import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

import { app, renderer, camera, scene, airTip } from "./scene_setup.js";
import { bubbles, poppedStack } from "./bubbles_factory.js";
import { spawnBurst } from "./particles_bursts.js";
import { airValueByGroup } from "./heatmap.js";
import { projectToScreen } from "./projection_overlay.js";
import { clamp } from "./utils.js";
import { view, updateCameraFrustum, resetView } from "./camera_view.js";
import { getCompaniesMode } from "./hud_controls.js";
import { setHoverBubble } from "./scene_setup.js";
import { freeMode, startEdgeDrag, updateEdgeDragHover, finishEdgeDrag, cancelEdgeDrag } from "./free_mode.js";
import { setEdgePreview, clearEdgePreview, rebuildGraph } from "./graph_edges.js";
import { removeAllEdgesForBubble } from "./free_mode.js";
import { removeEdge } from "./free_mode.js";
import { pickEdgeIdAt, setHoveredEdgeMetricId } from "./graph_edges.js";
import { t } from "./i18n.js";




const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const isCoarse = matchMedia("(pointer: coarse)").matches;

function setTipVisible(on) {
  airTip.style.display = on ? "block" : "none";
}

// ---------- Pop / remove ----------
export function popBubble(b) {
  if (!b || b.popping) return;

  b.inEl.classList.remove("expanded");

  b.popping = true;
  b.popT = 0;

  const pos = b.mesh.position.clone();
  const col = b.baseColor.clone();
  spawnBurst(pos, col, b.targetR);

  b.vx += (Math.random() - 0.5) * 0.4;
  b.vy += (Math.random() - 0.5) * 0.4;
}

export function removeBubbleAtIndex(idx) {
  const b = bubbles[idx];

  // 1) удалить все рёбра, связанные с этим пузырём (если он вообще участвует в графе)
  if (b.id != null) {
    removeAllEdgesForBubble(b.id);
    rebuildGraph();
  }

  // 2) сохранить снепшот для "Вернуть сектор"
  poppedStack.push({
    s: b.s,
    targetX: b.targetX,
    targetY: b.targetY,
    targetR: b.targetR,
    baseZ: b.baseZ,
    phase: b.phase,
    seed: b.seed,
    // НОВОЕ: отмечаем, в каком режиме сектор был удалён
    poppedInFreeMode: freeMode.on,
    // НОВОЕ: сохраняем дефолтную раскладку,
    // чтобы не потерять её при удалении/возврате в free-режиме
    defaultTargetX: b.defaultTargetX,
    defaultTargetY: b.defaultTargetY,
  });

  // 3) убрать из сцены и DOM + почистить материалы
  scene.remove(b.mesh);
  if (b.glow) scene.remove(b.glow);

  if (b.inEl && b.inEl.parentNode) b.inEl.parentNode.removeChild(b.inEl);

  // Отписываем слушателя языка для этого пузыря
  if (b.inEl?._i18nUnsubscribe) {
    b.inEl._i18nUnsubscribe();
  }

  if (b.mat) b.mat.dispose();
  if (b.flatMat) b.flatMat.dispose();
  if (b.glowMat) b.glowMat.dispose();

  // 4) удалить из массива bubbles
  bubbles.splice(idx, 1);
}


// ---------- Panning state ----------
let isPanning = false;
let lastPanX = 0;
let lastPanY = 0;

// Для различения "клика колёсиком" и панорамирования
let panButton = null; // 1 = средняя, 2 = правая, 0 c Alt+левая
let middleDownTime = 0;
let middleMoved = false;

// --- multitouch state (for mobile) ---
const touchPts = new Map(); // pointerId -> {x,y}
let pinchActive = false;
let pinchStartDist = 0;
let pinchStartZoom = 1;

// 1-finger pan state
let touchPanEnabled = false;
let touchPanStarted = false;

// tap / double-tap
let downX = 0, downY = 0;
let downTime = 0;
let moved = false;
const TAP_MOVE_PX = 10;
const TAP_TIME_MS = 320;

let lastTapTime = 0;
let lastTapX = 0;
let lastTapY = 0;
const DOUBLE_TAP_MS = 320;
const DOUBLE_TAP_PX = 18;

// desktop click candidate
let downBubble = null;
let downButton = 0;
let downOnUI = false;

// ---------- Free-mode drag / edge-draw state ----------
let freeDragActive = false;
let freeDragPending = false;

let freeDragBubble = null;
let freeDragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0); // z = const
let freeEdgePointerId = null; // чтобы понимать чей pointerup завершает протяжку


function distance(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y;
  return Math.sqrt(dx*dx + dy*dy);
}

function isUIAtPoint(clientX, clientY) {
  const el = document.elementFromPoint(clientX, clientY);
  if (!el) return false;

  // HUD и trials panel — всегда UI
  if (el.closest("#hudWrap") || el.closest("#trialsPanel")) return true;

  // Внутри карточки UI только "окно", а не заголовки/текст
  // (окном считаем companies и кнопку trials)
  if (el.closest(".companies") || el.closest(".trialLink") || el.closest('[data-role="trial-link"]')) return true;

  // Ссылки тоже UI
  if (el.closest("a")) return true;

  return false;
}


function baseHWorld() {
  return 12; // важно: должно совпадать с тем, что используешь в camera/frustum и pan-логике
}

function worldToPixelsScale(rect) {
  // px per 1 world unit по вертикали
  return (rect.height * view.zoom) / baseHWorld();
}

// Более точный hit-test по экранному радиусу шара
function pickBubbleByScreenDistance(clientX, clientY) {
  const rect = renderer.domElement.getBoundingClientRect();
  const pxPerWorld = worldToPixelsScale(rect);

  let best = null;
  let bestD2 = Infinity;

  for (const b of bubbles) {
    const p = projectToScreen(b.mesh.position.x, b.mesh.position.y, b.mesh.position.z);

    const cx = rect.left + p.x;
    const cy = rect.top  + p.y;

    const dx = clientX - cx;
    const dy = clientY - cy;

    // радиус в пикселях (слегка увеличим для удобства пальцем/мышью)
    const rPx = b.targetR * pxPerWorld * 1.12;
    const r2 = rPx * rPx;

    const d2 = dx*dx + dy*dy;
    if (d2 <= r2 && d2 < bestD2) {
      best = b;
      bestD2 = d2;
    }
  }
  return best;
}

function worldPointOnZPlane(clientX, clientY, zConst) {
  const rect = renderer.domElement.getBoundingClientRect();
  const x = ((clientX - rect.left) / rect.width) * 2 - 1;
  const y = -(((clientY - rect.top) / rect.height) * 2 - 1);

  ndc.set(x, y);
  raycaster.setFromCamera(ndc, camera);

  // плоскость z = zConst  =>  normal (0,0,1), constant = -z
  freeDragPlane.constant = -zConst;

  const out = new THREE.Vector3();
  raycaster.ray.intersectPlane(freeDragPlane, out);
  return out;
}


function raycastPick(clientX, clientY) {
  const rect = renderer.domElement.getBoundingClientRect();
  const x = ((clientX - rect.left) / rect.width) * 2 - 1;
  const y = -(((clientY - rect.top) / rect.height) * 2 - 1);

  ndc.set(x, y);
  raycaster.setFromCamera(ndc, camera);

  const meshes = bubbles.map(b => b.mesh);
  const hits = raycaster.intersectObjects(meshes, false);
  if (hits.length === 0) return null;

  const hitMesh = hits[0].object;
  return bubbles.find(bb => bb.mesh === hitMesh) || null;
}

// отключаем контекстное меню
renderer.domElement.addEventListener("contextmenu", (e) => e.preventDefault(), { passive: false });

// hover off
renderer.domElement.addEventListener("pointerleave", () => {
  setHoverBubble(null);
  setTipVisible(false);
}, { passive: true });

// hover move (desktop only)
renderer.domElement.addEventListener("pointermove", (e) => {

if (!isUIAtPoint(e.clientX, e.clientY)) {
   
  const hoveredEdgeId = pickEdgeIdAt(
      e.clientX,
      e.clientY,
      camera,
      renderer.domElement
    );
    setHoveredEdgeMetricId(hoveredEdgeId);
  } else {
    setHoveredEdgeMetricId(null);
  }

    if (freeMode.on) {
    setHoverBubble(null);
    setTipVisible(false);
    return;
  }

  if (isCoarse) return;
  if (isUIAtPoint(e.clientX, e.clientY)) {
    setHoverBubble(null);
    setTipVisible(false);
    return;
  }

  
  // 1) raycast
  let b = raycastPick(e.clientX, e.clientY);

  // 2) fallback screen-radius (чтобы попадало на краях круга)
  if (!b) b = pickBubbleByScreenDistance(e.clientX, e.clientY);

  if (!b) {
    setHoverBubble(null);
    setTipVisible(false);
    return;
  }

  setHoverBubble(b);

  const air = airValueByGroup(b.s.group);
  const airClamped = clamp((air ?? 0), -1, 1);

  const g = b.mesh;
  const p = projectToScreen(g.position.x, g.position.y, g.position.z);

  airTip.textContent = t("tooltip.air", { value: airClamped.toFixed(2) });
  airTip.style.left = `${p.x}px`;
  airTip.style.top  = `${p.y}px`;
  setTipVisible(true);
}, { passive: false });

// pointerdown
renderer.domElement.addEventListener("pointerdown", (e) => {
  downX = e.clientX;
  downY = e.clientY;
  downTime = performance.now();
  moved = false;
    // --- FREE MODE: удаление конкретного ребра кликом ---
    if (freeMode.edgeDeleteMode) {
      // если кликнули не по UI
      if (!isUIAtPoint(e.clientX, e.clientY)) {
        const edgeId = pickEdgeIdAt(e.clientX, e.clientY, camera, renderer.domElement);
        if (edgeId) {
          removeEdge(edgeId);
          rebuildGraph();
          e.preventDefault();
          return;
        }
      }
      // если не попали по ребру — ничего не делаем (и не тащим шары)
      e.preventDefault();
      return;
    }

    // MOBILE (touch)
  if (isCoarse && e.pointerType === "touch") {
    renderer.domElement.setPointerCapture?.(e.pointerId);
    touchPts.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // 2 пальца => pinch
    if (touchPts.size === 2) {
      const pts = Array.from(touchPts.values());

      pinchActive = true;
      pinchStartDist = distance(pts[0], pts[1]);
      pinchStartZoom = view.zoom;

      // во время pinch НИКАКОГО pan
      touchPanEnabled = false;
      touchPanStarted = false;
      isPanning = false;
      panButton = null;

      e.preventDefault();
      return;
    }

    // ----- ОДИН ПАЛЕЦ -----
    // Если свободный режим включён — сначала пытаемся работать с шарами
    if (freeMode.on) {
      // пробуем попасть в шар
      let b = raycastPick(e.clientX, e.clientY);
      if (!b) b = pickBubbleByScreenDistance(e.clientX, e.clientY);

      if (b) {
        // 1) построение графа — протяжка ребра
        if (freeMode.edgeDrawMode) {
          startEdgeDrag(b.id);
          freeEdgePointerId = e.pointerId;

          const wp = worldPointOnZPlane(
            e.clientX,
            e.clientY,
            b.mesh.position.z
          );
          setEdgePreview(wp);

          e.preventDefault();
          return;
        }

        // 2) режим "убрать сектор" или "информация на шарах: вкл" —
        // обрабатываем как TAP на pointerup (через downBubble)
        if (freeMode.deleteMode || freeMode.labelsEnabled) {
          downBubble = b;
          downButton = 0;
          e.preventDefault();
          return;
        }

        // 3) иначе — свободное перетаскивание шара (но с порогом по движению)
        freeDragPending = true;
        freeDragActive = false;
        freeDragBubble = b;

        freeDragPlane.constant = -b.mesh.position.z;

        b.vx = 0;
        b.vy = 0;

        e.preventDefault();
        return;

      }
      // если тап мимо шара — пойдём в pan (как в обычном режиме)
    }

    // Свободный режим выключен ИЛИ тап мимо шара — обычный pan
    pinchActive = false;
    touchPanEnabled = true;
    touchPanStarted = false;

    isPanning = true;
    panButton = 0;
    lastPanX = e.clientX;
    lastPanY = e.clientY;

    e.preventDefault();
    return;
  }


  // DESKTOP pan (middle/right/alt+left)
  if (e.button === 1 || e.button === 2 || e.altKey) {
    isPanning = true;
    panButton = e.button === 1 ? 1 : (e.button === 2 ? 2 : 0);
    lastPanX = e.clientX;
    lastPanY = e.clientY;

    if (panButton === 1) {
      middleDownTime = performance.now();
      middleMoved = false;
    }

    e.preventDefault();
    return;
  }

  // DESKTOP left
if (e.button === 0) {
  downOnUI = isUIAtPoint(e.clientX, e.clientY);
  if (downOnUI) {
    downBubble = null;
    return;
  }

  // pick bubble
  let b = raycastPick(e.clientX, e.clientY);
  if (!b) b = pickBubbleByScreenDistance(e.clientX, e.clientY);

  // --- FREE MODE: drag bubble OR edge-draw ---
    // --- FREE MODE: drag / edge-draw / info-click / delete-click ---
  if (freeMode.on) {
    if (!b) return;

    // 1) режим протяжки рёбер — как было
    if (freeMode.edgeDrawMode) {
      startEdgeDrag(b.id);
      freeEdgePointerId = e.pointerId;

      const wp = worldPointOnZPlane(e.clientX, e.clientY, b.mesh.position.z);
      setEdgePreview(wp);

      renderer.domElement.setPointerCapture?.(e.pointerId);
      e.preventDefault();
      return;
    }

    // 2) режим удаления сектора: клик по шару должен удалить его (без drag)
    if (freeMode.deleteMode) {
      downBubble = b;
      downButton = 0;
      return; // дальше не идём, drag не запускаем
    }

    // 3) если "Информация на шарах: ВКЛ" — обычный инфо-клик (без drag)
    if (freeMode.labelsEnabled) {
      downBubble = b;
      downButton = 0;
      return;
    }

    // 4) иначе — свободное перетаскивание
    downBubble = null;

    freeDragActive = true;
    freeDragBubble = b;

    freeDragPlane.constant = -b.mesh.position.z;

    b.vx = 0;
    b.vy = 0;

    renderer.domElement.setPointerCapture?.(e.pointerId);
    e.preventDefault();
    return;
  }



  // --- NORMAL MODE (как было) ---
  if (!b) {
    downBubble = null;
    return;
  }
  downBubble = b;
  downButton = 0;
}


}, { passive: false });

// pan move (window-level)
window.addEventListener("pointermove", (e) => {
    // ---------- FREE MODE: edge-draw preview / drag bubble ----------
  if (freeMode.on) {
    // если тянем ребро
    if (freeMode.edgeDrag.active) {
      // world point для превью берём по Z плоскости исходного шара
      const fromB = bubbles.find(bb => bb.id === freeMode.edgeDrag.fromBubbleId);
      const z = fromB ? fromB.mesh.position.z : 0;

      const wp = worldPointOnZPlane(e.clientX, e.clientY, z);
      setEdgePreview(wp);

      // hover bubble для "куда отпустим"
      if (!isUIAtPoint(e.clientX, e.clientY)) {
        let hb = raycastPick(e.clientX, e.clientY);
        if (!hb) hb = pickBubbleByScreenDistance(e.clientX, e.clientY);
        updateEdgeDragHover(hb ? hb.id : null);
      } else {
        updateEdgeDragHover(null);
      }

      e.preventDefault();
      return;
    }

    // если перетаскиваем шар
    if (freeDragActive && freeDragBubble) {
      const z = freeDragBubble.mesh.position.z;
      const wp = worldPointOnZPlane(e.clientX, e.clientY, z);

      freeDragBubble.mesh.position.x = wp.x;
      freeDragBubble.mesh.position.y = wp.y;

      // чтобы после выхода из free режима не "пружинило" обратно
      freeDragBubble.targetX = wp.x;
      freeDragBubble.targetY = wp.y;

      e.preventDefault();
      return;
    }
  }

  // MOBILE multitouch
  if (isCoarse && e.pointerType === "touch") {
    if (!touchPts.has(e.pointerId)) return;

    const prev = touchPts.get(e.pointerId);
    const next = { x: e.clientX, y: e.clientY };
    touchPts.set(e.pointerId, next);

    // moved threshold
    if (!moved) {
      const dx0 = e.clientX - downX;
      const dy0 = e.clientY - downY;
      if (dx0*dx0 + dy0*dy0 > TAP_MOVE_PX*TAP_MOVE_PX) moved = true;
    }

      // Если в free-режиме есть кандидат на drag шара — активируем его после порога
  if (freeMode.on && freeDragPending && !isPanning && touchPts.size === 1) {
    const dx0 = e.clientX - downX;
    const dy0 = e.clientY - downY;
    if (dx0*dx0 + dy0*dy0 > TAP_MOVE_PX*TAP_MOVE_PX) {
      freeDragPending = false;
      freeDragActive = true;
      // дальше позиция будет обновляться ниже, в блоке "если перетаскиваем шар"
    }
  }


    // pinch
    if (touchPts.size === 2) {
      const pts = Array.from(touchPts.values());
      const d = distance(pts[0], pts[1]);
      if (pinchActive && pinchStartDist > 0) {
        const k = d / pinchStartDist;
        view.zoom = clamp(pinchStartZoom * k, 0.1, 10);
        updateCameraFrustum();
      }
      e.preventDefault();
      return;
    }

    // 1-finger pan
    if (isPanning && touchPanEnabled) {
      // стартуем пан только после порога (иначе любой тап станет паном)
      if (!touchPanStarted) {
        const dx0 = e.clientX - downX;
        const dy0 = e.clientY - downY;
        if (dx0*dx0 + dy0*dy0 > TAP_MOVE_PX*TAP_MOVE_PX) {
          touchPanStarted = true;
          isPanning = true;
        } else {
          return; // ещё считаем тапом
        }
      }

      const dx = next.x - prev.x;
      const dy = next.y - prev.y;

      const w = app.clientWidth || 1;
      const h = app.clientHeight || 1;
      const aspect = w / h;

      const baseH = baseHWorld();
      const viewH = baseH / view.zoom;
      const viewW = viewH * aspect;

      const worldDX = -dx / w * viewW;
      const worldDY =  dy / h * viewH;

      view.cx += worldDX;
      view.cy += worldDY;

      updateCameraFrustum();
      e.preventDefault();
    }
    return;
  }

  // DESKTOP pan
  if (!isPanning) return;

  const dx = e.clientX - lastPanX;
  const dy = e.clientY - lastPanY;
  lastPanX = e.clientX;
  lastPanY = e.clientY;

  if (panButton === 1 && !middleMoved) {
    const dist2m = dx * dx + dy * dy;
    if (dist2m > 4 * 4) middleMoved = true;
  }

  if (panButton === 1 && !middleMoved) return;

  const w = app.clientWidth || 1;
  const h = app.clientHeight || 1;
  const aspect = w / h;

  const baseH = baseHWorld();
  const viewH = baseH / view.zoom;
  const viewW = viewH * aspect;

  const worldDX = -dx / w * viewW;
  const worldDY =  dy / h * viewH;

  view.cx += worldDX;
  view.cy += worldDY;

  updateCameraFrustum();
}, { passive: false });

// pointerup
window.addEventListener("pointerup", (e) => {
  // ---------- FREE MODE: finish drag / finish edge ----------
  let handledFree = false;

  if (freeMode.on) {
    // завершение протяжки ребра
    if (
      freeMode.edgeDrag.active &&
      (freeEdgePointerId === null || e.pointerId === freeEdgePointerId)
    ) {
      const toId = freeMode.edgeDrag.toHoverBubbleId;
      const created = finishEdgeDrag(toId);

      clearEdgePreview();
      freeEdgePointerId = null;

      if (created) rebuildGraph();

      handledFree = true;
    }

    // завершение перетаскивания шара
    if (freeDragActive) {
      freeDragActive = false;
      freeDragBubble = null;
      handledFree = true;
    }

    if (handledFree) {
      e.preventDefault();
      // ВАЖНО: НЕ делаем return здесь —
      // пусть ниже, если это touch, сработает блок MOBILE end
    }
  }

    // MOBILE end
  if (isCoarse && e.pointerType === "touch") {
    touchPts.delete(e.pointerId);

    if (touchPts.size < 2) pinchActive = false;

    const dt = performance.now() - downTime;

    // если это был TAP (не двигали / не панорамировали)
    if (!moved && dt < TAP_TIME_MS) {
      // если тап по UI — не обрабатываем сцену
      if (!isUIAtPoint(e.clientX, e.clientY)) {
        const now = performance.now();
        const dxTap = e.clientX - lastTapX;
        const dyTap = e.clientY - lastTapY;
        const closePos =
          (dxTap * dxTap + dyTap * dyTap) < (DOUBLE_TAP_PX * DOUBLE_TAP_PX);
        const isDouble =
          (now - lastTapTime) < DOUBLE_TAP_MS && closePos;

        // bubble pick: raycast или screen-radius
        let b = raycastPick(e.clientX, e.clientY);
        if (!b) b = pickBubbleByScreenDistance(e.clientX, e.clientY);

        if (!b) {
          // тап по фону
          if (isDouble) resetView();
        } else {
          // --- ТАП ПО ШАРУ ---
          if (freeMode.on) {
            // Свободный режим:
            if (freeMode.deleteMode) {
              // режим "Убрать сектор"
              popBubble(b);
            } else if (freeMode.labelsEnabled) {
              // инфо-режим в free-mode
              b.inEl.classList.toggle("expanded");
            } else {
              // labelsEnabled=false в free-mode:
              // ничего не делаем на TAP (только пан/зум через жесты)
            }
          } else {
            // Обычный режим: старая логика
            if (getCompaniesMode()) b.inEl.classList.toggle("expanded");
            else popBubble(b);
          }
        }

        lastTapTime = now;
        lastTapX = e.clientX;
        lastTapY = e.clientY;
      }
    }

    // reset pan states
    isPanning = false;
    panButton = null;
    touchPanEnabled = false;
    touchPanStarted = false;
    return;
  }


  // ---------- DESKTOP click / middle-reset и т.д. ----------
  if (!isCoarse && (e.button === 0 || e.button === undefined)) {
    if (!isPanning && downBubble && !downOnUI) {
      if (!isUIAtPoint(e.clientX, e.clientY)) {
        if (freeMode.on) {
          if (freeMode.deleteMode) {
            popBubble(downBubble);
          } else {
            downBubble.inEl.classList.toggle("expanded");
          }
        } else {
          const infoMode = getCompaniesMode();
          if (infoMode) downBubble.inEl.classList.toggle("expanded");
          else popBubble(downBubble);
        }
      }
    }

    downBubble = null;
    downOnUI = false;
  }

  // middle-reset как был
  if (panButton === 1 && e.button === 1) {
    const dtm = performance.now() - middleDownTime;
    const isFast = dtm < 250;
    if (!middleMoved && isFast) resetView();
  }

  isPanning = false;
  panButton = null;
  middleMoved = false;
}, { passive: false });


window.addEventListener("pointerleave", () => {
  isPanning = false;
  panButton = null;
  middleMoved = false;
  touchPanEnabled = false;
  touchPanStarted = false;
}, { passive: true });

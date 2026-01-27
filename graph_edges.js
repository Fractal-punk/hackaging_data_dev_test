// graph_edges.js
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

import { scene } from "./scene_setup.js";
import { airValueByGroup } from "./heatmap.js";
import { sectors, MAX_TRIALS } from "./metrics.js";
import { isStrictTheme } from "./theme.js";
import { bubbles } from "./bubbles_factory.js";
import { freeMode, getInfluence, hasAnyInfluence } from "./free_mode.js";
import { contrastColor, clamp } from "./utils.js";


// === Параллельные рёбра: вычисление смещений ===

// edge._parallelOffsetPx будет хранить смещение в условных "px" перпендикулярно ребру
function assignParallelOffsets(edges) {
  if (!edges || !edges.length) return;

  const groups = new Map(); // "aId__bId" -> [edges...]

  for (const e of edges) {
    const a = e.aId;
    const b = e.bId;
    if (a == null || b == null) continue;

    const key = a < b ? `${a}__${b}` : `${b}__${a}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(e);
  }

  const baseSpacingPx = 10;   // шаг между параллельными рёбрами
  const maxSpanPx     = 50;  // максимальная общая ширина веера

  for (const group of groups.values()) {
    const n = group.length;

    if (n === 1) {
      const e = group[0];
      e._parallelIndex = 0;
      e._parallelCount = 1;
      e._parallelOffsetPx = 0;
      continue;
    }

    // (n - 1) * spacing <= maxSpanPx
    const span   = Math.min((n - 1) * baseSpacingPx, maxSpanPx);
    const space  = span / (n - 1);

    for (let i = 0; i < n; i++) {
      // центрируем вокруг 0: [-..., -space, 0, +space, ...]
      const offsetPx = (i - (n - 1) / 2) * space;

      const e = group[i];
      e._parallelIndex    = i;
      e._parallelCount    = n;
      e._parallelOffsetPx = offsetPx;
    }
  }
}

let inited = false;
// --- Метки метрик на рёбрах (спрайты) ---

const metricSprites = new Map();      // edgeId -> THREE.Sprite
const metricTextureCache = new Map(); // metricName -> THREE.Texture
let hoveredEdgeId = null;             // для ховера по одному ребру
//
const graphRoot = new THREE.Group();
graphRoot.name = "graphEdges";

const edgeMeshes = new Map(); // edgeId -> THREE.Line
let previewLine = null;

const _v = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _pA = new THREE.Vector3();
const _pB = new THREE.Vector3();
const _ray = new THREE.Raycaster();
const _ndc = new THREE.Vector2();
let metricsInited = false;
let maxCapital = 1;
let maxAirAbs = 1;

// Палитра цветов для метрик (0..1)
const METRIC_TINTS = {
  trials:  new THREE.Color(0.20, 0.90, 1.00), // яркий циан
  capital: new THREE.Color(1.00, 0.30, 0.90), // маджента
  air:     new THREE.Color(0.50, 1.00, 0.40), // лайм/зеленоватый
};

// Веса метрик в режиме "All" (капитал чуть душим)
const METRIC_WEIGHTS = {
  trials:  0.40,
  air:     0.35,
  capital: 0.25,
};


function initMetricsBounds() {
  if (metricsInited) return;
  metricsInited = true;

  let mc = 0;
  let ma = 0;

  for (const s of sectors) {
    if (typeof s.capital === "number") {
      mc = Math.max(mc, s.capital);
    }
    if (s.group != null) {
      const air = airValueByGroup(s.group);
      if (typeof air === "number" && isFinite(air)) {
        ma = Math.max(ma, Math.abs(air));
      }
    }
  }

  maxCapital = mc || 1;
  maxAirAbs = ma || 1;
}


function initOnce() {
  if (inited) return;
  inited = true;
  initMetricsBounds();
  scene.add(graphRoot);
}


export function pickEdgeIdAt(clientX, clientY, camera, domElement) {
  if (!inited) return null;

  const rect = domElement.getBoundingClientRect();
  const x = ((clientX - rect.left) / rect.width) * 2 - 1;
  const y = -(((clientY - rect.top) / rect.height) * 2 - 1);

  _ndc.set(x, y);
  _ray.setFromCamera(_ndc, camera);

  // важно для тонких линий — иначе почти невозможно попасть
  _ray.params.Line = _ray.params.Line || {};
  _ray.params.Line.threshold = 0.12; // world units, можно 0.08..0.2 подобрать

  const lines = Array.from(edgeMeshes.values());
  if (lines.length === 0) return null;

  const hits = _ray.intersectObjects(lines, false);
  if (!hits || hits.length === 0) return null;

  const obj = hits[0].object;
  return obj?.userData?.edgeId || null;
}

export function setHoveredEdgeMetricId(edgeId) {
  hoveredEdgeId = edgeId || null;
}



function getBubbleById(id) {
  return bubbles.find(b => b.id === id);
}

function getBubbleMetricValue(metricId, b) {
  if (!b) return 0;

  switch (metricId) {
    case "trials":
      return typeof b.trials === "number" ? b.trials : (b.s?.trials ?? 0);

    case "capital":
      return typeof b.s?.capital === "number" ? b.s.capital : 0;

    case "air": {
      const g = b.s?.group;
      const v = g != null ? airValueByGroup(g) : 0;
      return (typeof v === "number" && isFinite(v)) ? v : 0;
    }

    default:
      return 0;
  }
}



function getEdgeMetricDiff01(edge) {
  const metric = edge.metric;
  if (!metric || metric === "None") return 0;

  const A = getBubbleById(edge.aId);
  const B = getBubbleById(edge.bId);
  if (!A || !B) return 0;

  const vA = getBubbleMetricValue(metric, A);
  const vB = getBubbleMetricValue(metric, B);

  let diff;
  let denom = 1;

  switch (metric) {
    case "trials":
      diff = Math.abs(vA - vB);
      denom = MAX_TRIALS || 1;
      break;

    case "capital":
      diff = Math.abs(vA - vB);
      denom = maxCapital || 1;
      break;

    case "air": {
      // особый случай: ||A| - |B||
      const absA = Math.abs(vA || 0);
      const absB = Math.abs(vB || 0);
      diff = Math.abs(absA - absB);     // то самое 0.4 в твоём примере
      denom = maxAirAbs || 1;
      break;
    }

    default:
      diff = Math.abs(vA - vB);
      denom = 1;
  }

  return clamp((diff || 0) / (denom || 1), 0, 1);
}


function getBubbleMetric01(metric, b) {
  const v = getBubbleById && getBubbleMetricValue ? getBubbleMetricValue(metric, b) : 0;

  switch (metric) {
    case "trials":
      return clamp((v || 0) / (MAX_TRIALS || 1), 0, 1);

    case "capital":
      return clamp((v || 0) / (maxCapital || 1), 0, 1);

    case "air": {
      // AIR: чем ближе к 0, тем СИЛЬНЕЕ сигнал (ярче)
      const av = Math.abs(v || 0);
      const denom = maxAirAbs || 1;
      if (!denom) return 0;

      const rel = av / denom;      // 0 у центра, 1 у худшего по модулю
      const closeness = 1 - rel;   // 1 у центра, 0 у края

      return clamp(closeness, 0, 1);
    }


    default:
      return 0;
  }
}


function getRadius(b) {
  // важно: у тебя scale = targetR * breathe * pulse
  // для "крепления к краю" берем targetR (стабильнее)
  return b.targetR ?? 1;
}

function endpointsOnSurface(edge, outA, outB, offsetPx = 0) {
  const A = getBubbleById(edge.aId);
  const B = getBubbleById(edge.bId);
  if (!A || !B) return false;
  if (!A.mesh || !B.mesh) return false;

  const posA = A.mesh.position;
  const posB = B.mesh.position;

  _dir.subVectors(posB, posA);
  const len = _dir.length();
  if (len < 1e-6) return false;
  _dir.multiplyScalar(1 / len);

  const rA = getRadius(A);
  const rB = getRadius(B);

  // Базовые точки на "поверхности" пузырей
  outA.copy(posA).addScaledVector(_dir, rA);
  outB.copy(posB).addScaledVector(_dir, -rB);

  // --- Параллельное смещение (веер) ---
  if (offsetPx !== 0) {
    // Коэффициент "px → мир". Можно потом подстроить под твой масштаб.
    const PARALLEL_OFFSET_SCALE = 0.01;
    const s = offsetPx * PARALLEL_OFFSET_SCALE;

    // Касательная в плоскости XY (перпендикуляр к направлению A→B)
    // tangent = ( -dy, dx ) в 2D
    _v.set(-_dir.y, _dir.x, 0);
    const tLen = _v.length();
    if (tLen > 1e-6) {
      _v.multiplyScalar(s / tLen);
      outA.add(_v);
      outB.add(_v);
    }
  }

  return true;
}


function createMetricTexture(metric, isStrictThemeNow) {
  const BASE_FONT_SIZE = 64;
  const FONT_FAMILY = "system-ui, -apple-system, Segoe UI, Roboto, Arial";
  const PADDING = 24;      // поля справа/слева
  const BASE_HEIGHT = 64;  // высота canvas в пикселях

  let label = metric;
  if (!label || label === "None") label = "нет";

  // --- Сначала замеряем ширину текста на временном canvas ---
  const measureCanvas = document.createElement("canvas");
  const mctx = measureCanvas.getContext("2d");
  if (!mctx) return null;

  mctx.font = `bold ${BASE_FONT_SIZE}px ${FONT_FAMILY}`;
  const textWidth = mctx.measureText(label).width;

  // Ширина = ширина текста + поля
  let width = Math.ceil(textWidth + PADDING);
  if (width < 32) width = 32;  // на всякий случай минимальный размер
  const height = BASE_HEIGHT;

  // --- Теперь создаём реальный canvas нужного размера ---
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.clearRect(0, 0, width, height);

  ctx.font = `bold ${BASE_FONT_SIZE}px ${FONT_FAMILY}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Цвет текста в зависимости от темы
  if (isStrictThemeNow) {
    ctx.fillStyle = "rgba(0,0,0,0.96)";
  } else {
    ctx.fillStyle = "rgba(255,255,255,0.96)";
  }

  ctx.fillText(label, width / 2, height / 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;

  return tex;
}

function getMetricTexture(metric) {
  // учитываем тему в ключе кэша, чтобы при смене темы
  // метки рисовались с правильным цветом
  const themeKey = isStrictTheme() ? "strict" : "normal";
  const key = `${metric}|${themeKey}`;

  if (metricTextureCache.has(key)) {
    return metricTextureCache.get(key);
  }

  const tex = createMetricTexture(metric, themeKey === "strict");
  if (tex) metricTextureCache.set(key, tex);
  return tex;
}

function ensureMetricSprite(edge) {
  let sprite = metricSprites.get(edge.id);
  const metric = edge.metric || "None";

  const tex = getMetricTexture(metric);
  if (!tex) return null;

  // Аспект текстуры (ширина/высота)
  let aspect = 1;
  if (tex.image && tex.image.width && tex.image.height) {
    aspect = tex.image.width / tex.image.height;
  }

  const BASE_LABEL_HEIGHT = 0.35; // высота лейбла в world units (подбери по вкусу)
  const sx = BASE_LABEL_HEIGHT * aspect;
  const sy = BASE_LABEL_HEIGHT;

  if (!sprite) {
    const mat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
    });
    sprite = new THREE.Sprite(mat);
    sprite.renderOrder = 2;

    sprite.scale.set(sx, sy, 1);
    metricSprites.set(edge.id, sprite);
    graphRoot.add(sprite);
  } else {
    // если тема/метрика поменялась -> новая текстура
    if (sprite.material && sprite.material.map !== tex) {
      sprite.material.map = tex;
      sprite.material.needsUpdate = true;
    }
    // и обязательно пересчитать scale (длина могла измениться)
    sprite.scale.set(sx, sy, 1);
  }

  return sprite;
}



function makeLineMaterial() {
  return new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  });
}

function setLineColors(line, c0, c1) {
  const attr = line.geometry.getAttribute("color");
  const a = attr.array;
  a[0] = c0.r; a[1] = c0.g; a[2] = c0.b;
  a[3] = c1.r; a[4] = c1.g; a[5] = c1.b;
  attr.needsUpdate = true;
}

function neonColor(t) {
  // t в [0,1]
  const c1 = new THREE.Color(0.0, 0.95, 0.8);  // бирюзовый
  const c2 = new THREE.Color(1.0, 0.3, 0.9);   // маджента
  return c1.lerp(c2, clamp(t, 0, 1));
}

// подсветка рёбер с учётом активной метрики
function colorsForEdge(edge) {
  const metric = edge.metric || "None";
  const active = freeMode.activeMetric || "None";

  const neutral = new THREE.Color(0.35, 0.35, 0.35);
  const dim     = new THREE.Color(0.25, 0.25, 0.25);

  // Ничего не подсвечиваем — просто серые рёбра
  if (active === "None") {
    return [neutral, neutral];
  }

  // Режим ALL: каждое ребро подсвечено своим цветом метрики
  if (active === "All") {
    if (metric === "None") {
      return [dim, dim];
    }

    const t = getEdgeMetricDiff01(edge); // 0..1
    const base = METRIC_TINTS[metric] || neonColor(1.0);

    const c = neutral.clone().lerp(base, t); // чем сильнее diff, тем ближе к цвету метрики
    return [c, c];
  }

  // Одиночная метрика: только выбранная — неоновая, остальные приглушённые
  if (metric !== active) {
    return [dim, dim];
  }

  const t = getEdgeMetricDiff01(edge); // 0..1
  const c = neonColor(t);
  return [c, c];
}



function createEdgeLine(edge) {
  if (!endpointsOnSurface(edge, _pA, _pB, edge._parallelOffsetPx || 0)) return null;

  const geom = new THREE.BufferGeometry();
  const pos = new Float32Array(6);
  pos[0] = _pA.x; pos[1] = _pA.y; pos[2] = _pA.z;
  pos[3] = _pB.x; pos[4] = _pB.y; pos[5] = _pB.z;
  geom.setAttribute("position", new THREE.BufferAttribute(pos, 3));

  const col = new Float32Array(6);
  geom.setAttribute("color", new THREE.BufferAttribute(col, 3));

  const mat = makeLineMaterial();
  const line = new THREE.Line(geom, mat);
  line.userData.edgeId = edge.id;

  const [c0, c1] = colorsForEdge(edge);
  setLineColors(line, c0, c1);
  return line;
}


export function rebuildGraph() {
  initOnce();

  // снести старое
  for (const line of edgeMeshes.values()) {
    graphRoot.remove(line);
    line.geometry.dispose();
    line.material.dispose();
  }
  edgeMeshes.clear();

    // Снести старые спрайты метрик
  for (const sprite of metricSprites.values()) {
    graphRoot.remove(sprite);
    if (sprite.material) sprite.material.dispose();
  }
  metricSprites.clear();

  // посчитать смещения для параллельных рёбер
  assignParallelOffsets(freeMode.edges);

  // собрать новое
  for (const edge of freeMode.edges) {
    const line = createEdgeLine(edge);
    if (!line) continue;
    edgeMeshes.set(edge.id, line);
    graphRoot.add(line);
  }
}


export function clearGraphAll() {
  initOnce();

  for (const line of edgeMeshes.values()) {
    graphRoot.remove(line);
    line.geometry.dispose();
    line.material.dispose();
  }
  edgeMeshes.clear();

  // чистим превью
  clearEdgePreview();

  // чистим спрайты метрик
  for (const sprite of metricSprites.values()) {
    graphRoot.remove(sprite);
    if (sprite.material) sprite.material.dispose();
  }
  metricSprites.clear();

  hoveredEdgeId = null;
}


export function updateGraphEdges() {
  initOnce();

  // поддерживаем соответствие на лету (если где-то добавили ребро без rebuild)
  if (edgeMeshes.size !== freeMode.edges.length) {
    rebuildGraph();
    return; // rebuildGraph сам всё только что обновил
  }

  // обновить смещения для параллельных рёбер (на случай смены метрики/даты и т.п.)
  assignParallelOffsets(freeMode.edges);

  // обновляем геометрию и цвета
  for (const [edgeId, line] of edgeMeshes.entries()) {
    const edge = freeMode.edgesById.get(edgeId);
    if (!edge) continue;

    if (!endpointsOnSurface(edge, _pA, _pB, edge._parallelOffsetPx || 0)) continue;

    const pos = line.geometry.getAttribute("position");
    const a = pos.array;
    a[0] = _pA.x; a[1] = _pA.y; a[2] = _pA.z;
    a[3] = _pB.x; a[4] = _pB.y; a[5] = _pB.z;
    pos.needsUpdate = true;

    const [c0, c1] = colorsForEdge(edge);
    setLineColors(line, c0, c1);

    // --- метки метрик ---

    const showLabel = freeMode.showEdgeMetrics || (edgeId === hoveredEdgeId);
    let sprite = metricSprites.get(edgeId);

    if (showLabel) {
      sprite = ensureMetricSprite(edge);
      if (sprite) {
        // позиционируем в середине ребра, чуть "над" ним по Z
        const midX = (_pA.x + _pB.x) * 0.5;
        const midY = (_pA.y + _pB.y) * 0.5;
        const midZ = (_pA.z + _pB.z) * 0.5 + 0.01;
        sprite.position.set(midX, midY, midZ);
        sprite.visible = true;
      }
    } else if (sprite) {
      sprite.visible = false;
    }

  }

  function setBubbleColor(b, col) {
  if (!b || !b.mesh) return;
  const mat = b.mesh.material;
  if (!mat) return;

  // Шейдерная версия (круглая тема)
  if (mat.uniforms && mat.uniforms.uBaseColor && mat.uniforms.uBaseColor.value) {
    mat.uniforms.uBaseColor.value.set(col.r, col.g, col.b);
    return;
  }

  // Обычный MeshBasicMaterial (строгая тема, квадраты)
  if ("color" in mat && mat.color && typeof mat.color.set === "function") {
    mat.color.set(col);
  }
}


  // превью, если надо
  updatePreviewLine();
  // превью, если надо
  updatePreviewLine();

  function applyBubbleMetricTint() {
    const metric = freeMode.activeMetric;

    // --- Нет активной метрики: вернуть базовые цвета всем ---
    if (!metric || metric === "None") {
      for (const b of bubbles) {
        const base = b.baseColor;
        if (!base) continue;
        setBubbleColor(b, base);
      }
      return;
    }

    // === вспомогательные множества: кто вообще в графе, и кто в какой метрике ===
    const metricsList = ["trials", "capital", "air"];

    const metricNodes = {
      trials:  new Set(),
      capital: new Set(),
      air:     new Set()
    };
    const anyNodes = new Set();

    for (const e of freeMode.edges) {
      const m = e.metric;
      if (!m || !metricNodes[m]) continue;

      metricNodes[m].add(e.aId);
      metricNodes[m].add(e.bId);

      anyNodes.add(e.aId);
      anyNodes.add(e.bId);
    }

        // ---------- РЕЖИМ ОДНОЙ МЕТРИКИ (trials / capital / air) ----------
  if (metric !== "All") {
    const tintBase = METRIC_TINTS[metric] || neonColor(1);
    const neutral  = new THREE.Color(0.15, 0.15, 0.15); // фон для "в графе, но без сигнала"

    const nodesWithMetric = metricNodes[metric] || new Set();

    for (const b of bubbles) {
      if (!b.id) continue;
      const base = b.baseColor;
      if (!base) continue;

      const hasMetric = nodesWithMetric.has(b.id);

      // пузырь не задействован в этой метрике → чистая теплокарта
      if (!hasMetric) {
        setBubbleColor(b, base);
        continue;
      }

      // сила метрики для этого пузыря: 0..1 (уже нормирована по max внутри getBubbleMetric01)
      let J = getBubbleMetric01(metric, b);

      if (J <= 0) {
        // в графе, но по этой метрике сам "тухлый"
        setBubbleColor(b, neutral);
        continue;
      }

      // лёгкая гамма, чтобы середина не слипалась с максимумом
      const Jgamma = Math.pow(J, 0.6); // J≈0.35 → ~0.47, J=1 → 1

      // цвет = линейный переход от тёмно-серого к яркому цвету метрики
      const col = neutral.clone().lerp(tintBase, Jgamma);

      setBubbleColor(b, col);
    }

    return;
  }



    // ---------- РЕЖИМ "All": смесь всех метрик ----------
    const perMetric = {};
    for (const m of metricsList) {
      perMetric[m] = { Jmap: new Map(), maxJ: 0 };
    }

    // 1) собираем J по каждой метрике отдельно, только для узлов, которые реально имеют рёбра этой метрики
    for (const b of bubbles) {
      if (!b.id) continue;

      for (const m of metricsList) {
        const nodes = metricNodes[m];
        if (!nodes || !nodes.has(b.id)) continue;

        const J = getBubbleMetric01(m, b); // 0..1
        const bucket = perMetric[m];
        bucket.Jmap.set(b.id, J);
        if (J > bucket.maxJ) bucket.maxJ = J;
      }
    }

      // 2) красим пузыри смесью цветов метрик
  for (const b of bubbles) {
    if (!b.id) continue;
    const base = b.baseColor;
    if (!base) continue;

    // нет ни одного ребра → теплокарта
    if (!hasAnyInfluence(b.id)) {
      setBubbleColor(b, base);
      continue;
    }

    let hasSignal  = false;
    let mixedColor = new THREE.Color(0, 0, 0);
    let colorWeight = 0;
    let maxLocal = 0; // максимальный нормированный J по метрикам для этого пузыря

    for (const m of metricsList) {
      const bucket = perMetric[m];
      const maxJ = bucket.maxJ || 0;
      if (maxJ <= 0) continue;

      let J = bucket.Jmap.get(b.id) || 0;
      if (maxJ > 0) J /= maxJ;
      J = clamp(J, 0, 1);
      if (J <= 0) continue;

      hasSignal = true;
      if (J > maxLocal) maxLocal = J;

      const tint  = METRIC_TINTS[m] || neonColor(1.0);
      const wBase = METRIC_WEIGHTS[m] ?? 1.0;
      const w     = wBase * J;

      mixedColor.r += tint.r * w;
      mixedColor.g += tint.g * w;
      mixedColor.b += tint.b * w;
      colorWeight  += w;
    }

    const neutral = new THREE.Color(0.15, 0.15, 0.15);

    if (!hasSignal || colorWeight <= 0 || maxLocal <= 0) {
      // в графе, но сигналов по метрикам почти нет
      setBubbleColor(b, neutral);
      continue;
    }

    // нормализуем смесь цветов
    mixedColor.multiplyScalar(1 / colorWeight);

    // насколько сильно вообще "горит" этот узел (максимум среди метрик)
    const strength = Math.pow(maxLocal, 0.7); // чуть растягиваем середину

    // финальный цвет: от нейтрального к смеси метрик
    const col = neutral.clone().lerp(mixedColor, strength);

    setBubbleColor(b, col);
   }

  }

  applyBubbleMetricTint();


}

// -------------------- preview line (для протяжки) --------------------

export function setEdgePreview(worldPoint) {
  initOnce();
  if (!freeMode.edgeDrag.active) return;

  const from = getBubbleById(freeMode.edgeDrag.fromBubbleId);
  if (!from) return;

  const posA = from.mesh.position;
  _dir.subVectors(worldPoint, posA);
  const len = _dir.length();
  if (len < 1e-6) return;
  _dir.multiplyScalar(1 / len);

  const rA = getRadius(from);
  _pA.copy(posA).addScaledVector(_dir, rA);
  _pB.copy(worldPoint);

  if (!previewLine) {
    const geom = new THREE.BufferGeometry();
    const pos = new Float32Array(6);
    geom.setAttribute("position", new THREE.BufferAttribute(pos, 3));

    const mat = new THREE.LineDashedMaterial({
      color: 0xffffff,
      dashSize: 0.18,
      gapSize: 0.12,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
    });

    previewLine = new THREE.Line(geom, mat);
    previewLine.computeLineDistances();
    graphRoot.add(previewLine);
  }

  const posAttr = previewLine.geometry.getAttribute("position");
  const a = posAttr.array;
  a[0] = _pA.x; a[1] = _pA.y; a[2] = _pA.z;
  a[3] = _pB.x; a[4] = _pB.y; a[5] = _pB.z;
  posAttr.needsUpdate = true;
  previewLine.computeLineDistances();
}

export function clearEdgePreview() {
  if (!previewLine) return;
  graphRoot.remove(previewLine);
  previewLine.geometry.dispose();
  previewLine.material.dispose();
  previewLine = null;
}

function updatePreviewLine() {
  if (!previewLine) return;
  if (!freeMode.edgeDrag.active) {
    clearEdgePreview();
  }
}


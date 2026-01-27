// free_mode.js
// Свободный режим + граф с параллельными рёбрами (каждое ребро отдельным объектом)

import { bubbles } from "./bubbles_factory.js";
import { createBubble } from "./bubbles_factory.js";
import { sectors } from "./metrics.js";


function uid() {
  // достаточно для клиента
  return "e_" + Math.random().toString(36).slice(2) + "_" + Date.now().toString(36);
}

function pairKey(aId, bId) {
  return (aId < bId) ? `${aId}|${bId}` : `${bId}|${aId}`;
}

export const freeMode = {
  on: false,

  // UI/поведение
  labelsEnabled: false,
  activeMetric: "None",

  hiddenSectors: new Set(),

  // новый флаг: в free-режиме левый клик по шару удаляет сектор
  deleteMode: false,

  edgeDeleteMode: false,

    // НОВОЕ: глобальный показ метрик на рёбрах
  showEdgeMetrics: false,

  // ---- протяжка ребра ----
  edgeDrawMode: false,
  edgeDrag: {
    active: false,
    fromBubbleId: null,
    toHoverBubbleId: null,
    metric: "None",
    w: 1,
  },

  // ---- рёбра ----
  edges: [],
  edgesById: new Map(),
  pairIndex: new Map(),
  bubbleIndex: new Map(),

  influences: new Map(),

  dragging: false,
  dragBubbleId: null,
};


export function setDeleteMode(on) {
  freeMode.deleteMode = !!on;
}


function ensureDefaultTargetsCaptured() {
  for (const b of bubbles) {
    if (b.defaultTargetX == null || b.defaultTargetY == null) {
      b.defaultTargetX = b.targetX;
      b.defaultTargetY = b.targetY;
    }
  }
}
export { ensureDefaultTargetsCaptured };

export function resetLayoutToDefault() {
  // гарантируем, что дефолтные таргеты один раз захвачены
  ensureDefaultTargetsCaptured();

  for (const b of bubbles) {
    if (b.defaultTargetX != null && b.defaultTargetY != null) {
      b.targetX = b.defaultTargetX;
      b.targetY = b.defaultTargetY;
    }

    b.mesh.position.x = b.targetX;
    b.mesh.position.y = b.targetY;

    b.vx = 0;
    b.vy = 0;
  }
}


// ------------------------
// базовые переключатели
// ------------------------
export function setFreeMode(on) {
  const newOn = !!on;
  if (newOn === freeMode.on) return;

  // переход из off -> on
  if (!freeMode.on && newOn) {
    // при входе в свободный режим один раз фиксируем дефолтную раскладку
    ensureDefaultTargetsCaptured();
  }

  freeMode.on = newOn;

  // сброс transient состояний
  freeMode.dragging = false;
  freeMode.dragBubbleId = null;

  freeMode.edgeDrag.active = false;
  freeMode.edgeDrag.fromBubbleId = null;
  freeMode.edgeDrag.toHoverBubbleId = null;
}


export function setLabelsEnabled(on) {
  freeMode.labelsEnabled = !!on;
}

export function setActiveMetric(metricName) {
  freeMode.activeMetric = metricName || "None";
}

// Режим протяжки рёбер (вкл/выкл)
export function setEdgeDrawMode(on) {
  freeMode.edgeDrawMode = !!on;
  if (!on) cancelEdgeDrag();
}

// Какую метрику ставим новыми рёбрами в режиме протяжки
export function setEdgeDragMetric(metricName) {
  // "All" и "None" не должны назначаться рёбрам
  if (!metricName || metricName === "None" || metricName === "All") {
    freeMode.edgeDrag.metric = "None";
  } else {
    freeMode.edgeDrag.metric = metricName;
  }
}


export function setEdgeDragWeight(w) {
  freeMode.edgeDrag.w = (typeof w === "number" && isFinite(w)) ? w : 1;
}

// ------------------------
// сектора hide/show
// ------------------------
export function hideSector(sectorId) { freeMode.hiddenSectors.add(sectorId); }
export function showSector(sectorId) { freeMode.hiddenSectors.delete(sectorId); }
export function isSectorHidden(sectorId) { return freeMode.hiddenSectors.has(sectorId); }

// ------------------------
// influences (stacking)
// ------------------------
function bumpInfluence(bubbleId, metricName, delta) {
  if (!metricName || metricName === "None") return;

  let mm = freeMode.influences.get(bubbleId);
  if (!mm) {
    mm = new Map();
    freeMode.influences.set(bubbleId, mm);
  }
  const prev = mm.get(metricName) || 0;
  const next = prev + delta;

  if (Math.abs(next) < 1e-12) mm.delete(metricName);
  else mm.set(metricName, next);

  if (mm.size === 0) freeMode.influences.delete(bubbleId);
}

export function getInfluence(bubbleId, metricName) {
  const mm = freeMode.influences.get(bubbleId);
  return mm ? (mm.get(metricName) || 0) : 0;
}

export function hasAnyInfluence(bubbleId) {
  return freeMode.influences.has(bubbleId);
}


// ------------------------
// рёбра: параллельные
// ------------------------
function indexAdd(map, key, id) {
  let s = map.get(key);
  if (!s) { s = new Set(); map.set(key, s); }
  s.add(id);
}

function indexDel(map, key, id) {
  const s = map.get(key);
  if (!s) return;
  s.delete(id);
  if (s.size === 0) map.delete(key);
}

export function addEdge(aId, bId, metricName, opts = {}) {
  if (!aId || !bId || aId === bId) return null;

  const id = uid();
  const A = (aId < bId) ? aId : bId;
  const B = (aId < bId) ? bId : aId;

  const e = {
    id,
    aId: A,
    bId: B,
    metric: metricName || "None",
    w: (typeof opts.w === "number" ? opts.w : 1),
    meta: opts.meta ?? null,
  };

  freeMode.edges.push(e);
  freeMode.edgesById.set(id, e);

  indexAdd(freeMode.pairIndex, pairKey(A, B), id);
  indexAdd(freeMode.bubbleIndex, A, id);
  indexAdd(freeMode.bubbleIndex, B, id);

  // влияния (складываются)
  bumpInfluence(A, e.metric, e.w);
  bumpInfluence(B, e.metric, e.w);

  return e;
}

export function removeEdge(edgeId) {
  const e = freeMode.edgesById.get(edgeId);
  if (!e) return false;

  // снять влияния
  bumpInfluence(e.aId, e.metric, -e.w);
  bumpInfluence(e.bId, e.metric, -e.w);

  // индексы
  indexDel(freeMode.pairIndex, pairKey(e.aId, e.bId), edgeId);
  indexDel(freeMode.bubbleIndex, e.aId, edgeId);
  indexDel(freeMode.bubbleIndex, e.bId, edgeId);

  freeMode.edgesById.delete(edgeId);

  // удалить из массива (ОК для небольшого количества)
  const i = freeMode.edges.findIndex(x => x.id === edgeId);
  if (i >= 0) freeMode.edges.splice(i, 1);

  return true;
}

export function listEdgesBetween(aId, bId) {
  const s = freeMode.pairIndex.get(pairKey(aId, bId));
  if (!s) return [];
  return Array.from(s).map(id => freeMode.edgesById.get(id)).filter(Boolean);
}

export function listEdgesForBubble(bubbleId) {
  const s = freeMode.bubbleIndex.get(bubbleId);
  if (!s) return [];
  return Array.from(s).map(id => freeMode.edgesById.get(id)).filter(Boolean);
}

export function removeAllEdgesForBubble(bubbleId) {
  const s = freeMode.bubbleIndex.get(bubbleId);
  if (!s) return;
  // копируем в массив, чтобы не ломать итерацию при removeEdge
  for (const edgeId of Array.from(s)) {
    removeEdge(edgeId);
  }
}



export function setEdgeDeleteMode(on) {
  freeMode.edgeDeleteMode = !!on;
}



export function clearAllEdges() {
  freeMode.edges.length = 0;
  freeMode.edgesById.clear();
  freeMode.pairIndex.clear();
  freeMode.bubbleIndex.clear();
  freeMode.influences.clear();
}

// ------------------------
// протяжка ребра (события будут дергать interaction_pointer.js)
// ------------------------
export function startEdgeDrag(fromBubbleId) {
  if (!freeMode.edgeDrawMode) return false;
  freeMode.edgeDrag.active = true;
  freeMode.edgeDrag.fromBubbleId = fromBubbleId;
  freeMode.edgeDrag.toHoverBubbleId = null;
  return true;
}

export function updateEdgeDragHover(toBubbleIdOrNull) {
  freeMode.edgeDrag.toHoverBubbleId = toBubbleIdOrNull;
}

export function cancelEdgeDrag() {
  freeMode.edgeDrag.active = false;
  freeMode.edgeDrag.fromBubbleId = null;
  freeMode.edgeDrag.toHoverBubbleId = null;
}

export function finishEdgeDrag(toBubbleId) {
  if (!freeMode.edgeDrag.active) return null;
  const from = freeMode.edgeDrag.fromBubbleId;

  const metric = freeMode.edgeDrag.metric || "None";
  const w = freeMode.edgeDrag.w ?? 1;

  cancelEdgeDrag();

  if (!from || !toBubbleId || from === toBubbleId) return null;

  // создаём отдельное ребро (параллельные разрешены)
  return addEdge(from, toBubbleId, metric, { w });
}

export function collectFreeConfig(bubbles) {
  const cfg = {
    version: 1,
    bubbles: [],
    edges: [],
  };

  for (const b of bubbles) {
    // считаем, что у сектора есть стабильный идентификатор s.id
    const sid = b.s?.id ?? b.s?.group ?? null;
    if (!sid) continue;

    cfg.bubbles.push({
      sectorId: sid,
      x: b.mesh.position.x,
      y: b.mesh.position.y,
      z: b.mesh.position.z,
      targetX: b.targetX,
      targetY: b.targetY,
      baseZ: b.baseZ,
    });
  }

  for (const e of freeMode.edges) {
    cfg.edges.push({
      aId: e.aId,
      bId: e.bId,
      metric: e.metric,
      w: e.w,
    });
  }

  return cfg;
}

export function applyFreeConfig(bubbles, cfg) {
  if (!cfg || typeof cfg !== "object") return;

  // сбрасываем текущие рёбра и влияния
  clearAllEdges();

  const bySectorId = new Map();
  for (const b of bubbles) {
    const sid = b.s?.id ?? b.s?.group ?? null;
    if (!sid) continue;
    bySectorId.set(sid, b);
  }

  const cfgBubbles = Array.isArray(cfg.bubbles) ? cfg.bubbles : [];

  // 1) Для всех записей в конфиге убедиться, что пузырь существует.
  for (const rec of cfgBubbles) {
    if (!rec || !rec.sectorId) continue;

    // уже есть такой сектор — пропускаем
    if (bySectorId.has(rec.sectorId)) continue;

    // ищем сектор по id / group
    const s = sectors.find(
      sec =>
        (sec.id != null && sec.id === rec.sectorId) ||
        (sec.id == null && sec.group === rec.sectorId) ||
        sec.group === rec.sectorId
    );
    if (!s) continue;

    // создаём новый пузырь по данным из конфига
    const preset = {
      targetX: rec.targetX ?? rec.x,
      targetY: rec.targetY ?? rec.y,
      baseZ:   rec.baseZ   ?? rec.z,
      // targetR / seed не сохранялись в конфиг, поэтому не задаём:
      // createBubble сам посчитает радиус из sharePct и даст случайный seed.
    };

    const nb = createBubble(s, preset);
    bubbles.push(nb);
    bySectorId.set(rec.sectorId, nb);
  }

  // 2) Теперь для ВСЕХ пузырей, присутствующих в конфиге, применяем координаты
  for (const rec of cfgBubbles) {
    const b = bySectorId.get(rec.sectorId);
    if (!b) continue;

    const x = rec.x ?? b.mesh.position.x;
    const y = rec.y ?? b.mesh.position.y;
    const z = rec.z ?? b.mesh.position.z;

    b.mesh.position.set(x, y, z);

    if (typeof rec.targetX === "number") b.targetX = rec.targetX;
    if (typeof rec.targetY === "number") b.targetY = rec.targetY;
    if (typeof rec.baseZ === "number")  b.baseZ   = rec.baseZ;
  }

  // 3) Восстанавливаем рёбра из конфига
  if (Array.isArray(cfg.edges)) {
    for (const e of cfg.edges) {
      addEdge(e.aId, e.bId, e.metric, { w: e.w });
    }
  }
}

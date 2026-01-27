// i18n.js
// Простейшая мультиязычность для HUD и подсказок

const SUPPORTED_LANGS = ["ru", "en", "zh"]; // zh как "китайский общий", если надо будет, можно split на zh-CN/zh-TW

let currentLang = detectInitialLang();

// Словарь фраз
// Ключи — короткие идентификаторы, не зависящие от языка.
// То, что уже есть в проекте, я обозначил в виде примеров.
const messages = {
  ru: {
    // Общие
    "lang.name": "Русский",
    "lang.english": "Английский",
    "lang.chinese": "Китайский",

    // HUD / режимы
    "hud.togglePanel.expand": "Развернуть панель",
    "hud.togglePanel.collapse": "Свернуть панель",

    "hud.freeMode.on": "Свободный режим: вкл",
    "hud.freeMode.off": "Свободный режим: выкл",

    "hud.labels.on": "Информация на шарах: вкл",
    "hud.labels.off": "Информация на шарах: выкл",

    "hud.edgeDraw.on": "Построение графа: вкл",
    "hud.edgeDraw.off": "Построение графа: выкл",

    "hud.hideSector.on": "Убрать сектор: вкл",
    "hud.hideSector.off": "Убрать сектор: выкл",

    "hud.deleteEdge.on": "Удаление связи: вкл",
    "hud.deleteEdge.off": "Удаление связи: выкл",

    "hud.showEdgeMetric.on": "Показывать метрику: вкл",
    "hud.showEdgeMetric.off": "Показывать метрику: выкл",

    "hud.detailsMode.on": "Отображение подробностей: вкл",
    "hud.detailsMode.off": "Отображение подробностей: выкл",

    "hud.undoSector": "Вернуть сектор",
    "hud.clearEdges": "Удалить все связи",
    "hud.saveLayout": "Сохранить шаблон",
    "hud.loadLayout": "Загрузить шаблон",
    "hud.exitFreeMode": "Выйти из свободного режима",
    "hud.theme": "Тема",

    // Подсказки в нормальном режиме
    "hud.hint.color": "Цвет = AIR (Air to Investment Ratio)",
    "hud.hint.size": "Размер = капитал",
    "hud.hint.percent": "% = доля сектора в суммарном капитале",
    "hud.info.modeInfo": "Режим информации — клик по шару раскрывает/сворачивает список компаний.",
    "hud.info.modeHide": "Режим скрытия — клик удаляет сектор.",
    "hud.info.undo": "\"Вернуть сектор\" восстанавливает последний убранный сектор.",
    "hud.hint.freeMode": "Свободный режим: физика выключена, можно двигать шары и строить граф.",

    // Y-axis label
    "yaxis.title": "Доля сектора",
    "hud.freeMetricLabel": "Метрика графа",
    "hud.saveConfigLabel": "Сохранить конфигурацию",
    "hud.loadConfigLabel": "Загрузить конфигурацию",

    // Метрики
    "metric.none": "None",
    "metric.trials": "Триалы",
    "metric.capital": "Инвестиции",
    "metric.air": "AIR",
    "metric.all": "All",

    // Сообщения об ошибках и уведомления
    "error.loadConfig": "Не удалось загрузить конфигурацию (см. консоль).",
    "log.loadConfigError": "Ошибка загрузки конфигурации:",

    // Подсказка AIR
    "tooltip.air": "AIR = {value}",

    // Внутри шара
    "bubble.trials": "Trials",
    "bubble.trials.hint": "Клик — список клинических исследований",
    "bubble.companies.title": "Companies ({count})",
    "bubble.noCompanies": "(нет списка компаний)",
    "bubble.articles": "Articles: {count}",
    "bubble.articlesPerM": "Articles / $M: {value}",

    // Trials panel (если нужно будет)
    "trials.title": "Клинические исследования",
    "trials.search.placeholder": "Поиск по исследованиям...",
    "trials.status.loading": "Загружаем данные о клинических исследованиях...",
    "trials.status.empty": "Для этого сектора исследований в базе пока нет.",
    "trials.status.notFound": "Исследований в базе не найдено.",
    "trials.status.noMatch": "По запросу ничего не найдено.",
    "trials.status.count": "{filtered} из {all} исследований",
    "trials.status.total": "{count} исследований в базе",
    "trials.error.load": "Не удалось загрузить clinical_trials.csv.",
    "trials.meta.nct": "NCT",
    "trials.meta.phase": "phase",
    "trials.meta.statusNA": "status n/a",
    "trials.meta.conditions": "Conditions",
  },

  en: {
    "lang.name": "English",
    "lang.english": "English",
    "lang.chinese": "Chinese",

    "hud.togglePanel.expand": "Expand panel",
    "hud.togglePanel.collapse": "Collapse panel",

    "hud.freeMode.on": "Free mode: on",
    "hud.freeMode.off": "Free mode: off",

    "hud.labels.on": "Bubble info: on",
    "hud.labels.off": "Bubble info: off",

    "hud.edgeDraw.on": "Graph drawing: on",
    "hud.edgeDraw.off": "Graph drawing: off",

    "hud.hideSector.on": "Hide sector: on",
    "hud.hideSector.off": "Hide sector: off",

    "hud.deleteEdge.on": "Delete link: on",
    "hud.deleteEdge.off": "Delete link: off",

    "hud.showEdgeMetric.on": "Show metric: on",
    "hud.showEdgeMetric.off": "Show metric: off",

    "hud.detailsMode.on": "Details display: on",
    "hud.detailsMode.off": "Details display: off",

    "hud.undoSector": "Restore sector",
    "hud.clearEdges": "Clear all links",
    "hud.saveLayout": "Save layout",
    "hud.loadLayout": "Load layout",
    "hud.exitFreeMode": "Exit free mode",
    "hud.theme": "Theme",

    // Tips in normal mode
    "hud.hint.color": "Color = AIR (Air to Investment Ratio)",
    "hud.hint.size": "Size = capital",
    "hud.hint.percent": "% = sector share of total capital",
    "hud.info.modeInfo": "Info mode — click bubble to expand/collapse company list.",
    "hud.info.modeHide": "Hide mode — click to remove sector.",
    "hud.info.undo": "\"Restore sector\" restores the last removed sector.",
    "hud.hint.freeMode": "Free mode: physics disabled, drag bubbles and build graphs.",

    // Y-axis label
    "yaxis.title": "Capital share (Y)",
    "hud.freeMetricLabel": "Graph metric",
    "hud.saveConfigLabel": "Save configuration",
    "hud.loadConfigLabel": "Load configuration",

    // Metrics
    "metric.none": "None",
    "metric.trials": "Trials",
    "metric.capital": "Capital",
    "metric.air": "AIR",
    "metric.all": "All",

    // Error messages
    "error.loadConfig": "Failed to load configuration (see console).",
    "log.loadConfigError": "Configuration loading error:",

    "tooltip.air": "AIR = {value}",

    "bubble.trials": "Trials",
    "bubble.trials.hint": "Click — list of clinical trials",
    "bubble.companies.title": "Companies ({count})",
    "bubble.noCompanies": "(no company list)",
    "bubble.articles": "Articles: {count}",
    "bubble.articlesPerM": "Articles / $M: {value}",

    "trials.title": "Clinical trials",
    "trials.search.placeholder": "Search trials...",
    "trials.status.loading": "Loading clinical trials data...",
    "trials.status.empty": "No trials found for this sector.",
    "trials.status.notFound": "No trials in database.",
    "trials.status.noMatch": "No results for your search.",
    "trials.status.count": "{filtered} of {all} trials",
    "trials.status.total": "{count} trials in database",
    "trials.error.load": "Failed to load clinical_trials.csv.",
    "trials.meta.nct": "NCT",
    "trials.meta.phase": "phase",
    "trials.meta.statusNA": "status n/a",
    "trials.meta.conditions": "Conditions",
  },

  zh: {
    "lang.name": "中文",
    "lang.english": "英语",
    "lang.chinese": "中文",

    "hud.togglePanel.expand": "展开面板",
    "hud.togglePanel.collapse": "收起面板",

    "hud.freeMode.on": "自由模式：开",
    "hud.freeMode.off": "自由模式：关",

    "hud.labels.on": "气泡信息：开",
    "hud.labels.off": "气泡信息：关",

    "hud.edgeDraw.on": "绘制图：开",
    "hud.edgeDraw.off": "绘制图：关",

    "hud.hideSector.on": "隐藏扇区：开",
    "hud.hideSector.off": "隐藏扇区：关",

    "hud.deleteEdge.on": "删除连接：开",
    "hud.deleteEdge.off": "删除连接：关",

    "hud.showEdgeMetric.on": "显示指标：开",
    "hud.showEdgeMetric.off": "显示指标：关",

    "hud.detailsMode.on": "显示详细信息：开",
    "hud.detailsMode.off": "显示详细信息：关",

    "hud.undoSector": "恢复扇区",
    "hud.clearEdges": "清除所有连接",
    "hud.saveLayout": "保存布局",
    "hud.loadLayout": "加载布局",
    "hud.exitFreeMode": "退出自由模式",
    "hud.theme": "主题",

    // 提示文本
    "hud.hint.color": "颜色 = AIR（空气投资比）",
    "hud.hint.size": "大小 = 资本",
    "hud.hint.percent": "% = 扇区在总资本中的占比",
    "hud.info.modeInfo": "信息模式 — 点击气泡展开/折叠公司列表。",
    "hud.info.modeHide": "隐藏模式 — 点击移除扇区。",
    "hud.info.undo": "\"恢复扇区\" 恢复最后移除的扇区。",
    "hud.hint.freeMode": "自由模式：物理禁用，可以拖动气泡和构建图表。",

    // Y-axis label
    "yaxis.title": "资本占比 (Y)",
    "hud.freeMetricLabel": "图表度量",
    "hud.saveConfigLabel": "保存配置",
    "hud.loadConfigLabel": "加载配置",

    // 指标
    "metric.none": "None",
    "metric.trials": "试验",
    "metric.capital": "资本",
    "metric.air": "AIR",
    "metric.all": "All",

    // Error messages
    "error.loadConfig": "无法加载配置（查看控制台）。",
    "log.loadConfigError": "配置加载错误:",

    "tooltip.air": "AIR = {value}",

    "bubble.trials": "试验",
    "bubble.trials.hint": "点击 — 查看临床试验列表",
    "bubble.companies.title": "公司 ({count})",
    "bubble.noCompanies": "（没有公司列表）",
    "bubble.articles": "文章: {count}",
    "bubble.articlesPerM": "文章 / 百万美金: {value}",

    "trials.title": "临床试验",
    "trials.search.placeholder": "搜索试验…",
    "trials.status.loading": "加载临床试验数据中…",
    "trials.status.empty": "该扇区未找到试验。",
    "trials.status.notFound": "数据库中没有试验。",
    "trials.status.noMatch": "搜索无结果。",
    "trials.status.count": "{filtered} 个（共 {all} 个）试验",
    "trials.status.total": "数据库中有 {count} 个试验",
    "trials.error.load": "无法加载 clinical_trials.csv。",
    "trials.meta.nct": "NCT",
    "trials.meta.phase": "phase",
    "trials.meta.statusNA": "status n/a",
    "trials.meta.conditions": "病情",
  },
};

// ---------------------
// API
// ---------------------

export function getLang() {
  return currentLang;
}

export function setLang(lang) {
  const norm = normalizeLang(lang);
  if (norm === currentLang) return;

  currentLang = norm;

  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem("invair_lang", currentLang);
    }
  } catch (e) {
    // ignore
  }

  // нотифицируем слушателей
  for (const cb of langChangeListeners) {
    try {
      cb(currentLang);
    } catch (e) {
      console.error("i18n langChange listener error:", e);
    }
  }
}

// Простая функция перевода с плейсхолдерами
// t("tooltip.air", { value: air.toFixed(2) })
export function t(key, params) {
  const langTable = messages[currentLang] || messages["ru"] || {};
  let s = langTable[key];

  if (typeof s !== "string") {
    // fallback: английский, потом ключ
    s = (messages["en"] && messages["en"][key]) || key;
  }

  if (!params) return s;

  return s.replace(/\{(\w+)}/g, (match, name) => {
    if (Object.prototype.hasOwnProperty.call(params, name)) {
      return String(params[name]);
    }
    return match;
  });
}

// Для UI, чтобы подписаться на смену языка и обновить надписи
const langChangeListeners = new Set();

export function onLangChange(cb) {
  if (typeof cb === "function") {
    langChangeListeners.add(cb);
  }
  return () => langChangeListeners.delete(cb);
}

// ---------------------
// Вспомогательные
// ---------------------

function detectInitialLang() {
  // 1) localStorage
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const saved = window.localStorage.getItem("invair_lang");
      if (saved && SUPPORTED_LANGS.includes(saved)) {
        return saved;
      }
    }
  } catch (e) {
    // ignore
  }

  // 2) navigator.language
  if (typeof navigator !== "undefined" && navigator.language) {
    const nav = navigator.language.toLowerCase();
    if (nav.startsWith("ru")) return "ru";
    if (nav.startsWith("en")) return "en";
    if (nav.startsWith("zh") || nav.startsWith("cn")) return "zh";
  }

  // 3) дефолт
  return "ru";
}

function normalizeLang(lang) {
  if (!lang) return currentLang;
  const lc = String(lang).toLowerCase();

  if (SUPPORTED_LANGS.includes(lc)) return lc;
  if (lc.startsWith("ru")) return "ru";
  if (lc.startsWith("en")) return "en";
  if (lc.startsWith("zh") || lc.startsWith("cn")) return "zh";

  return currentLang;
}

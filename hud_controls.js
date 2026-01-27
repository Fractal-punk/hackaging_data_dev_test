import { bubbles, poppedStack, createBubble } from "./bubbles_factory.js";
import { resolve2DOverlaps } from "./anchors_and_targets.js";
import { applyTheme, toggleTheme, isStrictTheme } from "./theme.js";
import {
  freeMode,
  setFreeMode,
  resetLayoutToDefault,
  clearAllEdges,
  collectFreeConfig,
  applyFreeConfig,
  ensureDefaultTargetsCaptured,
  setDeleteMode,          // ← добавили
  setActiveMetric,
  setEdgeDragMetric,
  setEdgeDeleteMode
} from "./free_mode.js";
import { rebuildGraph } from "./graph_edges.js";

import { clearGraphAll } from "./graph_edges.js";
import { resetView } from "./camera_view.js";
import { t, onLangChange, getLang, setLang } from "./i18n.js";

// ЕДИНЫЙ режим для всех: pointer + overlay-click
let companiesMode = true;
export function getCompaniesMode() { return companiesMode; }
export function setCompaniesMode(v) { companiesMode = !!v; }

const isCoarse = matchMedia("(pointer: coarse)").matches;
let hudCollapsed = isCoarse;


function applyHudState(hud, btnToggleHud) {
  hud.classList.toggle("collapsed", hudCollapsed);
  btnToggleHud.textContent = hudCollapsed ? "≡" : "—";
  btnToggleHud.setAttribute(
    "aria-label",
    hudCollapsed ? t("hud.togglePanel.expand") : t("hud.togglePanel.collapse")
  );
}

function applyCompaniesModeUI(btnToggleCompanies) {
  const key = companiesMode ? "hud.detailsMode.on" : "hud.detailsMode.off";
  btnToggleCompanies.textContent = t(key);
}

function restoreLastPopped() {
  if (poppedStack.length === 0) return;

  const snap = poppedStack.pop();

  // Если сектор был убран в свободном режиме, а сейчас свободный режим ВЫКЛЮЧЕН,
  // игнорируем сохранённые free-mode координаты и даём layout-у расставить шар.
  let preset = snap;
  if (snap.poppedInFreeMode && !freeMode.on) {
    preset = {
      // createBubble всё равно получает s отдельным параметром,
      // так что здесь достаточно передать только то, что хотим сохранить.
      targetR: snap.targetR,
      seed: snap.seed,
      // targetX/targetY НЕ задаём — они возьмутся из anchors/layout
      // baseZ тоже возьмётся из anchors
    };
  }

  const restored = createBubble(snap.s, preset);

  restored.vx = 0;
  restored.vy = 0;

  bubbles.push(restored);
  resolve2DOverlaps(bubbles, 2);

  applyTheme();

  if (!companiesMode) restored.inEl?.classList.remove("expanded");
}


function applyLabelsInteractivity() {
  const labels = document.getElementById("labels");
  if (!labels) return;

  // если labelsEnabled = false => блокируем UI лейблов
  labels.classList.toggle("freeNoUI", freeMode.on && !freeMode.labelsEnabled);
}



// SVG иконки больше не используются - иконки добавлены через CSS background-image в style.css

export function initHudControls() {
  const btnToggleFreeMode = document.getElementById("toggleFreeMode");
  const hudFree = document.getElementById("hudFree");

  const btnExitFreeMode = document.getElementById("exitFreeMode");
  const btnToggleFreeLabels = document.getElementById("toggleFreeLabels");
  const btnToggleEdgeDraw = document.getElementById("toggleEdgeDraw");

  const btnToggleTheme2 = document.getElementById("toggleTheme2"); // если оставил вторую кнопку
  const freeMetricSelect = document.getElementById("freeMetricSelect");
  const btnFreeHideMode = document.getElementById("freeHideSector");
  const btnFreeUndoPop  = document.getElementById("freeRestoreSector");
  const btnSaveFreeConfig = document.getElementById("saveFreeConfig");
  const btnLoadFreeConfig = document.getElementById("loadFreeConfig");
  const btnFreeClearEdges = document.getElementById("freeClearEdges");
  const btnFreeDeleteEdge = document.getElementById("freeDeleteEdge");
  const btnFreeShowEdgeMetrics = document.getElementById("freeShowEdgeMetrics");


function applyEdgeDeleteUI() {
  if (!btnFreeDeleteEdge) return;
  const key = freeMode.edgeDeleteMode ? "hud.deleteEdge.on" : "hud.deleteEdge.off";
  btnFreeDeleteEdge.textContent = t(key);
}

  if (freeMetricSelect) {
    // стартовое значение
    freeMetricSelect.value = freeMode.activeMetric || "None";

    freeMetricSelect.addEventListener("change", () => {
      const val = freeMetricSelect.value || "None";
      setActiveMetric(val);
      setEdgeDragMetric(val);   // новыми рёбрами сразу ставим выбранную метрику
      rebuildGraph();           // чтобы цвета/трибы сразу пересчитались
    });
  }


if (btnFreeDeleteEdge) {
  applyEdgeDeleteUI();
  btnFreeDeleteEdge.addEventListener("click", () => {
    // выключаем конфликтующие режимы
    freeMode.edgeDrawMode = false;

    freeMode.edgeDeleteMode = !freeMode.edgeDeleteMode;
    applyEdgeDeleteUI();
  });
}

  function applyShowEdgeMetricsUI() {
    if (!btnFreeShowEdgeMetrics) return;
    const key = freeMode.showEdgeMetrics ? "hud.showEdgeMetric.on" : "hud.showEdgeMetric.off";
    btnFreeShowEdgeMetrics.textContent = t(key);
  }

    if (btnFreeShowEdgeMetrics) {
    applyShowEdgeMetricsUI();
    btnFreeShowEdgeMetrics.addEventListener("click", () => {
      freeMode.showEdgeMetrics = !freeMode.showEdgeMetrics;
      applyShowEdgeMetricsUI();
      // updateGraphEdges и так крутится, отдельно дёргать не обязательно
    });
  }

    // --- Удалить все рёбра ---
  if (btnFreeClearEdges) {
    btnFreeClearEdges.addEventListener("click", () => {
      clearAllEdges();  // чистим структуру в free_mode
      rebuildGraph();   // обновляем визуализацию линий
    });
  }


    // --- SAVE CONFIG ---
  if (btnSaveFreeConfig) {
    btnSaveFreeConfig.addEventListener("click", () => {
      const cfg = collectFreeConfig(bubbles);
      const json = JSON.stringify(cfg, null, 2);

      const blob = new Blob([json], { type: "text/plain" });

      // Опционально: можно прикрутить дату или хэш в имя файла
      const now = new Date();
      const stamp = now.toISOString().slice(0, 19).replace(/[:T]/g, "-");
      const filename = `air_free_config_${stamp}.txt`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });
  }

  // --- LOAD CONFIG ---
  if (btnLoadFreeConfig) {
    btnLoadFreeConfig.addEventListener("click", () => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".txt,.json";

      input.addEventListener("change", () => {
        const file = input.files && input.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = () => {
          try {
            const text = String(reader.result || "");
            const cfg = JSON.parse(text);

            applyFreeConfig(bubbles, cfg);

            // Шаблон стал новой "истиной":
            // убираем старые попнутые сектора и скрытия
            poppedStack.length = 0;
            freeMode.hiddenSectors.clear();

            rebuildGraph(); // обновляем визуализацию рёбер
          } catch (err) {
            console.error(t("log.loadConfigError"), err);
            alert(t("error.loadConfig"));
          }
        };

        reader.readAsText(file);
      });

      input.click();
    });
  }



    function applyFreeHideModeUI() {
    if (!btnFreeHideMode) return;
    const key = freeMode.deleteMode ? "hud.hideSector.on" : "hud.hideSector.off";
    btnFreeHideMode.textContent = t(key);
  }



  function exitFreeModeAndResetScreen() {
    // 1) сброс расположения шаров к дефолту
    resetLayoutToDefault();

    // 2) очистка всех рёбер в данных
    clearAllEdges();

    // 3) очистка линий графа из сцены
    clearGraphAll();

    // 4) сброс скрытых секторов
    freeMode.hiddenSectors.clear();

    // 5) сброс камеры
    resetView();

    // 6) собственно выключаем режим
    setFreeMode(false);

    // 7) обновляем UI и интерактивность лейблов
    applyHudModeUI();
    applyFreeModeUI();
    applyLabelsInteractivity();
  }


    function applyHudModeUI() {
    if (!hudNormal || !hudFree) return;
    hudNormal.style.display = freeMode.on ? "none" : "block";
    hudFree.style.display = freeMode.on ? "block" : "none";
  }

  function applyFreeLabelsUI() {
    if (!btnToggleFreeLabels) return;
    const key = freeMode.labelsEnabled ? "hud.labels.on" : "hud.labels.off";
    btnToggleFreeLabels.textContent = t(key);
  }

  function applyEdgeDrawUI() {
    if (!btnToggleEdgeDraw) return;
    const key = freeMode.edgeDrawMode ? "hud.edgeDraw.on" : "hud.edgeDraw.off";
    btnToggleEdgeDraw.textContent = t(key);
  }

    // уже есть toggleFreeMode — дополним
  if (btnToggleFreeMode) {
  applyFreeModeUI();
  btnToggleFreeMode.addEventListener("click", () => {
    const willOn = !freeMode.on;

    if (willOn) {
      // входим в свободный режим: просто переключаем флаг и UI
      setFreeMode(true);
      applyHudModeUI();
      applyFreeModeUI();
      applyLabelsInteractivity();
    } else {
      // выходим из свободного режима: полный сброс вида
      exitFreeModeAndResetScreen();
    }
  });
}

  // --- Убрать сектор (режим удаления) ---
  if (btnFreeHideMode) {
    applyFreeHideModeUI();
    btnFreeHideMode.addEventListener("click", () => {
      setDeleteMode(!freeMode.deleteMode);
      applyFreeHideModeUI();
    });
  }

  // --- Вернуть сектор (тот же стек poppedStack, что и в обычном HUD) ---
  if (btnFreeUndoPop) {
    btnFreeUndoPop.addEventListener("click", restoreLastPopped);
  }


  if (btnExitFreeMode) {
  btnExitFreeMode.addEventListener("click", () => {
    exitFreeModeAndResetScreen();
  });
 }


  if (btnToggleFreeLabels) {
    applyFreeLabelsUI();
    btnToggleFreeLabels.addEventListener("click", () => {
      freeMode.labelsEnabled = !freeMode.labelsEnabled;
      // важно: реально включить/выключить pointer-events у labels (см. ниже)
      applyFreeLabelsUI();
      applyLabelsInteractivity();
    });
  }

  if (btnToggleEdgeDraw) {
    applyEdgeDrawUI();
    btnToggleEdgeDraw.addEventListener("click", () => {
      freeMode.edgeDrawMode = !freeMode.edgeDrawMode;
      applyEdgeDrawUI();
    });
  }

  if (btnToggleTheme2) btnToggleTheme2.addEventListener("click", () => toggleTheme());

  function applyFreeModeUI() {
    if (!btnToggleFreeMode) return;
    const key = freeMode.on ? "hud.freeMode.on" : "hud.freeMode.off";
    btnToggleFreeMode.textContent = t(key);
  }

  const hud = document.getElementById("hud");
  const btnToggleHud = document.getElementById("toggleHud");
  const btnToggleCompanies = document.getElementById("toggleCompanies");
  const btnToggleTheme = document.getElementById("toggleTheme");
  const btnUndoPop = document.getElementById("undoPop");

  if (btnUndoPop) {
    btnUndoPop.addEventListener("click", restoreLastPopped);
  }

  if (hud && btnToggleHud) {
    btnToggleHud.addEventListener("click", () => {
      hudCollapsed = !hudCollapsed;
      applyHudState(hud, btnToggleHud);
    });
    applyHudState(hud, btnToggleHud);
  }

  if (btnToggleCompanies) {
    applyCompaniesModeUI(btnToggleCompanies);

    btnToggleCompanies.addEventListener("click", () => {
      companiesMode = !companiesMode;
      applyCompaniesModeUI(btnToggleCompanies);

      if (!companiesMode) {
        for (const b of bubbles) b.inEl?.classList.remove("expanded");
      }
    });
  }

  if (btnToggleTheme) {
    btnToggleTheme.addEventListener("click", () => toggleTheme());
  }


  applyHudModeUI();
  applyFreeLabelsUI();
  applyEdgeDrawUI();
  applyLabelsInteractivity();
  applyFreeHideModeUI();
  applyEdgeDeleteUI();
  setupCustomMetricSelect();
  applyShowEdgeMetricsUI();

  // Инициализация языкового селектора
  initLangSelector();

  // Слушатель для обновления UI при смене языка
  onLangChange(() => {
    applyHudState(hud, btnToggleHud);
    applyCompaniesModeUI(btnToggleCompanies);
    applyFreeModeUI();
    applyFreeLabelsUI();
    applyEdgeDrawUI();
    applyFreeHideModeUI();
    applyEdgeDeleteUI();
    applyShowEdgeMetricsUI();
    
    // Обновляем опции метрик в кастомном селекте
    const freeMetricSelect = document.getElementById("freeMetricSelect");
    if (freeMetricSelect) {
      const metricLabels = {
        "None": t("metric.none"),
        "trials": t("metric.trials"),
        "capital": t("metric.capital"),
        "air": t("metric.air"),
        "All": t("metric.all")
      };
      
      // Обновляем текст в нативном select
      Array.from(freeMetricSelect.options).forEach(opt => {
        if (metricLabels[opt.value]) {
          opt.textContent = metricLabels[opt.value];
        }
      });
      
      // Обновляем видимые кнопки в кастомном меню
      document.querySelectorAll(".hudSelectOption").forEach(optBtn => {
        const value = optBtn.dataset.value;
        if (metricLabels[value]) {
          optBtn.textContent = metricLabels[value];
        }
      });
      
      // Обновляем текст на кнопке
      const selectedOpt = freeMetricSelect.selectedOptions[0];
      const labelSpan = document.querySelector(".hudSelectLabel");
      if (labelSpan && selectedOpt) {
        labelSpan.textContent = selectedOpt.textContent;
      }
    }
    
    // Обновляем placeholder для trials search
    const trialsSearch = document.getElementById("trialsSearch");
    if (trialsSearch) {
      trialsSearch.placeholder = t("trials.search.placeholder");
    }
  });



  // тема при старте — один раз
  applyTheme();
}

export function initLangSelector() {
  const langSelector = document.getElementById("langSelector");
  const langBtn = document.getElementById("langBtn");
  const langMenu = document.getElementById("langMenu");
  const langOptions = document.querySelectorAll(".langOption");

  if (!langBtn || !langMenu) return;

  // Функция для обновления всех элементов с data-i18n
  const updateAllI18nElements = () => {
    document.querySelectorAll("[data-i18n]").forEach(el => {
      const key = el.dataset.i18n;
      el.textContent = t(key);
    });
    
    // Обновляем aria-label для кнопки toggle
    const toggleBtn = document.getElementById("toggleHud");
    if (toggleBtn) {
      toggleBtn.setAttribute("aria-label", 
        hudCollapsed ? t("hud.togglePanel.expand") : t("hud.togglePanel.collapse")
      );
    }
  };

  // Обновляем текст кнопки в соответствии с текущим языком
  const updateLangBtn = () => {
    const currentLang = getLang();
    const langMap = {
      ru: "RU",
      en: "EN",
      zh: "中文"
    };
    langBtn.textContent = langMap[currentLang] || currentLang.toUpperCase();
  };

  // Обновляем активный класс
  const updateLangOptions = () => {
    const currentLang = getLang();
    langOptions.forEach(opt => {
      if (opt.dataset.lang === currentLang) {
        opt.classList.add("active");
      } else {
        opt.classList.remove("active");
      }
    });
  };

  updateLangBtn();
  updateLangOptions();
  updateAllI18nElements();

  // Клик по кнопке — открыть/закрыть меню
  langBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    langSelector.classList.toggle("open");
  });

  // Выбор языка
  langOptions.forEach(opt => {
  opt.addEventListener("click", (e) => {
    e.stopPropagation();
    const selectedLang = opt.dataset.lang;
    setLang(selectedLang);      // всё остальное сделают onLangChange-слушатели
    langSelector.classList.remove("open");
    });
  });

  // Закрытие меню при клике вне
  document.addEventListener("click", (e) => {
    if (!langSelector.contains(e.target)) {
      langSelector.classList.remove("open");
    }
  });

  // Обновляем активный класс и все элементы при смене языка через i18n
  onLangChange(() => {
    updateLangBtn();
    updateLangOptions();
    updateAllI18nElements();
  });
}

export function setupCustomMetricSelect() {
  const native = document.getElementById("freeMetricSelect");
  if (!native) return;

  // Переводим опции select для всех языков
  const metricLabels = {
    "None": t("metric.none"),
    "trials": t("metric.trials"),
    "capital": t("metric.capital"),
    "air": t("metric.air"),
    "All": t("metric.all")
  };

  // Обновляем текст в нативном select
  Array.from(native.options).forEach(opt => {
    if (metricLabels[opt.value]) {
      opt.textContent = metricLabels[opt.value];
    }
  });

  // помечаем как "нативный" и прячем через CSS
  native.classList.add("hudSelectNative");

  // создаём обёртку
  const wrap = document.createElement("div");
  wrap.className = "hudSelectWrap";

  // кнопка-заменитель
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "hudSelectFake";

  const labelSpan = document.createElement("span");
  labelSpan.className = "hudSelectLabel";
  labelSpan.textContent =
    native.selectedOptions[0]?.textContent ?? native.value ?? "Metric";

  const arrowSpan = document.createElement("span");
  arrowSpan.className = "hudSelectArrow";
  arrowSpan.textContent = "▾";

  btn.appendChild(labelSpan);
  btn.appendChild(arrowSpan);

  // меню
  const menu = document.createElement("div");
  menu.className = "hudSelectMenu";

  Array.from(native.options).forEach(opt => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "hudSelectOption";
    item.textContent = opt.textContent;
    item.dataset.value = opt.value;

    if (opt.selected) {
      item.dataset.selected = "true";
    }

    item.addEventListener("click", () => {
      // обновляем нативный select
      native.value = opt.value;
      labelSpan.textContent = opt.textContent;

      // закрываем меню
      wrap.classList.remove("open");

      // прокидываем change, чтобы уже существующая логика сработала
      const ev = new Event("change", { bubbles: true });
      native.dispatchEvent(ev);
    });

    menu.appendChild(item);
  });

  // Вставляем всё в DOM над нативным select
  native.parentNode.insertBefore(wrap, native);
  wrap.appendChild(native);  // нативный внутри, но невидимый
  wrap.appendChild(btn);
  wrap.appendChild(menu);

  // Открыть/закрыть по клику
    // Открыть/закрыть по клику + автоскролл HUD вниз при открытии
  btn.addEventListener("click", () => {
    const willOpen = !wrap.classList.contains("open");
    wrap.classList.toggle("open");

    if (willOpen) {
      const hudBody = document.getElementById("hudBody");
      if (!hudBody) return;

      // форсим лэйаут, чтобы размеры были актуальны
      const menuRect = menu.getBoundingClientRect();
      const bodyRect = hudBody.getBoundingClientRect();

      let delta = 0;

      // если низ меню вылезает ниже видимой области hudBody — скроллим вниз
      if (menuRect.bottom > bodyRect.bottom) {
        delta = menuRect.bottom - bodyRect.bottom + 8; // небольшой запас
      }

      // (опционально) если верх меню выше hudBody — скроллим вверх
      else if (menuRect.top < bodyRect.top) {
        delta = menuRect.top - bodyRect.top - 8;
      }

      if (delta !== 0) {
        hudBody.scrollTop += delta;
      }
    }
  });


  // Клик вне — закрыть
  document.addEventListener("click", (e) => {
    if (!wrap.contains(e.target)) {
      wrap.classList.remove("open");
    }
  });
}


import { sectors } from "./metrics.js";
import { ensureTrialsLoaded, getTrialsDataByGroup, isTrialsLoaded } from "./trials_loader.js";

import { labelsRoot } from "./scene_setup.js";
import { bubbles } from "./bubbles_factory.js";
import { t, onLangChange } from "./i18n.js";

// Trials panel elements
const trialsPanel  = document.getElementById("trialsPanel");
const trialsTitle  = document.getElementById("trialsTitle");
const trialsList   = document.getElementById("trialsList");
const trialsSearch = document.getElementById("trialsSearch");
const trialsStatus = document.getElementById("trialsStatus");
const trialsClose  = document.getElementById("trialsClose");

// --- Ghost-tap guard (mobile) ---
let panelArmed = true; // можно ли взаимодействовать с панелью прямо сейчас

function disarmPanelBriefly(ms = 120) {
  if (!trialsPanel) return;

  panelArmed = false;
  trialsPanel.style.pointerEvents = "none";

  // включаем обратно после микропаузЫ
  window.setTimeout(() => {
    panelArmed = true;
    trialsPanel.style.pointerEvents = "auto";
  }, ms);
}


export function closeTrialsPanel() {
  if (!trialsPanel) return;
  trialsPanel.style.display = "none";
  trialsPanel.removeAttribute("data-group");
}

function renderTrialsListForGroup(group, query) {
  if (!trialsList) return;

  const data = getTrialsDataByGroup();
  const all = (data && data[group]) || [];
  const q = (query || "").trim().toLowerCase();

  let filtered = all;
  if (q) {
    filtered = all.filter(t => {
      const title = (t.title || "").toLowerCase();
      const cond  = (t.conditions || "").toLowerCase();
      const nct   = (t.nct_id || "").toLowerCase();
      return title.includes(q) || cond.includes(q) || nct.includes(q);
    });
  }

  trialsList.innerHTML = "";

  if (filtered.length === 0) {
    trialsStatus.textContent = q
      ? t("trials.status.noMatch")
      : t("trials.status.notFound");
    return;
  }

  trialsStatus.textContent = q
    ? t("trials.status.count", { filtered: filtered.length, all: all.length })
    : t("trials.status.total", { count: all.length });

  for (const trial of filtered) {
    const div = document.createElement("div");
    div.className = "trialItem";

    const nct = trial.nct_id || "";
    const url = nct
      ? `https://clinicaltrials.gov/study/${encodeURIComponent(nct)}`
      : null;

    const phase = trial.phase ? `${t("trials.meta.phase")}: ${trial.phase}` : "";
    const conditions = trial.conditions 
      ? `<div class="trialConditions">${t("trials.meta.conditions")}: ${trial.conditions}</div>`
      : "";
    const summary = trial.brief_summary
      ? `<div class="trialSummary">${trial.brief_summary}</div>`
      : "";

    const metaParts = [];
    if (nct) metaParts.push(`${t("trials.meta.nct")}: ${nct}`);
    metaParts.push(trial.status || t("trials.meta.statusNA"));
    if (phase) metaParts.push(phase);

    div.innerHTML = `
      <div class="trialTitle">
        ${
          url
            ? `<a href="${url}" target="_blank" rel="noopener noreferrer">${trial.title || "(без названия)"}</a>`
            : (trial.title || "(без названия)")
        }
      </div>
      <div class="trialMetaLine">${metaParts.join(" • ")}</div>
      ${conditions}
      ${summary}
    `;

    trialsList.appendChild(div);
  }
}

export function openTrialsPanelForGroup(group) {
  if (!trialsPanel) return;

  trialsPanel.dataset.group = group;

  const sec = sectors.find(s => s.group === group);
  trialsTitle.textContent = sec ? `${t("trials.title")} — ${sec.name}` : `${t("trials.title")} — ${group}`;

  if (trialsSearch) trialsSearch.value = "";
  if (trialsStatus) trialsStatus.textContent = t("trials.status.loading");
  if (trialsList) trialsList.innerHTML = "";
  trialsPanel.style.display = "flex";
  // Важно: чтобы "тот же самый" pointerup не нажал по панели сразу после появления
  disarmPanelBriefly(140);


  ensureTrialsLoaded()
    .then(() => {
      const data = getTrialsDataByGroup();
      const arr = (data && data[group]) || [];

      if (!arr.length) {
        trialsStatus.textContent = t("trials.status.empty");
        trialsList.innerHTML = "";
        return;
      }

      renderTrialsListForGroup(group, "");

      setTimeout(() => {
        try { trialsSearch?.focus(); } catch (e) {}
      }, 10);
    })
    .catch(() => {
      trialsStatus.textContent = t("trials.error.load");
      trialsList.innerHTML = "";
    });
}

// Закрытие trials panel — ТОЛЬКО по X
if (trialsClose) {
  trialsClose.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    closeTrialsPanel();
  });
}

// Если панель только что появилась — гасим любые pointer/click события внутри неё
if (trialsPanel) {
  const swallowIfDisarmed = (e) => {
    if (!panelArmed) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation?.();
      return false;
    }
  };

  // На мобилке чаще всего прилетает pointerup/click
  trialsPanel.addEventListener("pointerdown", swallowIfDisarmed, { passive: false });
  trialsPanel.addEventListener("pointerup", swallowIfDisarmed, { passive: false });
  trialsPanel.addEventListener("click", swallowIfDisarmed, { passive: false });
}


// Поиск
if (trialsSearch) {
  trialsSearch.addEventListener("input", () => {
    const group = trialsPanel?.dataset.group;
    if (!group || !isTrialsLoaded()) return;
    renderTrialsListForGroup(group, trialsSearch.value);
  });
}

// Обновляем placeholder поиска при смене языка
onLangChange(() => {
  if (trialsSearch) {
    trialsSearch.placeholder = t("trials.search.placeholder");
  }
});

/**
 * Overlay interaction rules:
 * - Header (cap/ret/name/meta) is NOT interactive via CSS pointer-events:none
 * - Companies window (.companies) toggles expanded on click/tap
 * - Trials button (.trialLink[data-role="trial-link"]) opens trials panel
 */
function handleOverlayAction(clientX, clientY) {
  const el = document.elementFromPoint(clientX, clientY);
  if (!el) return;

  // Не вмешиваемся, если клик был по HUD или trialsPanel
  if (el.closest("#hudWrap") || el.closest("#trialsPanel")) return;

  // 1) Trials button
  const link = el.closest('[data-role="trial-link"]');
  if (link) {
    // гасим событие, чтобы не улетало в canvas
    // (само событие гасим в listener-ах ниже)
    const card = link.closest(".inball");
    if (!card) return;

    if (!card.classList.contains("expanded")) {
      card.classList.add("expanded"); // первый клик только раскрывает
      return;
    }

    const group = link.dataset.group;
    if (!group) return;
    openTrialsPanelForGroup(group);
    return;
  }

  // 2) Companies window toggles expanded
  const companiesBox = el.closest(".companies");
  if (companiesBox) {
    const card = companiesBox.closest(".inball");
    if (!card) return;

    // Если клик по ссылке внутри компаний — не закрываем карточку
    if (el.closest("a")) return;

    card.classList.toggle("expanded");
    return;
  }

  // Всё остальное игнорируем (заголовок не интерактивен)
}

const coarse = matchMedia("(pointer: coarse)").matches;

if (labelsRoot) {
  if (coarse) {
    labelsRoot.addEventListener("pointerup", (e) => {
      if (e.pointerType !== "touch") return;

      // Если было по интерактиву — гасим, чтобы не пошло в canvas
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (!el) return;
      const isOverlayInteractive =
        el.closest('[data-role="trial-link"]') || el.closest(".companies");

      if (!isOverlayInteractive) return;

      e.preventDefault();
      e.stopPropagation();

      handleOverlayAction(e.clientX, e.clientY);
    }, { passive: false });
  } else {
    labelsRoot.addEventListener("click", (e) => {
      const t = e.target;

      // Обрабатываем только интерактивные элементы overlay
      const isOverlayInteractive =
        t.closest('[data-role="trial-link"]') || t.closest(".companies");

      if (!isOverlayInteractive) return;

      e.preventDefault();
      e.stopPropagation();

      handleOverlayAction(e.clientX, e.clientY);
    });
  }
}

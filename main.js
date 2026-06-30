// Orchestration: load static data -> poll games -> build bracket -> render.

import { loadStatic, fetchGames } from "./js/api.js";
import { buildBracket } from "./js/bracket.js";
import { renderBracket, renderLegend } from "./js/render.js";
import { initInteraction, refreshDetail, hideDetail } from "./js/interact.js";
import { createLive } from "./js/live.js";
import { t, setLang, getLang, onLangChange } from "./js/i18n.js";

const svg = document.getElementById("bracket");
const legendEl = document.getElementById("legend");
const detailEl = document.getElementById("detail");
const overlay = document.getElementById("overlay");
const overlayMsg = document.getElementById("overlayMsg");
const overlaySpinner = document.getElementById("overlaySpinner");
const overlayRetry = document.getElementById("overlayRetry");
const liveDot = document.getElementById("liveDot");
const updatedAt = document.getElementById("updatedAt");

const stateData = {
  staticData: null, // { teamsById, stadiumsById }
  games: [],
  bracket: null,
  loaded: false,
  lastAgeMs: null,
};

const ctx = () => ({
  teamsById: stateData.staticData?.teamsById ?? new Map(),
  stadiumsById: stateData.staticData?.stadiumsById ?? new Map(),
  bracket: stateData.bracket,
});

initInteraction(svg, detailEl, ctx);

const live = createLive({
  fetchFn: fetchGames,
  intervalMs: 30000,
  onUpdate: handleGames,
  onError: handleError,
  onAge: (ms) => {
    stateData.lastAgeMs = ms;
    updateAgeLabel();
  },
});

// ---------- data handling ----------

function handleGames(games) {
  stateData.games = games;
  stateData.bracket = buildBracket(games);
  if (!stateData.bracket) {
    handleError(new Error("No final match in data"));
    return;
  }
  stateData.loaded = true;
  hideOverlay();
  render();
  updateLiveDot();
  refreshDetail(); // keep an open popover in sync with fresh data
}

function handleError(err) {
  console.error("[worldcup]", err);
  if (!stateData.loaded) {
    showOverlay(t("errorLoad"), /*retry*/ true);
  }
  liveDot.dataset.state = "error";
}

// ---------- rendering ----------

function render() {
  renderBracket(svg, stateData.bracket, ctx());
  renderLegend(legendEl);
}

function updateLiveDot() {
  const anyLive = stateData.games.some(
    (g) => g.type !== "group" && g.status === "live"
  );
  liveDot.dataset.state = anyLive ? "live" : "ok";
}

function updateAgeLabel() {
  if (!stateData.loaded) {
    updatedAt.textContent = t("loading");
    return;
  }
  const ms = stateData.lastAgeMs ?? 0;
  const s = Math.floor(ms / 1000);
  if (s < 5) updatedAt.textContent = t("updatedJustNow");
  else if (s < 60) updatedAt.textContent = t("updatedSecondsAgo", s);
  else updatedAt.textContent = t("updatedMinutesAgo", Math.floor(s / 60));
}

// ---------- i18n wiring ----------

function applyI18n() {
  document.documentElement.lang = getLang();
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    if (el === updatedAt) return; // managed by age logic
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-title]").forEach((el) => {
    el.title = t(el.dataset.i18nTitle);
  });
  document.querySelectorAll(".lang-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.lang === getLang());
  });
  updateAgeLabel();
}

onLangChange(() => {
  applyI18n();
  if (stateData.bracket) render();
  refreshDetail();
});

document.querySelectorAll(".lang-btn").forEach((btn) => {
  btn.addEventListener("click", () => setLang(btn.dataset.lang));
});

document.getElementById("refreshBtn").addEventListener("click", () => live.refreshNow());
overlayRetry.addEventListener("click", () => {
  showOverlay(t("loading"), false);
  init();
});

// ---------- overlay ----------

function showOverlay(msg, retry) {
  overlayMsg.textContent = msg;
  overlaySpinner.hidden = retry;
  overlayRetry.hidden = !retry;
  overlay.hidden = false;
}
function hideOverlay() {
  overlay.hidden = true;
}

// ---------- boot ----------

async function init() {
  showOverlay(t("loading"), false);
  try {
    stateData.staticData = await loadStatic();
    live.start(); // first poll happens immediately
  } catch (err) {
    handleError(err);
  }
}

applyI18n();
init();

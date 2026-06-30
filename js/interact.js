// Match-detail popover + node selection. Uses event delegation on the SVG.

import { t, roundLabel } from "./i18n.js";

let state = null; // { svg, detailEl, getContext, selectedId }

export function initInteraction(svg, detailEl, getContext) {
  state = { svg, detailEl, getContext, selectedId: null };

  svg.addEventListener("click", (e) => {
    const group = e.target.closest(".node-group");
    if (!group) {
      hideDetail();
      return;
    }
    const id = parseInt(group.getAttribute("data-match-id"), 10);
    if (Number.isNaN(id)) return;
    if (state.selectedId === id) hideDetail();
    else showDetail(id);
  });

  detailEl.addEventListener("click", (e) => {
    if (e.target.closest(".d-close")) hideDetail();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hideDetail();
  });
}

export function showDetail(matchId) {
  if (!state) return;
  const ctx = state.getContext();
  const node = ctx.bracket.matchNodes.find((n) => n.id === matchId);
  if (!node) return;
  state.selectedId = matchId;
  state.detailEl.innerHTML = buildDetailHTML(node, ctx);
  state.detailEl.hidden = false;
}

export function hideDetail() {
  if (!state) return;
  state.selectedId = null;
  state.detailEl.hidden = true;
  state.detailEl.innerHTML = "";
}

// re-render the open panel after a data/lang refresh (keeps it in sync)
export function refreshDetail() {
  if (state && state.selectedId != null) showDetail(state.selectedId);
}

function buildDetailHTML(node, ctx) {
  const { teamsById, stadiumsById } = ctx;
  const g = node.game;

  const home = sideInfo(node, "home", teamsById);
  const away = sideInfo(node, "away", teamsById);
  const showScore = g.status !== "notstarted";

  const statusCls = g.status === "live" ? "live" : "";
  const statusTxt =
    g.status === "live"
      ? g.liveMinute != null
        ? `${t("live")} · ${g.liveMinute}'`
        : t("live")
      : t(g.status);

  const teamRow = (s, isWinner) => `
    <div class="d-team ${isWinner ? "winner" : ""}">
      ${s.flag ? `<img src="${esc(s.flag)}" alt="" />` : `<span style="width:26px"></span>`}
      <span class="d-name ${s.isPlaceholder ? "placeholder" : ""}">${esc(s.name)}</span>
      ${showScore ? `<span class="d-score">${s.score}</span>` : ""}
      ${showScore && s.pen != null ? `<span class="d-pen">(${s.pen})</span>` : ""}
    </div>`;

  const scorers = buildScorers(node, home, away);
  const pens = buildPenalties(node, home, away);
  const stadium = g.stadiumId ? stadiumsById.get(g.stadiumId) : null;
  const meta = [];
  if (g.localDate) meta.push(`<div><strong>${esc(t("date"))}:</strong> ${esc(g.localDate)}</div>`);
  if (stadium)
    meta.push(
      `<div><strong>${esc(t("stadium"))}:</strong> ${esc(stadium.nameEn)}, ${esc(stadium.cityEn)}</div>`
    );

  return `
    <button class="d-close" aria-label="Close">×</button>
    <div class="d-round">${esc(roundLabel(node.round))}</div>
    <div class="d-status ${statusCls}">${esc(statusTxt)}</div>
    <div class="d-teams">
      ${teamRow(home, node.winnerSide === "home")}
      ${teamRow(away, node.winnerSide === "away")}
    </div>
    ${scorers}
    ${pens}
    ${meta.length ? `<div class="d-meta">${meta.join("")}</div>` : ""}
  `;
}

function sideInfo(node, side, teamsById) {
  const g = node.game;
  const teamId = side === "home" ? node.homeTeamId : node.awayTeamId;
  const label = side === "home" ? g.homeLabel : g.awayLabel;
  const team = teamId ? teamsById.get(teamId) : null;
  return {
    teamId,
    team,
    flag: team ? team.flag : null,
    name: team ? team.nameEn : label || t("toBeDecided"),
    isPlaceholder: !team,
    score: side === "home" ? g.homeScore ?? 0 : g.awayScore ?? 0,
    pen: side === "home" ? g.homePen : g.awayPen,
  };
}

function buildScorers(node, home, away) {
  const g = node.game;
  const items = [
    ...g.homeScorers.map((s) => ({ ...s, flag: home.flag })),
    ...g.awayScorers.map((s) => ({ ...s, flag: away.flag })),
  ];
  if (!items.length) return "";
  items.sort((a, b) => minNum(a.minute) - minNum(b.minute));
  const lis = items
    .map(
      (s) =>
        `<li><span class="min">${s.minute ? esc(s.minute) + "'" : ""}</span>${flagSpan(s.flag)}<span>${esc(s.name)}</span></li>`
    )
    .join("");
  return `<div class="d-section-title">${esc(t("scorers"))}</div><ul class="d-scorers">${lis}</ul>`;
}

function buildPenalties(node, home, away) {
  const g = node.game;
  if (!(g.homePenScorers.length || g.awayPenScorers.length)) return "";
  const fmt = (arr, miss, flag) =>
    arr
      .map(
        (s) =>
          `<li><span class="min">${miss ? "✗" : "✓"}</span>${flagSpan(flag)}<span>${esc(s.name)}</span></li>`
      )
      .join("");
  const lis =
    fmt(g.homePenScorers, false, home.flag) +
    fmt(g.homePenMisses, true, home.flag) +
    fmt(g.awayPenScorers, false, away.flag) +
    fmt(g.awayPenMisses, true, away.flag);
  return `<div class="d-section-title">${esc(t("penalties"))}</div><ul class="d-scorers">${lis}</ul>`;
}

function flagSpan(flag) {
  return flag
    ? `<img class="d-scorer-flag" src="${esc(flag)}" alt="" />`
    : `<span class="d-scorer-flag d-scorer-flag--empty"></span>`;
}

function minNum(m) {
  if (!m) return 999;
  const n = parseInt(m, 10);
  return Number.isNaN(n) ? 999 : n;
}

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

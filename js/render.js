// Renders the bracket as a single SVG (built as a string, set once per render).

import { polar, RING } from "./bracket.js";
import { roundLabel, t } from "./i18n.js";

const CENTER = 500;

const NODE_R = { team: 22, r32: 16, r16: 15, qf: 14, sf: 14, final: 0 };

let clipSeq = 0;

export function renderBracket(svg, bracket, ctx) {
  clipSeq = 0;
  const { teamsById } = ctx;

  const defs = [];
  const connectors = [];
  const slots = []; // outer team badges (R32 participants)
  const nodes = []; // winner-advancement badges (inner rings)
  const chips = []; // score / live chips

  for (const node of bracket.matchNodes) {
    const childR = node.home.r; // both children share a ring
    const status = node.game.status;
    const connClass =
      status === "live" ? "live" : status === "finished" ? "decided" : "";

    // connectors: each child -> node (radial segment + arc on the node ring)
    connectors.push(connectorPath(node.home, node, childR, connClass));
    connectors.push(connectorPath(node.away, node, childR, connClass));

    // R32 matches own the two outer team slots
    if (node.round === "r32") {
      slots.push(teamBadge(node.home, node, teamsById, defs));
      slots.push(teamBadge(node.away, node, teamsById, defs));
    }

    // Final winner is shown as the champion at the very center
    if (node.round !== "final") {
      nodes.push(winnerBadge(node, teamsById, defs));
      const chip = scoreChip(node);
      if (chip) chips.push(chip);
    }
  }

  // a short stem from the final node toward the trophy
  const finalNode = bracket.finalNode;
  const fStem = (() => {
    const a = polar(finalNode.angle, finalNode.r);
    return `<path class="connector ${finalNode.game.status === "finished" ? "decided" : ""}" d="M ${f(a.x)} ${f(a.y)} L 0 0" />`;
  })();

  const center = trophyAndChampion(bracket.champion, teamsById, defs);

  svg.innerHTML = `
    <defs>
      <radialGradient id="bgGlow" cx="50%" cy="50%" r="55%">
        <stop offset="0%" stop-color="#2a2418" stop-opacity="0.9"/>
        <stop offset="35%" stop-color="#15131a" stop-opacity="0.5"/>
        <stop offset="100%" stop-color="#07070a" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="goldGrad" cx="50%" cy="35%" r="70%">
        <stop offset="0%" stop-color="#fff1c2"/>
        <stop offset="45%" stop-color="#f5c451"/>
        <stop offset="100%" stop-color="#b8860b"/>
      </radialGradient>
      <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#f5c451" stop-opacity="0.55"/>
        <stop offset="40%" stop-color="#b8860b" stop-opacity="0.22"/>
        <stop offset="100%" stop-color="#f5c451" stop-opacity="0"/>
      </radialGradient>
      <filter id="glow" x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur stdDeviation="6" result="b"/>
        <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      ${defs.join("\n")}
    </defs>

    <rect x="0" y="0" width="1000" height="1000" fill="url(#bgGlow)"/>

    <g transform="translate(${CENTER},${CENTER})">
      <g class="connectors">${connectors.join("")}${fStem}</g>
      <g class="nodes">${nodes.join("")}</g>
      <g class="slots">${slots.join("")}</g>
      <g class="chips">${chips.join("")}</g>
      <g class="center">${center}</g>
    </g>
  `;
}

// ---------- connectors ----------

function connectorPath(child, node, childR, cls) {
  const c = polar(child.angle, childR);
  const cIn = polar(child.angle, node.r);
  const sweep = node.angle > child.angle ? 1 : 0;
  const end = polar(node.angle, node.r);
  const d =
    `M ${f(c.x)} ${f(c.y)} L ${f(cIn.x)} ${f(cIn.y)} ` +
    `A ${f(node.r)} ${f(node.r)} 0 0 ${sweep} ${f(end.x)} ${f(end.y)}`;
  return `<path class="connector ${cls}" d="${d}" />`;
}

// ---------- badges ----------

function teamBadge(leaf, matchNode, teamsById, defs) {
  const team = leaf.teamId ? teamsById.get(leaf.teamId) : null;
  const decided = leaf.teamId != null;
  const isWinner = matchNode.advTeamId && matchNode.advTeamId === leaf.teamId;
  const ringCls = !decided
    ? "undecided"
    : isWinner
    ? "winner"
    : matchNode.game.status === "live"
    ? "live"
    : "";
  return badge({
    angle: leaf.angle,
    r: RING.team,
    radius: NODE_R.team,
    team,
    fallback: team ? team.fifaCode : "?",
    ringCls,
    matchId: matchNode.id,
    defs,
  });
}

function winnerBadge(node, teamsById, defs) {
  const status = node.game.status;
  const radius = NODE_R[node.round] ?? 13;

  if (status === "finished" && node.advTeamId) {
    const team = teamsById.get(node.advTeamId);
    return badge({
      angle: node.angle,
      r: node.r,
      radius,
      team,
      fallback: team ? team.fifaCode : "?",
      ringCls: "winner",
      matchId: node.id,
      defs,
    });
  }

  // live or upcoming: a marker dot (no winner yet)
  const cls = status === "live" ? "slot-ring live" : "slot-ring undecided";
  const p = polar(node.angle, node.r);
  return `<g class="node-group" data-match-id="${node.id}">
    <circle cx="${f(p.x)}" cy="${f(p.y)}" r="${radius - 5}" fill="#0e0e15"/>
    <circle cx="${f(p.x)}" cy="${f(p.y)}" r="${radius - 5}" class="${cls}"/>
  </g>`;
}

// generic circular flag badge
function badge({ angle, r, radius, team, fallback, ringCls, matchId, defs }) {
  const p = polar(angle, r);
  const id = `clip${clipSeq++}`;
  defs.push(
    `<clipPath id="${id}"><circle cx="${f(p.x)}" cy="${f(p.y)}" r="${radius - 2}"/></clipPath>`
  );
  const flag = team && team.flag;
  const img = flag
    ? `<image href="${esc(flag)}" x="${f(p.x - radius)}" y="${f(p.y - radius)}" width="${radius * 2}" height="${radius * 2}" clip-path="url(#${id})" preserveAspectRatio="xMidYMid slice" class="flag-img"/>`
    : "";
  const text = flag
    ? ""
    : `<text class="slot-code" x="${f(p.x)}" y="${f(p.y)}">${esc(fallback || "?")}</text>`;
  return `<g class="node-group" data-match-id="${matchId}">
    <circle cx="${f(p.x)}" cy="${f(p.y)}" r="${radius}" fill="#0e0e15"/>
    ${img}${text}
    <circle cx="${f(p.x)}" cy="${f(p.y)}" r="${radius}" class="slot-ring ${ringCls}"/>
  </g>`;
}

// ---------- chips (score / live minute) ----------

function scoreChip(node) {
  const g = node.game;
  if (g.status === "notstarted") return null;
  const h = g.homeScore ?? 0;
  const a = g.awayScore ?? 0;
  let label = `${h}–${a}`;
  if (g.homePen != null && g.awayPen != null) label += ` (${g.homePen}–${g.awayPen})`;
  if (g.status === "live") {
    const min = g.liveMinute != null ? `${g.liveMinute}'` : "•";
    label = `${min}  ${h}–${a}`;
  }
  const p = polar(node.angle, node.r + (NODE_R[node.round] ?? 13) + 9);
  const w = label.length * 6.2 + 10;
  const cls = g.status === "live" ? "score-badge live" : "score-badge";
  const dateStr = chipDate(g.localDate);
  const dateEl = dateStr
    ? `<text class="chip-date" x="${f(p.x)}" y="${f(p.y - 13)}">${esc(dateStr)}</text>`
    : "";
  return `<g class="${cls}" pointer-events="none">
    ${dateEl}
    <rect x="${f(p.x - w / 2)}" y="${f(p.y - 8)}" width="${f(w)}" height="16" rx="6"/>
    <text x="${f(p.x)}" y="${f(p.y + 0.5)}">${esc(label)}</text>
  </g>`;
}

// "MM/DD/YYYY HH:MM" -> "DD/MM HH:MM"
function chipDate(localDate) {
  if (!localDate) return null;
  const m = String(localDate).match(/^(\d{1,2})\/(\d{1,2})\/\d{2,4}(?:\s+(\d{1,2}:\d{2}))?/);
  if (!m) return localDate;
  const [, mm, dd, time] = m;
  return `${dd.padStart(2, "0")}/${mm.padStart(2, "0")}${time ? ` ${time}` : ""}`;
}

// ---------- center: trophy + champion ----------

function trophyAndChampion(championId, teamsById, defs) {
  const trophy = `
    <circle cx="0" cy="-6" r="115" fill="url(#centerGlow)"/>
    <g transform="translate(0,-4) scale(1.55)" filter="url(#glow)">
      <path d="M -18 -36 L 18 -36 Q 16 -8 0 -4 Q -16 -8 -18 -36 Z" fill="url(#goldGrad)"/>
      <path d="M -18 -33 C -33 -32 -33 -13 -17 -16" fill="none" stroke="url(#goldGrad)" stroke-width="3.5"/>
      <path d="M 18 -33 C 33 -32 33 -13 17 -16" fill="none" stroke="url(#goldGrad)" stroke-width="3.5"/>
      <path d="M -5 -4 L 5 -4 L 6 7 L -6 7 Z" fill="url(#goldGrad)"/>
      <rect x="-13" y="7" width="26" height="5" rx="1.5" fill="url(#goldGrad)"/>
      <rect x="-17" y="12" width="34" height="5" rx="1.5" fill="url(#goldGrad)"/>
    </g>`;

  if (!championId) return trophy;
  const team = teamsById.get(championId);
  const champBadge = team
    ? (() => {
        const id = `clip${clipSeq++}`;
        defs.push(`<clipPath id="${id}"><circle cx="0" cy="-58" r="18"/></clipPath>`);
        return `<g>
          <circle cx="0" cy="-58" r="20" fill="#0e0e15"/>
          <image href="${esc(team.flag)}" x="-20" y="-78" width="40" height="40" clip-path="url(#${id})" preserveAspectRatio="xMidYMid slice"/>
          <circle cx="0" cy="-58" r="20" class="slot-ring winner"/>
        </g>`;
      })()
    : "";
  const name = team ? esc(team.nameEn) : "";
  return `${champBadge}${trophy}
    <text class="champion-name" x="0" y="40">${name}</text>
    <text class="round-label" x="0" y="58" style="fill:var(--gold);opacity:.8">${esc(t("champion"))}</text>`;
}

// ---------- helpers ----------

function f(n) {
  return Math.round(n * 100) / 100;
}

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Build the round legend (called by main on render / lang change)
export function renderLegend(el) {
  const rounds = ["r32", "r16", "qf", "sf", "final"];
  const swatches = `
    <div class="legend-item"><span class="legend-swatch" style="background:var(--live)"></span>${esc(t("legendLive"))}</div>
    <div class="legend-item"><span class="legend-swatch" style="background:var(--gold)"></span>${esc(t("legendDone"))}</div>
    <div class="legend-item"><span class="legend-swatch" style="background:var(--ink-dim)"></span>${esc(t("legendPending"))}</div>`;
  el.innerHTML = swatches;
}

export { roundLabel };

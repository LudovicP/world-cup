// Renders the bracket as a single SVG (built as a string, set once per render).

import { polar, RING } from "./bracket.js";
import { roundLabel, t } from "./i18n.js";
import { matchInstantMs, formatShort } from "./time.js";

const CENTER = 500;

const NODE_R = { team: 22, r32: 16, r16: 15, qf: 14, sf: 14, final: 0 };

let clipSeq = 0;

export function renderBracket(svg, bracket, ctx) {
  clipSeq = 0;
  const { teamsById } = ctx;
  const stadiumsById = ctx.stadiumsById ?? new Map();
  const cityOf = (game) =>
    game.stadiumId ? stadiumsById.get(game.stadiumId)?.cityEn ?? null : null;

  const defs = [];
  const connectors = [];
  const slots = []; // outer team badges (R32 participants)
  const nodes = []; // winner-advancement badges (inner rings)
  const chips = []; // score / live chips

  for (const node of bracket.matchNodes) {
    const childR = node.home.r; // both children share a ring
    const status = node.game.status;
    // the segment a side traversed is gold ("winner") if that side won this match,
    // tracing each winner's path inward; otherwise live (red) / decided / dim.
    const sideClass = (wins) =>
      wins ? "winner" : status === "live" ? "live" : status === "finished" ? "decided" : "";

    // connectors: each child -> node (radial segment + arc on the node ring)
    connectors.push(connectorPath(node.home, node, childR, sideClass(node.winnerSide === "home")));
    connectors.push(connectorPath(node.away, node, childR, sideClass(node.winnerSide === "away")));

    // R32 matches own the two outer team slots
    if (node.round === "r32") {
      slots.push(teamBadge(node.home, node, teamsById, defs));
      slots.push(teamBadge(node.away, node, teamsById, defs));
    }

    // Final winner is shown as the champion at the very center
    if (node.round !== "final") {
      nodes.push(winnerBadge(node, teamsById, defs));
      const chip = scoreChip(node, cityOf(node.game));
      if (chip) chips.push(chip);
    }
  }

  // a short stem from the final node toward the trophy
  const finalNode = bracket.finalNode;
  const fStem = (() => {
    const a = polar(finalNode.angle, finalNode.r);
    // champion's last step to the trophy = gold when the final is decided
    return `<path class="connector ${finalNode.game.status === "finished" ? "winner" : ""}" d="M ${f(a.x)} ${f(a.y)} L 0 0" />`;
  })();

  // when the final hasn't produced a champion yet, show its scheduled kickoff
  const fg = finalNode.game;
  const finalDate =
    bracket.champion || fg.status === "finished"
      ? null
      : formatShort(matchInstantMs(fg.localDate, cityOf(fg))) ?? chipDate(fg.localDate);
  const center = trophyAndChampion(bracket.champion, teamsById, defs, finalDate);

  svg.innerHTML = `
    <defs>
      <radialGradient id="bgGlow" cx="50%" cy="50%" r="55%">
        <stop offset="0%" stop-color="#2a2418" stop-opacity="0.9"/>
        <stop offset="35%" stop-color="#15131a" stop-opacity="0.5"/>
        <stop offset="100%" stop-color="#07070a" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#f5c451" stop-opacity="0.55"/>
        <stop offset="40%" stop-color="#b8860b" stop-opacity="0.22"/>
        <stop offset="100%" stop-color="#f5c451" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="trophyGold" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#fff3c4"/>
        <stop offset="22%" stop-color="#f7cf63"/>
        <stop offset="55%" stop-color="#d9a528"/>
        <stop offset="100%" stop-color="#9c6f12"/>
      </linearGradient>
      <linearGradient id="trophyShine" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#9c6f12"/>
        <stop offset="30%" stop-color="#ffe9a0"/>
        <stop offset="50%" stop-color="#fffbe8"/>
        <stop offset="70%" stop-color="#ffe9a0"/>
        <stop offset="100%" stop-color="#8f6410"/>
      </linearGradient>
      <radialGradient id="globeGrad" cx="38%" cy="30%" r="80%">
        <stop offset="0%" stop-color="#fffbe8"/>
        <stop offset="40%" stop-color="#f3c54e"/>
        <stop offset="100%" stop-color="#a9780f"/>
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

// ---------- chips (score / live minute / kickoff) ----------

function scoreChip(node, city) {
  const g = node.game;
  // kickoff in the viewer's timezone (falls back to the raw venue-local string)
  const dateStr = formatShort(matchInstantMs(g.localDate, city)) ?? chipDate(g.localDate);
  const radius = NODE_R[node.round] ?? 13;
  const p = polar(node.angle, node.r + radius + 9);

  // upcoming match: a single date/time chip, no score yet
  if (g.status === "notstarted") {
    if (!dateStr) return null;
    const w = dateStr.length * 5.4 + 12;
    return `<g class="date-chip" pointer-events="none">
      <rect x="${f(p.x - w / 2)}" y="${f(p.y - 8)}" width="${f(w)}" height="16" rx="6"/>
      <text x="${f(p.x)}" y="${f(p.y + 0.5)}">${esc(dateStr)}</text>
    </g>`;
  }

  // played match (live/finished): split for readability — date on the outer
  // side of the flag, score on the inner side, so the badge sits between them.
  const h = g.homeScore ?? 0;
  const a = g.awayScore ?? 0;
  let label = `${h}–${a}`;
  if (g.homePen != null && g.awayPen != null) label += ` (${g.homePen}–${g.awayPen})`;
  if (g.status === "live") {
    const min = g.liveMinute != null ? `${g.liveMinute}'` : "•";
    label = `${min}  ${h}–${a}`;
  }
  const w = label.length * 6.2 + 10;
  const cls = g.status === "live" ? "score-badge live" : "score-badge";
  // screen-space: date directly above the flag, score directly below it
  const fp = polar(node.angle, node.r);
  const dateEl = dateStr
    ? `<text class="chip-date" x="${f(fp.x)}" y="${f(fp.y - radius - 11)}">${esc(dateStr)}</text>`
    : "";
  return `<g pointer-events="none">
    ${dateEl}
    <g class="${cls}">
      <rect x="${f(fp.x - w / 2)}" y="${f(fp.y + radius + 5)}" width="${f(w)}" height="16" rx="6"/>
      <text x="${f(fp.x)}" y="${f(fp.y + radius + 13.5)}">${esc(label)}</text>
    </g>
  </g>`;
}

// raw venue-local fallback "MM/DD/YYYY HH:MM" -> "DD/MM HH:MM"
function chipDate(localDate) {
  if (!localDate) return null;
  const m = String(localDate).match(/^(\d{1,2})\/(\d{1,2})\/\d{2,4}(?:\s+(\d{1,2}:\d{2}))?/);
  if (!m) return localDate;
  const [, mm, dd, time] = m;
  return `${dd.padStart(2, "0")}/${mm.padStart(2, "0")}${time ? ` ${time}` : ""}`;
}

// ---------- center: trophy + champion ----------

function trophyAndChampion(championId, teamsById, defs, finalDate) {
  // FIFA World Cup trophy: a golden globe cradled by two upswept twisting
  // figures on a green-banded base. Drawn in a local frame (globe at y≈-70,
  // base bottom at y≈+62) and scaled into the bracket center.
  const body =
    "M -21 -80 C -32 -70 -31 -52 -25 -42 C -19 -31 -13 -15 -11 2 " +
    "C -10 14 -11 24 -13 33 L 13 33 C 11 24 10 14 11 2 " +
    "C 13 -15 19 -31 25 -42 C 31 -52 32 -70 21 -80 " +
    "C 13 -86 7 -66 0 -58 C -7 -66 -13 -86 -21 -80 Z";
  const trophy = `
    <circle cx="0" cy="-20" r="120" fill="url(#centerGlow)"/>
    <g transform="translate(0,-14) scale(0.7)">
      <g filter="url(#glow)" opacity="0.4">
        <path d="${body}" fill="#f5c451"/>
        <circle cx="0" cy="-70" r="24" fill="#f5c451"/>
      </g>
      <path d="M -15 33 L 15 33 L 22 42 L 22 58 Q 22 62 18 62 L -18 62 Q -22 62 -22 58 L -22 42 Z" fill="url(#trophyGold)"/>
      <rect x="-22" y="44" width="44" height="6.5" fill="#1f7a3d"/>
      <rect x="-22" y="52.5" width="44" height="6" fill="#1f7a3d"/>
      <path d="${body}" fill="url(#trophyGold)"/>
      <path d="M -5 -52 C -11 -26 -9 0 -7 31 L 6 31 C 9 0 11 -26 5 -52 C 3 -58 -3 -58 -5 -52 Z" fill="url(#trophyShine)" opacity="0.5"/>
      <path d="M -16 -64 C -8 -36 -4 -8 -2 30" fill="none" stroke="#8a5f0c" stroke-width="1.3" opacity="0.55"/>
      <path d="M 16 -64 C 6 -34 3 -6 2 30" fill="none" stroke="#8a5f0c" stroke-width="1.3" opacity="0.55"/>
      <circle cx="0" cy="-70" r="24" fill="url(#globeGrad)"/>
      <g transform="rotate(-12 0 -70)">
        <g fill="none" stroke="#8a5f0c" stroke-width="1.1" opacity="0.55">
          <ellipse cx="0" cy="-70" rx="24" ry="8.5"/>
          <ellipse cx="0" cy="-70" rx="8.5" ry="24"/>
          <path d="M -22.5 -78 H 22.5 M -22.5 -62 H 22.5"/>
        </g>
        <path d="M -11 -83 q 6 -2 9 2 q 4 1 4 5 q -2 4 -7 3 q -2 4 -7 2 q -4 -2 -2 -6 q -3 -4 3 -6 Z" fill="#9c6f12" opacity="0.5"/>
        <path d="M 7 -64 q 6 1 5 6 q -4 4 -8 0 q -2 -5 3 -6 Z" fill="#9c6f12" opacity="0.5"/>
      </g>
      <ellipse cx="-9" cy="-80" rx="5" ry="2.6" fill="#fffbe8" opacity="0.45" transform="rotate(-25 -9 -80)"/>
    </g>`;

  if (!championId) {
    const dateLabel = finalDate
      ? `<text class="final-date" x="0" y="46">${esc(t("final"))} · ${esc(finalDate)}</text>`
      : "";
    return `${trophy}${dateLabel}`;
  }
  const team = teamsById.get(championId);
  const champBadge = team
    ? (() => {
        const id = `clip${clipSeq++}`;
        defs.push(`<clipPath id="${id}"><circle cx="0" cy="-94" r="11"/></clipPath>`);
        return `<g>
          <circle cx="0" cy="-94" r="13" fill="#0e0e15"/>
          <image href="${esc(team.flag)}" x="-13" y="-107" width="26" height="26" clip-path="url(#${id})" preserveAspectRatio="xMidYMid slice"/>
          <circle cx="0" cy="-94" r="13" class="slot-ring winner"/>
        </g>`;
      })()
    : "";
  const name = team ? esc(team.nameEn) : "";
  return `${trophy}${champBadge}
    <text class="champion-name" x="0" y="46">${name}</text>
    <text class="round-label" x="0" y="64" style="fill:var(--gold);opacity:.8">${esc(t("champion"))}</text>`;
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

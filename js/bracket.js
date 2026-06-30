// Build the knockout tree from the flat games list and lay it out in polar
// coordinates for the circular bracket.
//
// Tree shape (root = Final):
//   final -> 2x sf -> 2x qf -> 2x r16 -> 2x r32 -> 2x team-slot
// 32 team slots end up on the outer ring; each round nests one ring inward.

import { resolveWinner } from "./api.js";

// Ring radius per level (viewBox 1000x1000, center 500,500).
export const RING = {
  team: 452,
  r32: 366,
  r16: 284,
  qf: 206,
  sf: 128,
  final: 56,
};

const STEP = 360 / 32; // 11.25° between adjacent team slots
const START = -90; // first slot at top

// child label like "Winner Match 86"
const MATCH_REF = /Winner Match\s+(\d+)/i;

export function buildBracket(games) {
  const byId = new Map(games.map((g) => [g.id, g]));
  const finalGame = games.find((g) => g.type === "final");
  if (!finalGame) return null;

  // --- build the tree ---
  const matchNodes = [];

  function buildMatch(game) {
    const node = {
      kind: "match",
      id: game.id,
      round: game.type,
      game,
      home: buildChild(game.homeLabel, game.homeTeamId),
      away: buildChild(game.awayLabel, game.awayTeamId),
    };
    node.children = [node.home, node.away];
    matchNodes.push(node);
    return node;
  }

  function buildChild(label, teamId) {
    const m = label && label.match(MATCH_REF);
    if (m) {
      const childGame = byId.get(parseInt(m[1], 10));
      if (childGame) return buildMatch(childGame);
    }
    // R32 leaf: a fixed participant slot (teamId may be null = undecided)
    return { kind: "team", teamId, label };
  }

  const root = buildMatch(finalGame);

  // --- ordered leaves (DFS) -> angles ---
  const leaves = [];
  (function collect(node) {
    if (node.kind === "team") return void leaves.push(node);
    collect(node.home);
    collect(node.away);
  })(root);

  leaves.forEach((leaf, i) => {
    leaf.angle = START + i * STEP;
    leaf.r = RING.team;
  });

  // internal node angle = mean of children (balanced tree -> midpoint of range,
  // computed on unwrapped linear angles so there is no 0/360 seam issue)
  (function place(node) {
    if (node.kind === "team") return;
    place(node.home);
    place(node.away);
    node.angle = (node.home.angle + node.away.angle) / 2;
    node.r = RING[node.round] ?? RING.final;
  })(root);

  // --- resolve participants + winners bottom-up ---
  (function resolve(node) {
    if (node.kind === "team") return;
    resolve(node.home);
    resolve(node.away);
    node.homeTeamId = participantOf(node.home);
    node.awayTeamId = participantOf(node.away);
    node.winnerSide = resolveWinner(node.game); // "home" | "away" | null
    node.advTeamId =
      node.winnerSide === "home"
        ? node.homeTeamId
        : node.winnerSide === "away"
        ? node.awayTeamId
        : null;
  })(root);

  const champion = root.advTeamId;

  return { root, matchNodes, leaves, champion, finalNode: root };
}

function participantOf(child) {
  return child.kind === "team" ? child.teamId : child.advTeamId;
}

// polar -> cartesian (center applied by caller via translate)
export function polar(angleDeg, r) {
  const a = (angleDeg * Math.PI) / 180;
  return { x: Math.cos(a) * r, y: Math.sin(a) * r };
}

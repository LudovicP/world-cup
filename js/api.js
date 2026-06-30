// Data layer: fetch the worldcup26.ir endpoints and normalize their
// all-strings payloads into typed objects the rest of the app can trust.

const BASE = "https://worldcup26.ir";

export const ROUND_ORDER = ["r32", "r16", "qf", "sf", "final"];

// ---------- low-level parsers ----------

export function parseBool(v) {
  return String(v).trim().toUpperCase() === "TRUE";
}

// "0" -> 0, "null"/""/"0"(team) handled by caller; returns int or null
export function parseIntOrNull(v) {
  if (v == null) return null;
  const s = String(v).trim();
  if (s === "" || s.toLowerCase() === "null") return null;
  const n = parseInt(s, 10);
  return Number.isNaN(n) ? null : n;
}

// team/stadium ids use "0" to mean "not determined yet"
function parseRefId(v) {
  const n = parseIntOrNull(v);
  return n && n > 0 ? n : null;
}

// time_elapsed: "notstarted" | "finished" | <minute number>
export function parseElapsed(v) {
  const s = String(v ?? "").trim().toLowerCase();
  if (s === "" || s === "notstarted") return { state: "notstarted", minute: null };
  if (s === "finished") return { state: "finished", minute: null };
  const n = parseInt(s, 10);
  if (!Number.isNaN(n)) return { state: "live", minute: n };
  return { state: "notstarted", minute: null };
}

// Postgres array literal as string, e.g. {"Nestory Irankunda 27'","C. Metcalfe 75'"}
export function parseScorers(raw) {
  if (raw == null) return [];
  let s = String(raw).trim();
  if (!s || s === "null" || s === "{}" || s === "{null}") return [];
  if (s.startsWith("{") && s.endsWith("}")) s = s.slice(1, -1);
  if (!s.trim()) return [];

  const tokens = [];
  const re = /"((?:[^"\\]|\\.)*)"/g;
  let m;
  let quoted = false;
  while ((m = re.exec(s)) !== null) {
    quoted = true;
    tokens.push(m[1]);
  }
  if (!quoted) {
    s.split(",").forEach((t) => {
      const v = t.trim();
      if (v && v.toLowerCase() !== "null") tokens.push(v);
    });
  }
  return tokens.map(parseScorerToken).filter(Boolean);
}

function parseScorerToken(tok) {
  const t = tok.replace(/\\"/g, '"').trim();
  if (!t || t.toLowerCase() === "null") return null;
  const mm = t.match(/^(.*?)[\s,]*?(\d{1,3}(?:\+\d+)?)\s*'?\s*$/);
  if (mm && mm[1].trim()) return { name: mm[1].trim().replace(/[,\s]+$/, ""), minute: mm[2] };
  return { name: t, minute: null };
}

// ---------- normalization ----------

export function normalizeGame(g) {
  const elapsed = parseElapsed(g.time_elapsed);
  const finished = parseBool(g.finished);
  let status = finished ? "finished" : elapsed.state;
  // a match flagged finished overrides; otherwise trust elapsed
  if (finished) status = "finished";

  return {
    id: parseIntOrNull(g.id),
    type: String(g.type || "").toLowerCase(),
    group: g.group || null,
    matchday: parseIntOrNull(g.matchday),
    stadiumId: parseRefId(g.stadium_id),
    localDate: g.local_date || null,
    persianDate: g.persian_date || null,

    homeTeamId: parseRefId(g.home_team_id),
    awayTeamId: parseRefId(g.away_team_id),
    homeLabel: g.home_team_label || g.home_team_name_en || null,
    awayLabel: g.away_team_label || g.away_team_name_en || null,
    homeNameEn: g.home_team_name_en || null,
    awayNameEn: g.away_team_name_en || null,

    homeScore: parseIntOrNull(g.home_score),
    awayScore: parseIntOrNull(g.away_score),
    homePen: parseIntOrNull(g.home_penalty_score),
    awayPen: parseIntOrNull(g.away_penalty_score),

    homeScorers: parseScorers(g.home_scorers),
    awayScorers: parseScorers(g.away_scorers),
    homePenScorers: parseScorers(g.home_penalty_scorers),
    awayPenScorers: parseScorers(g.away_penalty_scorers),
    homePenMisses: parseScorers(g.home_penalty_misses),
    awayPenMisses: parseScorers(g.away_penalty_misses),

    finished,
    status, // "notstarted" | "live" | "finished"
    liveMinute: elapsed.state === "live" ? elapsed.minute : null,
  };
}

function normalizeTeam(t) {
  return {
    id: parseIntOrNull(t.id),
    nameEn: t.name_en,
    nameFa: t.name_fa,
    flag: upscaleFlag(t.flag),
    fifaCode: t.fifa_code,
    iso2: t.iso2,
    group: t.groups || t.group || null,
  };
}

// flagcdn serves /w80/ by default; request a crisper size for retina
function upscaleFlag(url) {
  if (!url) return url;
  return url.replace(/\/w\d+\//, "/w160/");
}

function normalizeStadium(s) {
  return {
    id: parseIntOrNull(s.id),
    nameEn: s.name_en,
    nameFa: s.name_fa,
    fifaName: s.fifa_name,
    cityEn: s.city_en,
    cityFa: s.city_fa,
    countryEn: s.country_en,
    countryFa: s.country_fa,
    capacity: typeof s.capacity === "number" ? s.capacity : parseIntOrNull(s.capacity),
  };
}

// ---------- winner resolution (live-consistent) ----------

// returns "home" | "away" | null
export function resolveWinner(game) {
  if (!game || !game.finished) return null;
  const { homeScore: h, awayScore: a, homePen: hp, awayPen: ap } = game;
  if (h == null || a == null) return null;
  if (h > a) return "home";
  if (a > h) return "away";
  if (hp != null && ap != null) {
    if (hp > ap) return "home";
    if (ap > hp) return "away";
  }
  return null;
}

// ---------- fetching ----------

async function fetchJSON(path, signal) {
  const res = await fetch(`${BASE}${path}`, { signal, cache: "no-store" });
  if (!res.ok) throw new Error(`${path} -> HTTP ${res.status}`);
  return res.json();
}

export async function fetchGames(signal) {
  const data = await fetchJSON("/get/games", signal);
  return (data.games || []).map(normalizeGame);
}

// Static reference data (teams + stadiums) loaded once.
export async function loadStatic(signal) {
  const [teamsRes, stadiumsRes] = await Promise.all([
    fetchJSON("/get/teams", signal),
    fetchJSON("/get/stadiums", signal),
  ]);
  const teams = (teamsRes.teams || []).map(normalizeTeam);
  const stadiums = (stadiumsRes.stadiums || []).map(normalizeStadium);
  const teamsById = new Map(teams.map((t) => [t.id, t]));
  const stadiumsById = new Map(stadiums.map((s) => [s.id, s]));
  return { teams, stadiums, teamsById, stadiumsById };
}

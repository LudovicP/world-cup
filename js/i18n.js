// Tiny FR/EN i18n with a change-notification hook.

const DICT = {
  fr: {
    loading: "Chargement des données…",
    retry: "Réessayer",
    refresh: "Rafraîchir",
    errorLoad: "Impossible de charger les données. Nouvel essai au prochain rafraîchissement.",
    dataSource: "Données :",
    updatesEvery: "Mise à jour toutes les 30 s",
    updatedJustNow: "MAJ à l'instant",
    updatedSecondsAgo: (s) => `MAJ il y a ${s} s`,
    updatedMinutesAgo: (m) => `MAJ il y a ${m} min`,
    // rounds
    r32: "16es de finale",
    r16: "Huitièmes",
    qf: "Quarts",
    sf: "Demi-finales",
    final: "Finale",
    third: "Petite finale",
    // status
    notstarted: "À venir",
    live: "En direct",
    finished: "Terminé",
    // detail
    scorers: "Buteurs",
    penalties: "Tirs au but",
    stadium: "Stade",
    date: "Date",
    winner: "Qualifié",
    champion: "Champion du monde",
    toBeDecided: "À déterminer",
    noScorers: "Aucun buteur",
    legendLive: "En direct",
    legendDone: "Qualifié",
    legendPending: "À venir",
    vs: "vs",
  },
  en: {
    loading: "Loading data…",
    retry: "Retry",
    refresh: "Refresh",
    errorLoad: "Could not load data. Will retry on next refresh.",
    dataSource: "Data:",
    updatesEvery: "Updates every 30s",
    updatedJustNow: "Updated just now",
    updatedSecondsAgo: (s) => `Updated ${s}s ago`,
    updatedMinutesAgo: (m) => `Updated ${m}m ago`,
    r32: "Round of 32",
    r16: "Round of 16",
    qf: "Quarter-finals",
    sf: "Semi-finals",
    final: "Final",
    third: "Third place",
    notstarted: "Upcoming",
    live: "Live",
    finished: "Finished",
    scorers: "Scorers",
    penalties: "Penalty shootout",
    stadium: "Stadium",
    date: "Date",
    winner: "Through",
    champion: "World Champion",
    toBeDecided: "To be decided",
    noScorers: "No scorers",
    legendLive: "Live",
    legendDone: "Through",
    legendPending: "Upcoming",
    vs: "vs",
  },
};

let current = "fr";
const listeners = new Set();

export function getLang() {
  return current;
}

export function setLang(lang) {
  if (!DICT[lang] || lang === current) return;
  current = lang;
  listeners.forEach((cb) => cb(current));
}

export function onLangChange(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

// t("key") or t("key", arg) for function-valued entries
export function t(key, arg) {
  const v = DICT[current][key];
  if (typeof v === "function") return v(arg);
  return v != null ? v : key;
}

export function roundLabel(type) {
  return t(type);
}

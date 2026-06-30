// Kickoff times -> the viewer's own timezone.
//
// The API reports each kickoff as a wall-clock time *at the stadium*
// (e.g. "07/19/2026 15:00" = 3pm ET for the final at MetLife). To show it in
// the visitor's local zone we pair every host city with its IANA timezone,
// resolve the real instant with Temporal, then format in the browser's zone.
//
// Temporal is used when the runtime provides it (per request); we fall back to
// a fixed-offset table otherwise. The fixed offsets are exact for the 2026
// tournament window (Jun 11 – Jul 19): North-American DST is in effect
// throughout and Mexico observes no DST, so no transition falls inside it.

const HAS_TEMPORAL = typeof globalThis.Temporal !== "undefined";

// stadium.cityEn -> { zone: IANA id, off: minutes east of UTC during the event }
const VENUE_TZ = {
  "Mexico City": { zone: "America/Mexico_City", off: -360 },
  "Guadalajara (Zapopan)": { zone: "America/Mexico_City", off: -360 },
  "Monterrey (Guadalupe)": { zone: "America/Monterrey", off: -360 },
  "Dallas (Arlington, Texas)": { zone: "America/Chicago", off: -300 },
  Houston: { zone: "America/Chicago", off: -300 },
  "Kansas City": { zone: "America/Chicago", off: -300 },
  Atlanta: { zone: "America/New_York", off: -240 },
  "Miami (Miami Gardens)": { zone: "America/New_York", off: -240 },
  "Boston (Foxborough)": { zone: "America/New_York", off: -240 },
  Philadelphia: { zone: "America/New_York", off: -240 },
  "New York/New Jersey (East Rutherford)": { zone: "America/New_York", off: -240 },
  Toronto: { zone: "America/Toronto", off: -240 },
  Vancouver: { zone: "America/Vancouver", off: -420 },
  Seattle: { zone: "America/Los_Angeles", off: -420 },
  "San Francisco Bay Area (Santa Clara)": { zone: "America/Los_Angeles", off: -420 },
  "Los Angeles (Inglewood)": { zone: "America/Los_Angeles", off: -420 },
};

// "MM/DD/YYYY HH:MM" -> {y, mo, d, h, mi} | null
function parseWall(s) {
  const m = String(s ?? "").match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return { y: +m[3], mo: +m[1], d: +m[2], h: +m[4], mi: +m[5] };
}

// venue wall-clock + venue city -> epoch ms (the true instant), or null when the
// city is unknown (caller then shows the raw venue-local string unchanged).
export function matchInstantMs(localDate, cityEn) {
  const w = parseWall(localDate);
  if (!w) return null;
  const tz = VENUE_TZ[cityEn];
  if (!tz) return null;
  if (HAS_TEMPORAL) {
    try {
      return Temporal.PlainDateTime.from({
        year: w.y,
        month: w.mo,
        day: w.d,
        hour: w.h,
        minute: w.mi,
      })
        .toZonedDateTime(tz.zone)
        .epochMilliseconds;
    } catch {
      /* fall through to fixed offset */
    }
  }
  return Date.UTC(w.y, w.mo - 1, w.d, w.h, w.mi) - tz.off * 60000;
}

// compact date+time, in the browser's own locale AND timezone
// (date order DD/MM vs MM/DD and 12h/24h follow Intl's default locale).
const SHORT_FMT = new Intl.DateTimeFormat(undefined, {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});
export function formatShort(ms) {
  if (ms == null) return null;
  return SHORT_FMT.format(new Date(ms));
}

// full date+time, in the browser's own locale and timezone,
// e.g. "dim. 19 juil. 2026, 21:00" / "Sun, Jul 19, 2026, 3:00 PM"
const FULL_FMT = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
export function formatFull(ms) {
  if (ms == null) return null;
  return FULL_FMT.format(new Date(ms));
}

// the viewer's timezone label, e.g. "Europe/Paris"
export function viewerZone() {
  if (HAS_TEMPORAL) return Temporal.Now.timeZoneId();
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
}

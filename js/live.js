// Polling manager: one poll timer + one 1s display tick. Single-instance safe.

export function createLive({ fetchFn, intervalMs = 30000, onUpdate, onError, onAge }) {
  let pollTimer = null;
  let tickTimer = null;
  let controller = null;
  let inFlight = false;
  let lastUpdated = null;
  let stopped = false;

  async function poll() {
    if (inFlight) return;
    inFlight = true;
    if (controller) controller.abort();
    controller = new AbortController();
    try {
      const games = await fetchFn(controller.signal);
      lastUpdated = Date.now();
      if (!stopped) onUpdate(games, lastUpdated);
    } catch (e) {
      if (e.name !== "AbortError" && !stopped) onError(e);
    } finally {
      inFlight = false;
    }
  }

  function tick() {
    if (onAge && lastUpdated != null) onAge(Date.now() - lastUpdated);
  }

  function start() {
    stop(); // ensure no duplicate timers
    stopped = false;
    poll();
    pollTimer = setInterval(poll, intervalMs);
    tickTimer = setInterval(tick, 1000);
    // refresh promptly when the tab regains focus
    document.addEventListener("visibilitychange", onVisible);
  }

  function onVisible() {
    if (document.visibilityState === "visible") poll();
  }

  function refreshNow() {
    poll();
  }

  function stop() {
    stopped = true;
    if (pollTimer) clearInterval(pollTimer);
    if (tickTimer) clearInterval(tickTimer);
    pollTimer = tickTimer = null;
    if (controller) controller.abort();
    document.removeEventListener("visibilitychange", onVisible);
  }

  return { start, stop, refreshNow, getLastUpdated: () => lastUpdated };
}

(() => {
  const Content = (globalThis.ZenStopContent = globalThis.ZenStopContent || {});
  const stateApi = Content.state;
  const storage = Content.storage;
  const indicator = Content.indicator;
  if (!stateApi || !storage || !indicator) return;

  let onGraceReturn = null;

  function setReturnHandler(handler) {
    onGraceReturn = typeof handler === "function" ? handler : null;
  }

  function scheduleReturn(siteKey, delayMs) {
    if (!onGraceReturn) return;
    stateApi.setTimer(siteKey, delayMs, onGraceReturn);
  }

  async function start(siteKey, minutes) {
    const releaseAt = await storage.grantGracePeriod(siteKey, minutes);
    if (!releaseAt) return 0;
    indicator.showGraceIndicator(releaseAt);
    scheduleReturn(siteKey, releaseAt - Date.now());
    return releaseAt;
  }

  function showActive(siteKey, releaseAt) {
    if (!releaseAt || releaseAt <= Date.now()) {
      indicator.clearGraceIndicator();
      return;
    }
    indicator.showGraceIndicator(releaseAt);
    scheduleReturn(siteKey, releaseAt - Date.now());
  }

  async function clear(siteKey) {
    await storage.clearGracePeriod(siteKey);
    indicator.clearGraceIndicator();
    stateApi.clearTimer(siteKey);
  }

  Content.grace = {
    setReturnHandler,
    start,
    showActive,
    clear
  };
})();

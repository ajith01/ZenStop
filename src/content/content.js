(() => {
  const Content = globalThis.ZenStopContent || {};
  const constants = Content.constants;
  const stateApi = Content.state;
  const helpers = Content.helpers;
  const storage = Content.storage;
  const indicator = Content.indicator;
  const overlay = Content.overlay;
  const grace = Content.grace;
  const zenUtils = globalThis.ZenStopUtils || {};
  const buildBlockedList = zenUtils.buildBlockedList;
  const resolveGoalValue = zenUtils.resolveGoalValue;
  const calculateGoalStreak = zenUtils.calculateGoalStreak;

  if (!constants || !stateApi || !helpers || !storage || !indicator || !overlay || !grace) {
    throw new Error("ZenStop content modules not loaded");
  }
  if (!buildBlockedList || !resolveGoalValue || !calculateGoalStreak) {
    throw new Error("ZenStop utils not loaded");
  }

  grace.setReturnHandler(evaluateSite);
  initialize();

  function initialize() {
    observeRuntimeMessages();
    observeHistoryNavigation();
    observeStorageChanges();
    evaluateSite();
    stateApi.addInterval(checkForUrlChange, constants.URL_CHECK_INTERVAL_MS);
    stateApi.addInterval(evaluateSite, constants.SITE_RECHECK_INTERVAL_MS);
  }

  function observeRuntimeMessages() {
    if (!chrome?.runtime?.onMessage) return;
    chrome.runtime.onMessage.addListener((message) => {
      if (!message || typeof message !== "object") return;
      if (message.type !== constants.GRACE_EXPIRED_MESSAGE) return;
      evaluateSite();
    });
  }

  function observeHistoryNavigation() {
    const originalPushState = history.pushState;
    history.pushState = (...args) => {
      const result = originalPushState.apply(history, args);
      checkForUrlChange(true);
      return result;
    };
    window.addEventListener("popstate", () => checkForUrlChange(true));
  }

  function observeStorageChanges() {
    if (!chrome?.storage?.onChanged) return;
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "sync") return;
      const hasRelevant = constants.WATCHED_SYNC_KEYS.some((key) =>
        Object.prototype.hasOwnProperty.call(changes, key)
      );
      if (hasRelevant) {
        evaluateSite();
      }
    });
  }

  function checkForUrlChange(force = false) {
    if (!force && location.href === stateApi.state.lastHref) return;
    stateApi.state.lastHref = location.href;
    evaluateSite();
  }

  async function evaluateSite() {
    if (!helpers.isExtensionContextValid()) {
      cleanupIntervals();
      return;
    }
    if (stateApi.state.evaluating) return;
    stateApi.state.evaluating = true;
    try {
      if (shouldSkipBlocking()) {
        indicator.clearGraceIndicator();
        return;
      }
      const settings = await storage.loadSettings();
      const blockedSites = buildBlockedList(
        settings.blockedSites,
        settings.blockAdultSites,
        settings.customAdultSites,
        constants.ADULT_SITES
      );
      if (!blockedSites.length) {
        indicator.clearGraceIndicator();
        return;
      }

      const hostInfo = helpers.resolveBlockedSite(blockedSites);
      if (!hostInfo) {
        indicator.clearGraceIndicator();
        return;
      }

      await handleBlockedSite(settings, hostInfo);
    } finally {
      stateApi.state.evaluating = false;
    }
  }

  function shouldSkipBlocking() {
    if (location.protocol.startsWith("chrome")) return true;
    const overlayEl = document.getElementById(constants.OVERLAY_ID);
    if (!overlayEl) return false;
    if (!overlayEl.querySelector("#zenstop-countdown-value")) {
      overlayEl.remove();
      return false;
    }
    return true;
  }

  async function handleBlockedSite(settings, hostInfo) {
    const { siteKey } = hostInfo;
    const graceRelease = await storage.readGraceRelease(siteKey);
    if (graceRelease > Date.now()) {
      grace.showActive(siteKey, graceRelease);
      return;
    }

    indicator.clearGraceIndicator();
    const visitContext = await storage.recordVisit(settings, siteKey);
    helpers.stopAutoplayMedia();
    const overlayContext = buildOverlayContext(settings, hostInfo, visitContext);
    overlay.injectOverlay(settings.waitSeconds, settings.redirectUrl, overlayContext);
  }

  function buildOverlayContext(settings, hostInfo, visitContext) {
    const goalValue = resolveGoalValue(settings.visitGoals, settings.visitGoalDefault, hostInfo.siteKey);
    const streak = calculateGoalStreak(
      visitContext.historyMap,
      settings.openHistory,
      hostInfo.siteKey,
      visitContext.todayKey,
      goalValue
    );

    return {
      siteLabel: hostInfo.label,
      siteKey: hostInfo.siteKey,
      dailyStats: visitContext.dailyStats,
      successTotals: visitContext.successTotals,
      allowedMinutes: settings.allowedMinutes,
      openHistory: settings.openHistory,
      visitGoals: settings.visitGoals,
      visitGoalDefault: settings.visitGoalDefault,
      themeMode: settings.themeMode,
      intentTags: settings.intentTags,
      streak
    };
  }

  function cleanupIntervals() {
    stateApi.clearIntervals();
    stateApi.clearAllTimers();
    indicator.clearGraceIndicator();
  }
})();

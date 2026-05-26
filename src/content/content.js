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
  const normalizeEntry = zenUtils.normalizeEntry;
  const calculateGoalStreak = zenUtils.calculateGoalStreak;

  if (!constants || !stateApi || !helpers || !storage || !indicator || !overlay || !grace) {
    throw new Error("ZenStop content modules not loaded");
  }
  if (!buildBlockedList || !resolveGoalValue || !normalizeEntry || !calculateGoalStreak) {
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
      const primaryBlockedSites = buildBlockedList(
        settings.blockedSites,
        settings.blockAdultSites,
        settings.customAdultSites,
        constants.ADULT_SITES
      );
      const blockedSites = mergeBlockedSites(primaryBlockedSites, settings.goalSets);
      if (!blockedSites.length) {
        indicator.clearGraceIndicator();
        return;
      }

      const hostInfo = helpers.resolveBlockedSite(blockedSites);
      if (!hostInfo) {
        indicator.clearGraceIndicator();
        return;
      }

      const goalValue = resolveEffectiveGoalValue(
        settings,
        hostInfo.siteKey,
        location.hostname.toLowerCase(),
        primaryBlockedSites
      );
      await handleBlockedSite(settings, hostInfo, goalValue);
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

  async function handleBlockedSite(settings, hostInfo, goalValue) {
    const { siteKey } = hostInfo;
    const graceRelease = await storage.readGraceRelease(siteKey);
    if (graceRelease > Date.now()) {
      grace.showActive(siteKey, graceRelease);
      return;
    }

    indicator.clearGraceIndicator();
    const visitContext = await storage.recordVisit(settings, siteKey);
    helpers.stopAutoplayMedia();
    const overlayContext = buildOverlayContext(settings, hostInfo, visitContext, goalValue);
    overlay.injectOverlay(settings.waitSeconds, settings.redirectUrl, overlayContext);
  }

  function buildOverlayContext(settings, hostInfo, visitContext, goalValue) {
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
      goalValue,
      themeMode: settings.themeMode,
      intentTags: settings.intentTags,
      streak
    };
  }

  function mergeBlockedSites(primarySites, goalSets) {
    const combined = [...primarySites];
    (Array.isArray(goalSets) ? goalSets : []).forEach((set) => {
      if (Array.isArray(set.blockedSites)) {
        combined.push(...set.blockedSites);
      }
    });
    return dedupeByNormalized(combined);
  }

  function dedupeByNormalized(entries) {
    const seen = new Set();
    return entries.filter((entry) => {
      const normalized = normalizeEntry(entry);
      if (!normalized || seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    });
  }

  function resolveEffectiveGoalValue(settings, siteKey, hostname, primaryBlockedSites) {
    const candidates = [];
    if (matchesSite(hostname, primaryBlockedSites)) {
      const value = resolveGoalValue(settings.visitGoals, settings.visitGoalDefault, siteKey);
      if (Number.isFinite(value) && value > 0) candidates.push(value);
    }

    (Array.isArray(settings.goalSets) ? settings.goalSets : []).forEach((set) => {
      if (!set || !Array.isArray(set.blockedSites)) return;
      if (!matchesSite(hostname, set.blockedSites)) return;
      const value = resolveGoalValue(set.visitGoals, set.visitGoalDefault, siteKey);
      if (Number.isFinite(value) && value > 0) candidates.push(value);
    });

    if (!candidates.length) return null;
    return Math.min(...candidates);
  }

  function matchesSite(hostname, entries) {
    if (!hostname || !Array.isArray(entries)) return false;
    return entries.some((entry) => {
      const normalized = normalizeEntry(entry);
      return normalized ? helpers.isHostMatch(hostname, normalized) : false;
    });
  }

  function cleanupIntervals() {
    stateApi.clearIntervals();
    stateApi.clearAllTimers();
    indicator.clearGraceIndicator();
  }
})();

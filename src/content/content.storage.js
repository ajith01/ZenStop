(() => {
  const Content = (globalThis.ZenStopContent = globalThis.ZenStopContent || {});
  const constants = Content.constants;
  const helpers = Content.helpers;
  const zenUtils = globalThis.ZenStopUtils || {};
  const normalizeDailyStats = zenUtils.normalizeDailyStats;
  const capRecordMap = zenUtils.capRecordMap;
  const capHistoryMap = zenUtils.capHistoryMap;

  if (!constants || !helpers || !normalizeDailyStats || !capRecordMap || !capHistoryMap) return;

  async function loadSettings() {
    if (!helpers.isExtensionContextValid()) {
      throw new Error("Extension context invalidated");
    }
    const {
      blockedSites = [],
      waitSeconds = constants.DEFAULT_WAIT_SECONDS,
      redirectUrl = "",
      dailyStats,
      history,
      visitHistory,
      successHistory,
      allowedMinutes = constants.DEFAULT_ALLOWED_MINUTES,
      blockAdultSites = true,
      customAdultSites = [],
      openHistory,
      goalSets = [],
      visitGoals = {},
      visitGoalDefault = constants.DEFAULT_VISIT_GOAL,
      themeMode = "auto",
      intentTags = []
    } = await chrome.storage.sync.get(constants.SETTINGS_SYNC_KEYS);

    return {
      blockedSites,
      waitSeconds: helpers.normalizePositiveNumber(
        waitSeconds,
        constants.DEFAULT_WAIT_SECONDS,
        constants.MIN_WAIT_SECONDS
      ),
      redirectUrl: helpers.normalizeRedirect(redirectUrl),
      dailyStats,
      visitHistory,
      successHistory,
      history,
      openHistory: helpers.normalizeRecordMap(openHistory),
      allowedMinutes: helpers.normalizePositiveNumber(
        allowedMinutes,
        constants.DEFAULT_ALLOWED_MINUTES,
        constants.MIN_ALLOWED_MINUTES
      ),
      blockAdultSites: typeof blockAdultSites === "boolean" ? blockAdultSites : true,
      customAdultSites: Array.isArray(customAdultSites) ? customAdultSites : [],
      goalSets: normalizeGoalSets(goalSets),
      visitGoals: helpers.normalizeRecordMap(visitGoals),
      visitGoalDefault: helpers.normalizePositiveNumber(visitGoalDefault, constants.DEFAULT_VISIT_GOAL, 1),
      themeMode: typeof themeMode === "string" && themeMode ? themeMode : "auto",
      intentTags: Array.isArray(intentTags) ? intentTags.slice(0, constants.MAX_CUSTOM_TAGS) : []
    };
  }

  async function recordVisit(settings, siteKey) {
    const todayKey = helpers.getTodayKey();
    const dailyStats = normalizeDailyStats(settings.dailyStats, todayKey);
    const visits = { ...dailyStats.visits };
    const bails = { ...dailyStats.bails };
    const opens = { ...dailyStats.opens };
    const visitHistory = helpers.normalizeRecordMap(settings.visitHistory);
    const successTotals = helpers.normalizeRecordMap(settings.successHistory);
    const historyMap = helpers.normalizeRecordMap(settings.history);

    visits[siteKey] = (visits[siteKey] || 0) + 1;
    dailyStats.visits = visits;
    dailyStats.opens = opens;
    dailyStats.bails = bails;

    const domainHistory = { ...(historyMap[siteKey] || {}) };
    domainHistory[todayKey] = (domainHistory[todayKey] || 0) + 1;
    historyMap[siteKey] = domainHistory;

    visitHistory[todayKey] = (visitHistory[todayKey] || 0) + 1;

    if (helpers.isExtensionContextValid()) {
      await chrome.storage.sync.set({
        dailyStats,
        history: capHistoryMap(historyMap),
        visitHistory: capRecordMap(visitHistory),
        successHistory: capRecordMap(successTotals)
      });
    }

    return { dailyStats, successTotals, historyMap, todayKey };
  }

  async function recordOpenOutcome({ dailyStats, openHistory, siteKey }) {
    const todayKey = helpers.getTodayKey();
    const opens = { ...(dailyStats.opens || {}) };
    opens[siteKey] = (opens[siteKey] || 0) + 1;
    dailyStats.opens = opens;

    const openHistoryMap = helpers.normalizeRecordMap(openHistory);
    const perSiteOpens = { ...(openHistoryMap[siteKey] || {}) };
    perSiteOpens[todayKey] = (perSiteOpens[todayKey] || 0) + 1;
    openHistoryMap[siteKey] = perSiteOpens;
    if (helpers.isExtensionContextValid()) {
      await chrome.storage.sync.set({
        dailyStats,
        openHistory: capHistoryMap(openHistoryMap)
      });
    }
    return { dailyStats, openHistory: openHistoryMap, todayKey };
  }

  async function recordBailOutcome({ dailyStats, successTotals, siteKey }) {
    const bails = { ...dailyStats.bails };
    bails[siteKey] = (bails[siteKey] || 0) + 1;
    dailyStats.bails = bails;
    const updatedSuccess = { ...successTotals };
    const todayKey = helpers.getTodayKey();
    updatedSuccess[todayKey] = (updatedSuccess[todayKey] || 0) + 1;
    if (helpers.isExtensionContextValid()) {
      await chrome.storage.sync.set({
        dailyStats,
        successHistory: capRecordMap(updatedSuccess)
      });
    }
    return { dailyStats, successTotals: updatedSuccess, todayKey };
  }

  async function readGraceRelease(siteKey) {
    if (!helpers.isExtensionContextValid()) return 0;
    const now = Date.now();
    const { [constants.GRACE_KEY]: stored = {} } = await chrome.storage.local.get(constants.GRACE_KEY);
    let dirty = false;
    Object.keys(stored).forEach((key) => {
      if (!stored[key] || stored[key] <= now) {
        delete stored[key];
        dirty = true;
      }
    });
    if (dirty) {
      await chrome.storage.local.set({ [constants.GRACE_KEY]: stored });
    }
    return stored[siteKey] || 0;
  }

  async function grantGracePeriod(siteKey, minutes) {
    if (!helpers.isExtensionContextValid()) return 0;
    if (!siteKey || !minutes) return 0;
    const durationMs = Math.max(constants.MIN_ALLOWED_MINUTES, minutes) * 60 * 1000;
    const { [constants.GRACE_KEY]: stored = {} } = await chrome.storage.local.get(constants.GRACE_KEY);
    const releaseAt = Date.now() + durationMs;
    stored[siteKey] = releaseAt;
    await chrome.storage.local.set({ [constants.GRACE_KEY]: stored });
    return releaseAt;
  }

  async function clearGracePeriod(siteKey) {
    if (!helpers.isExtensionContextValid()) return;
    if (!siteKey) return;
    const { [constants.GRACE_KEY]: stored = {} } = await chrome.storage.local.get(constants.GRACE_KEY);
    if (stored[siteKey]) {
      delete stored[siteKey];
      await chrome.storage.local.set({ [constants.GRACE_KEY]: stored });
    }
  }

  async function saveUsageReason(entry) {
    if (!chrome?.storage?.sync || !chrome?.storage?.local) return;
    let list = [];
    try {
      const { [constants.REASONS_KEY]: stored = [] } = await chrome.storage.sync.get([constants.REASONS_KEY]);
      list = Array.isArray(stored) ? stored.slice() : [];
    } catch {
      const { [constants.REASONS_KEY]: stored = [] } = await chrome.storage.local.get([constants.REASONS_KEY]);
      list = Array.isArray(stored) ? stored.slice() : [];
    }
    const safeUrl = sanitizeReasonUrl(entry.url);
    const safeReason = typeof entry.reason === "string" ? entry.reason.slice(0, 200) : "";
    list.unshift({
      siteKey: entry.siteKey,
      siteLabel: entry.siteLabel || entry.siteKey,
      reason: safeReason,
      tag: entry.tag || "",
      outcome: entry.outcome || "continue",
      url: safeUrl.slice(0, 200),
      timestamp: entry.timestamp || Date.now()
    });
    const capped = list.slice(0, constants.MAX_REASONS);
    try {
      await chrome.storage.sync.set({ [constants.REASONS_KEY]: capped });
    } catch (e) {
      console.warn("ZenStop: Failed to sync reasons, falling back to local storage", e);
      await chrome.storage.local.set({ [constants.REASONS_KEY]: capped });
    }
  }

  function sanitizeReasonUrl(value) {
    if (typeof value !== "string" || !value.trim()) return "";
    try {
      const parsed = new URL(value);
      return `${parsed.origin}${parsed.pathname}`;
    } catch {
      return "";
    }
  }

  function normalizeGoalSets(raw) {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((entry) => {
        if (!entry || typeof entry !== "object") return null;
        const blockedSites = Array.isArray(entry.blockedSites)
          ? entry.blockedSites.filter((site) => typeof site === "string" && site.trim())
          : [];
        return {
          id: typeof entry.id === "string" ? entry.id : "",
          name: typeof entry.name === "string" ? entry.name.trim() : "",
          blockedSites,
          visitGoals: helpers.normalizeRecordMap(entry.visitGoals),
          visitGoalDefault: helpers.normalizePositiveNumber(
            entry.visitGoalDefault,
            constants.DEFAULT_VISIT_GOAL,
            1
          )
        };
      })
      .filter(Boolean);
  }

  Content.storage = {
    loadSettings,
    recordVisit,
    recordOpenOutcome,
    recordBailOutcome,
    readGraceRelease,
    grantGracePeriod,
    clearGracePeriod,
    saveUsageReason
  };
})();

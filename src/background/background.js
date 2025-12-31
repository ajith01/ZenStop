const DEFAULTS = {
  blockedSites: ["facebook.com", "instagram.com"],
  waitSeconds: 15,
  redirectUrl: "https://www.google.com",
  allowedMinutes: 15,
  blockAdultSites: true,
  customAdultSites: [],
  openHistory: {},
  visitGoals: {},
  visitGoalDefault: 5,
  themeMode: "auto",
  intentTags: []
};

const MAX_INTENT_TAGS = 5;
const GRACE_ALARM_PREFIX = "zenstopGrace:";
const GRACE_STARTED_MESSAGE = "zenstop_grace_started";
const GRACE_EXPIRED_MESSAGE = "zenstop_grace_expired";
const OVERLAY_SHOWN_MESSAGE = "zenstop_overlay_shown";
const OVERLAY_RESOLVED_MESSAGE = "zenstop_overlay_resolved";
const TEST_PING_MESSAGE = "zenstop_test_ping";
const OVERLAY_SESSIONS_KEY = "overlaySessions";

const overlaySessionsByTab = new Map();

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  const current = await chrome.storage.sync.get([
    "blockedSites",
    "waitSeconds",
    "redirectUrl",
    "allowedMinutes",
    "blockAdultSites",
    "customAdultSites",
    "openHistory",
    "visitGoals",
    "visitGoalDefault",
    "themeMode",
    "intentTags"
  ]);
  if (reason === "install") {
    await chrome.storage.sync.set(DEFAULTS);
    return;
  }

  const nextState = {
    blockedSites: Array.isArray(current.blockedSites) ? current.blockedSites : DEFAULTS.blockedSites,
    waitSeconds: typeof current.waitSeconds === "number" ? current.waitSeconds : DEFAULTS.waitSeconds,
    redirectUrl: typeof current.redirectUrl === "string" && current.redirectUrl.trim()
      ? current.redirectUrl
      : DEFAULTS.redirectUrl,
    allowedMinutes: typeof current.allowedMinutes === "number" && current.allowedMinutes > 0
      ? current.allowedMinutes
      : DEFAULTS.allowedMinutes,
    blockAdultSites: typeof current.blockAdultSites === "boolean"
      ? current.blockAdultSites
      : DEFAULTS.blockAdultSites,
    customAdultSites: Array.isArray(current.customAdultSites)
      ? current.customAdultSites
      : DEFAULTS.customAdultSites,
    openHistory: current.openHistory && typeof current.openHistory === "object" && !Array.isArray(current.openHistory)
      ? current.openHistory
      : DEFAULTS.openHistory,
    visitGoals: current.visitGoals && typeof current.visitGoals === "object" && !Array.isArray(current.visitGoals)
      ? current.visitGoals
      : DEFAULTS.visitGoals,
    visitGoalDefault: typeof current.visitGoalDefault === "number" && current.visitGoalDefault > 0
      ? current.visitGoalDefault
      : DEFAULTS.visitGoalDefault,
    themeMode: typeof current.themeMode === "string" && current.themeMode
      ? current.themeMode
      : DEFAULTS.themeMode,
    intentTags: Array.isArray(current.intentTags)
      ? current.intentTags.slice(0, MAX_INTENT_TAGS)
      : DEFAULTS.intentTags
  };
  await chrome.storage.sync.set(nextState);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message !== "object") return false;
  const tabId = sender?.tab?.id;
  if (!tabId) return false;

  const type = message.type;
  if (type === GRACE_STARTED_MESSAGE) {
    const siteKey = typeof message.siteKey === "string" ? message.siteKey : "";
    const releaseAt = typeof message.releaseAt === "number" ? message.releaseAt : 0;
    if (!siteKey || !releaseAt) return false;
    const alarmName = `${GRACE_ALARM_PREFIX}${tabId}:${encodeURIComponent(siteKey)}`;
    chrome.alarms.create(alarmName, { when: releaseAt });
    sendResponse?.({ ok: true });
    return true;
  }

  if (type === OVERLAY_SHOWN_MESSAGE) {
    const siteKey = typeof message.siteKey === "string" ? message.siteKey : "";
    if (!siteKey) return false;
    overlaySessionsByTab.set(tabId, siteKey);
    void hydrateOverlaySessionsCache()
      .then(() => {
        overlaySessionsByTab.set(tabId, siteKey);
        return persistOverlaySessions();
      })
      .then(
      () => sendResponse?.({ ok: true }),
      () => sendResponse?.({ ok: false })
    );
    return true;
  }

  if (type === OVERLAY_RESOLVED_MESSAGE) {
    overlaySessionsByTab.delete(tabId);
    void hydrateOverlaySessionsCache()
      .then(() => {
        overlaySessionsByTab.delete(tabId);
        return persistOverlaySessions();
      })
      .then(
      () => sendResponse?.({ ok: true }),
      () => sendResponse?.({ ok: false })
    );
    return true;
  }

  if (type === TEST_PING_MESSAGE) {
    sendResponse?.({ ok: true, version: chrome.runtime.getManifest().version });
    return true;
  }

  return false;
});

chrome.alarms.onAlarm.addListener((alarm) => {
  const name = alarm?.name || "";
  if (!name.startsWith(GRACE_ALARM_PREFIX)) return;

  const payload = name.slice(GRACE_ALARM_PREFIX.length);
  const [tabIdRaw, siteKeyEncoded] = payload.split(":");
  const tabId = Number(tabIdRaw);
  if (!Number.isFinite(tabId)) return;
  if (!siteKeyEncoded) return;

  let siteKey = "";
  try {
    siteKey = decodeURIComponent(siteKeyEncoded);
  } catch {
    return;
  }

  chrome.tabs.sendMessage(tabId, { type: GRACE_EXPIRED_MESSAGE, siteKey }).catch(() => {});
});

if (chrome?.tabs?.onRemoved) {
  chrome.tabs.onRemoved.addListener((tabId) => {
    void handleTabRemoved(tabId);
  });
}

async function handleTabRemoved(tabId) {
  try {
    await hydrateOverlaySessionsCache();
    const siteKey = overlaySessionsByTab.get(tabId) || "";
    if (!siteKey) return;
    overlaySessionsByTab.delete(tabId);
    await persistOverlaySessions();
    await recordMindfulExit(siteKey);
  } catch {
    // ignore
  }
}

let overlayCacheHydrated = false;

async function hydrateOverlaySessionsCache() {
  if (overlayCacheHydrated) return;
  const { [OVERLAY_SESSIONS_KEY]: stored = {} } = await chrome.storage.local.get([OVERLAY_SESSIONS_KEY]);
  if (stored && typeof stored === "object") {
    Object.entries(stored).forEach(([tabIdRaw, entry]) => {
      const tabId = Number(tabIdRaw);
      if (!Number.isFinite(tabId)) return;
      const siteKey = typeof entry?.siteKey === "string" ? entry.siteKey : "";
      if (!siteKey) return;
      overlaySessionsByTab.set(tabId, siteKey);
    });
  }
  overlayCacheHydrated = true;
}

async function persistOverlaySessions() {
  const payload = {};
  overlaySessionsByTab.forEach((siteKey, tabId) => {
    payload[String(tabId)] = { siteKey, timestamp: Date.now() };
  });
  await chrome.storage.local.set({ [OVERLAY_SESSIONS_KEY]: payload });
}

async function recordMindfulExit(siteKey) {
  const todayKey = getTodayKey();
  const { dailyStats, successHistory = {} } = await chrome.storage.sync.get(["dailyStats", "successHistory"]);
  const normalized = normalizeDailyStats(dailyStats, todayKey);
  const bails = { ...(normalized.bails || {}) };
  bails[siteKey] = (bails[siteKey] || 0) + 1;
  normalized.bails = bails;

  const updatedSuccess = successHistory && typeof successHistory === "object" ? { ...successHistory } : {};
  updatedSuccess[todayKey] = (updatedSuccess[todayKey] || 0) + 1;
  await chrome.storage.sync.set({ dailyStats: normalized, successHistory: updatedSuccess });
}

function normalizeDailyStats(value, todayKey) {
  if (value && value.date === todayKey) {
    return {
      date: todayKey,
      visits: value.visits || {},
      bails: value.bails || {},
      opens: value.opens || {}
    };
  }
  return { date: todayKey, visits: {}, bails: {}, opens: {} };
}

function getTodayKey() {
  return formatDateKey(new Date());
}

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

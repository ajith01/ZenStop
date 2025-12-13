const DEFAULTS = {
  blockedSites: ["facebook.com", "instagram.com"],
  waitSeconds: 15,
  redirectUrl: "https://www.google.com",
  allowedMinutes: 15,
  blockAdultSites: true,
  customAdultSites: [],
  visitGoals: {},
  visitGoalDefault: 5,
  themeMode: "auto",
  intentTags: []
};

const MAX_INTENT_TAGS = 5;
const GRACE_ALARM_PREFIX = "zenstopGrace:";
const GRACE_STARTED_MESSAGE = "zenstop_grace_started";
const GRACE_EXPIRED_MESSAGE = "zenstop_grace_expired";

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  const current = await chrome.storage.sync.get([
    "blockedSites",
    "waitSeconds",
    "redirectUrl",
    "allowedMinutes",
    "blockAdultSites",
    "customAdultSites",
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

chrome.runtime.onMessage.addListener((message, sender) => {
  if (!message || typeof message !== "object") return;
  if (message.type !== GRACE_STARTED_MESSAGE) return;
  const tabId = sender?.tab?.id;
  const siteKey = typeof message.siteKey === "string" ? message.siteKey : "";
  const releaseAt = typeof message.releaseAt === "number" ? message.releaseAt : 0;
  if (!tabId || !siteKey || !releaseAt) return;

  const alarmName = `${GRACE_ALARM_PREFIX}${tabId}:${encodeURIComponent(siteKey)}`;
  chrome.alarms.create(alarmName, { when: releaseAt });
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

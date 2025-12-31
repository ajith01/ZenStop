const isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;

const asArray = (value) => (Array.isArray(value) ? value : []);

const padTwoDigits = (value) => String(value).padStart(2, "0");

const pluralize = (count, singular, plural) => (count === 1 ? singular : plural);

function normalizeEntry(entry) {
  if (!isNonEmptyString(entry)) return "";
  const trimmed = entry.trim().toLowerCase();
  const noProtocol = trimmed.replace(/^https?:\/\//, "");
  const host = noProtocol.split(/[/?#:]/)[0];
  return host.replace(/^\.+/, "");
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

function buildBlockedList(userSites = [], blockAdultSites = true, customAdultSites = [], adultSites = []) {
  const combined = [...asArray(userSites)];
  if (blockAdultSites) {
    combined.push(...asArray(adultSites), ...asArray(customAdultSites));
  }
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

function resolveGoalValue(visitGoals, visitGoalDefault, siteKey) {
  const siteGoal = visitGoals?.[siteKey];
  if (typeof siteGoal === "number" && siteGoal > 0) return siteGoal;
  if (typeof visitGoalDefault === "number" && visitGoalDefault > 0) return visitGoalDefault;
  return null;
}

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = padTwoDigits(date.getMonth() + 1);
  const day = padTwoDigits(date.getDate());
  return `${year}-${month}-${day}`;
}

function parseDateKey(value) {
  if (!isNonEmptyString(value)) return new Date();
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return new Date();
  return new Date(year, month - 1, day);
}

function calculateGoalStreak(historyMap, openHistory, siteKey, todayKey, goalValue) {
  const goal = Number(goalValue);
  if (!siteKey || !Number.isFinite(goal) || goal <= 0) return 0;

  const perVisitHistory = historyMap?.[siteKey] || {};
  const perOpenHistory = openHistory?.[siteKey] || {};
  const dateKeys = collectDateKeys(perVisitHistory, perOpenHistory);
  if (!dateKeys.length) return 0;

  const earliestKey = findEarliestKey(dateKeys);
  if (!earliestKey || earliestKey > todayKey) return 0;

  return countGoalDays(perOpenHistory, todayKey, earliestKey, goal);
}

function collectDateKeys(perVisitHistory, perOpenHistory) {
  const combined = [...Object.keys(perVisitHistory), ...Object.keys(perOpenHistory)];
  return [...new Set(combined)];
}

function findEarliestKey(dateKeys) {
  return dateKeys.reduce((earliest, key) => (!earliest || key < earliest ? key : earliest), "");
}

function countGoalDays(perOpenHistory, todayKey, earliestKey, goal) {
  let streak = 0;
  const cursor = parseDateKey(todayKey);
  const earliestDate = parseDateKey(earliestKey);
  while (cursor >= earliestDate) {
    const key = formatDateKey(cursor);
    const openCount = Number(perOpenHistory[key]) || 0;
    if (openCount > goal) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function formatCountdown(remainingMs) {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${padTwoDigits(minutes)}:${padTwoDigits(seconds)}`;
  }
  return `${minutes}:${padTwoDigits(seconds)}`;
}

function formatStreak(value) {
  const count = Number(value) || 0;
  return `${count} ${pluralize(count, "day", "days")}`;
}

const ZenStopUtils = {
  normalizeEntry,
  normalizeDailyStats,
  buildBlockedList,
  resolveGoalValue,
  formatDateKey,
  parseDateKey,
  calculateGoalStreak,
  formatCountdown,
  formatStreak
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = ZenStopUtils;
}

if (typeof globalThis !== "undefined") {
  globalThis.ZenStopUtils = ZenStopUtils;
}

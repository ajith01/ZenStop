(() => {
  const Popup = (window.ZenStopPopup = window.ZenStopPopup || {});
  const STORAGE_KEYS = [
    "blockedSites",
    "waitSeconds",
    "dailyStats",
    "blockAdultSites",
    "customAdultSites",
    "themeMode"
  ];
  const DEFAULT_WAIT_SECONDS = 10;
  const MIN_WAIT_SECONDS = 3;
  const DEFAULT_THEME = "auto";

  async function loadSettings(todayKey) {
    const raw = await chrome.storage.sync.get(STORAGE_KEYS);
    return normalizeSettings(raw, todayKey);
  }

  async function loadQuickBlockSettings() {
    const raw = await chrome.storage.sync.get(["blockedSites", "customAdultSites", "blockAdultSites"]);
    return {
      blockedSites: Array.isArray(raw.blockedSites) ? raw.blockedSites : [],
      customAdultSites: Array.isArray(raw.customAdultSites) ? raw.customAdultSites : [],
      blockAdultSites: typeof raw.blockAdultSites === "boolean" ? raw.blockAdultSites : true
    };
  }

  function normalizeSettings(raw, todayKey) {
    const blockedSites = Array.isArray(raw.blockedSites) ? raw.blockedSites : [];
    const customAdultSites = Array.isArray(raw.customAdultSites) ? raw.customAdultSites : [];
    const blockAdultSites = typeof raw.blockAdultSites === "boolean" ? raw.blockAdultSites : true;
    const waitSeconds = normalizePositiveNumber(raw.waitSeconds, DEFAULT_WAIT_SECONDS, MIN_WAIT_SECONDS);
    const themeMode = typeof raw.themeMode === "string" ? raw.themeMode : DEFAULT_THEME;

    return {
      blockedSites,
      customAdultSites,
      blockAdultSites,
      waitSeconds,
      themeMode,
      dailyStats: normalizeDailyStats(raw.dailyStats, todayKey)
    };
  }

  function normalizePositiveNumber(value, fallback, min) {
    const numberValue = Number(value);
    if (Number.isFinite(numberValue) && numberValue >= min) {
      return numberValue;
    }
    return fallback;
  }

  function normalizeDailyStats(value, todayKey) {
    if (value && value.date === todayKey) {
      return {
        date: todayKey,
        visits: value.visits || {},
        bails: value.bails || {}
      };
    }
    return { date: todayKey, visits: {}, bails: {} };
  }

  Popup.storage = {
    loadSettings,
    loadQuickBlockSettings
  };
})();

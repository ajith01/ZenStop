(() => {
  const Options = (window.ZenStopOptions = window.ZenStopOptions || {});
  const dom = Options.dom;
  const state = Options.state;
  const intentions = Options.intentions;
  if (!dom || !state || !intentions) return;

  const SETTINGS_KEYS = [
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
  ];
  const DEFAULT_WAIT_SECONDS = 10;
  const MIN_WAIT_SECONDS = 3;
  const DEFAULT_ALLOWED_MINUTES = 15;
  const MIN_ALLOWED_MINUTES = 1;
  const DEFAULT_VISIT_GOAL = 5;
  const DEFAULT_THEME = "auto";
  const STATUS_CLEAR_MS = 1500;

  async function restoreSettings() {
    const raw = await chrome.storage.sync.get(SETTINGS_KEYS);
    const settings = normalizeSettings(raw);

    if (dom.elements.blockedInput) dom.elements.blockedInput.value = settings.blockedSites.join("\n");
    if (dom.elements.secondsInput) dom.elements.secondsInput.value = settings.waitSeconds;
    if (dom.elements.redirectInput) dom.elements.redirectInput.value = settings.redirectUrl;
    if (dom.elements.allowedMinutesInput) dom.elements.allowedMinutesInput.value = settings.allowedMinutes;
    if (dom.elements.blockAdultSitesInput) {
      dom.elements.blockAdultSitesInput.checked = settings.blockAdultSites;
    }
    if (dom.elements.customAdultSitesInput) {
      dom.elements.customAdultSitesInput.value = settings.customAdultSites.join("\n");
    }
    if (dom.elements.visitGoalsInput) {
      dom.elements.visitGoalsInput.value = formatVisitGoals(settings.visitGoals);
    }
    if (dom.elements.visitGoalDefaultInput) {
      dom.elements.visitGoalDefaultInput.value = settings.visitGoalDefault;
    }

    if (dom.elements.themeModeSelect) {
      dom.elements.themeModeSelect.value = settings.themeMode;
    }
    applyTheme(settings.themeMode);

    state.cachedBlockedSites = settings.blockedSites;
    state.cachedCustomAdultSites = settings.customAdultSites;
    state.currentCustomTags = intentions.normalizeCustomTags(settings.intentTags);
    intentions.renderCustomTags();
    intentions.hydrateFilterOptions();
    syncAdultVisibility();
  }

  function normalizeSettings(raw) {
    return {
      blockedSites: Array.isArray(raw.blockedSites) ? raw.blockedSites : [],
      waitSeconds: normalizePositiveNumber(raw.waitSeconds, DEFAULT_WAIT_SECONDS, MIN_WAIT_SECONDS),
      redirectUrl: normalizeRedirect(raw.redirectUrl),
      allowedMinutes: normalizePositiveNumber(raw.allowedMinutes, DEFAULT_ALLOWED_MINUTES, MIN_ALLOWED_MINUTES),
      blockAdultSites: typeof raw.blockAdultSites === "boolean" ? raw.blockAdultSites : true,
      customAdultSites: Array.isArray(raw.customAdultSites) ? raw.customAdultSites : [],
      visitGoals: raw.visitGoals && typeof raw.visitGoals === "object" && !Array.isArray(raw.visitGoals) ? raw.visitGoals : {},
      visitGoalDefault: normalizePositiveNumber(raw.visitGoalDefault, DEFAULT_VISIT_GOAL, 1),
      themeMode: typeof raw.themeMode === "string" ? raw.themeMode : DEFAULT_THEME,
      intentTags: Array.isArray(raw.intentTags) ? raw.intentTags : []
    };
  }

  function normalizePositiveNumber(value, fallback, min) {
    const numberValue = Number(value);
    if (Number.isFinite(numberValue) && numberValue >= min) {
      return numberValue;
    }
    return fallback;
  }

  function normalizeRedirect(value) {
    if (typeof value !== "string") return "";
    const trimmed = value.trim();
    if (!trimmed) return "";
    const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    try {
      const parsed = new URL(candidate);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return "";
      }
      if (parsed.pathname === "/" && !parsed.search && !parsed.hash) {
        return parsed.origin;
      }
      return parsed.toString();
    } catch {
      return "";
    }
  }

  async function saveSettings() {
    const blockedSites = parseLineList(dom.elements.blockedInput?.value || "");
    const waitSeconds = normalizePositiveNumber(dom.elements.secondsInput?.value, DEFAULT_WAIT_SECONDS, MIN_WAIT_SECONDS);
    const redirectUrl = normalizeRedirect(dom.elements.redirectInput?.value || "");
    const allowedMinutes = normalizePositiveNumber(
      dom.elements.allowedMinutesInput?.value,
      DEFAULT_ALLOWED_MINUTES,
      MIN_ALLOWED_MINUTES
    );
    const blockAdultSites = Boolean(dom.elements.blockAdultSitesInput?.checked);
    const customAdultSites = parseLineList(dom.elements.customAdultSitesInput?.value || "");
    const visitGoals = parseVisitGoals(dom.elements.visitGoalsInput?.value || "");
    const visitGoalDefault = normalizePositiveNumber(dom.elements.visitGoalDefaultInput?.value, DEFAULT_VISIT_GOAL, 1);
    const themeMode = dom.elements.themeModeSelect?.value || DEFAULT_THEME;

    await chrome.storage.sync.set({
      blockedSites,
      waitSeconds,
      redirectUrl,
      allowedMinutes,
      blockAdultSites,
      customAdultSites,
      visitGoals,
      visitGoalDefault,
      themeMode,
      intentTags: state.currentCustomTags
    });
    setStatus("Saved!");
  }

  function setStatus(message) {
    if (!dom.elements.status) return;
    dom.elements.status.textContent = message;
    setTimeout(() => {
      dom.elements.status.textContent = "";
    }, STATUS_CLEAR_MS);
  }

  function parseLineList(value) {
    return value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  }

  function syncAdultVisibility() {
    if (!dom.elements.blockAdultSitesInput || !dom.elements.customAdultWrapper) return;
    const enabled = Boolean(dom.elements.blockAdultSitesInput.checked);
    if (!enabled && dom.elements.customAdultWrapper.open) {
      dom.elements.customAdultWrapper.open = false;
    }
    dom.elements.customAdultWrapper.classList.toggle("hidden", !enabled);
  }

  function applyTheme(mode) {
    const target = document.documentElement;
    if (!target) return;
    const valid = ["auto", "light", "dark"].includes(mode) ? mode : DEFAULT_THEME;
    target.dataset.theme = valid;
  }

  function parseVisitGoals(raw) {
    if (!raw || typeof raw !== "string") return {};
    const lines = raw.split("\n").map((line) => line.trim()).filter(Boolean);
    const goals = {};
    lines.forEach((line) => {
      const [site, value] = line.split(":").map((part) => (part || "").trim());
      if (!site) return;
      const normalizedSite = site.toLowerCase();
      const goalNum = Number(value);
      if (Number.isFinite(goalNum) && goalNum > 0) {
        goals[normalizedSite] = Math.floor(goalNum);
      }
    });
    return goals;
  }

  function formatVisitGoals(goals) {
    if (!goals || typeof goals !== "object") return "";
    return Object.entries(goals)
      .map(([site, value]) => `${site}: ${value}`)
      .join("\n");
  }

  Options.settings = {
    DEFAULT_THEME,
    restoreSettings,
    saveSettings,
    syncAdultVisibility,
    applyTheme
  };
})();

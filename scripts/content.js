const OVERLAY_ID = "zenstop-overlay";
const OVERLAY_STYLE_ID = "zenstop-overlay-style";
const GRACE_KEY = "gracePeriods";
const GRACE_EXPIRED_MESSAGE = "zenstop_grace_expired";
const GRACE_STARTED_MESSAGE = "zenstop_grace_started";
const OVERLAY_SHOWN_MESSAGE = "zenstop_overlay_shown";
const OVERLAY_RESOLVED_MESSAGE = "zenstop_overlay_resolved";
const REASONS_KEY = "usageReasons";
const MAX_REASONS = 50;
const MAX_CUSTOM_TAGS = 5;
const GOALS_KEY = "visitGoals";
const GOAL_DEFAULT_KEY = "visitGoalDefault";
const THEME_KEY = "themeMode";
const INTENT_TAGS_KEY = "intentTags";
const DEFAULT_INTENT_TAGS = ["Productive", "Research", "Entertainment"];
const ADULT_SITES = [
  "pornhub.com",
  "xvideos.com",
  "xnxx.com",
  "xhamster.com",
  "youporn.com",
  "redtube.com",
  "onlyfans.com",
  "brazzers.com",
  "adultfriendfinder.com",
  "bongacams.com",
  "imagefap.com",
  "spankbang.com",
  "tube8.com",
  "fapster.com"
];

const state = {
  evaluating: false,
  lastHref: location.href,
  timers: new Map(),
  intervals: []
};

initialize();

function initialize() {
  observeRuntimeMessages();
  observeHistoryNavigation();
  observeStorageChanges();
  evaluateSite();
  state.intervals.push(setInterval(checkForUrlChange, 1200));
  state.intervals.push(setInterval(evaluateSite, 60000));
}

function observeRuntimeMessages() {
  if (!chrome?.runtime?.onMessage) return;
  chrome.runtime.onMessage.addListener((message) => {
    if (!message || typeof message !== "object") return;
    if (message.type !== GRACE_EXPIRED_MESSAGE) return;
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
    const watchedKeys = [
      "blockedSites",
      "blockAdultSites",
      "customAdultSites",
      "waitSeconds",
      "redirectUrl",
      "allowedMinutes",
      GOALS_KEY,
      GOAL_DEFAULT_KEY,
      THEME_KEY,
      INTENT_TAGS_KEY
    ];
    const hasRelevant = watchedKeys.some((key) => key in changes);
    if (hasRelevant) {
      evaluateSite();
    }
  });
}

function checkForUrlChange(force = false) {
  if (!force && location.href === state.lastHref) return;
  state.lastHref = location.href;
  evaluateSite();
}

async function evaluateSite() {
  if (!isExtensionContextValid()) {
    cleanupIntervals();
    return;
  }
  if (state.evaluating) return;
  state.evaluating = true;
  try {
    if (location.protocol.startsWith("chrome")) return;
    if (document.getElementById(OVERLAY_ID)) return;

    const settings = await loadSettings();
    const blockedSites = buildBlockedList(
      settings.blockedSites,
      settings.blockAdultSites,
      settings.customAdultSites
    );
    if (!blockedSites.length) return;

    const hostInfo = resolveBlockedSite(blockedSites);
    if (!hostInfo) return;

    const { siteKey, label } = hostInfo;
    const graceRelease = await readGraceRelease(siteKey);
    if (graceRelease > Date.now()) {
      scheduleReturn(siteKey, graceRelease - Date.now());
      return;
    }

    const visitContext = await recordVisit(settings, siteKey);
    stopAutoplayMedia();

    injectOverlay(settings.waitSeconds, settings.redirectUrl, {
      siteLabel: label,
      siteKey,
      dailyStats: visitContext.dailyStats,
      successTotals: visitContext.successTotals,
      allowedMinutes: settings.allowedMinutes,
      visitGoals: settings.visitGoals,
      visitGoalDefault: settings.visitGoalDefault,
      themeMode: settings.themeMode,
      intentTags: settings.intentTags
    });
  } finally {
    state.evaluating = false;
  }
}

async function loadSettings() {
  if (!isExtensionContextValid()) throw new Error("Extension context invalidated");
  const {
    blockedSites = [],
    waitSeconds = 10,
    redirectUrl = "",
    dailyStats,
    history,
    visitHistory,
    successHistory,
    allowedMinutes = 15,
    blockAdultSites = true,
    customAdultSites = [],
    visitGoals = {},
    visitGoalDefault = 5,
    themeMode = "auto",
    intentTags = []
  } = await chrome.storage.sync.get([
    "blockedSites",
    "waitSeconds",
    "redirectUrl",
    "dailyStats",
    "history",
    "visitHistory",
    "successHistory",
    "allowedMinutes",
    "blockAdultSites",
    "customAdultSites",
    GOALS_KEY,
    GOAL_DEFAULT_KEY,
    THEME_KEY,
    INTENT_TAGS_KEY
  ]);

  return {
    blockedSites,
    waitSeconds: Math.max(3, Number(waitSeconds) || 10),
    redirectUrl: normalizeRedirect(redirectUrl),
    dailyStats,
    visitHistory,
    successHistory,
    history,
    allowedMinutes: Math.max(1, Number(allowedMinutes) || 15),
    blockAdultSites: typeof blockAdultSites === "boolean" ? blockAdultSites : true,
    customAdultSites: Array.isArray(customAdultSites) ? customAdultSites : [],
    visitGoals: visitGoals && typeof visitGoals === "object" && !Array.isArray(visitGoals) ? visitGoals : {},
    visitGoalDefault: typeof visitGoalDefault === "number" && visitGoalDefault > 0 ? visitGoalDefault : 5,
    themeMode: typeof themeMode === "string" && themeMode ? themeMode : "auto",
    intentTags: Array.isArray(intentTags) ? intentTags.slice(0, MAX_CUSTOM_TAGS) : []
  };
}

function resolveBlockedSite(sites) {
  const hostname = location.hostname.toLowerCase();
  const match = sites
    .map((entry) => {
      const normalized = normalizeEntry(entry);
      return normalized ? { normalized, label: entry?.trim() || normalized } : null;
    })
    .filter(Boolean)
    .find(({ normalized }) => isHostMatch(hostname, normalized));

  if (!match) return null;
  return { siteKey: match.normalized, label: match.label };
}

function isHostMatch(hostname, normalized) {
  if (!hostname || !normalized) return false;
  if (hostname === normalized) return true;
  if (hostname.endsWith(`.${normalized}`)) return true;
  // Fallback to substring match to catch alternate TLDs or edge cases.
  return hostname.includes(normalized);
}

function buildBlockedList(userSites = [], blockAdultSites = true, customAdultSites = []) {
  const merged = [...(Array.isArray(userSites) ? userSites : [])];
  if (blockAdultSites) {
    merged.push(...ADULT_SITES, ...(Array.isArray(customAdultSites) ? customAdultSites : []));
  }
  const seen = new Set();
  return merged.filter((entry) => {
    const normalized = normalizeEntry(entry);
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

async function recordVisit(settings, siteKey) {
  const today = getTodayKey();
  const dailyStats = normalizeDailyStats(settings.dailyStats, today);
  const visits = { ...dailyStats.visits };
  const bails = { ...dailyStats.bails };
  const opens = { ...dailyStats.opens };
  const visitHistory = getCounterMap(settings.visitHistory);
  const successTotals = getCounterMap(settings.successHistory);
  const historyMap = getHistoryMap(settings.history);

  visits[siteKey] = (visits[siteKey] || 0) + 1;
  dailyStats.visits = visits;
  dailyStats.opens = opens;

  const domainHistory = { ...(historyMap[siteKey] || {}) };
  domainHistory[today] = (domainHistory[today] || 0) + 1;
  historyMap[siteKey] = domainHistory;

  visitHistory[today] = (visitHistory[today] || 0) + 1;

  if (isExtensionContextValid()) {
    await chrome.storage.sync.set({
      dailyStats,
      history: historyMap,
      visitHistory,
      successHistory: successTotals
    });
  }

  return { dailyStats, successTotals };
}

function injectOverlay(seconds, redirectUrl, stats = {}) {
  ensureOverlayStyles();
  const overlay = document.createElement("div");
  overlay.id = OVERLAY_ID;
  overlay.className = "zenstop-backdrop";
  overlay.innerHTML = `
    <div class="zenstop-panel">
      <div class="zenstop-label-row">
        <span class="zenstop-label">Pause checkpoint</span>
        <span class="zenstop-badge">Deep breath</span>
      </div>
      <h1 class="zenstop-heading">Refocus before you continue</h1>
      <p class="zenstop-description">
        You marked this space as distracting. Take a beat before you dive back in.
      </p>
      <p class="zenstop-open-emphasis">
        Opens <span id="zenstop-open-count">0</span> / Goal <span id="zenstop-open-goal">-</span>
      </p>
      <div class="zenstop-breath">
        <div class="zenstop-breath-circle"></div>
        <span class="zenstop-breath-text">Inhale / Exhale</span>
      </div>
      <div class="zenstop-intent">
        <label class="zenstop-intent-label" for="zenstop-reason">Why are you opening this site?</label>
        <textarea id="zenstop-reason" class="zenstop-intent-input" placeholder="Jot your purpose or task"></textarea>
        <div class="zenstop-tag-row" role="group" aria-label="Purpose tags"></div>
        <div id="zenstop-reason-error" class="zenstop-intent-error hidden">Add a reason and choose a category.</div>
      </div>
      <div class="zenstop-actions">
        <button id="zenstop-dismiss" class="zenstop-btn zenstop-primary" disabled>
          <span id="zenstop-timer" class="zenstop-timer-inline">${seconds}</span>
          Continue
        </button>
        <button id="zenstop-redirect" class="zenstop-btn zenstop-secondary" ${redirectUrl ? "" : "disabled"}>
          It's not worth my time
        </button>
      </div>
    </div>
  `;

  const {
    siteLabel,
    siteKey,
    dailyStats,
    successTotals: initialSuccessTotals = {},
    allowedMinutes = 15,
    visitGoals = {},
    visitGoalDefault = 5,
    themeMode = "auto",
    intentTags = []
  } = stats;

  notifyOverlayShown(siteKey);

  const goalValue = typeof visitGoals?.[siteKey] === "number" && visitGoals[siteKey] > 0
    ? visitGoals[siteKey]
    : (typeof visitGoalDefault === "number" && visitGoalDefault > 0 ? visitGoalDefault : null);
  const todayOpens = (dailyStats?.opens && dailyStats.opens[siteKey]) || 0;
  const openCountEl = overlay.querySelector("#zenstop-open-count");
  const openGoalEl = overlay.querySelector("#zenstop-open-goal");
  if (openCountEl) {
    openCountEl.textContent = `${todayOpens}`;
  }
  if (openGoalEl) {
    openGoalEl.textContent = goalValue ? `${goalValue}` : "-";
  }
  const allTags = buildIntentTags(intentTags);
  const tagInputs = renderTagOptions(overlay, allTags);
  applyOverlayTheme(themeMode, overlay);

  const appendOverlay = () => {
    const host = document.body || document.documentElement;
    if (!host) return false;
    if (!overlay.isConnected) {
      try {
        host.appendChild(overlay);
      } catch {
        return false;
      }
    }
    if (document.documentElement?.style) {
      document.documentElement.style.overflow = "hidden";
    }
    return true;
  };

  if (!appendOverlay()) {
    document.addEventListener("DOMContentLoaded", () => appendOverlay(), { once: true });
  }
  const dismissButton = overlay.querySelector("#zenstop-dismiss");
  const redirectButton = overlay.querySelector("#zenstop-redirect");
  const timerEl = overlay.querySelector("#zenstop-timer");
  const reasonInput = overlay.querySelector("#zenstop-reason");
  const reasonError = overlay.querySelector("#zenstop-reason-error");
  let timerUnlocked = false;

  if (!dismissButton) return;

  if (reasonInput) {
    reasonInput.addEventListener("input", () => {
      hideReasonError();
      updateActionState();
    });
  }
  tagInputs.forEach((input) =>
    input.addEventListener("change", () => {
      hideReasonError();
      updateActionState();
    })
  );

  const getReasonText = () => reasonInput?.value.trim() || "";

  const getSelectedTag = () => {
    const selected = Array.from(tagInputs).find((input) => input.checked);
    return selected ? selected.value : "";
  };

  const collectReason = () => {
    const reason = getReasonText();
    const tag = getSelectedTag();
    if (!reason || !tag) return null;
    return { reason, tag };
  };

  const hasReason = () => Boolean(getReasonText());
  const hasTag = () => Boolean(getSelectedTag());

  const showReasonError = () => {
    reasonInput?.classList.add("zenstop-intent-missing");
    reasonError?.classList.remove("hidden");
  };

  const hideReasonError = () => {
    reasonInput?.classList.remove("zenstop-intent-missing");
    reasonError?.classList.add("hidden");
  };

  const updateActionState = () => {
    const reasonOk = hasReason();
    const tagOk = hasTag();
    if (dismissButton) {
      dismissButton.disabled = !(timerUnlocked && reasonOk && tagOk);
    }
    if (redirectButton) {
      redirectButton.disabled = !redirectUrl;
    }
  };

  const logReasonIfProvided = async (outcome) => {
    const reason = collectReason();
    if (!reason) return;
    await saveUsageReason({
      siteKey,
      siteLabel: siteLabel || siteKey,
      reason: reason.reason,
      tag: reason.tag,
      outcome,
      url: location.href
    });
  };

  let remaining = seconds;
  const interval = setInterval(() => {
    remaining -= 1;
    if (timerEl) {
      timerEl.textContent = remaining > 0 ? remaining : "";
    }
    if (remaining <= 0) {
      clearInterval(interval);
      timerUnlocked = true;
      updateActionState();
      if (dismissButton) {
        dismissButton.textContent = "Continue";
      }
    }
  }, 1000);

  const cleanup = () => {
    clearInterval(interval);
    overlay.remove();
    document.documentElement.style.overflow = "";
  };

  dismissButton.addEventListener("click", async () => {
    if (dismissButton.disabled) return;
    if (!hasReason() || !hasTag()) {
      showReasonError();
      (hasReason() ? tagInputs[0] : reasonInput)?.focus();
      return;
    }
    const opens = { ...(dailyStats.opens || {}) };
    opens[siteKey] = (opens[siteKey] || 0) + 1;
    dailyStats.opens = opens;
    await chrome.storage.sync.set({ dailyStats });
    await logReasonIfProvided("continue").catch(() => {});
    cleanup();
    await notifyOverlayResolved(siteKey, "continue");
    const releaseAt = await grantGracePeriod(siteKey, allowedMinutes);
    await notifyGraceStarted(siteKey, releaseAt);
  });

  if (redirectButton) {
    redirectButton.disabled = !redirectUrl;
    if (redirectUrl) {
      redirectButton.addEventListener("click", async () => {
        const bails = { ...dailyStats.bails };
        const nextBail = (bails[siteKey] || 0) + 1;
        bails[siteKey] = nextBail;
        dailyStats.bails = bails;
        const updatedSuccess = { ...initialSuccessTotals };
        const todayKey = getTodayKey();
        updatedSuccess[todayKey] = (updatedSuccess[todayKey] || 0) + 1;
        await logReasonIfProvided("redirect").catch(() => {});
        cleanup();
        await notifyOverlayResolved(siteKey, "redirect");
        await chrome.storage.sync.set({ dailyStats, successHistory: updatedSuccess });
        await clearGracePeriod(siteKey);
        window.location.assign(redirectUrl);
      });
    }
  }
  updateActionState();

}

function normalizeRedirect(target) {
  if (typeof target !== "string") return "";
  const trimmed = target.trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function normalizeEntry(entry) {
  if (typeof entry !== "string") return "";
  const trimmed = entry.trim().toLowerCase();
  if (!trimmed) return "";
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

function getHistoryMap(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return { ...value };
  }
  return {};
}

function getCounterMap(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return { ...value };
  }
  return {};
}

async function readGraceRelease(siteKey) {
  if (!isExtensionContextValid()) return 0;
  const now = Date.now();
  const { [GRACE_KEY]: stored = {} } = await chrome.storage.local.get(GRACE_KEY);
  let dirty = false;
  Object.keys(stored).forEach((key) => {
    if (!stored[key] || stored[key] <= now) {
      delete stored[key];
      dirty = true;
    }
  });
  if (dirty) {
    await chrome.storage.local.set({ [GRACE_KEY]: stored });
  }
  return stored[siteKey] || 0;
}

async function grantGracePeriod(siteKey, minutes) {
  if (!isExtensionContextValid()) return;
  if (!siteKey || !minutes) return;
  const durationMs = Math.max(1, minutes) * 60 * 1000;
  const { [GRACE_KEY]: stored = {} } = await chrome.storage.local.get(GRACE_KEY);
  const releaseAt = Date.now() + durationMs;
  stored[siteKey] = releaseAt;
  await chrome.storage.local.set({ [GRACE_KEY]: stored });
  scheduleReturn(siteKey, durationMs);
  return releaseAt;
}

async function notifyGraceStarted(siteKey, releaseAt) {
  if (!isExtensionContextValid()) return;
  if (!siteKey || !releaseAt) return;
  try {
    await chrome.runtime.sendMessage({
      type: GRACE_STARTED_MESSAGE,
      siteKey,
      releaseAt
    });
  } catch {
    // Ignore messaging failures (e.g., background asleep); content timers still act as fallback.
  }
}

async function notifyOverlayShown(siteKey) {
  if (!isExtensionContextValid()) return;
  if (!siteKey) return;
  try {
    await chrome.runtime.sendMessage({
      type: OVERLAY_SHOWN_MESSAGE,
      siteKey,
      timestamp: Date.now()
    });
  } catch {
    // ignore
  }
}

async function notifyOverlayResolved(siteKey, outcome) {
  if (!isExtensionContextValid()) return;
  if (!siteKey) return;
  try {
    await chrome.runtime.sendMessage({
      type: OVERLAY_RESOLVED_MESSAGE,
      siteKey,
      outcome: outcome || "unknown",
      timestamp: Date.now()
    });
  } catch {
    // ignore
  }
}

async function clearGracePeriod(siteKey) {
  if (!isExtensionContextValid()) return;
  if (!siteKey) return;
  const { [GRACE_KEY]: stored = {} } = await chrome.storage.local.get(GRACE_KEY);
  if (stored[siteKey]) {
    delete stored[siteKey];
    await chrome.storage.local.set({ [GRACE_KEY]: stored });
  }
  const timeout = state.timers.get(siteKey);
  if (timeout) {
    clearTimeout(timeout);
    state.timers.delete(siteKey);
  }
}

function scheduleReturn(siteKey, delayMs) {
  if (!siteKey || !delayMs || delayMs <= 0) return;
  const existing = state.timers.get(siteKey);
  if (existing) clearTimeout(existing);
  const timeout = setTimeout(() => {
    state.timers.delete(siteKey);
    evaluateSite();
  }, delayMs);
  state.timers.set(siteKey, timeout);
}

async function saveUsageReason(entry) {
  if (!isExtensionContextValid()) return;
  const { [REASONS_KEY]: stored = [] } = await chrome.storage.sync.get([REASONS_KEY]);
  const list = Array.isArray(stored) ? stored.slice() : [];
  list.unshift({
    siteKey: entry.siteKey,
    siteLabel: entry.siteLabel || entry.siteKey,
    reason: entry.reason || "",
    tag: entry.tag || "",
    outcome: entry.outcome || "continue",
    url: entry.url || "",
    timestamp: entry.timestamp || Date.now()
  });
  const capped = list.slice(0, MAX_REASONS);
  await chrome.storage.sync.set({ [REASONS_KEY]: capped });
}

function stopAutoplayMedia() {
  document.querySelectorAll("video, audio").forEach((el) => {
    try {
      el.pause?.();
      el.muted = true;
      if (!Number.isNaN(el.currentTime)) {
        el.currentTime = 0;
      }
    } catch (err) {
      // ignore
    }
  });
}

function ensureOverlayStyles() {
  if (document.getElementById(OVERLAY_STYLE_ID)) return;
  const link = document.createElement("link");
  link.id = OVERLAY_STYLE_ID;
  link.rel = "stylesheet";
  link.href = chrome.runtime.getURL("styles/overlay.css");

  const appendLink = () => {
    if (document.head) {
      document.head.appendChild(link);
      return true;
    }
    if (document.documentElement && !link.isConnected) {
      document.documentElement.appendChild(link);
      return true;
    }
    return false;
  };

  if (!appendLink()) {
    document.addEventListener("DOMContentLoaded", appendLink, { once: true });
  }
}

function applyOverlayTheme(mode, overlay) {
  if (!overlay) return;
  overlay.dataset.theme = resolveTheme(mode);
}

function resolveTheme(mode) {
  if (mode === "dark") return "dark";
  if (mode === "light") return "light";
  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  return prefersDark ? "dark" : "light";
}

function buildIntentTags(customTags = []) {
  const safeCustom = normalizeCustomTags(customTags);
  const combined = [...DEFAULT_INTENT_TAGS, ...safeCustom];
  const seen = new Set();
  return combined.filter((tag) => {
    const key = tag.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeCustomTags(tags) {
  if (!Array.isArray(tags)) return [];
  const seen = new Set();
  const result = [];
  tags.forEach((tag) => {
    if (typeof tag !== "string") return;
    const trimmed = tag.trim();
    if (!trimmed) return;
    const key = trimmed.toLowerCase();
    if (seen.has(key) || result.length >= MAX_CUSTOM_TAGS) return;
    seen.add(key);
    result.push(trimmed);
  });
  return result;
}

function renderTagOptions(overlay, tags) {
  const row = overlay.querySelector(".zenstop-tag-row");
  if (!row) return [];
  row.innerHTML = "";
  tags.forEach((tag, index) => {
    const id = `zenstop-tag-${index}`;
    const label = document.createElement("label");
    label.className = "zenstop-tag";
    const input = document.createElement("input");
    input.type = "radio";
    input.name = "zenstop-tag";
    input.value = tag;
    input.id = id;
    const span = document.createElement("span");
    span.textContent = tag;
    label.appendChild(input);
    label.appendChild(span);
    row.appendChild(label);
  });
  return row.querySelectorAll('input[name="zenstop-tag"]');
}

function getTodayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isExtensionContextValid() {
  return typeof chrome !== "undefined" && chrome.runtime && Boolean(chrome.runtime.id);
}

function cleanupIntervals() {
  state.intervals.forEach((intervalId) => clearInterval(intervalId));
  state.intervals.length = 0;
  state.timers.forEach((timeoutId) => clearTimeout(timeoutId));
  state.timers.clear();
}

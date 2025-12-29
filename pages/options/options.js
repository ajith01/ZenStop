const blockedInput = document.getElementById("blocked");
const secondsInput = document.getElementById("seconds");
const redirectInput = document.getElementById("redirect");
const allowedMinutesInput = document.getElementById("allowedMinutes");
const blockAdultSitesInput = document.getElementById("blockAdultSites");
const customAdultSitesInput = document.getElementById("customAdultSites");
const customAdultWrapper = document.getElementById("customAdultWrapper");
const statusEl = document.getElementById("status");
const saveBtn = document.getElementById("save");
const chartCanvas = document.getElementById("historyChart");
const historyEmpty = document.getElementById("historyEmpty");
const visitTotalEl = document.getElementById("visitTotal");
const successTotalEl = document.getElementById("successTotal");
const rangeButtons = document.querySelectorAll("[data-history-range]");
const metricButtons = document.querySelectorAll("[data-metric]");
const siteSelect = document.getElementById("historySite");
const visitGoalsInput = document.getElementById("visitGoals");
const visitGoalDefaultInput = document.getElementById("visitGoalDefault");
const reasonList = document.getElementById("reasonList");
const reasonEmpty = document.getElementById("reasonEmpty");
const tabButtons = document.querySelectorAll("[data-tab-target]");
const tabPanels = document.querySelectorAll("[data-tab-panel]");
const themeModeSelect = document.getElementById("themeMode");
const customTagInput = document.getElementById("customTagInput");
const addTagBtn = document.getElementById("addTagBtn");
const customTagList = document.getElementById("customTagList");
const reasonFilter = document.getElementById("reasonFilter");
const clearReasonsBtn = document.getElementById("clearReasons");
const tagError = document.getElementById("tagError");

const DEFAULT_TAGS = ["Productive", "Research", "Entertainment"];
const MAX_CUSTOM_TAGS = 5;

const chartCtx = chartCanvas ? chartCanvas.getContext("2d") : null;

let chartData = [];
let currentRange = 7;
let currentMetric = "visits";
let currentSite = "all";
let currentCustomTags = [];
let currentReasons = [];
let currentFilter = "all";
let cachedBlockedSites = [];
let cachedCustomAdultSites = [];

document.addEventListener("DOMContentLoaded", async () => {
  await restore();
  await renderDailySummary();
  await renderUsageReasons();
  chartData = await loadHistoryTotals();
  populateSiteOptions(chartData.perSiteVisits);
  setActiveRangeButton(currentRange);
  setActiveMetricButton(currentMetric);
  syncMetricAvailability();
  updateChart();
  initTabs();

  rangeButtons.forEach((button) =>
    button.addEventListener("click", () => {
      const range = Number(button.dataset.historyRange);
      if (!range || range === currentRange) return;
      currentRange = range;
      setActiveRangeButton(range);
      updateChart();
    })
  );

  metricButtons.forEach((button) =>
    button.addEventListener("click", () => {
      if (button.disabled) return;
      const metric = button.dataset.metric;
      if (!metric || metric === currentMetric) return;
      currentMetric = metric;
      setActiveMetricButton(metric);
      updateChart();
    })
  );

  window.addEventListener("resize", () => updateChart());
  blockAdultSitesInput.addEventListener("change", syncAdultVisibility);
  if (siteSelect) {
    siteSelect.addEventListener("change", () => {
      currentSite = siteSelect.value || "all";
      syncMetricAvailability();
      updateChart();
    });
  }
  if (chrome?.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "sync" && changes.usageReasons) {
        renderUsageReasons();
      }
      if (area === "sync" && (changes.history || changes.visitHistory || changes.successHistory)) {
        void refreshHistoryData();
      }
      if (area === "sync" && (changes.blockedSites || changes.customAdultSites)) {
        cachedBlockedSites = Array.isArray(changes.blockedSites?.newValue)
          ? changes.blockedSites.newValue
          : cachedBlockedSites;
        cachedCustomAdultSites = Array.isArray(changes.customAdultSites?.newValue)
          ? changes.customAdultSites.newValue
          : cachedCustomAdultSites;
        populateSiteOptions(chartData.perSiteVisits);
        syncMetricAvailability();
        updateChart();
      }
      if (area === "sync" && changes.themeMode && themeModeSelect) {
        themeModeSelect.value = changes.themeMode.newValue || "auto";
        applyTheme(themeModeSelect.value);
      }
      if (area === "sync" && changes.intentTags) {
        currentCustomTags = normalizeCustomTags(changes.intentTags.newValue);
        renderCustomTags();
        renderUsageReasons();
        hydrateFilterOptions();
      }
    });
  }
  if (themeModeSelect) {
    themeModeSelect.addEventListener("change", () => applyTheme(themeModeSelect.value));
  }
  if (addTagBtn && customTagInput) {
    addTagBtn.addEventListener("click", addCustomTag);
    customTagInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        addCustomTag();
      }
    });
  }
  if (reasonFilter) {
    reasonFilter.addEventListener("change", () => {
      currentFilter = reasonFilter.value || "all";
      renderUsageReasons();
    });
  }
  if (clearReasonsBtn) {
    clearReasonsBtn.addEventListener("click", clearAllReasons);
  }
});
if (saveBtn) {
  saveBtn.addEventListener("click", save);
}

async function restore() {
  const {
    blockedSites = [],
    waitSeconds = 10,
    redirectUrl = "",
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
    "allowedMinutes",
    "blockAdultSites",
    "customAdultSites",
    "visitGoals",
    "visitGoalDefault",
    "themeMode",
    "intentTags"
  ]);
  blockedInput.value = blockedSites.join("\n");
  secondsInput.value = waitSeconds;
  redirectInput.value = redirectUrl || "";
  allowedMinutesInput.value = allowedMinutes;
  blockAdultSitesInput.checked = typeof blockAdultSites === "boolean" ? blockAdultSites : true;
  customAdultSitesInput.value = Array.isArray(customAdultSites) ? customAdultSites.join("\n") : "";
  cachedBlockedSites = Array.isArray(blockedSites) ? blockedSites : [];
  cachedCustomAdultSites = Array.isArray(customAdultSites) ? customAdultSites : [];
  if (visitGoalsInput) {
    visitGoalsInput.value = formatVisitGoals(visitGoals);
  }
  if (visitGoalDefaultInput) {
    visitGoalDefaultInput.value = visitGoalDefault || 5;
  }
  const selectedTheme = themeMode || "auto";
  if (themeModeSelect) {
    themeModeSelect.value = selectedTheme;
  }
  applyTheme(selectedTheme);
  currentCustomTags = normalizeCustomTags(intentTags);
  renderCustomTags();
  hydrateFilterOptions();
  syncAdultVisibility();
}

async function save() {
  const sites = blockedInput.value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const waitSeconds = Math.max(3, Number(secondsInput.value) || 10);
  const redirectUrl = redirectInput.value.trim();
  const allowedMinutes = Math.max(1, Number(allowedMinutesInput.value) || 15);
  const blockAdultSites = Boolean(blockAdultSitesInput.checked);
  const customAdultSites = customAdultSitesInput.value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const visitGoals = parseVisitGoals(visitGoalsInput?.value || "");
  const visitGoalDefault = Math.max(1, Number(visitGoalDefaultInput?.value) || 5);
  const themeMode = themeModeSelect?.value || "auto";
  const intentTags = currentCustomTags;
  await chrome.storage.sync.set({
    blockedSites: sites,
    waitSeconds,
    redirectUrl,
    allowedMinutes,
    blockAdultSites,
    customAdultSites,
    visitGoals,
    visitGoalDefault,
    themeMode,
    intentTags
  });
  statusEl.textContent = "Saved!";
  setTimeout(() => (statusEl.textContent = ""), 1500);
}

async function refreshHistoryData() {
  chartData = await loadHistoryTotals();
  populateSiteOptions(chartData.perSiteVisits);
  syncMetricAvailability();
  updateChart();
}

function syncAdultVisibility() {
  const enabled = Boolean(blockAdultSitesInput.checked);
  if (!enabled && customAdultWrapper.open) {
    customAdultWrapper.open = false;
  }
  customAdultWrapper.classList.toggle("hidden", !enabled);
}

async function renderDailySummary() {
  const todayKey = getTodayKey();
  const { dailyStats } = await chrome.storage.sync.get(["dailyStats"]);
  const normalized = normalizeDailyStats(dailyStats, todayKey);
  const totalVisits = Object.values(normalized.visits).reduce((sum, value) => sum + (Number(value) || 0), 0);
  const totalSuccess = Object.values(normalized.bails).reduce((sum, value) => sum + (Number(value) || 0), 0);
  visitTotalEl.textContent = totalVisits.toString();
  successTotalEl.textContent = totalSuccess.toString();
}

async function renderUsageReasons() {
  if (!reasonList || !reasonEmpty) return;
  const reasons = await loadUsageReasons();
  currentReasons = reasons;
  const filtered = filterReasons(reasons, currentFilter);
  renderReasonFilterState(reasons);
  if (!reasons.length) {
    reasonList.innerHTML = "";
    reasonEmpty.classList.remove("hidden");
    return;
  }
  reasonEmpty.classList.add("hidden");
  reasonList.innerHTML = "";
  const formatter = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });
  filtered.forEach((entry) => {
    const item = document.createElement("li");
    item.className = "reason-item";

    const top = document.createElement("div");
    top.className = "reason-top";
    const siteEl = document.createElement("div");
    siteEl.className = "reason-site";
    siteEl.textContent = entry.siteLabel || entry.siteKey || "Blocked site";
    const metaEl = document.createElement("div");
    metaEl.className = "reason-meta";
    const date = new Date(entry.timestamp);
    metaEl.textContent = Number.isNaN(date.getTime()) ? "" : formatter.format(date);
    top.appendChild(siteEl);
    top.appendChild(metaEl);
    item.appendChild(top);

    if (entry.reason) {
      const body = document.createElement("p");
      body.className = "reason-body";
      body.textContent = entry.reason;
      item.appendChild(body);
    }

    const tagWrap = document.createElement("div");
    tagWrap.className = "reason-tags";
    const outcomeLabel = document.createElement("span");
    outcomeLabel.className = "reason-pill";
    outcomeLabel.textContent = formatOutcome(entry.outcome);
    tagWrap.appendChild(outcomeLabel);
    if (entry.tag) {
      const tagEl = document.createElement("span");
      tagEl.className = "reason-pill";
      tagEl.textContent = formatTag(entry.tag);
      tagWrap.appendChild(tagEl);
    }
    if (tagWrap.childNodes.length) {
      item.appendChild(tagWrap);
    }

    reasonList.appendChild(item);
  });
}

async function loadUsageReasons() {
  const { usageReasons = [] } = await chrome.storage.sync.get(["usageReasons"]);
  if (!Array.isArray(usageReasons)) return [];
  return usageReasons.map((entry) => ({
    siteLabel: typeof entry?.siteLabel === "string" && entry.siteLabel.trim() ? entry.siteLabel : entry?.siteKey || "Blocked site",
    siteKey: entry?.siteKey || "",
    reason: typeof entry?.reason === "string" ? entry.reason : "",
    tag: typeof entry?.tag === "string" ? entry.tag : "",
    outcome: typeof entry?.outcome === "string" ? entry.outcome : "continue",
    timestamp: typeof entry?.timestamp === "number" ? entry.timestamp : Date.now()
  }));
}

function formatOutcome(outcome) {
  if (outcome === "redirect") return "Bailed out";
  return "Continued";
}

function formatTag(tag) {
  if (!tag) return "";
  return tag.charAt(0).toUpperCase() + tag.slice(1);
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
    result.push(formatTag(trimmed));
  });
  return result;
}

function showTagError(message) {
  if (!tagError) return;
  tagError.textContent = message;
  tagError.classList.remove("hidden");
}

function clearTagError() {
  if (!tagError) return;
  tagError.textContent = "";
  tagError.classList.add("hidden");
}

function addCustomTag() {
  if (!customTagInput) return;
  const raw = customTagInput.value.trim();
  if (!raw) return;

  const nextTag = formatTag(raw);
  const combined = [...DEFAULT_TAGS, ...currentCustomTags];
  const alreadyExists = combined.some((tag) => tag.toLowerCase() === nextTag.toLowerCase());
  if (alreadyExists) {
    customTagInput.value = "";
    clearTagError();
    return;
  }
  if (currentCustomTags.length >= MAX_CUSTOM_TAGS) {
    showTagError(`Max ${MAX_CUSTOM_TAGS} tags reached.`);
    return;
  }

  currentCustomTags = normalizeCustomTags([...currentCustomTags, nextTag]);
  customTagInput.value = "";
  renderCustomTags();
  hydrateFilterOptions();
  clearTagError();
}

function renderCustomTags() {
  if (!customTagList) return;
  customTagList.innerHTML = "";
  const combined = [...DEFAULT_TAGS, ...currentCustomTags];
  combined.forEach((tag) => {
    const chip = document.createElement("span");
    chip.className = "tag-pill";
    chip.textContent = tag;
    if (!DEFAULT_TAGS.includes(tag)) {
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "tag-pill-remove";
      remove.textContent = "×";
      remove.setAttribute("aria-label", `Remove ${tag}`);
      remove.addEventListener("click", () => {
        currentCustomTags = currentCustomTags.filter((t) => t.toLowerCase() !== tag.toLowerCase());
        renderCustomTags();
        hydrateFilterOptions();
        clearTagError();
      });
      chip.appendChild(remove);
    }
    customTagList.appendChild(chip);
  });
}

function hydrateFilterOptions() {
  if (!reasonFilter) return;
  const tags = [...DEFAULT_TAGS, ...currentCustomTags];
  const existing = new Set();
  reasonFilter.innerHTML = `<option value="all">All</option>`;
  tags.forEach((tag) => {
    const key = tag.toLowerCase();
    if (existing.has(key)) return;
    existing.add(key);
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = tag;
    reasonFilter.appendChild(opt);
  });
  reasonFilter.value = existing.has(currentFilter) ? currentFilter : "all";
}

function filterReasons(reasons, filterKey) {
  if (!filterKey || filterKey === "all") return reasons;
  return reasons.filter((r) => (r.tag || "").toLowerCase() === filterKey);
}

function renderReasonFilterState(reasons) {
  if (!reasonFilter) return;
  const tags = new Set();
  reasons.forEach((r) => {
    if (r.tag) tags.add(r.tag.toLowerCase());
  });
  if (!tags.has(currentFilter) && currentFilter !== "all") {
    currentFilter = "all";
    reasonFilter.value = "all";
  }
}

async function clearAllReasons() {
  await chrome.storage.sync.set({ usageReasons: [] });
  renderUsageReasons();
}

function initTabs() {
  if (!tabButtons.length || !tabPanels.length) return;
  const defaultTab = "rules";
  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.tabTarget;
      if (!target) return;
      setActiveTab(target);
    });
  });
  setActiveTab(defaultTab);
}

function setActiveTab(name) {
  tabButtons.forEach((btn) => {
    const isActive = btn.dataset.tabTarget === name;
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-selected", String(isActive));
    btn.setAttribute("tabindex", isActive ? "0" : "-1");
  });
  tabPanels.forEach((panel) => {
    const isActive = panel.dataset.tabPanel === name;
    panel.classList.toggle("active", isActive);
    panel.setAttribute("aria-hidden", String(!isActive));
  });
}

function applyTheme(mode) {
  const target = document.documentElement;
  if (!target) return;
  const valid = ["auto", "light", "dark"].includes(mode) ? mode : "auto";
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

async function loadHistoryTotals() {
  const { visitHistory = null, successHistory = null, history = {} } = await chrome.storage.sync.get([
    "visitHistory",
    "successHistory",
    "history"
  ]);
  const visits = visitHistory
    ? Object.keys(visitHistory).map((date) => ({ date, value: Number(visitHistory[date]) || 0 }))
    : buildTotalsFromLegacy(history);
  const successes = successHistory
    ? Object.keys(successHistory).map((date) => ({ date, value: Number(successHistory[date]) || 0 }))
    : [];
  const perSiteVisits = buildPerSiteSeries(history);
  return {
    visits: visits.sort((a, b) => a.date.localeCompare(b.date)),
    success: successes.sort((a, b) => a.date.localeCompare(b.date)),
    perSiteVisits
  };
}

function buildTotalsFromLegacy(history) {
  const totals = {};
  Object.values(history).forEach((perDomain) => {
    if (!perDomain) return;
    Object.entries(perDomain).forEach(([date, count]) => {
      totals[date] = (totals[date] || 0) + (Number(count) || 0);
    });
  });
  return Object.keys(totals).map((date) => ({ date, value: totals[date] }));
}

function buildPerSiteSeries(history) {
  if (!history || typeof history !== "object") return {};
  const result = {};
  Object.entries(history).forEach(([siteKey, perSite]) => {
    if (!perSite || typeof perSite !== "object") return;
    result[siteKey] = Object.keys(perSite)
      .map((date) => ({ date, value: Number(perSite[date]) || 0 }))
      .sort((a, b) => a.date.localeCompare(b.date));
  });
  return result;
}

function updateChart() {
  if (!chartData) {
    drawHistoryChart([], currentRange);
    return;
  }
  let series = [];
  if (currentSite === "all") {
    series = chartData[currentMetric] || [];
  } else {
    series = chartData.perSiteVisits?.[currentSite] || [];
  }
  const filtered = getRangeData(series, currentRange);
  drawHistoryChart(filtered, currentRange);
}

function setActiveMetricButton(metric) {
  metricButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.metric === metric);
  });
}

function syncMetricAvailability() {
  const isAllSites = currentSite === "all";
  metricButtons.forEach((btn) => {
    if (btn.dataset.metric === "success") {
      btn.disabled = !isAllSites;
      btn.classList.toggle("active", isAllSites && currentMetric === "success");
    }
  });
  if (!isAllSites && currentMetric === "success") {
    currentMetric = "visits";
    setActiveMetricButton(currentMetric);
  }
}

function populateSiteOptions(perSiteVisits = {}) {
  if (!siteSelect) return;
  const labelMap = buildSiteLabelMap(cachedBlockedSites, cachedCustomAdultSites);
  const manualKeys = new Set(
    [...(cachedBlockedSites || []), ...(cachedCustomAdultSites || [])]
      .map((entry) => normalizeEntry(entry))
      .filter(Boolean)
  );
  const siteKeys = Object.keys(perSiteVisits || {}).sort((a, b) => {
    const labelA = (labelMap[a] || a).toLowerCase();
    const labelB = (labelMap[b] || b).toLowerCase();
    return labelA.localeCompare(labelB);
  });

  const currentValue = siteSelect.value || "all";
  siteSelect.innerHTML = `<option value="all">All sites</option>`;
  siteKeys.filter((key) => manualKeys.has(key)).forEach((key) => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = labelMap[key] || key;
    siteSelect.appendChild(option);
  });

  const nextValue = manualKeys.has(currentValue) ? currentValue : "all";
  siteSelect.value = nextValue;
  currentSite = nextValue;
}

function drawHistoryChart(data, rangeDays) {
  if (!chartCanvas || !chartCtx) return;

  if (!data.length) {
    chartCanvas.classList.add("hidden");
    historyEmpty.classList.remove("hidden");
    return;
  }
  chartCanvas.classList.remove("hidden");
  historyEmpty.classList.add("hidden");

  const ratio = window.devicePixelRatio || 1;
  const displayWidth = chartCanvas.clientWidth || chartCanvas.parentElement.clientWidth || 600;
  const displayHeight = chartCanvas.clientHeight || 220;
  chartCanvas.width = displayWidth * ratio;
  chartCanvas.height = displayHeight * ratio;
  chartCanvas.style.height = `${displayHeight}px`;
  chartCtx.setTransform(1, 0, 0, 1, 0, 0);
  chartCtx.scale(ratio, ratio);
  chartCtx.clearRect(0, 0, displayWidth, displayHeight);

  const padding = { top: 20, right: 20, bottom: 40, left: 48 };
  const innerWidth = displayWidth - padding.left - padding.right;
  const innerHeight = displayHeight - padding.top - padding.bottom;
  const maxVal = Math.max(...data.map((item) => item.value), 1);
  const barWidth = Math.max(14, innerWidth / data.length - 8);
  const step = innerWidth / data.length;
  const labelInterval = rangeDays > 14 ? Math.ceil(rangeDays / 14) : 1;
  const dateFormatter = new Intl.DateTimeFormat(undefined, {
    month: rangeDays > 14 ? "numeric" : "short",
    day: "numeric"
  });

  chartCtx.lineWidth = 1;
  chartCtx.strokeStyle = "rgba(93,108,101,0.35)";
  chartCtx.beginPath();
  chartCtx.moveTo(padding.left, displayHeight - padding.bottom);
  chartCtx.lineTo(displayWidth - padding.right, displayHeight - padding.bottom);
  chartCtx.stroke();

  chartCtx.fillStyle = "#5d6c65";
  chartCtx.font = "12px Inter, sans-serif";
  chartCtx.textAlign = "center";

  data.forEach((entry, index) => {
    const { date, value } = entry;
    const barHeight = (value / maxVal) * innerHeight;
    const x = padding.left + index * step + (step - barWidth) / 2;
    const y = displayHeight - padding.bottom - barHeight;

    const gradient = chartCtx.createLinearGradient(0, y, 0, y + barHeight);
    gradient.addColorStop(0, "#7cb6a5");
    gradient.addColorStop(1, "#9fd8cb");
    chartCtx.fillStyle = gradient;
    chartCtx.fillRect(x, y, barWidth, barHeight);

    chartCtx.fillStyle = "#5d6c65";
    chartCtx.fillText(value.toString(), x + barWidth / 2, y - 6);

    if (index % labelInterval === 0 || index === data.length - 1) {
      let label = date;
      const parsed = new Date(date);
      if (!Number.isNaN(parsed.getTime())) {
        label = dateFormatter.format(parsed);
      }
      chartCtx.fillText(label, x + barWidth / 2, displayHeight - padding.bottom + 18);
    }
  });
}

function setActiveRangeButton(days) {
  rangeButtons.forEach((button) => {
    const range = Number(button.dataset.historyRange);
    button.classList.toggle("active", range === days);
  });
}

function getRangeData(source, days) {
  if (!source || !source.length) return [];
  const lookup = source.reduce((acc, entry) => {
    acc[entry.date] = entry.value;
    return acc;
  }, {});
  const today = new Date();
  const result = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = formatDateKey(d);
    result.push({ date: key, value: lookup[key] || 0 });
  }
  return result;
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

function normalizeEntry(entry) {
  if (typeof entry !== "string") return "";
  const trimmed = entry.trim().toLowerCase();
  if (!trimmed) return "";
  const noProtocol = trimmed.replace(/^https?:\/\//, "");
  const host = noProtocol.split(/[/?#:]/)[0];
  return host.replace(/^\.+/, "");
}

function buildSiteLabelMap(blockedSites, customAdultSites) {
  const map = {};
  [...(blockedSites || []), ...(customAdultSites || [])].forEach((entry) => {
    const normalized = normalizeEntry(entry);
    if (!normalized) return;
    if (!map[normalized]) {
      map[normalized] = entry.trim() || normalized;
    }
  });
  return map;
}

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getTodayKey() {
  return formatDateKey(new Date());
}

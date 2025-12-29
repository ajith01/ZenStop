const summary = document.getElementById("summary");
const pauseStats = document.getElementById("pauseStats");
const pauseCountEl = document.getElementById("pauseCount");
const bailCountEl = document.getElementById("bailCount");
const button = document.getElementById("openOptions");
const currentSiteEl = document.getElementById("currentSite");
const blockSiteBtn = document.getElementById("blockSite");
const blockChooserEl = document.getElementById("blockChooser");
const blockAsUnproductiveBtn = document.getElementById("blockAsUnproductive");
const blockAsAdultBtn = document.getElementById("blockAsAdult");
const blockSiteStatusEl = document.getElementById("blockSiteStatus");

const elementsReady = summary && pauseStats && pauseCountEl && bailCountEl && button;
const quickBlockReady = currentSiteEl && blockSiteBtn && blockChooserEl && blockAsUnproductiveBtn && blockAsAdultBtn && blockSiteStatusEl;

(async () => {
  if (!elementsReady) return;
  const todayKey = getTodayKey();
  const {
    blockedSites = [],
    waitSeconds = 10,
    dailyStats,
    blockAdultSites = true,
    customAdultSites = [],
    themeMode = "auto"
  } = await chrome.storage.sync.get([
    "blockedSites",
    "waitSeconds",
    "dailyStats",
    "blockAdultSites",
    "customAdultSites",
    "themeMode"
  ]);

  applyTheme(themeMode || "auto");

  const normalizedDaily = normalizeDailyStats(dailyStats, todayKey);
  const visits = normalizedDaily.visits;
  const bails = normalizedDaily.bails;

  const hasAnyBlocking = blockedSites.length > 0 || blockAdultSites;
  if (hasAnyBlocking) {
    summary.textContent = blockAdultSites
      ? `You'll wait ${waitSeconds}s before visiting your list and built-in adult sites.`
      : `You'll wait ${waitSeconds}s before visiting these spaces.`;
  } else {
    summary.textContent = "No blocked sites yet.";
  }

  const totalPauses = Object.values(visits).reduce((sum, value) => sum + (Number(value) || 0), 0);
  const totalBails = Object.values(bails).reduce((sum, value) => sum + (Number(value) || 0), 0);

  if (pauseStats) {
    pauseStats.textContent = "";
  }
  pauseCountEl.textContent = totalPauses.toString();
  bailCountEl.textContent = totalBails.toString();

  if (quickBlockReady) {
    await hydrateQuickBlock({ blockedSites, blockAdultSites, customAdultSites });
  }
})();

if (elementsReady) {
  button.addEventListener("click", () => chrome.runtime.openOptionsPage());
}

if (quickBlockReady) {
  blockSiteBtn.addEventListener("click", toggleBlockChooser);
  blockAsUnproductiveBtn.addEventListener("click", blockCurrentSiteAsUnproductive);
  blockAsAdultBtn.addEventListener("click", blockCurrentSiteAsAdult);
}

function applyTheme(mode) {
  const target = document.documentElement;
  if (!target) return;
  const valid = ["auto", "light", "dark"].includes(mode) ? mode : "auto";
  target.dataset.theme = valid;
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

async function hydrateQuickBlock({ blockedSites, blockAdultSites, customAdultSites }) {
  const host = await getActiveHostname();
  if (!host) {
    currentSiteEl.textContent = "Unavailable";
    blockSiteBtn.disabled = true;
    blockChooserEl.classList.add("hidden");
    blockSiteStatusEl.textContent = "Open a normal website tab to block it.";
    return;
  }

  currentSiteEl.textContent = host;

  const normalizedBlocked = normalizeSiteList(blockedSites);
  const alreadyBlocked = normalizedBlocked.some((entry) => host === entry || host.endsWith(`.${entry}`));
  const normalizedAdult = normalizeSiteList(customAdultSites);
  const alreadyInAdultList = normalizedAdult.some((entry) => host === entry || host.endsWith(`.${entry}`));

  blockSiteBtn.disabled = false;
  blockSiteBtn.textContent = alreadyBlocked || (alreadyInAdultList && blockAdultSites) ? "Edit" : "Block";

  blockSiteStatusEl.textContent = "";
  blockChooserEl.classList.add("hidden");
}

async function toggleBlockChooser() {
  const host = await getActiveHostname();
  if (!host) return;
  blockChooserEl.classList.toggle("hidden");
  blockSiteStatusEl.textContent = blockChooserEl.classList.contains("hidden") ? "" : "Add this site as:";
}

async function blockCurrentSiteAsUnproductive() {
  const host = await getActiveHostname();
  if (!host) return;

  blockAsUnproductiveBtn.disabled = true;
  blockSiteStatusEl.textContent = "Saving…";

  const { blockedSites = [], customAdultSites = [], blockAdultSites = true } = await chrome.storage.sync.get([
    "blockedSites",
    "customAdultSites",
    "blockAdultSites"
  ]);
  const normalizedList = normalizeSiteList(blockedSites);
  const alreadyBlocked = normalizedList.some((entry) => host === entry || host.endsWith(`.${entry}`));
  if (alreadyBlocked) {
    await hydrateQuickBlock({ blockedSites, customAdultSites, blockAdultSites });
    blockSiteStatusEl.textContent = "Already in blocked websites.";
    return;
  }

  const nextBlockedSites = Array.isArray(blockedSites) ? blockedSites.slice() : [];
  nextBlockedSites.push(host);
  await chrome.storage.sync.set({ blockedSites: nextBlockedSites });

  blockSiteStatusEl.textContent = "Added to blocked websites.";
  await hydrateQuickBlock({ blockedSites: nextBlockedSites, customAdultSites, blockAdultSites });
}

async function blockCurrentSiteAsAdult() {
  const host = await getActiveHostname();
  if (!host) return;

  blockAsAdultBtn.disabled = true;
  blockSiteStatusEl.textContent = "Saving…";

  const { customAdultSites = [], blockAdultSites = true, blockedSites = [] } = await chrome.storage.sync.get([
    "customAdultSites",
    "blockAdultSites",
    "blockedSites"
  ]);

  const normalizedAdult = normalizeSiteList(customAdultSites);
  const alreadyInAdultList = normalizedAdult.some((entry) => host === entry || host.endsWith(`.${entry}`));
  if (alreadyInAdultList && blockAdultSites) {
    await hydrateQuickBlock({ blockedSites, blockAdultSites, customAdultSites });
    blockSiteStatusEl.textContent = "Already in adult sites.";
    return;
  }

  const nextCustomAdultSites = Array.isArray(customAdultSites) ? customAdultSites.slice() : [];
  nextCustomAdultSites.push(host);
  await chrome.storage.sync.set({ customAdultSites: nextCustomAdultSites, blockAdultSites: true });

  blockSiteStatusEl.textContent = "Added to adult sites.";
  await hydrateQuickBlock({ blockedSites, blockAdultSites: true, customAdultSites: nextCustomAdultSites });
}

async function getActiveHostname() {
  if (!chrome?.tabs?.query) return "";
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = tabs?.[0]?.url || tabs?.[0]?.pendingUrl || "";
    if (!url) return "";
    const parsed = new URL(url);
    if (!parsed.hostname) return "";
    return normalizeHostname(parsed.hostname);
  } catch {
    return "";
  }
}

function normalizeHostname(hostname) {
  const lower = String(hostname || "").trim().toLowerCase();
  return lower.startsWith("www.") ? lower.slice(4) : lower;
}

function normalizeSiteEntry(entry) {
  if (typeof entry !== "string") return "";
  const trimmed = entry.trim().toLowerCase();
  if (!trimmed) return "";
  const noProtocol = trimmed.replace(/^https?:\/\//, "");
  const host = noProtocol.split(/[/?#:]/)[0];
  return normalizeHostname(host.replace(/^\.+/, ""));
}

function normalizeSiteList(list) {
  const raw = Array.isArray(list) ? list : [];
  const seen = new Set();
  const result = [];
  raw.forEach((entry) => {
    const normalized = normalizeSiteEntry(entry);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    result.push(normalized);
  });
  return result;
}

function getTodayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

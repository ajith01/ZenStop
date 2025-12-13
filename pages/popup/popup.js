const summary = document.getElementById("summary");
const pauseStats = document.getElementById("pauseStats");
const pauseCountEl = document.getElementById("pauseCount");
const bailCountEl = document.getElementById("bailCount");
const button = document.getElementById("openOptions");
const resetGraceBtn = document.getElementById("resetGrace");

const elementsReady = summary && pauseStats && pauseCountEl && bailCountEl && button && resetGraceBtn;

(async () => {
  if (!elementsReady) return;
  const todayKey = getTodayKey();
  const {
    blockedSites = [],
    waitSeconds = 10,
    dailyStats,
    blockAdultSites = true,
    themeMode = "auto"
  } = await chrome.storage.sync.get(["blockedSites", "waitSeconds", "dailyStats", "blockAdultSites", "themeMode"]);

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
    pauseStats.textContent =
      totalPauses || totalBails
        ? `${totalPauses} ${totalPauses === 1 ? "pause" : "pauses"} | ${totalBails} ${
            totalBails === 1 ? "mindful exit" : "mindful exits"
          } today`
        : "No pauses logged today.";
  }
  pauseCountEl.textContent = totalPauses.toString();
  bailCountEl.textContent = totalBails.toString();
})();

if (elementsReady) {
  button.addEventListener("click", () => chrome.runtime.openOptionsPage());
  resetGraceBtn.addEventListener("click", clearGracePeriods);
}

function applyTheme(mode) {
  const target = document.documentElement;
  if (!target) return;
  const valid = ["auto", "light", "dark"].includes(mode) ? mode : "auto";
  target.dataset.theme = valid;
}

async function clearGracePeriods() {
  try {
    await chrome.storage.local.set({ gracePeriods: {} });
    resetGraceBtn.textContent = "Timers cleared";
    setTimeout(() => (resetGraceBtn.textContent = "Reset timers"), 1400);
  } catch (err) {
    console.error("Failed clearing grace periods", err);
  }
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

function getTodayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

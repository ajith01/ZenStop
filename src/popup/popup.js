(() => {
  const Popup = window.ZenStopPopup || {};
  const dom = Popup.dom;
  const storage = Popup.storage;
  const quickblock = Popup.quickblock;
  if (!dom || !storage) return;

  const init = () => initPopup().catch(() => {});
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
  bindEvents();

  async function initPopup() {
    if (!dom.summaryReady) return;
    const todayKey = getTodayKey();
    const settings = await storage.loadSettings(todayKey);

    dom.applyTheme(settings.themeMode);
    updateSummary(settings);
    updateDailyStats(settings.dailyStats);

    if (dom.quickBlockReady && quickblock) {
      await quickblock.hydrateQuickBlock(settings);
    }
  }

  function bindEvents() {
    if (dom.summaryReady) {
      dom.elements.openOptions.addEventListener("click", () => chrome.runtime.openOptionsPage());
    }

    if (dom.quickBlockReady && quickblock) {
      dom.elements.blockSite.addEventListener("click", quickblock.toggleBlockChooser);
      dom.elements.blockAsUnproductive.addEventListener("click", quickblock.blockCurrentSiteAsUnproductive);
      dom.elements.blockAsAdult.addEventListener("click", quickblock.blockCurrentSiteAsAdult);
    }
  }

  function updateSummary(settings) {
    const hasAnyBlocking = settings.blockedSites.length > 0 || settings.blockAdultSites;
    if (hasAnyBlocking) {
      dom.setSummaryText(
        settings.blockAdultSites
          ? `You'll wait ${settings.waitSeconds}s before visiting your list and built-in adult sites.`
          : `You'll wait ${settings.waitSeconds}s before visiting these spaces.`
      );
      return;
    }
    dom.setSummaryText("No blocked sites yet.");
  }

  function updateDailyStats(dailyStats) {
    const totalPauses = sumRecord(dailyStats.visits);
    const totalBails = sumRecord(dailyStats.bails);
    dom.setPauseCounts(totalPauses, totalBails);
  }

  function sumRecord(record) {
    return Object.values(record).reduce((sum, value) => sum + (Number(value) || 0), 0);
  }

  function getTodayKey() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
})();

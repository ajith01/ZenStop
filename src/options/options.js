(() => {
  const Options = window.ZenStopOptions || {};
  const dom = Options.dom;
  const state = Options.state;
  const settings = Options.settings;
  const history = Options.history;
  const intentions = Options.intentions;
  const tabs = Options.tabs;
  if (!dom || !state || !settings || !history || !intentions || !tabs) return;

  const init = () => initializeOptions().catch(() => {});
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  async function initializeOptions() {
    await settings.restoreSettings();
    await history.renderDailySummary();
    await intentions.renderUsageReasons();
    state.chartData = await history.loadHistoryTotals();
    history.populateSiteOptions(state.chartData.perSiteVisits);
    history.setActiveRangeButton(state.currentRange);
    history.setActiveMetricButton(state.currentMetric);
    history.syncMetricAvailability();
    history.updateChart();
    tabs.initTabs();
    bindEvents();
  }

  function bindEvents() {
    dom.rangeButtons.forEach((button) =>
      button.addEventListener("click", () => {
        const range = Number(button.dataset.historyRange);
        if (!range || range === state.currentRange) return;
        state.currentRange = range;
        history.setActiveRangeButton(range);
        history.updateChart();
      })
    );

    dom.metricButtons.forEach((button) =>
      button.addEventListener("click", () => {
        if (button.disabled) return;
        const metric = button.dataset.metric;
        if (!metric || metric === state.currentMetric) return;
        state.currentMetric = metric;
        history.setActiveMetricButton(metric);
        history.updateChart();
      })
    );

    window.addEventListener("resize", () => history.updateChart());

    if (dom.elements.blockAdultSitesInput) {
      dom.elements.blockAdultSitesInput.addEventListener("change", settings.syncAdultVisibility);
    }

    if (dom.elements.siteSelect) {
      dom.elements.siteSelect.addEventListener("change", () => {
        state.currentSite = dom.elements.siteSelect.value || "all";
        history.syncMetricAvailability();
        history.updateChart();
      });
    }

    if (chrome?.storage?.onChanged) {
      chrome.storage.onChanged.addListener(handleStorageChange);
    }

    if (dom.elements.themeModeSelect) {
      dom.elements.themeModeSelect.addEventListener("change", () =>
        settings.applyTheme(dom.elements.themeModeSelect.value)
      );
    }

    if (dom.elements.addTagBtn && dom.elements.customTagInput) {
      dom.elements.addTagBtn.addEventListener("click", intentions.addCustomTag);
      dom.elements.customTagInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          intentions.addCustomTag();
        }
      });
    }

    if (dom.elements.reasonFilter) {
      dom.elements.reasonFilter.addEventListener("change", () => {
        state.currentFilter = dom.elements.reasonFilter.value || "all";
        intentions.renderUsageReasons();
      });
    }

    if (dom.elements.clearReasonsBtn) {
      dom.elements.clearReasonsBtn.addEventListener("click", intentions.clearAllReasons);
    }

    if (dom.elements.saveBtn) {
      dom.elements.saveBtn.addEventListener("click", settings.saveSettings);
    }
  }

  function handleStorageChange(changes, area) {
    if (area !== "sync" && area !== "local") return;
    if (changes.usageReasons) {
      intentions.renderUsageReasons();
    }
    if (area !== "sync") return;
    if (changes.history || changes.visitHistory || changes.successHistory) {
      void history.refreshHistoryData();
    }
    if (changes.blockedSites || changes.customAdultSites) {
      state.cachedBlockedSites = Array.isArray(changes.blockedSites?.newValue)
        ? changes.blockedSites.newValue
        : state.cachedBlockedSites;
      state.cachedCustomAdultSites = Array.isArray(changes.customAdultSites?.newValue)
        ? changes.customAdultSites.newValue
        : state.cachedCustomAdultSites;
      history.populateSiteOptions(state.chartData?.perSiteVisits || {});
      history.syncMetricAvailability();
      history.updateChart();
    }
    if (changes.themeMode && dom.elements.themeModeSelect) {
      dom.elements.themeModeSelect.value = changes.themeMode.newValue || settings.DEFAULT_THEME;
      settings.applyTheme(dom.elements.themeModeSelect.value);
    }
    if (changes.intentTags) {
      state.currentCustomTags = intentions.normalizeCustomTags(changes.intentTags.newValue);
      intentions.renderCustomTags();
      intentions.renderUsageReasons();
      intentions.hydrateFilterOptions();
    }
  }
})();

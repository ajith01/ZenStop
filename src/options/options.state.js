(() => {
  const Options = (window.ZenStopOptions = window.ZenStopOptions || {});
  Options.state = {
    chartData: null,
    currentRange: 7,
    currentMetric: "visits",
    currentSite: "all",
    currentCustomTags: [],
    currentReasons: [],
    currentFilter: "all",
    cachedBlockedSites: [],
    cachedCustomAdultSites: []
  };
})();

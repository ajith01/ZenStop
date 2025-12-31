(() => {
  const Options = (window.ZenStopOptions = window.ZenStopOptions || {});
  const elements = {
    blockedInput: document.getElementById("blocked"),
    secondsInput: document.getElementById("seconds"),
    redirectInput: document.getElementById("redirect"),
    allowedMinutesInput: document.getElementById("allowedMinutes"),
    blockAdultSitesInput: document.getElementById("blockAdultSites"),
    customAdultSitesInput: document.getElementById("customAdultSites"),
    customAdultWrapper: document.getElementById("customAdultWrapper"),
    status: document.getElementById("status"),
    saveBtn: document.getElementById("save"),
    chartCanvas: document.getElementById("historyChart"),
    historyEmpty: document.getElementById("historyEmpty"),
    visitTotal: document.getElementById("visitTotal"),
    successTotal: document.getElementById("successTotal"),
    siteSelect: document.getElementById("historySite"),
    visitGoalsInput: document.getElementById("visitGoals"),
    visitGoalDefaultInput: document.getElementById("visitGoalDefault"),
    reasonList: document.getElementById("reasonList"),
    reasonEmpty: document.getElementById("reasonEmpty"),
    themeModeSelect: document.getElementById("themeMode"),
    customTagInput: document.getElementById("customTagInput"),
    addTagBtn: document.getElementById("addTagBtn"),
    customTagList: document.getElementById("customTagList"),
    reasonFilter: document.getElementById("reasonFilter"),
    clearReasonsBtn: document.getElementById("clearReasons"),
    tagError: document.getElementById("tagError")
  };

  Options.dom = {
    elements,
    rangeButtons: Array.from(document.querySelectorAll("[data-history-range]")),
    metricButtons: Array.from(document.querySelectorAll("[data-metric]")),
    tabButtons: Array.from(document.querySelectorAll("[data-tab-target]")),
    tabPanels: Array.from(document.querySelectorAll("[data-tab-panel]")),
    chartCtx: elements.chartCanvas ? elements.chartCanvas.getContext("2d") : null
  };
})();

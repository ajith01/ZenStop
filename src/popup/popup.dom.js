(() => {
  const Popup = (window.ZenStopPopup = window.ZenStopPopup || {});
  const elements = {
    summary: document.getElementById("summary"),
    pauseStats: document.getElementById("pauseStats"),
    pauseCount: document.getElementById("pauseCount"),
    bailCount: document.getElementById("bailCount"),
    openOptions: document.getElementById("openOptions"),
    currentSite: document.getElementById("currentSite"),
    blockSite: document.getElementById("blockSite"),
    blockChooser: document.getElementById("blockChooser"),
    blockAsUnproductive: document.getElementById("blockAsUnproductive"),
    blockAsAdult: document.getElementById("blockAsAdult"),
    blockSiteStatus: document.getElementById("blockSiteStatus")
  };

  const summaryReady = hasElements([
    elements.summary,
    elements.pauseStats,
    elements.pauseCount,
    elements.bailCount,
    elements.openOptions
  ]);
  const quickBlockReady = hasElements([
    elements.currentSite,
    elements.blockSite,
    elements.blockChooser,
    elements.blockAsUnproductive,
    elements.blockAsAdult,
    elements.blockSiteStatus
  ]);

  function hasElements(list) {
    return list.every(Boolean);
  }

  function applyTheme(mode) {
    const target = document.documentElement;
    if (!target) return;
    const valid = ["auto", "light", "dark"].includes(mode) ? mode : "auto";
    target.dataset.theme = valid;
  }

  function setSummaryText(text) {
    if (elements.summary) {
      elements.summary.textContent = text;
    }
  }

  function setPauseCounts(pauses, bails) {
    if (elements.pauseStats) {
      elements.pauseStats.textContent = "";
    }
    if (elements.pauseCount) {
      elements.pauseCount.textContent = pauses.toString();
    }
    if (elements.bailCount) {
      elements.bailCount.textContent = bails.toString();
    }
  }

  function setQuickBlockStatus(text) {
    if (elements.blockSiteStatus) {
      elements.blockSiteStatus.textContent = text;
    }
  }

  function setQuickBlockBusy(button, isBusy) {
    if (!button) return;
    button.disabled = isBusy;
  }

  Popup.dom = {
    elements,
    summaryReady,
    quickBlockReady,
    applyTheme,
    setSummaryText,
    setPauseCounts,
    setQuickBlockStatus,
    setQuickBlockBusy
  };
})();

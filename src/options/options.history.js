(() => {
  const Options = (window.ZenStopOptions = window.ZenStopOptions || {});
  const dom = Options.dom;
  const state = Options.state;
  if (!dom || !state) return;

  const HISTORY_KEYS = ["visitHistory", "successHistory", "history"];

  async function renderDailySummary() {
    if (!dom.elements.visitTotal || !dom.elements.successTotal) return;
    const todayKey = getTodayKey();
    const { dailyStats } = await chrome.storage.sync.get(["dailyStats"]);
    const normalized = normalizeDailyStats(dailyStats, todayKey);
    dom.elements.visitTotal.textContent = sumRecord(normalized.visits).toString();
    dom.elements.successTotal.textContent = sumRecord(normalized.bails).toString();
  }

  function sumRecord(record) {
    return Object.values(record).reduce((sum, value) => sum + (Number(value) || 0), 0);
  }

  async function loadHistoryTotals() {
    const { visitHistory = null, successHistory = null, history = {} } = await chrome.storage.sync.get(HISTORY_KEYS);
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
    if (!state.chartData) {
      drawHistoryChart([], state.currentRange);
      return;
    }
    let series = [];
    if (state.currentSite === "all") {
      series = state.chartData[state.currentMetric] || [];
    } else {
      series = state.chartData.perSiteVisits?.[state.currentSite] || [];
    }
    drawHistoryChart(getRangeData(series, state.currentRange), state.currentRange);
  }

  function setActiveMetricButton(metric) {
    dom.metricButtons.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.metric === metric);
    });
  }

  function syncMetricAvailability() {
    const isAllSites = state.currentSite === "all";
    dom.metricButtons.forEach((btn) => {
      if (btn.dataset.metric === "success") {
        btn.disabled = !isAllSites;
      }
    });
    if (!isAllSites && state.currentMetric === "success") {
      state.currentMetric = "visits";
      setActiveMetricButton(state.currentMetric);
    }
  }

  function populateSiteOptions(perSiteVisits = {}) {
    if (!dom.elements.siteSelect) return;
    const labelMap = buildSiteLabelMap(state.cachedBlockedSites, state.cachedCustomAdultSites);
    const manualKeys = new Set(
      [...(state.cachedBlockedSites || []), ...(state.cachedCustomAdultSites || [])]
        .map((entry) => normalizeEntry(entry))
        .filter(Boolean)
    );
    const siteKeys = Object.keys(perSiteVisits || {}).sort((a, b) => {
      const labelA = (labelMap[a] || a).toLowerCase();
      const labelB = (labelMap[b] || b).toLowerCase();
      return labelA.localeCompare(labelB);
    });

    const currentValue = dom.elements.siteSelect.value || "all";
    dom.elements.siteSelect.innerHTML = `<option value="all">All sites</option>`;
    siteKeys.filter((key) => manualKeys.has(key)).forEach((key) => {
      const option = document.createElement("option");
      option.value = key;
      option.textContent = labelMap[key] || key;
      dom.elements.siteSelect.appendChild(option);
    });

    const nextValue = manualKeys.has(currentValue) ? currentValue : "all";
    dom.elements.siteSelect.value = nextValue;
    state.currentSite = nextValue;
  }

  function drawHistoryChart(data, rangeDays) {
    if (!dom.elements.chartCanvas || !dom.chartCtx || !dom.elements.historyEmpty) return;

    if (!data.length) {
      dom.elements.chartCanvas.classList.add("hidden");
      dom.elements.historyEmpty.classList.remove("hidden");
      return;
    }
    dom.elements.chartCanvas.classList.remove("hidden");
    dom.elements.historyEmpty.classList.add("hidden");

    const ratio = window.devicePixelRatio || 1;
    const displayWidth = dom.elements.chartCanvas.clientWidth || dom.elements.chartCanvas.parentElement.clientWidth || 600;
    const displayHeight = dom.elements.chartCanvas.clientHeight || 220;
    dom.elements.chartCanvas.width = displayWidth * ratio;
    dom.elements.chartCanvas.height = displayHeight * ratio;
    dom.elements.chartCanvas.style.height = `${displayHeight}px`;
    dom.chartCtx.setTransform(1, 0, 0, 1, 0, 0);
    dom.chartCtx.scale(ratio, ratio);
    dom.chartCtx.clearRect(0, 0, displayWidth, displayHeight);

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

    dom.chartCtx.lineWidth = 1;
    dom.chartCtx.strokeStyle = "rgba(93,108,101,0.35)";
    dom.chartCtx.beginPath();
    dom.chartCtx.moveTo(padding.left, displayHeight - padding.bottom);
    dom.chartCtx.lineTo(displayWidth - padding.right, displayHeight - padding.bottom);
    dom.chartCtx.stroke();

    dom.chartCtx.fillStyle = "#5d6c65";
    dom.chartCtx.font = "12px Inter, sans-serif";
    dom.chartCtx.textAlign = "center";

    data.forEach((entry, index) => {
      const { date, value } = entry;
      const barHeight = (value / maxVal) * innerHeight;
      const x = padding.left + index * step + (step - barWidth) / 2;
      const y = displayHeight - padding.bottom - barHeight;

      const gradient = dom.chartCtx.createLinearGradient(0, y, 0, y + barHeight);
      gradient.addColorStop(0, "#7cb6a5");
      gradient.addColorStop(1, "#9fd8cb");
      dom.chartCtx.fillStyle = gradient;
      dom.chartCtx.fillRect(x, y, barWidth, barHeight);

      dom.chartCtx.fillStyle = "#5d6c65";
      dom.chartCtx.fillText(value.toString(), x + barWidth / 2, y - 6);

      if (index % labelInterval === 0 || index === data.length - 1) {
        let label = date;
        const parsed = new Date(date);
        if (!Number.isNaN(parsed.getTime())) {
          label = dateFormatter.format(parsed);
        }
        dom.chartCtx.fillText(label, x + barWidth / 2, displayHeight - padding.bottom + 18);
      }
    });
  }

  function setActiveRangeButton(days) {
    dom.rangeButtons.forEach((button) => {
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

  async function refreshHistoryData() {
    state.chartData = await loadHistoryTotals();
    populateSiteOptions(state.chartData.perSiteVisits);
    syncMetricAvailability();
    updateChart();
  }

  Options.history = {
    loadHistoryTotals,
    renderDailySummary,
    updateChart,
    setActiveRangeButton,
    setActiveMetricButton,
    syncMetricAvailability,
    populateSiteOptions,
    refreshHistoryData
  };
})();

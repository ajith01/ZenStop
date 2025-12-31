(() => {
  const Options = (window.ZenStopOptions = window.ZenStopOptions || {});
  const dom = Options.dom;
  const state = Options.state;
  if (!dom || !state) return;

  const REASONS_KEY = "usageReasons";
  const DEFAULT_TAGS = ["Productive", "Research", "Entertainment"];
  const MAX_CUSTOM_TAGS = 5;

  async function renderUsageReasons() {
    if (!dom.elements.reasonList || !dom.elements.reasonEmpty) return;
    const reasons = await loadUsageReasons();
    state.currentReasons = reasons;
    renderReasonFilterState(reasons);
    const filtered = filterReasons(reasons, state.currentFilter);

    if (!reasons.length) {
      dom.elements.reasonList.innerHTML = "";
      dom.elements.reasonEmpty.classList.remove("hidden");
      return;
    }

    dom.elements.reasonEmpty.classList.add("hidden");
    dom.elements.reasonList.innerHTML = "";
    const formatter = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });
    filtered.forEach((entry) => {
      dom.elements.reasonList.appendChild(createReasonItem(entry, formatter));
    });
  }

  async function loadUsageReasons() {
    const [syncData, localData] = await Promise.all([
      chrome.storage.sync.get([REASONS_KEY]),
      chrome.storage.local.get([REASONS_KEY])
    ]);
    const syncReasons = Array.isArray(syncData[REASONS_KEY]) ? syncData[REASONS_KEY] : [];
    const localReasons = Array.isArray(localData[REASONS_KEY]) ? localData[REASONS_KEY] : [];
    const combined = dedupeReasons([...localReasons, ...syncReasons]).sort(
      (a, b) => (Number(b?.timestamp) || 0) - (Number(a?.timestamp) || 0)
    );
    return combined.map((entry) => ({
      siteLabel:
        typeof entry?.siteLabel === "string" && entry.siteLabel.trim()
          ? entry.siteLabel
          : entry?.siteKey || "Blocked site",
      siteKey: entry?.siteKey || "",
      reason: typeof entry?.reason === "string" ? entry.reason : "",
      tag: typeof entry?.tag === "string" ? entry.tag : "",
      outcome: typeof entry?.outcome === "string" ? entry.outcome : "continue",
      timestamp: typeof entry?.timestamp === "number" ? entry.timestamp : Date.now()
    }));
  }

  function dedupeReasons(reasons) {
    if (!Array.isArray(reasons)) return [];
    const seen = new Set();
    const result = [];
    reasons.forEach((entry) => {
      const key = JSON.stringify({
        siteKey: entry?.siteKey || "",
        reason: entry?.reason || "",
        tag: entry?.tag || "",
        outcome: entry?.outcome || "",
        timestamp: entry?.timestamp || 0,
        url: entry?.url || ""
      });
      if (seen.has(key)) return;
      seen.add(key);
      result.push(entry);
    });
    return result;
  }

  function createReasonItem(entry, formatter) {
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

    return item;
  }

  function formatOutcome(outcome) {
    return outcome === "redirect" ? "Bailed out" : "Continued";
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
    if (!dom.elements.tagError) return;
    dom.elements.tagError.textContent = message;
    dom.elements.tagError.classList.remove("hidden");
  }

  function clearTagError() {
    if (!dom.elements.tagError) return;
    dom.elements.tagError.textContent = "";
    dom.elements.tagError.classList.add("hidden");
  }

  function addCustomTag() {
    if (!dom.elements.customTagInput) return;
    const raw = dom.elements.customTagInput.value.trim();
    if (!raw) return;

    const nextTag = formatTag(raw);
    const combined = [...DEFAULT_TAGS, ...state.currentCustomTags];
    const alreadyExists = combined.some((tag) => tag.toLowerCase() === nextTag.toLowerCase());
    if (alreadyExists) {
      dom.elements.customTagInput.value = "";
      clearTagError();
      return;
    }
    if (state.currentCustomTags.length >= MAX_CUSTOM_TAGS) {
      showTagError(`Max ${MAX_CUSTOM_TAGS} tags reached.`);
      return;
    }

    state.currentCustomTags = normalizeCustomTags([...state.currentCustomTags, nextTag]);
    dom.elements.customTagInput.value = "";
    renderCustomTags();
    hydrateFilterOptions();
    clearTagError();
  }

  function renderCustomTags() {
    if (!dom.elements.customTagList) return;
    dom.elements.customTagList.innerHTML = "";
    const combined = [...DEFAULT_TAGS, ...state.currentCustomTags];
    combined.forEach((tag) => {
      const chip = document.createElement("span");
      chip.className = "tag-pill";
      chip.textContent = tag;
      if (!DEFAULT_TAGS.includes(tag)) {
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "tag-pill-remove";
        remove.textContent = "A-";
        remove.setAttribute("aria-label", `Remove ${tag}`);
        remove.addEventListener("click", () => {
          state.currentCustomTags = state.currentCustomTags.filter((t) => t.toLowerCase() !== tag.toLowerCase());
          renderCustomTags();
          hydrateFilterOptions();
          clearTagError();
        });
        chip.appendChild(remove);
      }
      dom.elements.customTagList.appendChild(chip);
    });
  }

  function hydrateFilterOptions() {
    if (!dom.elements.reasonFilter) return;
    const tags = [...DEFAULT_TAGS, ...state.currentCustomTags];
    const existing = new Set();
    dom.elements.reasonFilter.innerHTML = `<option value="all">All</option>`;
    tags.forEach((tag) => {
      const key = tag.toLowerCase();
      if (existing.has(key)) return;
      existing.add(key);
      const opt = document.createElement("option");
      opt.value = key;
      opt.textContent = tag;
      dom.elements.reasonFilter.appendChild(opt);
    });
    dom.elements.reasonFilter.value = existing.has(state.currentFilter) ? state.currentFilter : "all";
  }

  function filterReasons(reasons, filterKey) {
    if (!filterKey || filterKey === "all") return reasons;
    return reasons.filter((r) => (r.tag || "").toLowerCase() === filterKey);
  }

  function renderReasonFilterState(reasons) {
    if (!dom.elements.reasonFilter) return;
    const tags = new Set();
    reasons.forEach((r) => {
      if (r.tag) tags.add(r.tag.toLowerCase());
    });
    if (!tags.has(state.currentFilter) && state.currentFilter !== "all") {
      state.currentFilter = "all";
      dom.elements.reasonFilter.value = "all";
    }
  }

  async function clearAllReasons() {
    await Promise.all([
      chrome.storage.sync.set({ [REASONS_KEY]: [] }),
      chrome.storage.local.set({ [REASONS_KEY]: [] })
    ]);
    renderUsageReasons();
  }

  Options.intentions = {
    DEFAULT_TAGS,
    MAX_CUSTOM_TAGS,
    renderUsageReasons,
    normalizeCustomTags,
    renderCustomTags,
    hydrateFilterOptions,
    addCustomTag,
    clearAllReasons
  };
})();

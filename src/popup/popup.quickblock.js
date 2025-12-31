(() => {
  const Popup = (window.ZenStopPopup = window.ZenStopPopup || {});
  const dom = Popup.dom;
  const storage = Popup.storage;
  if (!dom || !storage) return;

  const URL_PARAMS = new URLSearchParams(window.location.search);

  async function hydrateQuickBlock({ blockedSites, blockAdultSites, customAdultSites }) {
    const host = await getActiveHostname();
    if (!host) {
      dom.elements.currentSite.textContent = "Unavailable";
      dom.elements.blockSite.disabled = true;
      dom.elements.blockChooser.classList.add("hidden");
      dom.setQuickBlockStatus("Open a normal website tab to block it.");
      return;
    }

    dom.elements.currentSite.textContent = host;

    const normalizedBlocked = normalizeSiteList(blockedSites);
    const alreadyBlocked = isHostListed(host, normalizedBlocked);
    const normalizedAdult = normalizeSiteList(customAdultSites);
    const alreadyInAdultList = isHostListed(host, normalizedAdult);

    dom.elements.blockSite.disabled = false;
    dom.elements.blockSite.textContent =
      alreadyBlocked || (alreadyInAdultList && blockAdultSites) ? "Edit" : "Block";

    dom.setQuickBlockStatus("");
    dom.elements.blockChooser.classList.add("hidden");
  }

  async function toggleBlockChooser() {
    const host = await getActiveHostname();
    if (!host) return;
    dom.elements.blockChooser.classList.toggle("hidden");
    const hidden = dom.elements.blockChooser.classList.contains("hidden");
    dom.setQuickBlockStatus(hidden ? "" : "Add this site as:");
  }

  async function blockCurrentSiteAsUnproductive() {
    const host = await getActiveHostname();
    if (!host) return;

    dom.setQuickBlockBusy(dom.elements.blockAsUnproductive, true);
    dom.setQuickBlockStatus("Saving...");

    try {
      const settings = await storage.loadQuickBlockSettings();
      const normalizedList = normalizeSiteList(settings.blockedSites);
      const alreadyBlocked = isHostListed(host, normalizedList);
      if (alreadyBlocked) {
        await hydrateQuickBlock(settings);
        dom.setQuickBlockStatus("Already in blocked websites.");
        return;
      }

      const nextBlockedSites = settings.blockedSites.slice();
      nextBlockedSites.push(host);
      await chrome.storage.sync.set({ blockedSites: nextBlockedSites });

      dom.setQuickBlockStatus("Added to blocked websites.");
      await hydrateQuickBlock({ ...settings, blockedSites: nextBlockedSites });
    } finally {
      dom.setQuickBlockBusy(dom.elements.blockAsUnproductive, false);
    }
  }

  async function blockCurrentSiteAsAdult() {
    const host = await getActiveHostname();
    if (!host) return;

    dom.setQuickBlockBusy(dom.elements.blockAsAdult, true);
    dom.setQuickBlockStatus("Saving...");

    try {
      const settings = await storage.loadQuickBlockSettings();
      const normalizedAdult = normalizeSiteList(settings.customAdultSites);
      const alreadyInAdultList = isHostListed(host, normalizedAdult);
      if (alreadyInAdultList && settings.blockAdultSites) {
        await hydrateQuickBlock(settings);
        dom.setQuickBlockStatus("Already in adult sites.");
        return;
      }

      const nextCustomAdultSites = settings.customAdultSites.slice();
      nextCustomAdultSites.push(host);
      await chrome.storage.sync.set({ customAdultSites: nextCustomAdultSites, blockAdultSites: true });

      dom.setQuickBlockStatus("Added to adult sites.");
      await hydrateQuickBlock({
        ...settings,
        blockAdultSites: true,
        customAdultSites: nextCustomAdultSites
      });
    } finally {
      dom.setQuickBlockBusy(dom.elements.blockAsAdult, false);
    }
  }

  function isHostListed(host, list) {
    return list.some((entry) => host === entry || host.endsWith(`.${entry}`));
  }

  async function getActiveHostname() {
    if (!chrome?.tabs?.query) return "";
    try {
      const tab = await getActiveTab();
      const url = tab?.url || tab?.pendingUrl || "";
      if (!url) return "";
      const parsed = new URL(url);
      if (!parsed.hostname) return "";
      return normalizeHostname(parsed.hostname);
    } catch {
      return "";
    }
  }

  async function getActiveTab() {
    if (!chrome?.tabs?.query) return null;
    if (URL_PARAMS.has("tab")) {
      const raw = Number(URL_PARAMS.get("tab"));
      if (Number.isFinite(raw)) {
        try {
          return await chrome.tabs.get(raw);
        } catch {
          return null;
        }
      }
    }
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return tabs?.[0] || null;
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

  if (typeof window !== "undefined") {
    window.__zenstopTest = window.__zenstopTest || {};
    window.__zenstopTest.getActiveTab = getActiveTab;
  }

  Popup.quickblock = {
    hydrateQuickBlock,
    toggleBlockChooser,
    blockCurrentSiteAsUnproductive,
    blockCurrentSiteAsAdult
  };
})();

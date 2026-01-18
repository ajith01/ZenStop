(() => {
  const Content = (globalThis.ZenStopContent = globalThis.ZenStopContent || {});
  const zenUtils = globalThis.ZenStopUtils || {};
  const normalizeEntry = zenUtils.normalizeEntry;
  const formatDateKey = zenUtils.formatDateKey;

  function normalizePositiveNumber(value, fallback, min = 1) {
    const numberValue = Number(value);
    if (Number.isFinite(numberValue) && numberValue >= min) {
      return numberValue;
    }
    return fallback;
  }

  function normalizeRedirect(target) {
    if (typeof target !== "string") return "";
    const trimmed = target.trim();
    if (!trimmed) return "";
    const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    try {
      const parsed = new URL(candidate);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return "";
      }
      if (parsed.pathname === "/" && !parsed.search && !parsed.hash) {
        return parsed.origin;
      }
      return parsed.toString();
    } catch {
      return "";
    }
  }

  function normalizeRecordMap(value) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return { ...value };
    }
    return {};
  }

  function isExtensionContextValid() {
    return typeof chrome !== "undefined" && chrome.runtime && Boolean(chrome.runtime.id);
  }

  function isHostMatch(hostname, normalized) {
    if (!hostname || !normalized) return false;
    if (hostname === normalized) return true;
    if (hostname.endsWith(`.${normalized}`)) return true;
    return false;
  }

  function resolveBlockedSite(sites) {
    const hostname = location.hostname.toLowerCase();
    const match = sites
      .map((entry) => {
        const normalized = normalizeEntry ? normalizeEntry(entry) : "";
        return normalized ? { normalized, label: entry?.trim() || normalized } : null;
      })
      .filter(Boolean)
      .find(({ normalized }) => isHostMatch(hostname, normalized));

    if (!match) return null;
    return { siteKey: match.normalized, label: match.label };
  }

  function stopAutoplayMedia() {
    document.querySelectorAll("video, audio").forEach((el) => {
      try {
        if (!el.dataset.zenstopMuted) {
          el.dataset.zenstopMuted = "true";
          el.dataset.zenstopMutedPrev = el.muted ? "true" : "false";
        }
        el.pause?.();
        el.muted = true;
        if (!Number.isNaN(el.currentTime)) {
          el.currentTime = 0;
        }
      } catch {
        // ignore
      }
    });
  }

  function restoreAutoplayMedia() {
    document.querySelectorAll("video, audio").forEach((el) => {
      if (!el.dataset.zenstopMuted) return;
      try {
        const wasMuted = el.dataset.zenstopMutedPrev === "true";
        el.muted = wasMuted;
      } catch {
        // ignore
      }
      delete el.dataset.zenstopMuted;
      delete el.dataset.zenstopMutedPrev;
    });
  }

  function startAutoplayMuteGuard(overlayId, intervalMs = 1000) {
    const root = document.documentElement || document.body;
    if (!root) return () => {};
    let active = true;
    const stop = () => {
      if (!active) return;
      active = false;
      observer.disconnect();
      clearInterval(intervalId);
    };
    const check = () => {
      if (!active) return;
      if (overlayId && !document.getElementById(overlayId)) {
        stop();
        return;
      }
      stopAutoplayMedia();
    };
    const observer = new MutationObserver(check);
    observer.observe(root, { childList: true, subtree: true });
    const intervalId = setInterval(check, intervalMs);
    check();
    return stop;
  }

  function getTodayKey() {
    if (!formatDateKey) return "";
    return formatDateKey(new Date());
  }

  Content.helpers = {
    normalizePositiveNumber,
    normalizeRedirect,
    normalizeRecordMap,
    isExtensionContextValid,
    isHostMatch,
    resolveBlockedSite,
    stopAutoplayMedia,
    restoreAutoplayMedia,
    startAutoplayMuteGuard,
    getTodayKey
  };
})();

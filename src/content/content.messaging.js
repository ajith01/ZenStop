(() => {
  const Content = (globalThis.ZenStopContent = globalThis.ZenStopContent || {});
  const constants = Content.constants;
  const helpers = Content.helpers;
  if (!constants || !helpers) return;

  async function notifyGraceStarted(siteKey, releaseAt) {
    if (!helpers.isExtensionContextValid()) return;
    if (!siteKey || !releaseAt) return;
    try {
      await chrome.runtime.sendMessage({
        type: constants.GRACE_STARTED_MESSAGE,
        siteKey,
        releaseAt
      });
    } catch {
      // ignore
    }
  }

  async function notifyOverlayShown(siteKey) {
    if (!helpers.isExtensionContextValid()) return;
    if (!siteKey) return;
    try {
      await chrome.runtime.sendMessage({
        type: constants.OVERLAY_SHOWN_MESSAGE,
        siteKey,
        timestamp: Date.now()
      });
    } catch {
      // ignore
    }
  }

  async function notifyOverlayResolved(siteKey, outcome) {
    if (!helpers.isExtensionContextValid()) return;
    if (!siteKey) return;
    try {
      await chrome.runtime.sendMessage({
        type: constants.OVERLAY_RESOLVED_MESSAGE,
        siteKey,
        outcome: outcome || "unknown",
        timestamp: Date.now()
      });
    } catch {
      // ignore
    }
  }

  Content.messaging = {
    notifyGraceStarted,
    notifyOverlayShown,
    notifyOverlayResolved
  };
})();

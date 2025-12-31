(() => {
  const Content = (globalThis.ZenStopContent = globalThis.ZenStopContent || {});
  const constants = Content.constants;
  const stateApi = Content.state;
  const zenUtils = globalThis.ZenStopUtils || {};
  const formatCountdown = zenUtils.formatCountdown;
  if (!constants || !stateApi) return;

  function showGraceIndicator(releaseAt) {
    if (!releaseAt || releaseAt <= Date.now()) {
      clearGraceIndicator();
      return;
    }
    ensureGraceIndicatorStyles();
    let indicator = document.getElementById(constants.GRACE_INDICATOR_ID);
    if (!indicator) {
      indicator = document.createElement("div");
      indicator.id = constants.GRACE_INDICATOR_ID;
      const appendIndicator = () => appendElement(indicator);
      if (!appendIndicator()) {
        document.addEventListener("DOMContentLoaded", appendIndicator, { once: true });
      }
    }
    enableIndicatorDrag(indicator);

    const update = () => {
      const remaining = releaseAt - Date.now();
      if (remaining <= 0) {
        clearGraceIndicator();
        return;
      }
      const label = formatCountdown ? formatCountdown(remaining) : Math.ceil(remaining / 1000);
      indicator.textContent = `Pause returns in ${label}`;
    };

    const indicatorState = stateApi.state.graceIndicator;
    if (indicatorState.intervalId) {
      clearInterval(indicatorState.intervalId);
    }
    indicatorState.intervalId = setInterval(update, constants.TIMER_TICK_MS);
    indicatorState.releaseAt = releaseAt;
    update();
  }

  function clearGraceIndicator() {
    const indicator = document.getElementById(constants.GRACE_INDICATOR_ID);
    if (indicator) {
      indicator.remove();
    }
    const indicatorState = stateApi.state.graceIndicator;
    if (indicatorState.intervalId) {
      clearInterval(indicatorState.intervalId);
      indicatorState.intervalId = null;
    }
    indicatorState.releaseAt = 0;
  }

  function ensureGraceIndicatorStyles() {
    if (document.getElementById(constants.GRACE_INDICATOR_STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = constants.GRACE_INDICATOR_STYLE_ID;
    style.textContent = `
      #${constants.GRACE_INDICATOR_ID} {
        position: fixed;
        right: 16px;
        bottom: 16px;
        z-index: 2147483646;
        font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
        font-size: 12px;
        font-weight: 600;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: #f5f2ff;
        background: rgba(25, 20, 45, 0.88);
        border: 1px solid rgba(245, 242, 255, 0.18);
        border-radius: 999px;
        padding: 6px 12px;
        box-shadow: 0 10px 24px rgba(12, 9, 28, 0.35);
        backdrop-filter: blur(8px);
        cursor: grab;
        user-select: none;
        touch-action: none;
      }
    `;
    const appendStyle = () => appendElement(style);
    if (!appendStyle()) {
      document.addEventListener("DOMContentLoaded", appendStyle, { once: true });
    }
  }

  function appendElement(node) {
    const tag = node?.tagName ? node.tagName.toLowerCase() : "";
    const preferHead = tag === "style" || tag === "link";
    if (preferHead && document.head) {
      document.head.appendChild(node);
      return true;
    }
    const host = document.body || document.documentElement;
    if (host && !node.isConnected) {
      host.appendChild(node);
      return true;
    }
    if (!preferHead && document.head && !node.isConnected) {
      document.head.appendChild(node);
      return true;
    }
    return false;
  }

  function enableIndicatorDrag(indicator) {
    if (!indicator || indicator.dataset.draggable === "true") return;
    indicator.dataset.draggable = "true";
    let dragState = null;

    indicator.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      const rect = indicator.getBoundingClientRect();
      indicator.style.left = `${rect.left}px`;
      indicator.style.top = `${rect.top}px`;
      indicator.style.right = "auto";
      indicator.style.bottom = "auto";
      dragState = {
        pointerId: event.pointerId,
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top
      };
      indicator.setPointerCapture(event.pointerId);
    });

    indicator.addEventListener("pointermove", (event) => {
      if (!dragState || dragState.pointerId !== event.pointerId) return;
      const rect = indicator.getBoundingClientRect();
      const maxLeft = Math.max(0, window.innerWidth - rect.width);
      const maxTop = Math.max(0, window.innerHeight - rect.height);
      const nextLeft = Math.min(maxLeft, Math.max(0, event.clientX - dragState.offsetX));
      const nextTop = Math.min(maxTop, Math.max(0, event.clientY - dragState.offsetY));
      indicator.style.left = `${nextLeft}px`;
      indicator.style.top = `${nextTop}px`;
    });

    const endDrag = (event) => {
      if (!dragState || dragState.pointerId !== event.pointerId) return;
      dragState = null;
      indicator.releasePointerCapture(event.pointerId);
    };

    indicator.addEventListener("pointerup", endDrag);
    indicator.addEventListener("pointercancel", endDrag);
  }

  Content.indicator = {
    showGraceIndicator,
    clearGraceIndicator
  };
})();

(() => {
  const Content = (globalThis.ZenStopContent = globalThis.ZenStopContent || {});
  const state = {
    evaluating: false,
    lastHref: typeof location !== "undefined" ? location.href : "",
    timers: new Map(),
    intervals: [],
    graceIndicator: {
      intervalId: null,
      releaseAt: 0
    }
  };

  function addInterval(callback, delayMs) {
    const id = setInterval(callback, delayMs);
    state.intervals.push(id);
    return id;
  }

  function clearIntervals() {
    state.intervals.forEach((intervalId) => clearInterval(intervalId));
    state.intervals.length = 0;
  }

  function setTimer(key, delayMs, callback) {
    if (!key || !delayMs || delayMs <= 0) return null;
    clearTimer(key);
    const id = setTimeout(() => {
      state.timers.delete(key);
      if (typeof callback === "function") {
        callback();
      }
    }, delayMs);
    state.timers.set(key, id);
    return id;
  }

  function clearTimer(key) {
    const id = state.timers.get(key);
    if (id) {
      clearTimeout(id);
      state.timers.delete(key);
    }
  }

  function clearAllTimers() {
    state.timers.forEach((timeoutId) => clearTimeout(timeoutId));
    state.timers.clear();
  }

  Content.state = {
    state,
    addInterval,
    clearIntervals,
    setTimer,
    clearTimer,
    clearAllTimers
  };
})();

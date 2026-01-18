(() => {
  const Content = (globalThis.ZenStopContent = globalThis.ZenStopContent || {});
  const constants = Content.constants;
  const helpers = Content.helpers;
  const storage = Content.storage;
  const messaging = Content.messaging;
  const grace = Content.grace;
  const zenUtils = globalThis.ZenStopUtils || {};
  const resolveGoalValue = zenUtils.resolveGoalValue;
  const formatCountdown = zenUtils.formatCountdown;
  const formatStreak = zenUtils.formatStreak;

  if (!constants || !helpers || !storage || !messaging || !grace) return;

  function injectOverlay(seconds, redirectUrl, stats = {}) {
    ensureOverlayStyles();
    const overlay = createOverlayElement(seconds, redirectUrl);
    const elements = getOverlayElements(overlay);
    const {
      siteLabel,
      siteKey,
      dailyStats,
      successTotals: initialSuccessTotals = {},
      allowedMinutes = constants.DEFAULT_ALLOWED_MINUTES,
      openHistory = {},
      visitGoals = {},
      visitGoalDefault = constants.DEFAULT_VISIT_GOAL,
      themeMode = "auto",
      intentTags = [],
      streak = 0
    } = stats;

    messaging.notifyOverlayShown(siteKey);

    applyOpenGoalDisplay(elements, {
      visitGoals,
      visitGoalDefault,
      dailyStats,
      siteKey
    });
    applyStreakDisplay(elements, streak);
    const allTags = buildIntentTags(intentTags);
    const tagInputs = renderTagOptions(overlay, allTags);
    applyOverlayTheme(themeMode, overlay);

    if (!appendOverlayElement(overlay)) {
      document.addEventListener("DOMContentLoaded", () => appendOverlayElement(overlay), { once: true });
    }

    if (!elements.dismissButton) return;

    const stopMuteGuard = helpers.startAutoplayMuteGuard
      ? helpers.startAutoplayMuteGuard(constants.OVERLAY_ID)
      : null;

    setupOverlayBehavior({
      overlay,
      elements,
      tagInputs,
      stopMuteGuard,
      context: {
        siteLabel,
        siteKey,
        dailyStats,
        successTotals: initialSuccessTotals,
        allowedMinutes,
        openHistory
      },
      redirectUrl,
      seconds
    });
  }

  function createOverlayElement(seconds, redirectUrl) {
    const initialCountdown = formatCountdown
      ? formatCountdown(Number(seconds) * 1000)
      : String(seconds);
    const overlay = document.createElement("div");
    overlay.id = constants.OVERLAY_ID;
    overlay.className = "zenstop-backdrop";
    overlay.innerHTML = `
      <div class="zenstop-panel">
        <div class="zenstop-label-row">
          <span class="zenstop-label">Pause checkpoint</span>
          <span class="zenstop-badge">Deep breath</span>
        </div>
        <h1 class="zenstop-heading">Refocus before you continue</h1>
        <p class="zenstop-description">
          You marked this space as distracting. Take a beat before you dive back in.
        </p>
        <p class="zenstop-open-emphasis">
          Opens <span id="zenstop-open-count">0</span> / Goal <span id="zenstop-open-goal">-</span>
        </p>
        <p class="zenstop-streak">
          Goal streak <span id="zenstop-streak-count">0</span>
        </p>
        <div class="zenstop-countdown" aria-live="polite">
          <span class="zenstop-countdown-label">Time left</span>
          <span id="zenstop-countdown-value" class="zenstop-countdown-value">${initialCountdown}</span>
        </div>
        <div class="zenstop-breath">
          <div class="zenstop-breath-circle"></div>
          <span class="zenstop-breath-text">Inhale / Exhale</span>
        </div>
        <div class="zenstop-intent">
          <label class="zenstop-intent-label" for="zenstop-reason">Why are you opening this site?</label>
          <textarea id="zenstop-reason" class="zenstop-intent-input" placeholder="Jot your purpose or task"></textarea>
          <div class="zenstop-tag-row" role="group" aria-label="Purpose tags"></div>
          <div id="zenstop-reason-error" class="zenstop-intent-error hidden">Add a reason and choose a category.</div>
        </div>
        <div class="zenstop-actions">
          <button id="zenstop-dismiss" class="zenstop-btn zenstop-primary" disabled>
            <span id="zenstop-timer" class="zenstop-timer-inline">${seconds}</span>
            Continue
          </button>
          <button id="zenstop-redirect" class="zenstop-btn zenstop-secondary" ${redirectUrl ? "" : "disabled"}>
            It's not worth my time
          </button>
        </div>
      </div>
    `;
    return overlay;
  }

  function getOverlayElements(overlay) {
    return {
      dismissButton: overlay.querySelector("#zenstop-dismiss"),
      redirectButton: overlay.querySelector("#zenstop-redirect"),
      timerEl: overlay.querySelector("#zenstop-timer"),
      countdownValueEl: overlay.querySelector("#zenstop-countdown-value"),
      countdownWrap: overlay.querySelector(".zenstop-countdown"),
      reasonInput: overlay.querySelector("#zenstop-reason"),
      reasonError: overlay.querySelector("#zenstop-reason-error"),
      openCountEl: overlay.querySelector("#zenstop-open-count"),
      openGoalEl: overlay.querySelector("#zenstop-open-goal"),
      openLineEl: overlay.querySelector(".zenstop-open-emphasis"),
      streakEl: overlay.querySelector("#zenstop-streak-count")
    };
  }

  function applyOpenGoalDisplay(elements, context) {
    const goalValue = resolveGoalValue
      ? resolveGoalValue(context.visitGoals, context.visitGoalDefault, context.siteKey)
      : null;
    const todayOpens = (context.dailyStats?.opens && context.dailyStats.opens[context.siteKey]) || 0;
    if (elements.openCountEl) {
      elements.openCountEl.textContent = `${todayOpens}`;
    }
    if (elements.openGoalEl) {
      elements.openGoalEl.textContent = goalValue ? `${goalValue}` : "-";
    }
    if (elements.openLineEl && goalValue) {
      const isLastAttempt = todayOpens === goalValue;
      elements.openLineEl.classList.toggle("zenstop-open-warning", isLastAttempt);
    }
  }

  function applyStreakDisplay(elements, streak) {
    if (elements.streakEl) {
      elements.streakEl.textContent = formatStreak ? formatStreak(streak) : String(streak);
    }
  }

  function appendOverlayElement(overlay) {
    const host = document.body || document.documentElement;
    if (!host) return false;
    if (!overlay.isConnected) {
      try {
        host.appendChild(overlay);
      } catch {
        return false;
      }
    }
    if (document.documentElement?.style) {
      document.documentElement.style.overflow = "hidden";
    }
    return true;
  }

  function setupOverlayBehavior({ overlay, elements, tagInputs, stopMuteGuard, context, redirectUrl, seconds }) {
    const { dismissButton, redirectButton, timerEl, countdownValueEl, countdownWrap, reasonInput, reasonError } =
      elements;
    const { dailyStats, siteKey, siteLabel, allowedMinutes, openHistory, successTotals } = context;
    let timerUnlocked = false;

    const getReasonText = () => reasonInput?.value.trim() || "";
    const getSelectedTag = () => {
      const selected = Array.from(tagInputs).find((input) => input.checked);
      return selected ? selected.value : "";
    };
    const hasReason = () => Boolean(getReasonText());
    const hasTag = () => Boolean(getSelectedTag());

    const showReasonError = () => {
      reasonInput?.classList.add("zenstop-intent-missing");
      reasonError?.classList.remove("hidden");
    };

    const hideReasonError = () => {
      reasonInput?.classList.remove("zenstop-intent-missing");
      reasonError?.classList.add("hidden");
    };

    const updateActionState = () => {
      const ready = timerUnlocked && hasReason() && hasTag();
      if (dismissButton) {
        dismissButton.disabled = !ready;
      }
      if (redirectButton) {
        redirectButton.disabled = !redirectUrl;
      }
    };

    const logReasonIfProvided = async (outcome) => {
      const reason = getReasonText();
      if (!reason) return;
      const tag = getSelectedTag();
      await storage.saveUsageReason({
        siteKey,
        siteLabel: siteLabel || siteKey,
        reason,
        tag: tag || "",
        outcome,
        url: location.href
      });
    };

    reasonInput?.addEventListener("input", () => {
      hideReasonError();
      updateActionState();
    });

    tagInputs.forEach((input) =>
      input.addEventListener("change", () => {
        hideReasonError();
        updateActionState();
      })
    );

    const stopCountdown = startCountdown(
      seconds,
      (remaining) => {
        const safeRemaining = Math.max(0, remaining);
        const formatted = formatCountdown
          ? formatCountdown(safeRemaining * 1000)
          : String(safeRemaining);
        if (timerEl) {
          timerEl.textContent = remaining > 0 ? formatted : "";
        }
        if (countdownValueEl) {
          countdownValueEl.textContent = formatted;
        }
      },
      () => {
        timerUnlocked = true;
        updateActionState();
        if (dismissButton) {
          dismissButton.textContent = "Continue";
        }
      }
    );

    const cleanup = () => {
      stopCountdown();
      stopMuteGuard?.();
      helpers.restoreAutoplayMedia?.();
      overlay.remove();
      document.documentElement.style.overflow = "";
    };

    dismissButton?.addEventListener("click", async () => {
      if (dismissButton.disabled) return;
      if (!hasReason() || !hasTag()) {
        showReasonError();
        (hasReason() ? tagInputs[0] : reasonInput)?.focus();
        return;
      }
      await storage.recordOpenOutcome({ dailyStats, openHistory, siteKey }).catch(() => {});
      await logReasonIfProvided("continue").catch(() => {});
      cleanup();
      await messaging.notifyOverlayResolved(siteKey, "continue");
      const releaseAt = await grace.start(siteKey, allowedMinutes);
      await messaging.notifyGraceStarted(siteKey, releaseAt);
    });

    if (redirectButton) {
      redirectButton.disabled = !redirectUrl;
      if (redirectUrl) {
        redirectButton.addEventListener("click", async () => {
          await storage.recordBailOutcome({ dailyStats, successTotals, siteKey }).catch(() => {});
          await logReasonIfProvided("redirect").catch(() => {});
          cleanup();
          await messaging.notifyOverlayResolved(siteKey, "redirect");
          await grace.clear(siteKey);
          window.location.assign(redirectUrl);
        });
      }
    }

    updateActionState();
  }

  function startCountdown(seconds, onTick, onComplete) {
    let remaining = seconds;
    const interval = setInterval(() => {
      remaining -= 1;
      if (typeof onTick === "function") {
        onTick(remaining);
      }
      if (remaining <= 0) {
        clearInterval(interval);
        if (typeof onComplete === "function") {
          onComplete();
        }
      }
    }, constants.TIMER_TICK_MS);
    return () => clearInterval(interval);
  }

  function ensureOverlayStyles() {
    if (document.getElementById(constants.OVERLAY_STYLE_ID)) return;
    const link = document.createElement("link");
    link.id = constants.OVERLAY_STYLE_ID;
    link.rel = "stylesheet";
  link.href = chrome.runtime.getURL("src/content/overlay.css");

    const appendLink = () => {
      if (document.head) {
        document.head.appendChild(link);
        return true;
      }
      if (document.documentElement && !link.isConnected) {
        document.documentElement.appendChild(link);
        return true;
      }
      return false;
    };

    if (!appendLink()) {
      document.addEventListener("DOMContentLoaded", appendLink, { once: true });
    }
  }

  function applyOverlayTheme(mode, overlay) {
    if (!overlay) return;
    overlay.dataset.theme = resolveTheme(mode);
  }

  function resolveTheme(mode) {
    if (mode === "dark") return "dark";
    if (mode === "light") return "light";
    const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    return prefersDark ? "dark" : "light";
  }

  function buildIntentTags(customTags = []) {
    const safeCustom = normalizeCustomTags(customTags);
    const combined = [...constants.DEFAULT_INTENT_TAGS, ...safeCustom];
    const seen = new Set();
    return combined.filter((tag) => {
      const key = tag.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
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
      if (seen.has(key) || result.length >= constants.MAX_CUSTOM_TAGS) return;
      seen.add(key);
      result.push(trimmed);
    });
    return result;
  }

  function renderTagOptions(overlay, tags) {
    const row = overlay.querySelector(".zenstop-tag-row");
    if (!row) return [];
    row.innerHTML = "";
    tags.forEach((tag, index) => {
      const id = `zenstop-tag-${index}`;
      const label = document.createElement("label");
      label.className = "zenstop-tag";
      const input = document.createElement("input");
      input.type = "radio";
      input.name = "zenstop-tag";
      input.value = tag;
      input.id = id;
      const span = document.createElement("span");
      span.textContent = tag;
      label.appendChild(input);
      label.appendChild(span);
      row.appendChild(label);
    });
    return row.querySelectorAll('input[name="zenstop-tag"]');
  }

  Content.overlay = {
    injectOverlay
  };
})();

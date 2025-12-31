(() => {
  const Options = (window.ZenStopOptions = window.ZenStopOptions || {});
  const dom = Options.dom;
  if (!dom) return;

  const DEFAULT_TAB = "rules";

  function initTabs() {
    if (!dom.tabButtons.length || !dom.tabPanels.length) return;
    dom.tabButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const target = btn.dataset.tabTarget;
        if (!target) return;
        setActiveTab(target);
      });
    });
    setActiveTab(DEFAULT_TAB);
  }

  function setActiveTab(name) {
    dom.tabButtons.forEach((btn) => {
      const isActive = btn.dataset.tabTarget === name;
      btn.classList.toggle("active", isActive);
      btn.setAttribute("aria-selected", String(isActive));
      btn.setAttribute("tabindex", isActive ? "0" : "-1");
    });
    dom.tabPanels.forEach((panel) => {
      const isActive = panel.dataset.tabPanel === name;
      panel.classList.toggle("active", isActive);
      panel.setAttribute("aria-hidden", String(!isActive));
    });
  }

  Options.tabs = {
    initTabs
  };
})();

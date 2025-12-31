/** @jest-environment jsdom */
beforeEach(() => {
  jest.resetModules();
  delete window.ZenStopContent;
  delete window.ZenStopUtils;
  document.body.innerHTML = "";
});

const loadModules = () => {
  require("../../src/shared/utils.js");
  require("../../src/content/content.constants.js");
  window.ZenStopContent.helpers = {
    isExtensionContextValid: () => true
  };
  window.ZenStopContent.storage = {
    saveUsageReason: jest.fn(async () => {}),
    recordOpenOutcome: jest.fn(async () => {}),
    recordBailOutcome: jest.fn(async () => {})
  };
  window.ZenStopContent.messaging = {
    notifyOverlayShown: jest.fn(async () => {}),
    notifyOverlayResolved: jest.fn(async () => {}),
    notifyGraceStarted: jest.fn(async () => {})
  };
  window.ZenStopContent.grace = {
    start: jest.fn(async () => Date.now() + 1000),
    clear: jest.fn(async () => {})
  };
  require("../../src/content/content.overlay.js");
};

test("injectOverlay renders overlay element", () => {
  loadModules();
  window.ZenStopContent.overlay.injectOverlay(3, "", {
    siteLabel: "Example",
    siteKey: "example.com",
    dailyStats: { opens: {} },
    successTotals: {},
    allowedMinutes: 10,
    openHistory: {},
    visitGoals: {},
    visitGoalDefault: 5,
    themeMode: "auto",
    intentTags: [],
    streak: 0
  });
  expect(document.getElementById("zenstop-overlay")).not.toBeNull();
});

test("injectOverlay shows open count", () => {
  loadModules();
  window.ZenStopContent.overlay.injectOverlay(3, "", {
    siteLabel: "Example",
    siteKey: "example.com",
    dailyStats: { opens: { "example.com": 2 } },
    successTotals: {},
    allowedMinutes: 10,
    openHistory: {},
    visitGoals: {},
    visitGoalDefault: 5,
    themeMode: "auto",
    intentTags: [],
    streak: 0
  });
  expect(document.getElementById("zenstop-open-count").textContent).toBe("2");
});


beforeEach(() => {
  jest.resetModules();
  delete global.ZenStopContent;
  delete global.ZenStopUtils;
  global.chrome.storage.sync.get = jest.fn(async () => ({}));
  global.chrome.storage.sync.set = jest.fn(async () => {});
  global.chrome.storage.local.get = jest.fn(async () => ({}));
  global.chrome.storage.local.set = jest.fn(async () => {});
});

const loadModules = () => {
  require("../../src/shared/utils.js");
  require("../../src/content/content.constants.js");
  require("../../src/content/content.helpers.js");
  require("../../src/content/content.storage.js");
};

test("loadSettings falls back to default wait seconds", async () => {
  loadModules();
  const settings = await global.ZenStopContent.storage.loadSettings();
  expect(settings.waitSeconds).toBe(10);
});

test("recordVisit increments daily stats visits", async () => {
  loadModules();
  const settings = {
    dailyStats: null,
    visitHistory: {},
    successHistory: {},
    history: {}
  };
  const result = await global.ZenStopContent.storage.recordVisit(settings, "example.com");
  expect(result.dailyStats.visits["example.com"]).toBe(1);
});

test("recordOpenOutcome increments opens count", async () => {
  loadModules();
  const dailyStats = { opens: {} };
  const result = await global.ZenStopContent.storage.recordOpenOutcome({
    dailyStats,
    openHistory: {},
    siteKey: "example.com"
  });
  expect(result.dailyStats.opens["example.com"]).toBe(1);
});

test("readGraceRelease returns 0 for expired entries", async () => {
  loadModules();
  global.chrome.storage.local.get = jest.fn(async () => ({
    gracePeriods: { "example.com": Date.now() - 1000 }
  }));
  const result = await global.ZenStopContent.storage.readGraceRelease("example.com");
  expect(result).toBe(0);
});


/** @jest-environment jsdom */
beforeEach(() => {
  jest.resetModules();
  delete window.ZenStopPopup;
});

test("loadSettings falls back to default wait time", async () => {
  global.chrome.storage.sync.get = jest.fn(async () => ({ waitSeconds: 1 }));
  require("../../src/popup/popup.storage.js");
  const settings = await window.ZenStopPopup.storage.loadSettings("2025-01-01");
  expect(settings.waitSeconds).toBe(10);
});

test("loadSettings uses todayKey for dailyStats date", async () => {
  global.chrome.storage.sync.get = jest.fn(async () => ({}));
  require("../../src/popup/popup.storage.js");
  const settings = await window.ZenStopPopup.storage.loadSettings("2025-01-02");
  expect(settings.dailyStats.date).toBe("2025-01-02");
});

test("loadSettings defaults blockAdultSites to true", async () => {
  global.chrome.storage.sync.get = jest.fn(async () => ({}));
  require("../../src/popup/popup.storage.js");
  const settings = await window.ZenStopPopup.storage.loadSettings("2025-01-03");
  expect(settings.blockAdultSites).toBe(true);
});


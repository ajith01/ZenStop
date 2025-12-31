beforeEach(() => {
  jest.resetModules();
  delete global.ZenStopContent;
});

test("constants expose overlay id", () => {
  require("../../src/content/content.constants.js");
  expect(global.ZenStopContent.constants.OVERLAY_ID).toBe("zenstop-overlay");
});

test("constants include visitGoals in settings keys", () => {
  require("../../src/content/content.constants.js");
  expect(global.ZenStopContent.constants.SETTINGS_SYNC_KEYS).toContain("visitGoals");
});


beforeEach(() => {
  jest.resetModules();
  delete global.ZenStopContent;
  global.chrome.runtime.sendMessage = jest.fn(async () => ({}));
});

test("notifyGraceStarted sends message", async () => {
  require("../../src/content/content.constants.js");
  require("../../src/content/content.helpers.js");
  require("../../src/content/content.messaging.js");
  await global.ZenStopContent.messaging.notifyGraceStarted("example.com", 123);
  expect(global.chrome.runtime.sendMessage).toHaveBeenCalledWith({
    type: "zenstop_grace_started",
    siteKey: "example.com",
    releaseAt: 123
  });
});

test("notifyOverlayResolved does nothing without siteKey", async () => {
  require("../../src/content/content.constants.js");
  require("../../src/content/content.helpers.js");
  require("../../src/content/content.messaging.js");
  await global.ZenStopContent.messaging.notifyOverlayResolved("", "continue");
  expect(global.chrome.runtime.sendMessage).not.toHaveBeenCalled();
});


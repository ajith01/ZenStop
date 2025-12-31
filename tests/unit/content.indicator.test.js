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
  require("../../src/content/content.state.js");
  require("../../src/content/content.indicator.js");
};

test("showGraceIndicator creates indicator element", () => {
  loadModules();
  const releaseAt = Date.now() + 60000;
  window.ZenStopContent.indicator.showGraceIndicator(releaseAt);
  expect(document.getElementById("zenstop-grace-indicator")).not.toBeNull();
});

test("clearGraceIndicator removes indicator element", () => {
  loadModules();
  const releaseAt = Date.now() + 60000;
  window.ZenStopContent.indicator.showGraceIndicator(releaseAt);
  window.ZenStopContent.indicator.clearGraceIndicator();
  expect(document.getElementById("zenstop-grace-indicator")).toBeNull();
});


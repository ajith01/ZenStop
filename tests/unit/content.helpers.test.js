beforeEach(() => {
  jest.resetModules();
  delete global.ZenStopContent;
  delete global.ZenStopUtils;
  delete global.location;
});

test("normalizePositiveNumber uses fallback on invalid", () => {
  require("../../src/shared/utils.js");
  require("../../src/content/content.helpers.js");
  const { normalizePositiveNumber } = global.ZenStopContent.helpers;
  expect(normalizePositiveNumber("nope", 5, 1)).toBe(5);
});

test("normalizeRedirect adds https protocol", () => {
  require("../../src/shared/utils.js");
  require("../../src/content/content.helpers.js");
  const { normalizeRedirect } = global.ZenStopContent.helpers;
  expect(normalizeRedirect("example.com")).toBe("https://example.com");
});

test("normalizeRecordMap returns empty object for arrays", () => {
  require("../../src/shared/utils.js");
  require("../../src/content/content.helpers.js");
  const { normalizeRecordMap } = global.ZenStopContent.helpers;
  expect(Object.keys(normalizeRecordMap([])).length).toBe(0);
});

test("resolveBlockedSite matches hostname", () => {
  require("../../src/shared/utils.js");
  require("../../src/content/content.helpers.js");
  global.location = { hostname: "example.com" };
  const { resolveBlockedSite } = global.ZenStopContent.helpers;
  const result = resolveBlockedSite(["example.com"]);
  expect(result.siteKey).toBe("example.com");
});


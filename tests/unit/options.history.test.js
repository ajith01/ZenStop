/** @jest-environment jsdom */
const markup = `
  <select id="historySite"></select>
`;

const loadModules = () => {
  require("../../src/options/options.dom.js");
  require("../../src/options/options.state.js");
  require("../../src/options/options.history.js");
};

beforeEach(() => {
  jest.resetModules();
  document.body.innerHTML = markup;
  delete window.ZenStopOptions;
});

test("populateSiteOptions only includes manual sites", () => {
  loadModules();
  window.ZenStopOptions.state.cachedBlockedSites = ["example.com"];
  window.ZenStopOptions.state.cachedCustomAdultSites = [];
  window.ZenStopOptions.history.populateSiteOptions({
    "example.com": [{ date: "2025-01-01", value: 1 }],
    "other.com": [{ date: "2025-01-01", value: 1 }]
  });
  expect(document.getElementById("historySite").options.length).toBe(2);
});


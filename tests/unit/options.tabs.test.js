/** @jest-environment jsdom */
const markup = `
  <button data-tab-target="rules" class="tab-btn"></button>
  <button data-tab-target="history" class="tab-btn"></button>
  <section data-tab-panel="rules" class="tab-panel"></section>
  <section data-tab-panel="history" class="tab-panel"></section>
`;

const loadModules = () => {
  require("../../src/options/options.dom.js");
  require("../../src/options/options.tabs.js");
};

beforeEach(() => {
  jest.resetModules();
  document.body.innerHTML = markup;
  delete window.ZenStopOptions;
});

test("initTabs activates default tab", () => {
  loadModules();
  window.ZenStopOptions.tabs.initTabs();
  expect(document.querySelector('[data-tab-target="rules"]').classList.contains("active")).toBe(true);
});


/** @jest-environment jsdom */
const markup = `
  <input id="customTagInput" />
  <div id="customTagList"></div>
  <select id="reasonFilter"></select>
  <div id="tagError" class="hidden"></div>
`;

const loadModules = () => {
  require("../../src/options/options.dom.js");
  require("../../src/options/options.state.js");
  require("../../src/options/options.intentions.js");
};

beforeEach(() => {
  jest.resetModules();
  document.body.innerHTML = markup;
  delete window.ZenStopOptions;
});

test("addCustomTag updates custom tag state", () => {
  loadModules();
  document.getElementById("customTagInput").value = "Study";
  window.ZenStopOptions.intentions.addCustomTag();
  expect(window.ZenStopOptions.state.currentCustomTags).toEqual(["Study"]);
});


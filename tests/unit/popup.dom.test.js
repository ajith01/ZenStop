/** @jest-environment jsdom */
const markup = `
  <div>
    <p id="summary"></p>
    <p id="pauseStats"></p>
    <span id="pauseCount"></span>
    <span id="bailCount"></span>
    <button id="openOptions"></button>
    <span id="currentSite"></span>
    <button id="blockSite"></button>
    <div id="blockChooser"></div>
    <button id="blockAsUnproductive"></button>
    <button id="blockAsAdult"></button>
    <p id="blockSiteStatus"></p>
  </div>
`;

beforeEach(() => {
  jest.resetModules();
  document.body.innerHTML = markup;
  delete window.ZenStopPopup;
});

test("summaryReady true when elements exist", () => {
  require("../../src/popup/popup.dom.js");
  expect(window.ZenStopPopup.dom.summaryReady).toBe(true);
});

test("quickBlockReady true when elements exist", () => {
  require("../../src/popup/popup.dom.js");
  expect(window.ZenStopPopup.dom.quickBlockReady).toBe(true);
});

test("applyTheme sets data attribute", () => {
  require("../../src/popup/popup.dom.js");
  window.ZenStopPopup.dom.applyTheme("dark");
  expect(document.documentElement.dataset.theme).toBe("dark");
});

test("setSummaryText updates summary element", () => {
  require("../../src/popup/popup.dom.js");
  window.ZenStopPopup.dom.setSummaryText("Hello");
  expect(document.getElementById("summary").textContent).toBe("Hello");
});

test("setPauseCounts writes pause count", () => {
  require("../../src/popup/popup.dom.js");
  window.ZenStopPopup.dom.setPauseCounts(3, 1);
  expect(document.getElementById("pauseCount").textContent).toBe("3");
});


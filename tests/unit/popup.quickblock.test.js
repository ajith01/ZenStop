/** @jest-environment jsdom */
const markup = `
  <div>
    <span id="currentSite"></span>
    <button id="blockSite"></button>
    <div id="blockChooser" class="hidden"></div>
    <button id="blockAsUnproductive"></button>
    <button id="blockAsAdult"></button>
    <p id="blockSiteStatus"></p>
  </div>
`;

const loadModules = () => {
  require("../../src/popup/popup.dom.js");
  require("../../src/popup/popup.storage.js");
  require("../../src/popup/popup.quickblock.js");
};

beforeEach(() => {
  jest.resetModules();
  document.body.innerHTML = markup;
  delete window.ZenStopPopup;
  global.chrome.tabs.query = jest.fn(async () => []);
  global.chrome.storage.sync.get = jest.fn(async () => ({}));
  global.chrome.storage.sync.set = jest.fn(async () => {});
});

test("hydrateQuickBlock shows unavailable when no active tab", async () => {
  loadModules();
  await window.ZenStopPopup.quickblock.hydrateQuickBlock({
    blockedSites: [],
    blockAdultSites: true,
    customAdultSites: []
  });
  expect(document.getElementById("currentSite").textContent).toBe("Unavailable");
});

test("hydrateQuickBlock sets edit label for blocked site", async () => {
  global.chrome.tabs.query = jest.fn(async () => [{ url: "https://example.com" }]);
  loadModules();
  await window.ZenStopPopup.quickblock.hydrateQuickBlock({
    blockedSites: ["example.com"],
    blockAdultSites: true,
    customAdultSites: []
  });
  expect(document.getElementById("blockSite").textContent).toBe("Edit");
});

test("blockCurrentSiteAsUnproductive writes blocked site", async () => {
  global.chrome.tabs.query = jest.fn(async () => [{ url: "https://example.com" }]);
  global.chrome.storage.sync.get = jest.fn(async () => ({
    blockedSites: [],
    customAdultSites: [],
    blockAdultSites: true
  }));
  loadModules();
  await window.ZenStopPopup.quickblock.blockCurrentSiteAsUnproductive();
  expect(global.chrome.storage.sync.set).toHaveBeenCalledWith({ blockedSites: ["example.com"] });
});


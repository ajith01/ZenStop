/** @jest-environment jsdom */
const markup = `
  <details id="customAdultWrapper"></details>
  <textarea id="blocked"></textarea>
  <input id="seconds" />
  <input id="redirect" />
  <input id="allowedMinutes" />
  <input id="blockAdultSites" type="checkbox" />
  <textarea id="customAdultSites"></textarea>
  <textarea id="visitGoals"></textarea>
  <input id="visitGoalDefault" />
  <select id="themeMode">
    <option value="auto">Auto</option>
    <option value="light">Light</option>
    <option value="dark">Dark</option>
  </select>
  <div id="status"></div>
`;

const loadModules = () => {
  require("../../src/options/options.dom.js");
  require("../../src/options/options.state.js");
  require("../../src/options/options.intentions.js");
  require("../../src/options/options.settings.js");
};

beforeEach(() => {
  jest.resetModules();
  document.body.innerHTML = markup;
  delete window.ZenStopOptions;
  global.chrome.storage.sync.get = jest.fn(async () => ({}));
  global.chrome.storage.sync.set = jest.fn(async () => {});
});

test("restoreSettings populates blocked sites", async () => {
  global.chrome.storage.sync.get = jest.fn(async () => ({ blockedSites: ["example.com"] }));
  loadModules();
  await window.ZenStopOptions.settings.restoreSettings();
  expect(document.getElementById("blocked").value).toBe("example.com");
});

test("saveSettings writes blocked sites to storage", async () => {
  document.getElementById("blocked").value = "example.com";
  document.getElementById("seconds").value = "5";
  document.getElementById("allowedMinutes").value = "10";
  document.getElementById("visitGoalDefault").value = "3";
  loadModules();
  window.ZenStopOptions.state.currentCustomTags = ["Study"];
  await window.ZenStopOptions.settings.saveSettings();
  expect(global.chrome.storage.sync.set).toHaveBeenCalledWith(
    expect.objectContaining({ blockedSites: ["example.com"] })
  );
});


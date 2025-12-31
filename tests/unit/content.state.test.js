beforeEach(() => {
  jest.resetModules();
  delete global.ZenStopContent;
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

test("addInterval tracks interval ids", () => {
  require("../../src/content/content.state.js");
  const { addInterval, state } = global.ZenStopContent.state;
  addInterval(() => {}, 1000);
  expect(state.intervals.length).toBe(1);
});

test("setTimer stores timer by key", () => {
  require("../../src/content/content.state.js");
  const { setTimer, state } = global.ZenStopContent.state;
  setTimer("example", 1000, () => {});
  expect(state.timers.has("example")).toBe(true);
});

test("clearAllTimers removes timers", () => {
  require("../../src/content/content.state.js");
  const { setTimer, clearAllTimers, state } = global.ZenStopContent.state;
  setTimer("example", 1000, () => {});
  clearAllTimers();
  expect(state.timers.size).toBe(0);
});


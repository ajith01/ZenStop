beforeEach(() => {
  jest.resetModules();
  delete global.ZenStopContent;
});

test("start returns release timestamp", async () => {
  global.ZenStopContent = {
    state: {
      setTimer: jest.fn()
    },
    storage: {
      grantGracePeriod: jest.fn(async () => 123)
    },
    indicator: {
      showGraceIndicator: jest.fn(),
      clearGraceIndicator: jest.fn()
    }
  };
  require("../../src/content/content.grace.js");
  const result = await global.ZenStopContent.grace.start("example.com", 1);
  expect(result).toBe(123);
});

test("clear calls indicator clear", async () => {
  global.ZenStopContent = {
    state: {
      setTimer: jest.fn(),
      clearTimer: jest.fn()
    },
    storage: {
      grantGracePeriod: jest.fn(async () => 0),
      clearGracePeriod: jest.fn(async () => {})
    },
    indicator: {
      showGraceIndicator: jest.fn(),
      clearGraceIndicator: jest.fn()
    }
  };
  require("../../src/content/content.grace.js");
  await global.ZenStopContent.grace.clear("example.com");
  expect(global.ZenStopContent.indicator.clearGraceIndicator).toHaveBeenCalled();
});


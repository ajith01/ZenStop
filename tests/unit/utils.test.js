const utils = require("../../src/shared/utils");

describe("ZenStop utils", () => {
  test.each([
    ["HTTPS://Example.COM/path", "example.com"],
    ["  .Foo.Bar.com ", "foo.bar.com"],
    ["", ""]
  ])("normalizeEntry('%s') => '%s'", (input, expected) => {
    expect(utils.normalizeEntry(input)).toBe(expected);
  });

  test("buildBlockedList dedupes and merges adult/custom lists", () => {
    const list = utils.buildBlockedList(
      ["example.com", "Example.com", "https://test.com/path"],
      true,
      ["custom.com", "ADULT.com"],
      ["adult.com"]
    );
    expect(list).toEqual(["example.com", "https://test.com/path", "adult.com", "custom.com"]);
  });

  test("resolveGoalValue prefers site goal over default", () => {
    expect(utils.resolveGoalValue({ "site.com": 2 }, 5, "site.com")).toBe(2);
  });

  test("resolveGoalValue uses default when site goal is invalid", () => {
    expect(utils.resolveGoalValue({ "site.com": -1 }, 5, "site.com")).toBe(5);
  });

  test("resolveGoalValue returns null when no goal is valid", () => {
    expect(utils.resolveGoalValue({}, 0, "site.com")).toBeNull();
  });

  test("formatCountdown renders mm:ss", () => {
    expect(utils.formatCountdown(65000)).toBe("1:05");
  });

  test("formatCountdown renders hh:mm:ss", () => {
    expect(utils.formatCountdown(3661000)).toBe("1:01:01");
  });

  test("normalizeDailyStats defaults when date mismatches", () => {
    const today = "2024-05-03";
    const input = { date: "2024-05-02", visits: { a: 1 } };
    expect(utils.normalizeDailyStats(input, today)).toEqual({
      date: today,
      visits: {},
      bails: {},
      opens: {}
    });
  });

  test("normalizeDailyStats uses stored values when date matches", () => {
    const today = "2024-05-03";
    expect(utils.normalizeDailyStats({ date: today, visits: { a: 1 } }, today)).toEqual({
      date: today,
      visits: { a: 1 },
      bails: {},
      opens: {}
    });
  });

  test("calculateGoalStreak counts consecutive days meeting goal", () => {
    const today = "2024-05-03";
    const historyMap = {
      "site.com": {
        "2024-05-01": 2,
        "2024-05-02": 1,
        "2024-05-03": 1
      }
    };
    const openHistory = {
      "site.com": {
        "2024-05-01": 3,
        "2024-05-02": 2,
        "2024-05-03": 2
      }
    };
    expect(utils.calculateGoalStreak(historyMap, openHistory, "site.com", today, 2)).toBe(2);
  });

  test("capRecordMap limits the number of entries", () => {
    const input = {
      "2024-05-01": 1,
      "2024-05-02": 2,
      "2024-05-03": 3,
      "2024-05-04": 4
    };
    const capped = utils.capRecordMap(input, 2);
    expect(Object.keys(capped).length).toBe(2);
    expect(capped).toHaveProperty("2024-05-04");
    expect(capped).toHaveProperty("2024-05-03");
  });

  test("capHistoryMap limits entries for each site", () => {
    const input = {
      "site1.com": { "2024-05-01": 1, "2024-05-02": 2, "2024-05-03": 3 },
      "site2.com": { "2024-05-01": 1 }
    };
    const capped = utils.capHistoryMap(input, 2);
    expect(Object.keys(capped["site1.com"]).length).toBe(2);
    expect(Object.keys(capped["site2.com"]).length).toBe(1);
    expect(capped["site1.com"]).toHaveProperty("2024-05-03");
    expect(capped["site1.com"]).toHaveProperty("2024-05-02");
  });
});


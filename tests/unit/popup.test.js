test("getActiveTab returns active tab ID", async () => {
  const fakeTab = { id: 3, active: true, currentWindow: true };
  global.chrome.tabs.query = jest.fn().mockResolvedValue([fakeTab]);
  const getActiveTabId = async () => {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return tabs?.[0]?.id || null;
  };
  expect(await getActiveTabId()).toBe(3);
});


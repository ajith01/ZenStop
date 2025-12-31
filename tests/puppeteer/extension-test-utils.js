const EXTENSION_PAGE_PATH = "src/options/options.html";

async function getExtensionInfo(activeBrowser) {
  const workerTarget = await activeBrowser.waitForTarget(
    (target) => target.type() === "service_worker" && target.url().includes("background.js")
  );
  const worker = await workerTarget.worker();
  const extensionId = new URL(worker.url()).host;
  return { extensionId };
}

async function withExtensionPage(activeBrowser, extensionId, handler) {
  const page = await activeBrowser.newPage();
  await page.goto(`chrome-extension://${extensionId}/${EXTENSION_PAGE_PATH}`, {
    waitUntil: "domcontentloaded"
  });
  await page.waitForFunction(() => Boolean(chrome?.storage?.sync));
  try {
    return await handler(page);
  } finally {
    await page.close();
  }
}

async function setStorage(page, payload) {
  await page.evaluate(
    (data) =>
      new Promise((resolve) => {
        chrome.storage.sync.set(data, resolve);
      }),
    payload
  );
}

async function getStorage(page, keys) {
  return page.evaluate(
    (keyList) =>
      new Promise((resolve) => {
        chrome.storage.sync.get(keyList, resolve);
      }),
    keys
  );
}

async function waitForStorage(page, expected, timeoutMs = 5000) {
  const keys = Object.keys(expected);
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const values = await getStorage(page, keys);
    const matches = keys.every(
      (key) => stableStringify(values[key]) === stableStringify(expected[key])
    );
    if (matches) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Timed out waiting for storage seed");
}

function stableStringify(value) {
  if (typeof value === "undefined") return "undefined";
  return JSON.stringify(sortValue(value));
}

function sortValue(value) {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = sortValue(value[key]);
        return acc;
      }, {});
  }
  return value;
}

async function seedStorage(activeBrowser, extensionId, payload, timeoutMs) {
  await withExtensionPage(activeBrowser, extensionId, async (page) => {
    await setStorage(page, payload);
    await waitForStorage(page, payload, timeoutMs);
  });
}

async function readStorage(activeBrowser, extensionId, keys) {
  return withExtensionPage(activeBrowser, extensionId, (page) => getStorage(page, keys));
}

module.exports = {
  getExtensionInfo,
  seedStorage,
  readStorage
};


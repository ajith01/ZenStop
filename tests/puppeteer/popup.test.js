const path = require("path");
const puppeteer = require("puppeteer");

const EXTENSION_PATH = path.resolve(__dirname, "..", "..");
const EXAMPLE_URL = "https://example.com";

let browser;

beforeEach(async () => {
  browser = await puppeteer.launch({
    headless: "new",
    args: [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`]
  });
});

afterEach(async () => {
  if (browser) {
    await browser.close();
  }
  browser = undefined;
});

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
  await page.goto(`chrome-extension://${extensionId}/src/options/options.html`, {
    waitUntil: "domcontentloaded"
  });
  await page.waitForFunction(() => Boolean(chrome?.storage?.sync));
  const result = await handler(page);
  await page.close();
  return result;
}

async function seedStorage(activeBrowser, extensionId, payload) {
  await withExtensionPage(activeBrowser, extensionId, (page) =>
    page.evaluate((data) => chrome.storage.sync.set(data), payload)
  );
  await waitForStorage(activeBrowser, extensionId, payload);
}

async function waitForStorage(activeBrowser, extensionId, expected, timeoutMs = 5000) {
  const keys = Object.keys(expected);
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const values = await readStorage(activeBrowser, extensionId, keys);
    const matches = keys.every((key) => JSON.stringify(values[key]) === JSON.stringify(expected[key]));
    if (matches) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Timed out waiting for storage seed");
}

async function readStorage(activeBrowser, extensionId, keys) {
  return withExtensionPage(activeBrowser, extensionId, (page) =>
    page.evaluate((k) => chrome.storage.sync.get(k), keys)
  );
}

async function openExamplePage(activeBrowser) {
  const page = await activeBrowser.newPage();
  await page.setRequestInterception(true);
  page.on("request", (request) => {
    if (request.url().startsWith(EXAMPLE_URL)) {
      request.respond({ status: 200, contentType: "text/html", body: "ok" });
      return;
    }
    request.continue();
  });
  await page.goto(EXAMPLE_URL, { waitUntil: "domcontentloaded" });
  return page;
}

async function getTabIdForUrl(activeBrowser, extensionId, url) {
  const pattern = `${url.replace(/\/$/, "")}/*`;
  return withExtensionPage(activeBrowser, extensionId, (page) =>
    page.evaluate(async (patternValue) => {
      const tabs = await chrome.tabs.query({ url: patternValue });
      return tabs[0]?.id || null;
    }, pattern)
  );
}

async function openPopup(activeBrowser, extensionId, tabId) {
  const popupUrl = tabId
    ? `chrome-extension://${extensionId}/src/popup/popup.html?tab=${tabId}`
    : `chrome-extension://${extensionId}/src/popup/popup.html`;
  const popup = await activeBrowser.newPage();
  await popup.goto(popupUrl, { waitUntil: "domcontentloaded" });
  return popup;
}

test("popup summary shows no blocked sites when disabled", async () => {
  const { extensionId } = await getExtensionInfo(browser);
  await seedStorage(browser, extensionId, { blockedSites: [], blockAdultSites: false, waitSeconds: 7 });

  const page = await openExamplePage(browser);
  const tabId = await getTabIdForUrl(browser, extensionId, EXAMPLE_URL);
  const popup = await openPopup(browser, extensionId, tabId);

  await popup.waitForFunction(
    () => document.getElementById("summary")?.textContent.trim() === "No blocked sites yet."
  );
  const summary = await popup.$eval("#summary", (el) => el.textContent.trim());
  expect(summary).toBe("No blocked sites yet.");

  await popup.close();
  await page.close();
});

test("quick block adds site to blocked list", async () => {
  const { extensionId } = await getExtensionInfo(browser);
  await seedStorage(browser, extensionId, { blockedSites: [], customAdultSites: [], blockAdultSites: true });

  const page = await openExamplePage(browser);
  const tabId = await getTabIdForUrl(browser, extensionId, EXAMPLE_URL);
  const popup = await openPopup(browser, extensionId, tabId);

  await popup.waitForFunction(() => {
    const site = document.getElementById("currentSite");
    const btn = document.getElementById("blockSite");
    return site && btn && !btn.disabled && !site.textContent.includes("Unavailable");
  });
  await popup.click("#blockSite");
  await popup.waitForFunction(() => !document.getElementById("blockChooser").classList.contains("hidden"));
  await popup.click("#blockAsUnproductive");
  await popup.waitForFunction(() => document.getElementById("blockSite").textContent.includes("Edit"));

  const result = await readStorage(browser, extensionId, ["blockedSites"]);
  expect(result.blockedSites).toContain("example.com");

  await popup.close();
  await page.close();
});

test("quick block adds site to adult list", async () => {
  const { extensionId } = await getExtensionInfo(browser);
  await seedStorage(browser, extensionId, { blockedSites: [], customAdultSites: [], blockAdultSites: true });

  const page = await openExamplePage(browser);
  const tabId = await getTabIdForUrl(browser, extensionId, EXAMPLE_URL);
  const popup = await openPopup(browser, extensionId, tabId);

  await popup.waitForFunction(() => {
    const site = document.getElementById("currentSite");
    const btn = document.getElementById("blockSite");
    return site && btn && !btn.disabled && !site.textContent.includes("Unavailable");
  });
  await popup.click("#blockSite");
  await popup.waitForFunction(() => !document.getElementById("blockChooser").classList.contains("hidden"));
  await popup.click("#blockAsAdult");
  await popup.waitForFunction(() => document.getElementById("blockSite").textContent.includes("Edit"));

  const result = await readStorage(browser, extensionId, ["customAdultSites", "blockAdultSites"]);
  expect(result.customAdultSites).toContain("example.com");
  expect(result.blockAdultSites).toBe(true);

  await popup.close();
  await page.close();
});


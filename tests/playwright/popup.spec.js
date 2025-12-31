const path = require("path");
const { test, expect, chromium } = require("@playwright/test");

const EXTENSION_PATH = path.resolve(__dirname, "..", "..");
const EXAMPLE_URL = "https://example.com";

let context;
let worker;
let extensionId;

test.beforeEach(async ({}, testInfo) => {
  const userDataDir = testInfo.outputPath("user-data");
  context = await chromium.launchPersistentContext(userDataDir, {
    headless: true,
    args: [
      "--headless=new",
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`
    ]
  });

  worker = context.serviceWorkers()[0] || await context.waitForEvent("serviceworker");
  extensionId = new URL(worker.url()).host;
});

test.afterEach(async () => {
  if (context) {
    await context.close();
  }
  context = undefined;
  worker = undefined;
  extensionId = undefined;
});

async function openExamplePage(activeContext) {
  const page = await activeContext.newPage();
  await page.route("**/*", (route) => route.fulfill({ status: 200, body: "ok" }));
  await page.goto(EXAMPLE_URL, { waitUntil: "domcontentloaded" });
  return page;
}

async function getExampleTabId(activeWorker) {
  return activeWorker.evaluate(async () => {
    const tabs = await chrome.tabs.query({ url: "*://example.com/*" });
    return tabs[0]?.id || null;
  });
}

async function openPopup(activeContext, id, tabId) {
  const popup = await activeContext.newPage();
  await popup.goto(`chrome-extension://${id}/src/popup/popup.html?tab=${tabId}`);
  return popup;
}

test("popup shows summary and current site", async () => {
  await openExamplePage(context);

  const tabId = await getExampleTabId(worker);
  expect(tabId).toBeTruthy();

  const popup = await openPopup(context, extensionId, tabId);

  await expect(popup.locator("#summary")).not.toHaveText("");
  await expect(popup.locator("#currentSite")).toHaveText(/example\.com|Unavailable/i);
});


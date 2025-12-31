const path = require("path");
const puppeteer = require("puppeteer");

const EXTENSION_PATH = path.resolve(__dirname, "..", "..");

let browser;

beforeEach(async () => {
  browser = await puppeteer.launch({
    headless: "new",
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`
    ]
  });
});

afterEach(async () => {
  if (browser) {
    await browser.close();
  }
  browser = undefined;
});

test("service worker responds after termination", async () => {
  const workerTarget = await browser.waitForTarget(
    (target) => target.type() === "service_worker" && target.url().includes("background.js")
  );
  const worker = await workerTarget.worker();
  const extensionId = new URL(worker.url()).host;

  const page = await browser.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/options/options.html`, { waitUntil: "domcontentloaded" });

  const firstResponse = await sendPing(page);
  expect(firstResponse.error).toBeNull();
  expect(firstResponse.response).toMatchObject({ ok: true });

  await stopServiceWorker(browser, extensionId);

  const secondResponse = await sendPing(page);
  expect(secondResponse.error).toBeNull();
  expect(secondResponse.response).toMatchObject({ ok: true });
});

async function sendPing(page) {
  return page.evaluate(() => {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: "zenstop_test_ping" }, (response) => {
        const error = chrome.runtime.lastError ? chrome.runtime.lastError.message : null;
        resolve({ response, error });
      });
    });
  });
}

async function stopServiceWorker(browser, extensionId) {
  const host = `chrome-extension://${extensionId}`;
  const target = await browser.waitForTarget((t) => t.type() === "service_worker" && t.url().startsWith(host));
  const worker = await target.worker();
  await worker.close();
}


const path = require("path");
const puppeteer = require("puppeteer");
const { getExtensionInfo, seedStorage, readStorage } = require("./extension-test-utils");

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

test("overlay continue flow shows grace indicator", async () => {
  const { extensionId } = await getExtensionInfo(browser);
  await seedStorage(browser, extensionId, {
    blockedSites: ["example.com"],
    blockAdultSites: false,
    waitSeconds: 3,
    allowedMinutes: 1
  });

  const page = await openExamplePage(browser);
  await page.waitForSelector("#zenstop-overlay", { timeout: 10000 });

  await page.type("#zenstop-reason", "Focus check");
  await page.click('input[name="zenstop-tag"]');

  await page.waitForFunction(() => {
    const btn = document.getElementById("zenstop-dismiss");
    return btn && !btn.disabled;
  });

  await page.$eval("#zenstop-dismiss", (el) => el.click());
  await page.waitForSelector("#zenstop-overlay", { hidden: true });
  await page.waitForSelector("#zenstop-grace-indicator");

  const indicatorText = await page.$eval("#zenstop-grace-indicator", (el) => el.textContent.trim());
  expect(indicatorText).toMatch(/Pause returns in/i);

  await page.close();
});

test("overlay redirect flow increments success history", async () => {
  const { extensionId } = await getExtensionInfo(browser);
  await seedStorage(browser, extensionId, {
    blockedSites: ["example.com"],
    blockAdultSites: false,
    waitSeconds: 3,
    redirectUrl: "https://example.com/redirect",
    allowedMinutes: 1
  });

  const page = await openExamplePage(browser);
  await page.waitForSelector("#zenstop-overlay", { timeout: 10000 });

  await page.type("#zenstop-reason", "Refocus later");
  await page.click('input[name="zenstop-tag"]');

  await page.$eval("#zenstop-redirect", (el) => el.click());
  await page.waitForFunction(() => location.href.includes("/redirect"));

  const stats = await readStorage(browser, extensionId, ["successHistory"]);
  const successHistory = stats.successHistory || {};
  const totalSuccesses = Object.values(successHistory).reduce((sum, value) => sum + Number(value || 0), 0);
  expect(totalSuccesses).toBeGreaterThan(0);

  await page.close();
});


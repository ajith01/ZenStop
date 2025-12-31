const path = require("path");
const puppeteer = require("puppeteer");
const { getExtensionInfo, seedStorage } = require("./extension-test-utils");

const EXTENSION_PATH = path.resolve(__dirname, "..", "..");

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

async function openOptions(activeBrowser, extensionId) {
  const page = await activeBrowser.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/options/options.html`, {
    waitUntil: "domcontentloaded"
  });
  return page;
}

test("history tab range toggle and site filter", async () => {
  const { extensionId } = await getExtensionInfo(browser);
  await seedStorage(browser, extensionId, {
    blockedSites: ["example.com"],
    history: { "example.com": { "2025-01-01": 2, "2025-01-02": 1 } },
    visitHistory: { "2025-01-01": 2, "2025-01-02": 1 }
  });

  const options = await openOptions(browser, extensionId);
  await options.click('[data-tab-target="history"]');
  await options.waitForSelector("#historySite");

  await options.click('[data-history-range="30"]');
  const rangeActive = await options.$eval('[data-history-range="30"]', (el) =>
    el.classList.contains("active")
  );
  expect(rangeActive).toBe(true);

  const siteOptions = await options.$$eval("#historySite option", (opts) =>
    opts.map((opt) => opt.value)
  );
  expect(siteOptions).toContain("example.com");

  await options.select("#historySite", "example.com");
  const selectedSite = await options.$eval("#historySite", (el) => el.value);
  expect(selectedSite).toBe("example.com");

  await options.close();
});


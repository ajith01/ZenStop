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

test("intentions tab adds tag and filters reasons", async () => {
  const { extensionId } = await getExtensionInfo(browser);
  await seedStorage(browser, extensionId, {
    usageReasons: [
      {
        siteKey: "example.com",
        siteLabel: "example.com",
        reason: "Study",
        tag: "Study",
        outcome: "continue",
        timestamp: Date.now()
      }
    ]
  });

  const options = await openOptions(browser, extensionId);
  await options.click('[data-tab-target="intentions"]');
  await options.waitForSelector("#customTagInput");

  await options.type("#customTagInput", "Focus");
  await options.click("#addTagBtn");
  await options.waitForSelector(".tag-pill");

  const tags = await options.$$eval(".tag-pill", (chips) => chips.map((chip) => chip.textContent));
  const hasFocus = tags.some((tag) => tag.includes("Focus"));
  expect(hasFocus).toBe(true);

  await options.select("#reasonFilter", "study");
  const visibleReasons = await options.$$eval("#reasonList .reason-item", (items) => items.length);
  expect(visibleReasons).toBeGreaterThan(0);

  await options.close();
});


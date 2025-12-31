const path = require("path");
const puppeteer = require("puppeteer");
const { getExtensionInfo, seedStorage, readStorage } = require("./extension-test-utils");

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

test("options save blocklist and adult list", async () => {
  const { extensionId } = await getExtensionInfo(browser);
  await seedStorage(browser, extensionId, {
    blockedSites: [],
    customAdultSites: [],
    blockAdultSites: true
  });

  const options = await openOptions(browser, extensionId);
  await options.waitForSelector("#blocked");
  await options.click('[data-tab-target="rules"]');
  await options.waitForFunction(() => document.getElementById("blockAdultSites")?.checked === true);

  await options.evaluate(() => {
    const blocked = document.getElementById("blocked");
    const custom = document.getElementById("customAdultSites");
    const wrapper = document.getElementById("customAdultWrapper");
    const checkbox = document.getElementById("blockAdultSites");
    if (wrapper) wrapper.open = true;
    if (checkbox) checkbox.checked = true;
    if (blocked) blocked.value = "example.com";
    if (custom) custom.value = "adult-example.com";
  });

  await options.click("#save");
  await options.waitForFunction(() => document.getElementById("status").textContent.includes("Saved"));

  const stored = await readStorage(browser, extensionId, ["blockedSites", "customAdultSites"]);
  expect(stored.blockedSites).toContain("example.com");
  expect(stored.customAdultSites).toContain("adult-example.com");

  await options.close();
});


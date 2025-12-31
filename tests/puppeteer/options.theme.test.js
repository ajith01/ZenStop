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

test("theme toggle updates dataset and persists", async () => {
  const { extensionId } = await getExtensionInfo(browser);
  await seedStorage(browser, extensionId, { themeMode: "auto" });

  const options = await openOptions(browser, extensionId);
  await options.waitForSelector("#themeMode");

  await options.select("#themeMode", "dark");
  const datasetTheme = await options.evaluate(() => document.documentElement.dataset.theme);
  expect(datasetTheme).toBe("dark");

  await options.click("#save");
  await options.waitForFunction(() => document.getElementById("status").textContent.includes("Saved"));

  const stored = await readStorage(browser, extensionId, ["themeMode"]);
  expect(stored.themeMode).toBe("dark");

  await options.close();
});


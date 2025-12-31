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

async function openOptions(activeBrowser, extensionId) {
  const page = await activeBrowser.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/options/options.html`, {
    waitUntil: "domcontentloaded"
  });
  return page;
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

test("options saves goals and overlay shows goal streak", async () => {
  const { extensionId } = await getExtensionInfo(browser);
  await seedStorage(browser, extensionId, {
    blockedSites: ["example.com"],
    blockAdultSites: false,
    waitSeconds: 1,
    visitGoalDefault: 2,
    visitGoals: { "example.com": 1 }
  });

  const options = await openOptions(browser, extensionId);
  await options.click('[data-tab-target="goals"]');
  await options.waitForSelector("#visitGoalDefault");

  await options.evaluate(() => {
    const defaultInput = document.getElementById("visitGoalDefault");
    const goalsInput = document.getElementById("visitGoals");
    if (defaultInput) defaultInput.value = "2";
    if (goalsInput) goalsInput.value = "example.com: 1";
  });
  await options.click("#save");
  await options.waitForFunction(() => document.getElementById("status").textContent.includes("Saved"));

  const stored = await readStorage(browser, extensionId, ["visitGoals", "visitGoalDefault"]);
  expect(stored.visitGoalDefault).toBe(2);
  expect(stored.visitGoals["example.com"]).toBe(1);

  const page = await openExamplePage(browser);
  await page.waitForSelector("#zenstop-streak-count");
  const streakText = await page.$eval("#zenstop-streak-count", (el) => el.textContent.trim());
  expect(streakText.length).toBeGreaterThan(0);

  await options.close();
  await page.close();
});


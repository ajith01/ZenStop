const path = require("path");
const fs = require("fs/promises");
const { chromium } = require("@playwright/test");

const EXTENSION_PATH = path.resolve(__dirname, "..");
const EXTENSION_MANIFEST = require(path.join(EXTENSION_PATH, "manifest.json"));
const OUTPUT_ROOT = path.resolve(__dirname, "screens");
const USER_DATA_ROOT = path.resolve(__dirname, "screens", ".screenshots-profile");
const VIEWPORT = { width: 1280, height: 800 };
const IMAGE_TYPE = "png";
const MAX_SHOTS = 5;
const SERVICE_WORKER_TIMEOUT_MS = 60000;
const EXAMPLE_URL = "https://example.com";
const HEADLESS = process.env.ZENSTOP_HEADLESS === "true";
const OVERLAY_SCALE = 0.9;

const OPTION_TABS = ["rules", "goals", "history", "intentions"];

const SHOT_PLAN = [
  { theme: "light", type: "options", tab: "rules" },
  { theme: "light", type: "options", tab: "goals" },
  { theme: "dark", type: "options", tab: "history", historyRange: 30 },
  { theme: "dark", type: "options", tab: "intentions" },
  { theme: "dark", type: "overlay" }
].slice(0, MAX_SHOTS);

const formatDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const buildHistorySeed = () => {
  const today = new Date();
  const visitHistory = {};
  const successHistory = {};
  const history = { "example.com": {}, "youtube.com": {} };
  for (let i = 6; i >= 0; i -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const key = formatDateKey(date);
    visitHistory[key] = i + 1;
    successHistory[key] = Math.max(0, i - 2);
    history["example.com"][key] = i + 1;
    history["youtube.com"][key] = Math.max(0, i - 1);
  }
  return { visitHistory, successHistory, history };
};

const buildSeedData = (theme) => {
  const todayKey = formatDateKey(new Date());
  const { visitHistory, successHistory, history } = buildHistorySeed();
  return {
    blockedSites: ["example.com", "twitter.com"],
    customAdultSites: ["adult-example.com"],
    blockAdultSites: true,
    waitSeconds: 10,
    allowedMinutes: 15,
    redirectUrl: "https://www.google.com",
    visitGoals: { "example.com": 2, "youtube.com": 1 },
    visitGoalDefault: 5,
    themeMode: theme,
    intentTags: ["Study", "Focus"],
    usageReasons: [
      {
        siteKey: "example.com",
        siteLabel: "example.com",
        reason: "Finish the tutorial notes",
        tag: "Productive",
        outcome: "continue",
        url: "https://example.com/docs",
        timestamp: Date.now() - 1000 * 60 * 60
      },
      {
        siteKey: "youtube.com",
        siteLabel: "youtube.com",
        reason: "Reference a short clip",
        tag: "Research",
        outcome: "continue",
        url: "https://youtube.com/watch?v=dQw4w9WgXcQ",
        timestamp: Date.now() - 1000 * 60 * 30
      }
    ],
    visitHistory,
    successHistory,
    history,
    dailyStats: {
      date: todayKey,
      visits: { "example.com": 3, "youtube.com": 2 },
      bails: { "example.com": 1 },
      opens: { "example.com": 1 }
    }
  };
};

const disableAnimations = async (page) => {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation: none !important;
        transition: none !important;
        caret-color: transparent !important;
      }
    `
  });
  await page.evaluate(() => document.fonts?.ready);
};

const applyOverlayScale = async (page, scale) => {
  if (!scale || scale === 1) return;
  await page.addStyleTag({
    content: `
      #zenstop-overlay .zenstop-panel {
        transform: scale(${scale});
        transform-origin: center;
      }
    `
  });
};

const attachPageErrorLogging = (page, label) => {
  page.on("pageerror", (error) => {
    console.error(`[${label}] page error: ${error.message}`);
  });
  page.on("console", (message) => {
    if (message.type() === "error") {
      console.error(`[${label}] console error: ${message.text()}`);
    }
  });
};

const waitForOptionsReady = async (page) => {
  await page.waitForFunction(() => Boolean(window.ZenStopOptions?.history?.updateChart), {
    timeout: 60000
  });
};

const activateOptionsTab = async (page, tabName) => {
  await page.evaluate((target) => {
    const buttons = Array.from(document.querySelectorAll("[data-tab-target]"));
    const panels = Array.from(document.querySelectorAll("[data-tab-panel]"));
    buttons.forEach((btn) => {
      const isActive = btn.dataset.tabTarget === target;
      btn.classList.toggle("active", isActive);
      btn.setAttribute("aria-selected", String(isActive));
      btn.setAttribute("tabindex", isActive ? "0" : "-1");
    });
    panels.forEach((panel) => {
      const isActive = panel.dataset.tabPanel === target;
      panel.classList.toggle("active", isActive);
      panel.setAttribute("aria-hidden", String(!isActive));
    });
  }, tabName);
};

const setHistoryRange = async (page, rangeDays) => {
  await page.evaluate((range) => {
    const options = window.ZenStopOptions;
    if (options?.state && options?.history) {
      options.state.currentRange = range;
      options.history.setActiveRangeButton(range);
      options.history.updateChart();
      return;
    }
    document.querySelectorAll("[data-history-range]").forEach((button) => {
      const value = Number(button.dataset.historyRange);
      button.classList.toggle("active", value === range);
    });
  }, rangeDays);
};

const readExtensionIdFromUi = async (context) => {
  const page = await context.newPage();
  try {
    await page.goto("chrome://extensions/", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => {
      const manager = document.querySelector("extensions-manager");
      const managerShadow = manager?.shadowRoot;
      const listHost = managerShadow?.querySelector("extensions-item-list");
      const listShadow = listHost?.shadowRoot;
      const items = listShadow?.querySelectorAll("extensions-item");
      return Boolean(items && items.length);
    });
    const extensionId = await page.evaluate((extensionName) => {
      const manager = document.querySelector("extensions-manager");
      const managerShadow = manager?.shadowRoot;
      const listHost = managerShadow?.querySelector("extensions-item-list");
      const listShadow = listHost?.shadowRoot;
      const roots = [managerShadow, listShadow].filter(Boolean);
      const items = [];
      roots.forEach((root) => {
        root.querySelectorAll("extensions-item").forEach((item) => items.push(item));
      });
      for (const item of items) {
        const itemShadow = item.shadowRoot;
        const name =
          itemShadow?.querySelector("#name")?.textContent?.trim() ||
          itemShadow?.querySelector(".name")?.textContent?.trim();
        if (!name) continue;
        if (name.toLowerCase() !== extensionName.toLowerCase()) continue;
        return (
          item.getAttribute("id") ||
          item.id ||
          itemShadow?.querySelector("#extension-id")?.textContent?.trim() ||
          null
        );
      }
      return null;
    }, EXTENSION_MANIFEST.name);
    return extensionId;
  } catch {
    return null;
  } finally {
    await page.close();
  }
};

const normalizePath = (value) => {
  if (!value || typeof value !== "string") return "";
  const normalized = path.normalize(value).replace(/\\/g, "/").toLowerCase();
  return normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
};

const readExtensionIdFromProfile = async (userDataDir, timeoutMs) => {
  const preferencePaths = [
    path.join(userDataDir, "Preferences"),
    path.join(userDataDir, "Default", "Preferences")
  ];
  const start = Date.now();
  const targetPath = normalizePath(EXTENSION_PATH);
  while (Date.now() - start < timeoutMs) {
    for (const preferencesPath of preferencePaths) {
      try {
        const raw = await fs.readFile(preferencesPath, "utf8");
        const prefs = JSON.parse(raw);
        const settings = prefs?.extensions?.settings;
        if (settings && typeof settings === "object") {
          for (const [id, entry] of Object.entries(settings)) {
            const entryPath = normalizePath(entry?.path);
            if (!entryPath) continue;
            if (entryPath === targetPath || entryPath.startsWith(`${targetPath}/`)) {
              return id;
            }
          }
        }
      } catch {
        // Ignore parse/read errors while Chrome is writing Preferences.
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return null;
};

const readExtensionIdFromInstall = async (userDataDir) => {
  const extensionDirs = [
    path.join(userDataDir, "Default", "Extensions"),
    path.join(userDataDir, "Extensions")
  ];
  for (const extensionsRoot of extensionDirs) {
    try {
      const entries = await fs.readdir(extensionsRoot, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const id = entry.name;
        const versionsRoot = path.join(extensionsRoot, id);
        let versions = [];
        try {
          versions = await fs.readdir(versionsRoot, { withFileTypes: true });
        } catch {
          continue;
        }
        for (const versionEntry of versions) {
          if (!versionEntry.isDirectory()) continue;
          const manifestPath = path.join(versionsRoot, versionEntry.name, "manifest.json");
          try {
            const raw = await fs.readFile(manifestPath, "utf8");
            const manifest = JSON.parse(raw);
            if (manifest?.name === EXTENSION_MANIFEST.name) {
              return id;
            }
          } catch {
            // ignore malformed manifest entries
          }
        }
      }
    } catch {
      // ignore missing directories
    }
  }
  return null;
};

const getExtensionId = async (context, userDataDir) => {
  const existingWorker = context.serviceWorkers()[0];
  if (existingWorker) {
    return new URL(existingWorker.url()).host;
  }
  const fromUi = await readExtensionIdFromUi(context);
  if (fromUi) return fromUi;
  const fromProfile = await readExtensionIdFromProfile(userDataDir, 5000);
  if (fromProfile) return fromProfile;
  try {
    const worker = await context.waitForEvent("serviceworker", {
      timeout: SERVICE_WORKER_TIMEOUT_MS
    });
    return new URL(worker.url()).host;
  } catch (err) {
    const extensionId = await readExtensionIdFromInstall(userDataDir);
    if (extensionId) return extensionId;
    throw err;
  }
};

const seedStorage = async (context, extensionId, payload) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/options/options.html`, {
    waitUntil: "domcontentloaded"
  });
  await page.waitForFunction(() => Boolean(chrome?.storage?.sync));
  await page.evaluate(
    (data) =>
      new Promise((resolve) => {
        chrome.storage.sync.set(data, resolve);
      }),
    payload
  );
  await page.close();
};

const openExamplePage = async (context) => {
  const page = await context.newPage();
  await page.route("**/*", (route) => {
    const url = route.request().url();
    if (url.startsWith("http://") || url.startsWith("https://")) {
      route.fulfill({ status: 200, body: "ok" });
      return;
    }
    route.continue();
  });
  await page.goto(EXAMPLE_URL, { waitUntil: "domcontentloaded" });
  return page;
};

const waitForOverlay = async (page, timeoutMs) => {
  try {
    await page.waitForSelector("#zenstop-overlay", { timeout: timeoutMs });
    return true;
  } catch {
    return false;
  }
};

const getExampleTabId = async (context) => {
  const worker = context.serviceWorkers()[0] || await context.waitForEvent("serviceworker");
  return worker.evaluate(async () => {
    const tabs = await chrome.tabs.query({ url: "*://example.com/*" });
    return tabs[0]?.id || null;
  });
};

const captureOptionsTabs = async (context, extensionId, outputDir, tabName, historyRange) => {
  const page = await context.newPage();
  attachPageErrorLogging(page, `options:${tabName || "rules"}`);
  await page.goto(`chrome-extension://${extensionId}/src/options/options.html`, {
    waitUntil: "domcontentloaded"
  });
  await disableAnimations(page);
  await page.waitForSelector('[data-tab-target="rules"]', { timeout: 45000 });
  await waitForOptionsReady(page);

  const tab = tabName || OPTION_TABS[0];
  await activateOptionsTab(page, tab);
  if (tab === "history" && historyRange) {
    await setHistoryRange(page, historyRange);
  }
  if (tab === "history") {
    await page.evaluate(() => window.ZenStopOptions?.history?.updateChart?.());
  }
  await page.waitForTimeout(150);
  const suffix = tab === "history" && historyRange === 30 ? "-month" : "";
  await page.screenshot({
    path: path.join(outputDir, `options-${tab}${suffix}.${IMAGE_TYPE}`),
    fullPage: false,
    type: IMAGE_TYPE
  });
  await page.close();
};

const capturePopup = async (context, extensionId, outputDir) => {
  await openExamplePage(context);
  const tabId = await getExampleTabId(context);
  if (!tabId) return;
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/src/popup/popup.html?tab=${tabId}`, {
    waitUntil: "domcontentloaded"
  });
  await disableAnimations(popup);
  await popup.waitForSelector("#summary");
  await popup.screenshot({
    path: path.join(outputDir, `popup.${IMAGE_TYPE}`),
    fullPage: false,
    type: IMAGE_TYPE
  });
  await popup.close();
};

const captureOverlay = async (context, outputDir) => {
  const page = await openExamplePage(context);
  await disableAnimations(page);
  const firstPass = await waitForOverlay(page, 20000);
  if (!firstPass) {
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForOverlay(page, 30000);
  }
  await applyOverlayScale(page, OVERLAY_SCALE);
  await page.waitForTimeout(500);
  await page.screenshot({
    path: path.join(outputDir, `overlay.${IMAGE_TYPE}`),
    fullPage: false,
    type: IMAGE_TYPE
  });
  await page.close();
};

const runTheme = async (theme, tasks) => {
  const outputDir = path.join(OUTPUT_ROOT, theme);
  const userDataDir = path.join(USER_DATA_ROOT, theme);
  await fs.mkdir(outputDir, { recursive: true });
  await fs.mkdir(userDataDir, { recursive: true });

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: HEADLESS,
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    ignoreDefaultArgs: ["--disable-extensions"],
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`
    ].filter(Boolean)
  });

  const extensionId = await getExtensionId(context, userDataDir);
  await seedStorage(context, extensionId, buildSeedData(theme));

  for (const task of tasks) {
    if (task.type === "options") {
      await captureOptionsTabs(context, extensionId, outputDir, task.tab, task.historyRange);
    } else if (task.type === "popup") {
      await capturePopup(context, extensionId, outputDir);
    } else if (task.type === "overlay") {
      await captureOverlay(context, outputDir);
    }
  }

  await context.close();
};

const main = async () => {
  await fs.mkdir(OUTPUT_ROOT, { recursive: true });
  await fs.mkdir(USER_DATA_ROOT, { recursive: true });
  const themes = [...new Set(SHOT_PLAN.map((shot) => shot.theme))];
  for (const theme of themes) {
    const tasks = SHOT_PLAN.filter((shot) => shot.theme === theme);
    await runTheme(theme, tasks);
  }
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

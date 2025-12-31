const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests/playwright",
  timeout: 60000,
  fullyParallel: true,
  reporter: "list"
});

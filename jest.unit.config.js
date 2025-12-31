module.exports = {
  testMatch: ["<rootDir>/tests/unit/**/*.test.js"],
  testTimeout: 10000,
  testEnvironment: "node",
  setupFiles: ["<rootDir>/tests/unit/mock-extension-apis.js"]
};

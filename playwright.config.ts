import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  testMatch: "acceptance.spec.ts",
  use: {
    baseURL: "http://localhost:3000",
    viewport: { width: 1536, height: 960 },
    headless: true,
  },
  workers: 1,
  reporter: "list",
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120000,
  },
});

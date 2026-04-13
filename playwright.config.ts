import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 120000,
  retries: 1,
  fullyParallel: true,
  use: {
    baseURL: "http://localhost:5177",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          args: ["--use-gl=angle", "--use-angle=swiftshader"],
        },
      },
    },
    {
      name: "firefox",
      use: {
        ...devices["Desktop Firefox"],
        launchOptions: {
          firefoxUserPrefs: {
            "webgl.force-enabled": true,
            "webgl.disable-fail-if-major-performance-caveat": true,
          },
        },
      },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
    {
      name: "mobile-chrome",
      testMatch: /mobile\.test\.ts$/,
      use: {
        ...devices["Pixel 7"],
        launchOptions: {
          args: ["--use-gl=angle", "--use-angle=swiftshader"],
        },
      },
    },
    {
      name: "mobile-safari",
      testMatch: /mobile\.test\.ts$/,
      use: { ...devices["iPhone 14"] },
    },
  ],
  webServer: {
    command: "npx http-server -p 5177 -c-1 --silent",
    port: 5177,
    reuseExistingServer: !process.env.CI,
    timeout: 10000,
  },
});

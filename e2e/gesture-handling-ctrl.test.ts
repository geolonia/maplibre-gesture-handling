import { expect, test } from "@playwright/test";

const PAGE = "/e2e/gesture-handling-ctrl.html";

async function initMap(page: import("@playwright/test").Page) {
  await page.goto(PAGE, { waitUntil: "load" });
  await page.waitForFunction(() => (window as any).__e2e != null, {
    timeout: 30_000,
  });
}

test.describe("GestureHandling E2E — ctrl modifier", () => {
  test("control initializes successfully", async ({ page }) => {
    await initMap(page);

    const result = await page.evaluate(() => ({
      ok: (window as any).__e2e?.ok,
      error: (window as any).__e2e?.error,
    }));
    expect(result.ok, result.error).toBe(true);
  });

  test("help overlay shows ctrl message on wheel without modifier", async ({
    page,
  }) => {
    await initMap(page);

    const mapEl = page.locator("#map");
    await mapEl.dispatchEvent("wheel", { deltaY: 100 });

    const overlay = page.locator("#map .gesture-handling-help-overlay");
    await expect(overlay).toBeVisible({ timeout: 5000 });

    const text = await overlay.locator("div").innerText();
    expect(text).toContain("Ctrl");
    expect(text).toContain("scroll");
  });
});

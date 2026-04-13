import { expect, test } from "@playwright/test";

const PAGE = "/e2e/gesture-handling.html";

async function initMap(page: import("@playwright/test").Page) {
  await page.goto(PAGE, { waitUntil: "load" });
  await page.waitForFunction(() => (window as any).__e2e != null, {
    timeout: 30_000,
  });
}

test.describe("GestureHandling E2E — default", () => {
  test("control initializes successfully", async ({ page }) => {
    await initMap(page);

    const result = await page.evaluate(() => ({
      ok: (window as any).__e2e?.ok,
      error: (window as any).__e2e?.error,
    }));
    expect(result.ok, result.error).toBe(true);
  });

  test("scrollZoom is disabled after addControl", async ({ page }) => {
    await initMap(page);

    const enabled = await page.evaluate(() =>
      (window as any).__e2e.map.scrollZoom.isEnabled(),
    );
    expect(enabled).toBe(false);
  });

  test("help overlay appears on wheel without modifier", async ({ page }) => {
    await initMap(page);

    const mapEl = page.locator("#map");
    await mapEl.dispatchEvent("wheel", { deltaY: 100 });

    const overlay = page.locator("#map div[style*='z-index']");
    await expect(overlay).toBeVisible({ timeout: 5000 });

    const text = await overlay.locator("div").innerText();
    expect(text).toContain("alt");
    expect(text).toContain("scroll");
  });

  test("help overlay disappears after timeout", async ({ page }) => {
    await initMap(page);

    const mapEl = page.locator("#map");
    await mapEl.dispatchEvent("wheel", { deltaY: 100 });

    const overlay = page.locator("#map div[style*='z-index']");
    await expect(overlay).toBeVisible({ timeout: 5000 });

    // デフォルトタイムアウトは2000ms
    await expect(overlay).not.toBeVisible({ timeout: 5000 });
  });

  test("removeControl re-enables scrollZoom", async ({ page }) => {
    await initMap(page);

    await page.evaluate(() => {
      const e = (window as any).__e2e;
      e.map.removeControl(e.ctrl);
    });

    const enabled = await page.evaluate(() =>
      (window as any).__e2e.map.scrollZoom.isEnabled(),
    );
    expect(enabled).toBe(true);
  });

  test("removeControl cleans up help overlay", async ({ page }) => {
    await initMap(page);

    // まずオーバーレイを表示
    const mapEl = page.locator("#map");
    await mapEl.dispatchEvent("wheel", { deltaY: 100 });

    const overlay = page.locator("#map div[style*='z-index']");
    await expect(overlay).toBeVisible({ timeout: 5000 });

    // コントロールを削除
    await page.evaluate(() => {
      const e = (window as any).__e2e;
      e.map.removeControl(e.ctrl);
    });

    await expect(overlay).not.toBeVisible({ timeout: 5000 });
  });
});

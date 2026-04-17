import { expect, test } from "@playwright/test";

const PAGE = "/e2e/gesture-handling-mobile.html";

async function initMap(page: import("@playwright/test").Page) {
  await page.goto(PAGE, { waitUntil: "load" });
  await page.waitForFunction(() => (window as any).__e2e != null, {
    timeout: 30_000,
  });
}

/**
 * map.fire("movestart") を1本指タッチの originalEvent 付きで発火する。
 * Touch/TouchEvent コンストラクタはブラウザ互換性が低いため、
 * "touches" プロパティを持つプレーンオブジェクトで代替する。
 */
async function fireSingleFingerMoveStart(
  page: import("@playwright/test").Page,
) {
  await page.evaluate(() => {
    const map = (window as any).__e2e.map;
    map.fire("movestart", {
      originalEvent: { touches: [{ clientX: 100, clientY: 100 }] },
    });
  });
}

test.describe("GestureHandling E2E — Mobile touch", () => {
  test("control initializes successfully", async ({ page }) => {
    await initMap(page);

    const result = await page.evaluate(() => ({
      ok: (window as any).__e2e?.ok,
      error: (window as any).__e2e?.error,
    }));
    expect(result.ok, result.error).toBe(true);
  });

  test("single-finger drag shows mobile help overlay", async ({ page }) => {
    await initMap(page);

    await fireSingleFingerMoveStart(page);

    const overlay = page.locator("#map .maplibregl-gesture-help-overlay");
    await expect(overlay).toBeVisible({ timeout: 5000 });

    const text = await overlay.locator("div").innerText();
    expect(text).toContain("two fingers");
  });

  test("help overlay disappears after timeout on mobile", async ({ page }) => {
    await initMap(page);

    await fireSingleFingerMoveStart(page);

    const overlay = page.locator("#map .maplibregl-gesture-help-overlay");
    await expect(overlay).toBeVisible({ timeout: 5000 });

    // デフォルトタイムアウト 2000ms 後に消える
    await expect(overlay).not.toBeVisible({ timeout: 5000 });
  });

  test("two-finger touch on overlay dismisses it", async ({ page }) => {
    await initMap(page);

    // まずオーバーレイを表示
    await fireSingleFingerMoveStart(page);

    const overlay = page.locator("#map .maplibregl-gesture-help-overlay");
    await expect(overlay).toBeVisible({ timeout: 5000 });

    // オーバーレイ上で2本指タッチをシミュレート
    // TouchEvent コンストラクタが使えないブラウザがあるため、
    // CustomEvent + touches プロパティで代替
    await page.evaluate(() => {
      const mapContainer = document.getElementById("map");
      if (!mapContainer) return;
      const helpEl = mapContainer.querySelector<HTMLElement>(
        ".maplibregl-gesture-help-overlay",
      );
      if (!helpEl) return;

      const event = new Event("touchstart", {
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(event, "touches", {
        value: [
          { clientX: 100, clientY: 100 },
          { clientX: 200, clientY: 200 },
        ],
      });
      Object.defineProperty(event, "preventDefault", {
        value: () => {},
      });
      helpEl.dispatchEvent(event);
    });

    await expect(overlay).not.toBeVisible({ timeout: 5000 });
  });

  test("removeControl re-enables scrollZoom on mobile", async ({ page }) => {
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
});

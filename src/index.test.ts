import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GestureHandling } from "./index";

// ---------- minimal DOM mock ----------

class MockElement {
  tagName: string;
  className = "";
  innerText = "";
  style: Record<string, string> = {};
  children: MockElement[] = [];
  parentNode: MockElement | null = null;
  private listeners: Record<string, ((...args: any[]) => void)[]> = {};

  constructor(tag: string) {
    this.tagName = tag.toUpperCase();
  }

  appendChild(child: MockElement) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  removeChild(child: MockElement) {
    this.children = this.children.filter((c) => c !== child);
    child.parentNode = null;
    return child;
  }

  get firstElementChild(): MockElement | null {
    return this.children[0] ?? null;
  }

  remove() {
    if (this.parentNode) {
      this.parentNode.removeChild(this);
    }
  }

  addEventListener(type: string, fn: (...args: any[]) => void) {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(fn);
  }

  removeEventListener(type: string, fn: (...args: any[]) => void) {
    const list = this.listeners[type];
    if (list) {
      this.listeners[type] = list.filter((f) => f !== fn);
    }
  }

  dispatchEvent(type: string, event: Record<string, any> = {}) {
    for (const fn of this.listeners[type] ?? []) {
      fn(event);
    }
  }

  contains(el: MockElement): boolean {
    if (this === el) return true;
    return this.children.some((c) => c.contains(el));
  }
}

function createMockMap() {
  const container = new MockElement("div");
  const mapListeners: Record<string, ((...args: any[]) => void)[]> = {};

  return {
    container,
    listeners: mapListeners,
    scrollZoom: {
      disable: vi.fn(),
      enable: vi.fn(),
      isEnabled: vi.fn(() => false),
      reset: vi.fn(),
    },
    dragPan: {
      disable: vi.fn(),
      enable: vi.fn(),
    },
    getContainer: () => container,
    on: vi.fn((type: string, fn: (...args: any[]) => void) => {
      if (!mapListeners[type]) mapListeners[type] = [];
      mapListeners[type].push(fn);
    }),
    off: vi.fn((type: string, fn: (...args: any[]) => void) => {
      const list = mapListeners[type];
      if (list) {
        mapListeners[type] = list.filter((f) => f !== fn);
      }
    }),
    emit(type: string, event: Record<string, any> = {}) {
      for (const fn of mapListeners[type] ?? []) {
        fn(event);
      }
    },
  };
}

type MockMap = ReturnType<typeof createMockMap>;

function setupDocumentMock() {
  const original = globalThis.document;
  const docListeners: Record<string, ((...args: any[]) => void)[]> = {};
  const mock = {
    createElement: vi.fn((tag: string) => new MockElement(tag)),
    addEventListener: vi.fn((type: string, fn: (...args: any[]) => void) => {
      if (!docListeners[type]) docListeners[type] = [];
      docListeners[type].push(fn);
    }),
    removeEventListener: vi.fn((type: string, fn: (...args: any[]) => void) => {
      const list = docListeners[type];
      if (list) {
        docListeners[type] = list.filter((f) => f !== fn);
      }
    }),
    fullscreenElement: null as MockElement | null,
    _listeners: docListeners,
  };
  globalThis.document = mock as any;
  return {
    restore: () => {
      globalThis.document = original;
    },
    mock,
  };
}

// ---------- tests ----------

describe("GestureHandling", () => {
  let doc: ReturnType<typeof setupDocumentMock>;
  let map: MockMap;

  beforeEach(() => {
    doc = setupDocumentMock();
    map = createMockMap();
    // navigator.languages のモック
    vi.stubGlobal("navigator", {
      languages: ["en"],
      language: "en",
    });
  });

  afterEach(() => {
    doc.restore();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("getDefaultPosition returns 'top-left'", () => {
    const ctrl = new GestureHandling();
    expect(ctrl.getDefaultPosition()).toBe("top-left");
  });

  it("onAdd disables scrollZoom", () => {
    const ctrl = new GestureHandling();
    ctrl.onAdd(map as any);
    expect(map.scrollZoom.disable).toHaveBeenCalled();
  });

  it("onAdd returns a hidden container element", () => {
    const ctrl = new GestureHandling();
    const el = ctrl.onAdd(map as any);
    expect(el.className).toBe("maplibregl-ctrl");
    expect(el.style.display).toBe("none");
  });

  it("onAdd registers wheel event on map container", () => {
    const ctrl = new GestureHandling();
    ctrl.onAdd(map as any);
    // コンテナにリスナーが登録されているか
    expect(
      (map.container as any).listeners.wheel?.length,
    ).toBeGreaterThanOrEqual(1);
  });

  it("onAdd registers movestart on map", () => {
    const ctrl = new GestureHandling();
    ctrl.onAdd(map as any);
    expect(map.on).toHaveBeenCalledWith("movestart", expect.any(Function));
  });

  it("onRemove re-enables scrollZoom", () => {
    const ctrl = new GestureHandling();
    ctrl.onAdd(map as any);
    ctrl.onRemove();
    expect(map.scrollZoom.enable).toHaveBeenCalled();
  });

  it("onRemove unregisters movestart from map", () => {
    const ctrl = new GestureHandling();
    ctrl.onAdd(map as any);
    ctrl.onRemove();
    expect(map.off).toHaveBeenCalledWith("movestart", expect.any(Function));
  });

  it("onRemove is safe to call without prior onAdd", () => {
    const ctrl = new GestureHandling();
    expect(() => ctrl.onRemove()).not.toThrow();
  });

  describe("wheel events", () => {
    it("shows help overlay when scrolling without modifier key", () => {
      const ctrl = new GestureHandling();
      ctrl.onAdd(map as any);

      map.container.dispatchEvent("wheel", {
        altKey: false,
        ctrlKey: false,
        preventDefault: vi.fn(),
      });

      // ヘルプ要素がコンテナに追加されている
      const helpEl = map.container.children.find(
        (c) => c.style.zIndex === "9999",
      );
      expect(helpEl).toBeDefined();
      expect(helpEl?.style.display).toBe("flex");
      expect(map.scrollZoom.disable).toHaveBeenCalled();
    });

    it("enables scrollZoom when modifier key is held", () => {
      const ctrl = new GestureHandling();
      ctrl.onAdd(map as any);

      const preventDefault = vi.fn();
      map.container.dispatchEvent("wheel", {
        altKey: true,
        ctrlKey: false,
        preventDefault,
      });

      expect(preventDefault).toHaveBeenCalled();
      expect(map.scrollZoom.reset).toHaveBeenCalled();
      expect(map.scrollZoom.enable).toHaveBeenCalled();
    });

    it("uses ctrl modifier when configured", () => {
      const ctrl = new GestureHandling({ modifierKey: "ctrl" });
      ctrl.onAdd(map as any);

      const preventDefault = vi.fn();
      map.container.dispatchEvent("wheel", {
        altKey: false,
        ctrlKey: true,
        preventDefault,
      });

      expect(preventDefault).toHaveBeenCalled();
      expect(map.scrollZoom.enable).toHaveBeenCalled();
    });

    it("hides help after timeout", () => {
      vi.useFakeTimers();

      const ctrl = new GestureHandling({ timeout: 1000 });
      ctrl.onAdd(map as any);

      map.container.dispatchEvent("wheel", {
        altKey: false,
        ctrlKey: false,
        preventDefault: vi.fn(),
      });

      const helpEl = map.container.children.find(
        (c) => c.style.zIndex === "9999",
      );
      expect(helpEl).toBeDefined();

      vi.advanceTimersByTime(1000);

      expect(helpEl?.style.display).toBe("none");

      vi.useRealTimers();
    });
  });

  describe("help overlay wheel events", () => {
    it("hides help when modifier key is held on overlay", () => {
      const ctrl = new GestureHandling();
      ctrl.onAdd(map as any);

      // まずオーバーレイを表示
      map.container.dispatchEvent("wheel", {
        altKey: false,
        ctrlKey: false,
        preventDefault: vi.fn(),
      });

      const helpEl = map.container.children.find(
        (c) => c.style.zIndex === "9999",
      );
      expect(helpEl).toBeDefined();

      // オーバーレイ上で modifier 付き wheel
      const preventDefault = vi.fn();
      (helpEl as MockElement).dispatchEvent("wheel", {
        altKey: true,
        ctrlKey: false,
        preventDefault,
      });

      expect(preventDefault).toHaveBeenCalled();
      expect(helpEl?.style.display).toBe("none");
    });

    it("resets timeout when scrolling on overlay without modifier", () => {
      vi.useFakeTimers();

      const ctrl = new GestureHandling({ timeout: 1000 });
      ctrl.onAdd(map as any);

      // オーバーレイを表示
      map.container.dispatchEvent("wheel", {
        altKey: false,
        ctrlKey: false,
        preventDefault: vi.fn(),
      });

      const helpEl = map.container.children.find(
        (c) => c.style.zIndex === "9999",
      );
      expect(helpEl).toBeDefined();

      // 500ms 後にオーバーレイ上でスクロール → タイマーリセット
      vi.advanceTimersByTime(500);
      (helpEl as MockElement).dispatchEvent("wheel", {
        altKey: false,
        ctrlKey: false,
        preventDefault: vi.fn(),
      });

      // さらに 500ms ではまだ表示中（リセットされたため）
      vi.advanceTimersByTime(500);
      expect(helpEl?.style.display).toBe("flex");

      // 合計 1000ms 後に消える
      vi.advanceTimersByTime(500);
      expect(helpEl?.style.display).toBe("none");

      vi.useRealTimers();
    });
  });

  describe("touch events", () => {
    it("shows mobile help on single-finger movestart", () => {
      const ctrl = new GestureHandling();
      ctrl.onAdd(map as any);

      map.emit("movestart", {
        originalEvent: { touches: [{}] },
      });

      const helpEl = map.container.children.find(
        (c) => c.style.zIndex === "9999",
      );
      expect(helpEl).toBeDefined();
      expect(map.dragPan.disable).toHaveBeenCalled();
    });

    it("does not show help on two-finger movestart", () => {
      const ctrl = new GestureHandling();
      ctrl.onAdd(map as any);

      map.emit("movestart", {
        originalEvent: { touches: [{}, {}] },
      });

      const helpEl = map.container.children.find(
        (c) => c.style.zIndex === "9999",
      );
      expect(helpEl).toBeUndefined();
    });

    it("re-enables dragPan after timeout on single-finger touch", () => {
      vi.useFakeTimers();

      const ctrl = new GestureHandling({ timeout: 1000 });
      ctrl.onAdd(map as any);

      map.emit("movestart", {
        originalEvent: { touches: [{}] },
      });

      expect(map.dragPan.disable).toHaveBeenCalled();

      vi.advanceTimersByTime(1000);

      expect(map.dragPan.enable).toHaveBeenCalled();

      vi.useRealTimers();
    });
  });

  describe("help overlay touch", () => {
    it("hides help and enables dragPan on two-finger touchstart", () => {
      const ctrl = new GestureHandling();
      ctrl.onAdd(map as any);

      // まずヘルプを表示
      map.container.dispatchEvent("wheel", {
        altKey: false,
        ctrlKey: false,
        preventDefault: vi.fn(),
      });

      const helpEl = map.container.children.find(
        (c) => c.style.zIndex === "9999",
      );
      expect(helpEl).toBeDefined();

      // ヘルプ要素上で2本指タッチ
      const preventDefault = vi.fn();
      (helpEl as MockElement).dispatchEvent("touchstart", {
        touches: [{}, {}],
        preventDefault,
      });

      expect(map.dragPan.enable).toHaveBeenCalled();
      expect(preventDefault).toHaveBeenCalled();
    });
  });

  describe("fullscreen", () => {
    it("enables scrollZoom without modifier in fullscreen mode", () => {
      const ctrl = new GestureHandling();
      ctrl.onAdd(map as any);

      // fullscreen に入る
      doc.mock.fullscreenElement = new MockElement("div");
      for (const fn of doc.mock._listeners.fullscreenchange ?? []) {
        fn();
      }

      const preventDefault = vi.fn();
      map.container.dispatchEvent("wheel", {
        altKey: false,
        ctrlKey: false,
        preventDefault,
      });

      expect(preventDefault).toHaveBeenCalled();
      expect(map.scrollZoom.enable).toHaveBeenCalled();
    });
  });

  describe("i18n", () => {
    it("uses Japanese messages when lang is ja", () => {
      const ctrl = new GestureHandling({ lang: "ja" });
      ctrl.onAdd(map as any);

      map.container.dispatchEvent("wheel", {
        altKey: false,
        ctrlKey: false,
        preventDefault: vi.fn(),
      });

      const helpEl = map.container.children.find(
        (c) => c.style.zIndex === "9999",
      );
      const textBox = helpEl?.firstElementChild;
      expect(textBox?.innerText).toContain("Alt");
      expect(textBox?.innerText).toContain("スクロール");
    });

    it("auto-detects Japanese from navigator.languages", () => {
      vi.stubGlobal("navigator", {
        languages: ["ja-JP"],
        language: "ja-JP",
      });

      const ctrl = new GestureHandling();
      ctrl.onAdd(map as any);

      map.container.dispatchEvent("wheel", {
        altKey: false,
        ctrlKey: false,
        preventDefault: vi.fn(),
      });

      const helpEl = map.container.children.find(
        (c) => c.style.zIndex === "9999",
      );
      const textBox = helpEl?.firstElementChild;
      expect(textBox?.innerText).toContain("スクロール");
    });

    it("uses English by default", () => {
      const ctrl = new GestureHandling();
      ctrl.onAdd(map as any);

      map.container.dispatchEvent("wheel", {
        altKey: false,
        ctrlKey: false,
        preventDefault: vi.fn(),
      });

      const helpEl = map.container.children.find(
        (c) => c.style.zIndex === "9999",
      );
      const textBox = helpEl?.firstElementChild;
      expect(textBox?.innerText).toContain("alt");
      expect(textBox?.innerText).toContain("scroll");
    });

    it("falls back to navigator.language when languages is empty", () => {
      vi.stubGlobal("navigator", {
        languages: [],
        language: "ja",
      });

      const ctrl = new GestureHandling();
      ctrl.onAdd(map as any);

      map.container.dispatchEvent("wheel", {
        altKey: false,
        ctrlKey: false,
        preventDefault: vi.fn(),
      });

      const helpEl = map.container.children.find(
        (c) => c.style.zIndex === "9999",
      );
      const textBox = helpEl?.firstElementChild;
      expect(textBox?.innerText).toContain("スクロール");
    });

    it("auto-detects Japanese from navigator.languages 'ja'", () => {
      vi.stubGlobal("navigator", {
        languages: ["ja"],
        language: "ja",
      });

      const ctrl = new GestureHandling();
      ctrl.onAdd(map as any);

      map.container.dispatchEvent("wheel", {
        altKey: false,
        ctrlKey: false,
        preventDefault: vi.fn(),
      });

      const helpEl = map.container.children.find(
        (c) => c.style.zIndex === "9999",
      );
      const textBox = helpEl?.firstElementChild;
      expect(textBox?.innerText).toContain("スクロール");
    });

    it("shows Japanese touch message on single-finger movestart", () => {
      const ctrl = new GestureHandling({ lang: "ja" });
      ctrl.onAdd(map as any);

      map.emit("movestart", {
        originalEvent: { touches: [{}] },
      });

      const helpEl = map.container.children.find(
        (c) => c.style.zIndex === "9999",
      );
      const textBox = helpEl?.firstElementChild;
      expect(textBox?.innerText).toContain("2本指");
    });

    it("shows Japanese ctrl message when modifierKey is ctrl", () => {
      const ctrl = new GestureHandling({ lang: "ja", modifierKey: "ctrl" });
      ctrl.onAdd(map as any);

      map.container.dispatchEvent("wheel", {
        altKey: false,
        ctrlKey: false,
        preventDefault: vi.fn(),
      });

      const helpEl = map.container.children.find(
        (c) => c.style.zIndex === "9999",
      );
      const textBox = helpEl?.firstElementChild;
      expect(textBox?.innerText).toContain("Ctrl");
    });

    it("shows ctrl in message when modifierKey is ctrl", () => {
      const ctrl = new GestureHandling({ modifierKey: "ctrl" });
      ctrl.onAdd(map as any);

      map.container.dispatchEvent("wheel", {
        altKey: false,
        ctrlKey: false,
        preventDefault: vi.fn(),
      });

      const helpEl = map.container.children.find(
        (c) => c.style.zIndex === "9999",
      );
      const textBox = helpEl?.firstElementChild;
      expect(textBox?.innerText).toContain("ctrl");
    });
  });

  describe("scrollZoom already enabled", () => {
    it("does not call reset/enable when scrollZoom is already enabled", () => {
      const ctrl = new GestureHandling();
      ctrl.onAdd(map as any);

      map.scrollZoom.isEnabled.mockReturnValue(true);

      const preventDefault = vi.fn();
      map.container.dispatchEvent("wheel", {
        altKey: true,
        ctrlKey: false,
        preventDefault,
      });

      expect(preventDefault).toHaveBeenCalled();
      expect(map.scrollZoom.reset).not.toHaveBeenCalled();
    });
  });

  describe("fullscreen touch", () => {
    it("dismisses help on single-finger touch in fullscreen", () => {
      const ctrl = new GestureHandling();
      ctrl.onAdd(map as any);

      // fullscreen に入る
      doc.mock.fullscreenElement = new MockElement("div");
      for (const fn of doc.mock._listeners.fullscreenchange ?? []) {
        fn();
      }

      // ヘルプを表示してから1本指タッチ
      map.container.dispatchEvent("wheel", {
        altKey: false,
        ctrlKey: false,
        preventDefault: vi.fn(),
      });

      // fullscreen なので modifier なしでも scrollZoom 有効化される
      // （onWheel で処理されるのでヘルプは表示されない）
      expect(map.scrollZoom.enable).toHaveBeenCalled();
    });

    it("helpOverlay touchstart dismisses in fullscreen with single finger", () => {
      const ctrl = new GestureHandling();
      ctrl.onAdd(map as any);

      // まずヘルプを表示（fullscreen 前に）
      map.container.dispatchEvent("wheel", {
        altKey: false,
        ctrlKey: false,
        preventDefault: vi.fn(),
      });

      const helpEl = map.container.children.find(
        (c) => c.style.zIndex === "9999",
      );
      expect(helpEl).toBeDefined();

      // fullscreen に入る
      doc.mock.fullscreenElement = new MockElement("div");
      for (const fn of doc.mock._listeners.fullscreenchange ?? []) {
        fn();
      }

      // fullscreen なら1本指でもオーバーレイ解除
      const preventDefault = vi.fn();
      (helpEl as MockElement).dispatchEvent("touchstart", {
        touches: [{}],
        preventDefault,
      });

      expect(helpEl?.style.display).toBe("none");
      expect(map.dragPan.enable).toHaveBeenCalled();
    });
  });

  describe("movestart edge cases", () => {
    it("ignores movestart without originalEvent", () => {
      const ctrl = new GestureHandling();
      ctrl.onAdd(map as any);

      map.emit("movestart", {});

      const helpEl = map.container.children.find(
        (c) => c.style.zIndex === "9999",
      );
      expect(helpEl).toBeUndefined();
    });

    it("ignores movestart without touches in originalEvent", () => {
      const ctrl = new GestureHandling();
      ctrl.onAdd(map as any);

      map.emit("movestart", {
        originalEvent: { type: "mousedown" },
      });

      const helpEl = map.container.children.find(
        (c) => c.style.zIndex === "9999",
      );
      expect(helpEl).toBeUndefined();
    });

    it("ignores single-finger movestart in fullscreen", () => {
      const ctrl = new GestureHandling();
      ctrl.onAdd(map as any);

      // fullscreen に入る
      doc.mock.fullscreenElement = new MockElement("div");
      for (const fn of doc.mock._listeners.fullscreenchange ?? []) {
        fn();
      }

      map.emit("movestart", {
        originalEvent: { touches: [{}] },
      });

      const helpEl = map.container.children.find(
        (c) => c.style.zIndex === "9999",
      );
      expect(helpEl).toBeUndefined();
    });
  });

  describe("fullscreen exit", () => {
    it("re-disables scrollZoom after exiting fullscreen", () => {
      const ctrl = new GestureHandling();
      ctrl.onAdd(map as any);

      // fullscreen に入る
      doc.mock.fullscreenElement = new MockElement("div");
      for (const fn of doc.mock._listeners.fullscreenchange ?? []) {
        fn();
      }

      // fullscreen から出る
      doc.mock.fullscreenElement = null;
      for (const fn of doc.mock._listeners.fullscreenchange ?? []) {
        fn();
      }

      // modifier なしで wheel → ヘルプが表示される（fullscreen ではない）
      map.container.dispatchEvent("wheel", {
        altKey: false,
        ctrlKey: false,
        preventDefault: vi.fn(),
      });

      const helpEl = map.container.children.find(
        (c) => c.style.zIndex === "9999",
      );
      expect(helpEl).toBeDefined();
    });
  });

  describe("custom options", () => {
    it("accepts custom messages", () => {
      const ctrl = new GestureHandling({
        textMessage: "Custom wheel msg",
        textMessageMobile: "Custom touch msg",
      });
      ctrl.onAdd(map as any);

      map.container.dispatchEvent("wheel", {
        altKey: false,
        ctrlKey: false,
        preventDefault: vi.fn(),
      });

      const helpEl = map.container.children.find(
        (c) => c.style.zIndex === "9999",
      );
      const textBox = helpEl?.firstElementChild;
      expect(textBox?.innerText).toBe("Custom wheel msg");
    });

    it("applies custom background and text colors", () => {
      const ctrl = new GestureHandling({
        backgroundColor: "red",
        textColor: "blue",
      });
      ctrl.onAdd(map as any);

      map.container.dispatchEvent("wheel", {
        altKey: false,
        ctrlKey: false,
        preventDefault: vi.fn(),
      });

      const helpEl = map.container.children.find(
        (c) => c.style.zIndex === "9999",
      );
      expect(helpEl?.style.backgroundColor).toBe("red");
      const textBox = helpEl?.firstElementChild;
      expect(textBox?.style.color).toBe("blue");
    });
  });
});

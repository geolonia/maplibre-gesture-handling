import type { ControlPosition, IControl, Map } from "maplibre-gl";

function detectLang(): "ja" | "en" {
  const lang = (navigator.languages?.[0] ?? navigator.language).toLowerCase();
  return lang === "ja" || lang === "ja-jp" ? "ja" : "en";
}

type ModifierKey = "altKey" | "ctrlKey";

const MESSAGES = {
  en: (key: ModifierKey) => ({
    wheel: `Use ${key === "altKey" ? "alt" : "ctrl"} + scroll to zoom the map.`,
    touch: "Use two fingers to move the map.",
  }),
  ja: (key: ModifierKey) => ({
    wheel: `${key === "altKey" ? "Alt" : "Ctrl"} キーを押しながらスクロールしてください。`,
    touch: "2本指を使って操作してください。",
  }),
} as const;

export interface GestureHandlingOptions {
  /** 背景色（デフォルト: "rgba(0, 0, 0, 0.8)"） */
  backgroundColor?: string;
  /** テキスト色（デフォルト: "#ffffff"） */
  textColor?: string;
  /** ホイール操作時のメッセージ */
  textMessage?: string;
  /** タッチ操作時のメッセージ */
  textMessageMobile?: string;
  /** メッセージ表示のタイムアウト（ms、デフォルト: 2000） */
  timeout?: number;
  /** 修飾キー指定: "alt" | "ctrl"（デフォルト: "alt"） */
  modifierKey?: "alt" | "ctrl";
  /** 言語: "ja" | "en" | "auto"（デフォルト: "auto"） */
  lang?: "ja" | "en" | "auto";
}

interface ResolvedSettings {
  backgroundColor: string;
  textColor: string;
  textMessage: string;
  textMessageMobile: string;
  timeout: number;
  modifierKey: ModifierKey;
}

function resolveSettings(options: GestureHandlingOptions): ResolvedSettings {
  const modifierKey: ModifierKey =
    options.modifierKey === "ctrl" ? "ctrlKey" : "altKey";
  const lang =
    options.lang === "auto" || !options.lang ? detectLang() : options.lang;
  const messages = MESSAGES[lang](modifierKey);

  return {
    backgroundColor: options.backgroundColor ?? "rgba(0, 0, 0, 0.8)",
    textColor: options.textColor ?? "#ffffff",
    textMessage: options.textMessage ?? messages.wheel,
    textMessageMobile: options.textMessageMobile ?? messages.touch,
    timeout: options.timeout ?? 2000,
    modifierKey,
  };
}

export class GestureHandling implements IControl {
  private readonly settings: ResolvedSettings;
  private helpElement: HTMLDivElement | undefined;
  private map: Map | undefined;
  private fullscreen = false;
  private timer: ReturnType<typeof setTimeout> | null = null;

  private readonly handleWheel: (event: WheelEvent) => void;
  private readonly handleHelpWheel: (event: WheelEvent) => void;
  private readonly handleHelpTouchStart: (event: TouchEvent) => void;
  private readonly handleMoveStart: (event: { originalEvent?: Event }) => void;
  private readonly handleFullscreenChange: () => void;

  constructor(options: GestureHandlingOptions = {}) {
    this.settings = resolveSettings(options);

    this.handleWheel = this.onWheel.bind(this);
    this.handleHelpWheel = this.onHelpWheel.bind(this);
    this.handleHelpTouchStart = this.onHelpTouchStart.bind(this);
    this.handleMoveStart = this.onMoveStart.bind(this);
    this.handleFullscreenChange = this.onFullscreenChange.bind(this);
  }

  onAdd(map: Map): HTMLDivElement {
    this.map = map;

    // ヘルプオーバーレイの作成
    const helpElement = document.createElement("div");
    helpElement.style.backgroundColor = this.settings.backgroundColor;
    helpElement.style.position = "absolute";
    helpElement.style.display = "none";
    helpElement.style.zIndex = "9999";
    helpElement.style.justifyContent = "center";
    helpElement.style.alignItems = "center";

    const textBox = document.createElement("div");
    textBox.style.textAlign = "center";
    textBox.style.color = this.settings.textColor;
    helpElement.appendChild(textBox);

    this.helpElement = helpElement;

    // scroll zoom を無効化
    map.scrollZoom.disable();

    // イベントリスナーの登録
    helpElement.addEventListener("wheel", this.handleHelpWheel);
    helpElement.addEventListener("touchstart", this.handleHelpTouchStart, {
      passive: false,
    });
    map.getContainer().addEventListener("wheel", this.handleWheel);
    map.on("movestart", this.handleMoveStart);
    document.addEventListener("fullscreenchange", this.handleFullscreenChange);

    // IControl の要件として空の container を返す
    const container = document.createElement("div");
    container.className = "maplibregl-ctrl";
    container.style.display = "none";
    return container;
  }

  onRemove(): void {
    this.clearTimer();

    if (this.helpElement) {
      this.helpElement.removeEventListener("wheel", this.handleHelpWheel);
      this.helpElement.removeEventListener(
        "touchstart",
        this.handleHelpTouchStart,
      );
      this.hideHelp();
      this.helpElement = undefined;
    }

    if (this.map) {
      this.map.getContainer().removeEventListener("wheel", this.handleWheel);
      this.map.off("movestart", this.handleMoveStart);
      this.map.scrollZoom.enable();
      this.map = undefined;
    }

    document.removeEventListener(
      "fullscreenchange",
      this.handleFullscreenChange,
    );
  }

  getDefaultPosition(): ControlPosition {
    return "top-left";
  }

  // --- internal ---

  private showHelp(message: string): void {
    const map = this.map;
    const help = this.helpElement;
    if (!map || !help) return;

    help.style.top = "0";
    help.style.left = "0";
    help.style.width = "100%";
    help.style.height = "100%";
    help.style.display = "flex";

    const textBox = help.firstElementChild as HTMLElement | null;
    if (textBox) {
      textBox.innerText = message;
    }

    map.getContainer().appendChild(help);
  }

  private hideHelp(): void {
    const help = this.helpElement;
    if (!help) return;
    help.style.display = "none";
    help.remove();
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private onWheel(event: WheelEvent): void {
    const map = this.map;
    if (!map) return;

    if (event[this.settings.modifierKey] || this.fullscreen) {
      event.preventDefault();
      if (!map.scrollZoom.isEnabled()) {
        map.scrollZoom.reset();
        map.scrollZoom.enable();
      }
    } else {
      map.scrollZoom.disable();
      this.showHelp(this.settings.textMessage);
      this.clearTimer();
      this.timer = setTimeout(() => {
        this.hideHelp();
      }, this.settings.timeout);
    }
  }

  private onHelpWheel(event: WheelEvent): void {
    if (event[this.settings.modifierKey] || this.fullscreen) {
      event.preventDefault();
      this.clearTimer();
      this.hideHelp();
    } else {
      this.clearTimer();
      this.timer = setTimeout(() => {
        this.hideHelp();
      }, this.settings.timeout);
    }
  }

  private onHelpTouchStart(event: TouchEvent): void {
    const map = this.map;
    if (!map) return;

    if (event.touches && (event.touches.length >= 2 || this.fullscreen)) {
      this.clearTimer();
      this.hideHelp();
      map.dragPan.enable();
      event.preventDefault();
    }
  }

  private onMoveStart(event: { originalEvent?: Event }): void {
    const map = this.map;
    if (!map) return;

    if (
      event.originalEvent &&
      "touches" in event.originalEvent &&
      (event.originalEvent as TouchEvent).touches.length < 2 &&
      !this.fullscreen
    ) {
      this.showHelp(this.settings.textMessageMobile);
      map.dragPan.disable();
      this.clearTimer();
      this.timer = setTimeout(() => {
        map.dragPan.enable();
        this.hideHelp();
      }, this.settings.timeout);
    }
  }

  private onFullscreenChange(): void {
    this.fullscreen = !!document.fullscreenElement;
  }
}

export default GestureHandling;

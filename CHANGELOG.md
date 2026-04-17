# Changelog

## v3.0.0

### Breaking Changes

- **Default modifier key changed from `alt` to platform auto-detection.** The `modifierKey` option now defaults to `"auto"`, which uses ⌘ (Command) on macOS and Ctrl on Windows/Linux. To restore the previous behavior, set `modifierKey: "alt"` explicitly.

### Added

- `modifierKey: "auto"` option (new default) — automatically selects the appropriate modifier key per platform.
- `modifierKey: "meta"` option — explicitly uses ⌘ (Command/Meta) key on all platforms.
- macOS platform detection via `navigator.userAgentData.platform` with `navigator.platform` fallback.
- CSS class `gesture-handling-help-overlay` on the help overlay element for stable styling and selector targeting.
- macOS E2E tests on GitHub Actions (`macos-latest`).
- Type-safe error handling in E2E fixture pages.

## v2.0.0

- Initial release as a TypeScript rewrite of [`@geolonia/mbgl-gesture-handling`](https://github.com/geolonia/mbgl-gesture-handling) for MapLibre GL JS.
- Implements `IControl` interface from MapLibre GL JS.
- Supports wheel gesture handling with modifier key (alt/ctrl) and two-finger touch gesture handling.
- Built-in i18n support (English and Japanese) with auto-detection from browser language.
- Configurable overlay appearance (background color, text color, timeout).
- Published as ESM with TypeScript declarations.

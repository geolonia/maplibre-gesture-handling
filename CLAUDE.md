# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`@geolonia/maplibre-gesture-handling` is a MapLibre GL JS plugin that intercepts wheel and touch gestures to prevent unintended map zoom/pan on embedded maps. It is a TypeScript rewrite of the original Mapbox GL JS plugin (`@geolonia/mbgl-gesture-handling`).

The plugin implements the `IControl` interface from MapLibre GL JS. It disables `scrollZoom` and shows a help overlay prompting the user to hold a modifier key (alt/ctrl) for wheel zoom, or use two fingers for touch pan.

## Commands

- **Build:** `npm run build` (runs `tsc`)
- **Unit tests:** `npm test` (vitest)
- **Single test:** `npx vitest run src/path/to/file.test.ts`
- **Coverage:** `npm run test:coverage`
- **Lint:** `npm run lint` (biome)
- **Lint fix:** `npm run lint:fix`
- **Dev server:** `npm run dev` (serves on port 5177, opens `/e2e/`)
- **E2E tests:** `npm run e2e` (playwright, auto-starts webServer)
- **Single E2E browser:** `npx playwright test --project=chromium`

## Architecture

- **`src/index.ts`** — Plugin entry point. `GestureHandling` class implementing `IControl`. Compiled to `dist/`.
- **`src/index.test.ts`** — Unit tests (vitest) with minimal DOM mocks (no jsdom).
- **`e2e/`** — Playwright E2E tests. Each scenario has an HTML fixture and a `.test.ts` file.
  - `*-mobile.test.ts` files run only on mobile browser projects (matched by `testMatch` in playwright config).
- The plugin is published as ESM with type declarations (`dist/index.js` + `dist/index.d.ts`).

## Tooling

- **TypeScript** for all source code (target ES2020, module ES2020, bundler resolution)
- **Biome** for linting and formatting (not ESLint/Prettier). HTML files are excluded via `files.includes` glob in `biome.json`.
- **Vitest** for unit tests
- **Playwright** for E2E tests — 5 browser projects: Chromium, Firefox, WebKit, Mobile Chrome (Pixel 7), Mobile Safari (iPhone 14)

## CI

GitHub Actions workflow (`.github/workflows/ci.yml`) runs lint, unit tests with coverage, and E2E tests across all 5 browsers in a matrix. Publishes to npm on `v*` tags with OIDC provenance.

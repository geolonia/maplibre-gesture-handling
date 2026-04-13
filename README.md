# @geolonia/maplibre-gesture-handling

MapLibre GL JS plugin that handles wheel and touch gestures to prevent unexpected zooming and panning on embedded maps.

On **desktop**, users must hold a modifier key (alt or ctrl) while scrolling to zoom the map. On **mobile**, users must use two fingers to pan.

When the user scrolls or drags without the required gesture, a translucent overlay appears with an instruction message.

## Install

```
npm install @geolonia/maplibre-gesture-handling
```

## Usage

```js
import maplibregl from "maplibre-gl";
import { GestureHandling } from "@geolonia/maplibre-gesture-handling";

const map = new maplibregl.Map({
  container: "map",
  style: "https://tile.openstreetmap.jp/styles/maptiler-basic-ja/style.json",
});

map.addControl(new GestureHandling());
```

## Options

All options are optional.

| Option | Type | Default | Description |
|---|---|---|---|
| `modifierKey` | `"alt" \| "ctrl"` | `"alt"` | Modifier key required for wheel zoom |
| `lang` | `"ja" \| "en" \| "auto"` | `"auto"` | Message language. `"auto"` detects from browser |
| `textMessage` | `string` | *(auto by lang)* | Desktop overlay message |
| `textMessageMobile` | `string` | *(auto by lang)* | Mobile overlay message |
| `backgroundColor` | `string` | `"rgba(0, 0, 0, 0.8)"` | Overlay background color |
| `textColor` | `string` | `"#ffffff"` | Overlay text color |
| `timeout` | `number` | `2000` | Overlay display duration in ms |

### Example with ctrl modifier

```js
map.addControl(new GestureHandling({ modifierKey: "ctrl" }));
```

### Example with Japanese messages

```js
map.addControl(new GestureHandling({ lang: "ja" }));
```

## License

MIT

# v4c icon pack — how to switch the app to the new icons

The v4c pack is 66 3D-rendered PNGs (512×512, transparent, color-differentiated) living in `assets/icons-v4c/`. See `assets/icons-v4c/asset_manifest.csv` for the full index.

## What was added (non-destructive)

- `assets/icons-v4c/` — 66 PNGs + manifest (CSV + JSON) + contact sheet
- `src/icons/ProvidedGlyphIconsV4c.tsx` — PNG-based drop-in mirror of `ProvidedGlyphIcons.tsx`
- `src/icons/AppTabIconsV4c.tsx` — PNG-based drop-in mirror of `AppTabIcons.tsx`

Nothing existing was modified. Old SVG components still work.

## To switch the whole app to v4c

Change the imports at each consumer. For the bottom nav, find wherever `AppTabIcon` is used and swap:

```tsx
// before
import { AppTabIcon } from './icons/AppTabIcons';
// after
import { AppTabIconV4c as AppTabIcon } from './icons/AppTabIconsV4c';
```

For arbitrary glyph usage:

```tsx
// before
import { ProvidedGlyphIcon } from './icons/ProvidedGlyphIcons';
// after
import { ProvidedGlyphIconV4c as ProvidedGlyphIcon } from './icons/ProvidedGlyphIconsV4c';
```

Or use the direct asset API for new UI:

```tsx
import { V4cIcon } from './icons/ProvidedGlyphIconsV4c';
<V4cIcon asset="CT_Trophy_Crown" size={48} />
```

## Glyph-name → v4c asset mapping (for the SVG drop-in)

| Old glyph   | v4c asset              |
|-------------|------------------------|
| deals       | AppNav_HotDeals        |
| favorites   | AppNav_Favorites       |
| badges      | CT_Badge_StarOrange    |
| browse      | AppNav_Browse          |
| close       | AppNav_Filter (keep SVG if exact X is needed) |
| location    | AppNav_Nearby          |
| map         | AppNav_MapApp          |
| profile     | AppNav_Profile         |
| storefront  | AppNav_Browse          |
| reviews     | CT_Trophy_Star         |
| saved       | AppNav_Favorites       |
| search      | AppNav_Search          |
| stars       | CT_Badge_StarOrange    |
| travel      | AppNav_Compass         |
| verify      | AppNav_Verify          |
| trophy      | CT_Trophy_Compass      |

## Gotchas

- v4c PNGs are **color-baked** (each asset has a CTv4 palette color). The `color` / `accentColor` props are accepted for API compat but not applied to the pixels. Focus/dim state is handled via `opacity`.
- Tint-to-theme won't work anymore. If you need a tab to go gray when blurred and vivid when focused, use the included opacity dim.
- If you need monochrome tinting on PNG, wrap in `<View style={{ tintColor: ... }}>` on iOS or use `react-native-fast-image` — but then you lose the hand-baked CTv4 look that took a week to land.

# Memory

## ★ Canonical 3D Build Pipeline (copy the key)

Any 3D glyph, badge layer, or ornament goes through THIS pipeline — no exceptions, no AI generators for flat art. Source of truth: `/sessions/practical-elegant-turing/mnt/canopy/Design/2D to 3D Pipeline.md`.

1. Author as SVG (viewBox 0 0 100 100, `fill-rule="evenodd"` for holes)
2. `bpy.ops.import_curve.svg(filepath=svg)` → new curve objects
3. For each curve: `data.dimensions = '3D'` BEFORE any transform
4. If multi-path: select all new curves → `bpy.ops.object.join()`
5. Scale 100× → `bpy.ops.object.transform_apply(scale=True)`
6. `bpy.ops.object.origin_set('ORIGIN_GEOMETRY', center='BOUNDS')` → `location=(0,0,0)`
7. Back to 2D for fill: `data.dimensions='2D'`, `data.fill_mode='BOTH'`
8. `bpy.ops.object.convert(target='MESH')`
9. Solidify modifier: `thickness=0.25`, `offset=0`, `use_even_offset=True` (NOT `use_even_thickness`), then apply
10. Re-origin and recenter, `bpy.ops.object.shade_smooth()`
11. Assign the shared material (gold baseline: Principled BSDF, Base Color 1.0/0.78/0.24, Roughness 0.22, Metallic 0.95)
12. Fit to frame: rescale so `max(dims.x, dims.y) == 4.2` (camera ortho_scale 6.0)
13. `bpy.ops.wm.save_as_mainfile(filepath=out_blend, compress=True)` — saves the FULL scene (mesh + camera + lights + material all visible on open). NEVER use `bpy.data.libraries.write({obj.data}, fake_user=True)` — it writes only a mesh datablock, leaving the file empty on open.
14. Render under Eevee (engine `"BLENDER_EEVEE"` in Blender 5.1 — NOT `"BLENDER_EEVEE_NEXT"`), 64 samples, `view_transform="Standard"`, `look="High Contrast"`, RGBA PNG at 512. For vibrant-bg variant: `film_transparent=False` + World `#121614` + `color_mode="RGB"` (transparent + emission + PNG RGBA premultiplies alpha and desaturates the color).

**Axis convention (locked):** Unity-style — X-right, Y-up, Z-forward. Camera at `(0, 0, 6)` rotation `(0,0,0)` looking down -Z. Ortho, not perspective, `ortho_scale=6.0`.

**Composition rule:** build every sub-element (rosette, ribbons, centerpiece, glyph) through the same SVG-extrude pipeline, each as its own mesh. Layer in one scene via Z-offset. Never use AI generators for flat/emblem art — only for organic (foliage, environments).

**Material recipes (locked):**

- _CanopyGold_ — metallic baseline: Principled BSDF, Base Color `(1.0, 0.78, 0.24)`, Metallic 0.95, Roughness 0.22.
- _CanopyGreen_ — matte + emission (metallic kills saturation on non-gold colors): Base Color `(0.18, 0.80, 0.44)` = `#2ECC71`, Metallic 0, Roughness 0.45, Emission Color same, Emission Strength 0.5.

**Rejected patterns (do not reintroduce):**

- Building geometry procedurally via bmesh when an SVG would do
- `use_even_thickness` attribute (doesn't exist in this Blender version)
- Applying transforms while curve `dimensions == '2D'` (raises "Cannot apply to 2D curve")
- AI-generated flat logos/icons (bad topology, hallucinated depth)
- `bpy.data.libraries.write({obj.data}, fake_user=True)` — produces empty scenes on open
- `"BLENDER_EEVEE_NEXT"` as engine name in Blender 5.1 — the engine was renamed back to `"BLENDER_EEVEE"`
- Metallic > 0 on non-gold colors — turns saturated colors pale/white-tinted because metallic surfaces reflect the light color, not the base color
- `film_transparent=True` + emissive materials + RGBA PNG — PNG alpha premultiplication desaturates the pixel color
- Default AgX view transform for stylized branding — desaturates extremes by design (keep AgX for photoreal only)
- Saving outputs to `Downloads\` — OneDrive sync causes intermittent "file not found"

**Asset paths (current):** `C:\Users\eleve\Desktop\canopytrove-assets\` with subfolders `svg/`, `blend/` (gold), `blend_green/` (green), `renders/` (gold), `renders_green/` (transparent bg), `renders_green_dark/` (vibrant dark bg), `blend_v3/` (fantasy trophy), `renders_v3/` (Eevee), `renders_v3_hero/` (Cycles 1024), `contact/`.

**Plugin:** Packaged as `canopytrove-blender.plugin` (v0.2.0) — install from workspace to give Claude access to ten Blender skills: the canonical SVG-to-3D pipeline plus Python scripting, modeling/sculpting/UV, shading & PBR, lighting & rendering, icon design, geometry nodes, rigging & animation, simulation/FX, and export pipelines. Ships with a shared `lib/blender_common.py` (color-safe material factory, 3/4-point rig builders, ortho/iso cameras, Eevee/Cycles config), nine Python helper scripts (headless boot, context overrides, bmesh utilities, shader factories, light rigs, icon batch renderer, contact sheets), and per-skill reference docs (api migration notes, principled socket migration, PBR texture slots, shader node cheatsheet, view transforms, sample budgets, denoiser comparison, UV seam strategy, modifier order, sculpt brush reference, style families, ortho framing). Triggers cover "bpy script", "PBR", "HDRI", "Rigify", "FBX Unity", "geometry nodes", etc., in addition to the original canopytrove triggers.

## ★ v3 Fantasy Trophy Composition (shipped)

The canonical pipeline above produces a single-mesh sticker. **v3** layers three meshes into a medallion for badges/trophies; icons stay single-mesh sticker. Shipped: 66 assets (5 badges × 3 variants + 5 trophies × 3 variants + 12 icons × 3 variants), 15 hero Cycles renders at 1024².

**Medallion composition (badges + trophies):**

1. `MedallionBack` — cylinder, `radius=2.35, depth=0.35`, location `(0,0,-0.3)`, Bevel `width=0.08 segments=6 limit=ANGLE` applied, `CanopyGold` (metallic=0.95, rough=0.20, coat=0.3).
2. `MedallionRing` — torus, `major=2.10 minor=0.07 major_segments=96 minor_segments=12`, `CanopyGoldDk` darker gold (metallic=0.95, rough=0.30) to read as an accent against the disc.
3. `Glyph` — SVG-extrude per canonical pipeline at `target_size=2.6, thickness=0.30, bevel=0.035`, Z-offset `0.32` to sit proud of the ring. Material is `CanopyEnamel` themed to the badge's color (see color-safe recipe below). The `badge_trove_hunter` case keeps `CanopyGold` for a pure-gold emblem.

**★ Color-safe enamel recipe (re-verified after pale-washout round):** Principled BSDF, Base Color = theme token, `Metallic=0.0`, `Roughness=0.55`, `Coat Weight=0.0` (coat kills saturation — any positive coat adds white specular on top of the color), `Emission Color = Base Color`, `Emission Strength=0.5` (enough to push color through shadow, not enough to blow out to white). DO NOT use coat>0, rough<0.4, or emission>1.0 — each of those washes the pixel to cream/white under stylized lighting. The user diagnosed this bug with "i still got no color whats happening man?" — the centers were reading (220, 229, 216) cream; after patch they read (132, 255, 201) green, (241, 119, 48) red, (94, 221, 255) blue — chroma > 115 across the palette.

**Icon composition (single mesh):**

- Skip medallion. Glyph at `target_size=3.8, thickness=0.38, bevel=0.05`, centered at origin. Same `CanopyEnamel` recipe.

**Color palette (v3 enamel tokens):**

- `GOLD` = `(1.0, 0.78, 0.24)` · `GREEN` = `(0.18, 0.80, 0.44)` · `RED` = `(0.90, 0.30, 0.36)` · `BLUE` = `(0.30, 0.55, 0.95)` · `PURPLE` = `(0.60, 0.38, 0.85)` · `AMBER` = `(0.95, 0.65, 0.20)` · `TEAL` = `(0.20, 0.75, 0.78)` · `ROSE` = `(0.95, 0.52, 0.65)` · `WHITE` = `(0.95, 0.95, 0.92)`.

**Hero assignment:** THEME dict keys (stripped of variant suffix) with `is_hero=True` also render a 1024² Cycles pass at 128 samples to `renders_v3_hero/`. Current heroes: all 5 badges + all 5 trophies × 3 variants = 30. Icons skip the hero Cycles pass.

**THEME dict MUST match actual filenames.** Real trophies in the dataset are `apex_forager, cartographers_crown, guardians_aegis, origin_stone, voice_of_the_trove` (NOT regional_rambler/deal_digger/route_legend — those names were aspirational; map them in the colored palette only if the SVG actually ships). Real icons are `chat, compass, deal, heart, home, map, scan, search, settings, shield, shop, star` (NOT leaf/map_pin/sparkle/camera/key/leaf_alt). `theme_for` fallback (default GREEN icon) will silently swallow missing entries and make everything green — audit the filename set before every run.

**4-point lighting rig (fantasy, color-safe):** Key 500W warm `(1.0, 0.95, 0.85)` at `(-3.5, 3.5, 5)`; Fill 220W cool `(0.85, 0.92, 1.0)` at `(3.5, -2.5, 4)`; Rim 500W back white at `(0, -2, -4)` rotation `(200°, 0, 0)` (rim-light silhouette, behind subject); Top 150W down-light at `(0, 4, 2)`. Camera ortho, `ortho_scale=6.5` at `(0, 0, 8)` — up from the canonical `6.0 / z=6` because the medallion is larger. Do NOT reach for the original Key 1200 / Rim 2200 / Top 600 numbers — those blow out the enamel to near-white under Emission≥0.3, which is the bug the user flagged with "i still got no color".

**World:** Gradient via `ShaderNodeTexCoord → Mapping → TexGradient(LINEAR) → ValToRGB → Background`. Color ramp: element[0] `(0.02, 0.03, 0.04)` deep, element[1] `(0.08, 0.10, 0.11)` warm-dark. Non-transparent film, RGB output.

**Engine split:**

- `setup_render_eevee(res=512, samples=64)` — all 66 assets. Standard view transform, **Medium High Contrast** look (High Contrast pushes highlights into white clipping on Emission≥0.3), exposure `-0.3`.
- `setup_render_cycles(res=1024, samples=128)` — heroes only. Same view transform + look + exposure. Cycles produces softer shadows and real reflections on the gold medallion.

**theme_for suffix-strip gotcha (fixed):** The variant-suffix strip list must include `_v1_silhouette, _v2_composed, _v2_colored, _v2_trophy, _v3_alt, _v1_icon, _v2_icon, _v3_icon` — missing `_v2_composed` dropped the hero badge `v2_composed` variants to default icon treatment during the first v3 pass. Always match against the full observed set of suffix strings.

**New rejected patterns (v3):**

- Joining medallion back/ring into the glyph mesh before save — they're supposed to read as separate layers with independent materials; `bpy.ops.object.join()` should only collapse imported SVG curves, never the medallion primitives.
- Rim light placed in front of the camera — must be behind the subject (negative Z) to actually rim-light.
- Cycles pass for every variant — 2 minutes × 66 is absurd for batch. Only hero heroes get Cycles.

## Me

Rozell (rozell), solo founder building Canopy Trove — a licensed dispensary discovery app for iOS (React Native/Expo). Handles frontend, backend, and deployment.

## Project

| Name             | What                                                                                                      |
| ---------------- | --------------------------------------------------------------------------------------------------------- |
| **Canopy Trove** | Licensed dispensary discovery app. RN/Expo frontend + Node/Express Cloud Run backend + Firestore named DB |

→ Details: memory/projects/canopy-trove.md

## Stack Quick Ref

| Layer       | Tech                                                         |
| ----------- | ------------------------------------------------------------ |
| Frontend    | React Native, Expo SDK, TypeScript, Expo Router              |
| Backend     | Node.js/Express on Cloud Run (`canopytrove-api`, `us-east4`) |
| Database    | Firestore named database `canopytrove` (NOT `(default)`)     |
| Auth        | Firebase Auth                                                |
| Maps        | Google Places API (backend gateway pattern)                  |
| Build       | EAS Build (development, preview, production profiles)        |
| Hosting     | Firebase Hosting for legal pages                             |
| Monitoring  | Sentry (integrated, needs DSN), Cloud Logging, runtime ops   |
| GCP Project | `canopy-trove`                                               |
| Bundle ID   | `com.rezell.canopytrove`                                     |

## Key Env Vars

| Var                         | Purpose                                                              |
| --------------------------- | -------------------------------------------------------------------- |
| `STOREFRONT_BACKEND_SOURCE` | `firestore` or defaults to `mock` — MUST be set on Cloud Run         |
| `FIREBASE_DATABASE_ID`      | `canopytrove` — required for named Firestore DB                      |
| `GOOGLE_MAPS_API_KEY`       | Via Secret Manager on Cloud Run                                      |
| `ADMIN_API_KEY`             | Via Secret Manager on Cloud Run                                      |
| `EXPO_PUBLIC_*`             | Client-visible env vars (legal URLs, Firebase config, feature flags) |
| `SENTRY_DSN`                | Backend crash monitoring — Sentry project DSN                        |
| `EXPO_PUBLIC_SENTRY_DSN`    | Frontend crash monitoring — Sentry project DSN                       |
| `OPS_HEALTHCHECK_API_URL`   | Runtime uptime monitor target (public API URL)                       |
| `OPS_ALERT_WEBHOOK_URL`     | Webhook for runtime health failure alerts                            |

## Design Tokens

| Token            | Value                    |
| ---------------- | ------------------------ |
| Background       | `#121614` (dark theme)   |
| Heading font     | SpaceGrotesk             |
| Body font        | DM Sans                  |
| Accent green     | `#2ECC71`                |
| Accent gold      | `#E8A000`                |
| Text primary     | `#FFFBF7`                |
| Text secondary   | `#C4B8B0`                |
| Min touch target | 48dp                     |
| Spacing scale    | 4, 8, 12, 16, 24, 32, 48 |
| Border radius    | sm:4, md:8, lg:12, xl:16 |

## Terms

| Term            | Meaning                                                                                     |
| --------------- | ------------------------------------------------------------------------------------------- |
| discovery run   | Backend sweep that enriches storefronts via Google Places API                               |
| storefront      | A dispensary listing (627 sources in DB)                                                    |
| routeMode       | `preview` vs `verified` — affects navigation URL generation                                 |
| zombie run      | A stuck discovery run record (status "running" forever)                                     |
| OCM             | Office of Cannabis Management (NY regulator)                                                |
| placeId         | Google Place ID for precise navigation                                                      |
| EAS             | Expo Application Services (build + submit + update)                                         |
| OTA             | Over-the-air update via EAS Update                                                          |
| COA             | Certificate of Analysis; lab report with cannabinoid potency, terpenes, contaminant results |
| product scan    | User-initiated camera capture in Verify tab resolving to shop license or product COA        |
| brand counter   | Aggregated Firestore document counting scans per brand across regions and time              |
| scan resolution | Discriminated union result: `license`, `product`, or `unknown`                              |

→ Full glossary: memory/glossary.md

## App Store Status

| Store       | Readiness | Notes                                                                                                                            |
| ----------- | --------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Apple       | 9.5/10    | Legal URLs wired, 17+ rating needed. Camera permission newly required. OCM verification + product scan **shipped** — Verify tab. |
| Google Play | 4/10      | Blanket ban on marijuana-facilitating apps                                                                                       |

## Licensed Shop Verifier (shipped)

| Layer              | Piece                                                                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Data source        | NY OCM public dispensary registry via data.ny.gov SODA API (`jskf-tt3q`), refreshed hourly                                            |
| Backend cache      | `ocmLicenseCacheService.ts` — TTL 1h, stale-serve 6h, Maps indexed by license / address+zip / normalized name                         |
| Backend enrichment | `storefrontOcmEnrichment.ts` attaches `ocmVerification` to every summary & detail (fail-soft, 1500ms budget)                          |
| Public endpoint    | `GET /licenses/verify?license=&name=&address=&city=&zip=` — no auth, Cache-Control 5m + SWR 10m                                       |
| Frontend tab       | `Verify` tab sits between `HotDeals` and `Profile`; `src/screens/VerifyScreen.tsx` form + result + disclaimer                         |
| Listing badge      | `LicensedBadge` inline pill on `StorefrontRouteCard`, full card on `StorefrontDetailScreen` — "Per OCM public records, updated today" |

## Product Scan Pipeline (shipped)

| Layer            | Piece                                                                                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Data source      | 6 NY lab COA URL parsers (Kaycha Labs, NY Green Analytics, ProVerde, Keystone State Testing, ACT Laboratories, generic fallback)                        |
| Backend services | `productCatalogService.ts` (lab metadata + parsing), `scanIngestionService.ts` (anonymous install-ID logging), `brandAnalyticsService.ts` (aggregation) |
| Endpoints        | `POST /scans/ingest` (App Check gated, 30 req/min), `GET /products/resolve` (cached 60s SWR 300s)                                                       |
| Firestore        | `productScans` collection (anonymous by install ID), `brandCounters` aggregation collection (regional brand trending)                                   |
| Frontend tab     | `VerifyScreen.tsx` — camera-first with full-bleed CameraView, top-left "Can't scan? Enter info" pill for manual fallback                                |
| Result screen    | `ScanResultScreen.tsx` — shared renderer handling license/product/unknown resolutions, displays lab results or shop verification                        |
| Privacy          | Anonymous by default (install ID only, never PII), optional location (aggregate-only), no cross-app tracking, disableable in Profile → Privacy          |

## Architecture Patterns (Research-Backed)

| Pattern                         | Where    | Reference                             |
| ------------------------------- | -------- | ------------------------------------- |
| Token-based design system       | Frontend | memory/context/ui-polish.md           |
| Reanimated 3 spring animations  | Frontend | memory/context/ui-polish.md           |
| Skeleton loading screens        | Frontend | memory/context/ui-polish.md           |
| Structured JSON logging (Pino)  | Backend  | memory/context/backend-hardening.md   |
| Zod request validation          | Backend  | memory/context/backend-hardening.md   |
| Graceful shutdown (SIGTERM)     | Backend  | memory/context/backend-hardening.md   |
| Health probes (/livez, /readyz) | Backend  | memory/context/backend-hardening.md   |
| Helmet.js security headers      | Backend  | memory/context/backend-hardening.md   |
| expo-secure-store for tokens    | Frontend | memory/context/hooks-and-secrets.md   |
| Backend gateway for API keys    | Both     | memory/context/hooks-and-secrets.md   |
| Firebase App Check              | Both     | memory/context/hooks-and-secrets.md   |
| Hermes V1 bytecode              | Frontend | memory/context/frontend-production.md |
| expo-image with caching         | Frontend | memory/context/frontend-production.md |

| EAS
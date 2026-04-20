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

## ★ Repo & Environment (Apr 20 2026)

**Canonical paths (locked):**

- Repo: `D:\src\canopytrove` — moved off `C:\dev\canopytrove` to escape OneDrive sync flakiness. The OneDrive copy was renamed to `C:\dev\canopytrove.OLD-2026-04-20`; safe to delete around May 4 2026 if no regressions surface.
- Secrets stash: `D:\src\_secrets-canopytrove\` — holds `credentials.json` (EAS Android keystore, 277 bytes), `package-lock.json.corrupt`, `web-app-guide.skill`, `webappsheet.txt`. Outside repo, outside OneDrive, outside git. **Never re-commit `credentials.json`** — codex's `.gitignore` already excludes `credentials/` and `credentials.json` (inherited by master post-FF).
- Windows Defender exclusions on `D:\src\canopytrove`, `git.exe`, `node.exe`.
- VS Code: remove `C:\dev\canopytrove` from File → Open Recent so it doesn't re-anchor on the stale OneDrive copy.

**Branch state (verified):** `master` and `codex/workspace-cleanup` both at `d415475`, both local + origin refs aligned. Master was 99 commits strictly behind codex (0 ahead) — fast-forwarded cleanly via `git merge --ff-only codex/workspace-cleanup` (834 files, 1,198,223 insertions, 10,734 deletions). All April work landed: location prompt, OCM verifier, product scan, music default, UI polish, review notes, privacy label doc, Fast checkout removal.

**Dev environment gotchas (locked):**

- **HUSKY=0 bypass for commit-amends** — when `git commit --amend` races lint-staged on Windows the index.lock holds and the commit fails partway. Set `$env:HUSKY = "0"` in the shell before the amend to skip hooks safely. Use sparingly — bypass hooks, not validation; only when re-running on a branch where lint already passed.
- **EAS CLI flag changes** — `eas device:list` no longer accepts `--platform` (devices are iOS-only anyway, just call `eas device:list` bare). `--non-interactive` is a boolean switch with no value: write `--non-interactive` alone, never `--non-interactive:$false` (PS will pass the literal string and EAS will reject "Nonexistent flag: --non-interactive:False"). Interactive mode is the default — drop the flag entirely if you want prompts.
- **PowerShell paste-safety** — terminal paste glitches strip leading `$` from variable names, leaving bare `

in the buffer which PS reads as a command and errors. For multi-line credential moves, prefer inline literal paths (`"D:\src\_secrets-canopytrove\credentials.json"`) over `$secretStash` variables.

- **VS Code SCM config.lock race** — VS Code's git provider grabs `.git/config.lock` during refreshes and can collide with shell `git` commands. Wait for the SCM panel to settle before running git from the terminal, or close VS Code for big rewrites/merges.
- **Line endings on mixed-origin files** — `app.json` was bare LF on disk despite `core.autocrlf=true` (committed from non-Windows tooling, git left it alone). PowerShell here-strings (`@'...'@`) are CRLF by default, so `.Contains($heredoc)` silently misses on LF files when the anchor spans multiple lines (single-line substring anchors don't hit this). Fix: LF-normalize both sides with `-replace "`r`n", "`n"`before`.Contains`/`.Replace`. After the first commit that rewrites such a file through git's index, `autocrlf=true`converts it to CRLF in the working tree on next checkout — so the quirk is per-file and often self-resolves after one edit. Diagnostic:`Select-Object -ExpandProperty`on`[IO.File]::ReadAllBytes(path)`and scan for`0A`bytes not preceded by`0D`.

**EAS dev build pre-flight (verified Apr 20 2026):**

- `eas whoami` → `ezell` (roszellbrantley02@gmail.com)
- `development` profile correct: `developmentClient: True`, `distribution: internal`, `channel: development`, `NODE_ENV=development`, `SENTRY_DISABLE_AUTO_UPLOAD=true`
- `expo-dev-client@55.0.27` installed, matches Expo SDK 55
- Build kickoff command: `eas device:list` then `eas build --platform ios --profile development` from `D:\src\canopytrove` on master at `d415475`.

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

| Layer            | Piece                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Data source      | 6 NY lab COA URL parsers (Kaycha Labs, NY Green Analytics, ProVerde, Keystone State Testing, ACT Laboratories, generic fallback)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Backend services | `productCatalogService.ts` (lab metadata + parsing), `scanIngestionService.ts` (anonymous install-ID logging), `brandAnalyticsService.ts` (aggregation)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Endpoints        | `POST /scans/ingest` (App Check gated, 30 req/min), `GET /products/resolve` (cached 60s SWR 300s)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Firestore        | `productScans` collection (anonymous by install ID), `brandCounters` aggregation collection (regional brand trending)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Frontend tab     | `VerifyScreen.tsx` — menu-first hub (Scan product / Scan shop / Rate / Verify OCM); `ScanCameraScreen.tsx` hosts the camera with safe-area-inset top/bottom pills so back/menu clears the notch/status bar                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Result screen    | `ScanResultScreen.tsx` — shared renderer handling license/product/unknown resolutions, displays lab results or shop verification                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| URL enrichment   | **Chain-through only.** `brandPageResolverService.ts` fetches scanned brand/retailer URLs server-side (SSRF-guarded, 2.5s timeout, 1MB size cap, HTML-only content-type), regex-extracts all `src`/`href` links, and if any resolve to a known NY lab domain delegates to `parseCoa()` — so a scanner who lands on a brand microsite still gets verified in-app lab data when the brand links to their COA. Wired into both `POST /scans/ingest` (`scanIngestionService.ts:174`) and `GET /products/resolve` (`productResolveRoutes.ts:70`). Does NOT scrape potency, terpenes, cannabinoid percentages, or brand imagery. If no lab link is found, outcome is `{ outcome: 'none' }` and caller falls back to `Linking.openURL` opening the brand page in the system browser. COA URLs hit `parseCoa()` which only extracts `labName` + `batchId` from the URL path via regex. The per-lab parsers in `productCatalogService.ts` still carry `TODO: Fetch page and extract brand, product, THC%, CBD%` comments — full COA page-scrape deferred intentionally to avoid copyright + NY-advertising risk on brand photos. Crowdsource flow remains the canonical brand/product name source |
| Privacy          | Anonymous by default (install ID only, never PII), optional location (aggregate-only), no cross-app tracking. Profile → Privacy opt-out toggle is **not shipped yet** — privacy policy calls it out as planned; users can email support to request scan-history deletion until the toggle ships                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

## Architecture Patterns (Research-Backed)

| Pattern                          | Where    | Reference                             |
| -------------------------------- | -------- | ------------------------------------- |
| Token-based design system        | Frontend | memory/context/ui-polish.md           |
| Reanimated 3 spring animations   | Frontend | memory/context/ui-polish.md           |
| Skeleton loading screens         | Frontend | memory/context/ui-polish.md           |
| Structured JSON logging (Pino)   | Backend  | memory/context/backend-hardening.md   |
| Zod request validation           | Backend  | memory/context/backend-hardening.md   |
| Graceful shutdown (SIGTERM)      | Backend  | memory/context/backend-hardening.md   |
| Health probes (/livez, /readyz)  | Backend  | memory/context/backend-hardening.md   |
| Helmet.js security headers       | Backend  | memory/context/backend-hardening.md   |
| expo-secure-store for tokens     | Frontend | memory/context/hooks-and-secrets.md   |
| Backend gateway for API keys     | Both     | memory/context/hooks-and-secrets.md   |
| Firebase App Check               | Both     | memory/context/hooks-and-secrets.md   |
| Hermes V1 bytecode               | Frontend | memory/context/frontend-production.md |
| expo-image with caching          | Frontend | memory/context/frontend-production.md |
| EAS build profiles + SDK 55      | Build    | memory/context/build-and-release.md   |
| FUSE sandbox git/npm workarounds | Build    | memory/context/build-and-release.md   |
| expo-build-properties for iOS    | Build    | memory/context/build-and-release.md   |

## Apple Submission Posture (Apr 19 2026)

Canonical support address: **askmehere@canopytrove.com** (in-app config + 15 public-release-pages HTML pages + review notes + privacy label all aligned). Earlier mismatch with `support@canopytrove.com` is resolved.

**Verify tab has two user-facing verification paths — reviewers must understand both to avoid reading one as a bug:**

- **Verify OCM license** — in-app form → backend → in-app result card. Stays in the app end-to-end, renders the "Per OCM public records" pill. Used by typing a dispensary name/license/address.
- **Scan shop QR** — camera decodes any URL-encoded QR (state Scan-to-Verify placard, Google Reviews QR, Weedmaps, Leafly, website) and opens the decoded URL in the system browser via `Linking.openURL`. No in-app result screen for this path; the destination page is the result. Reviewer prime: _"scanning a state placard should expect Safari to open on cannabis.ny.gov; this is the intended handoff, not a scan failure."_

**OCM Scan-to-Verify placard** is a state-mandated QR code that licensed NY dispensaries must display in public view (ref: `https://cannabis.ny.gov/dispensary-location-verification`). Canopy Trove's scan flow is the consumer-facing interface for that state-issued compliance artifact — key Guideline 1.4.3 framing.

**Pre-launch empty-data context** is documented in `docs/APPLE_APP_REVIEW_NOTES.md`: Rating Pending / 1-of-10 ratings / empty photo slots / "CLOSED" cards are all expected pre-launch behavior, not broken UI. Reviewer needs to know this up front.

**Screenshots posture (submission-safe):**

- Lead with **Verify tab** (compliance first) + **21+ age gate** (proves 1.4.3 compliance).
- Clean **review shot** (Helpful staff / Selection / Good parking / Easy to find tags; storefront-experience language only — no "Fast checkout", no "Verified Purchase", no specific product names).
- Nearby/Browse with neutral storefront names and at least one OPEN card during business-hours capture.
- Never show "$", Order, Buy, Delivery, or add-to-cart language anywhere.

**Rejected review-tag pattern (must not ship):** "Fast checkout" — reads as in-app checkout and is a 1.4.3 trip wire. **Removed Apr 20 2026** from `src/screens/writeReview/reviewComposerShared.ts` `REVIEW_TAGS`, scrubbed from `docs/API_CONTRACT.md` JSON examples, removed from `src/data/reactionGifCatalog.ts` keyword list. Do not reintroduce — if a "speed at register" sentiment is needed later, phrase it as "Quick service" or fold into "Helpful staff".

**Rejected review-body patterns:** "Verified Purchase" phrasing (implies transaction verification the app doesn't do), specific cannabis product names ("Orange Cream Pop", "moon rocks", etc.), "energy was high" (cannabis-connotation in context). Community guidelines need to scrub these.

## Launch Readiness (Apr 19 2026)

| Item                                                       | Status                                                                                                                                                   |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mailbox active + monitored (`askmehere@canopytrove.com`)   | ✅ confirmed by founder                                                                                                                                  |
| Reviewer credentials ready (customer + owner)              | ✅ confirmed by founder                                                                                                                                  |
| Real-phone QA in active rotation                           | ✅ ongoing                                                                                                                                               |
| Account deletion end-to-end matches public help page       | ✅ verified Apr 19 2026                                                                                                                                  |
| Public site email normalized to `askmehere@`               | ✅ commit `b79d932`                                                                                                                                      |
| Privacy nutrition label doc matches reality                | ✅ commit `26765ce`                                                                                                                                      |
| Apple review notes — OCM placard + pre-launch context      | ✅ commit `d79dfe1`                                                                                                                                      |
| Apple review notes — Scan shop QR path honest about Safari | ✅ commit `d6a2a66`                                                                                                                                      |
| D-U-N-S / seller name path ready                           | ✅ confirmed by founder                                                                                                                                  |
| OCM verifier smoke check green                             | ✅ confirmed by founder                                                                                                                                  |
| Cloud Run `/livez` + `/readyz` green                       | ✅ confirmed by founder                                                                                                                                  |
| Production EAS iOS build on top of `a6ee24e`+              | ✅ unblocked Apr 20 2026 — master fast-forwarded to `d415475` which includes the native plist change; repo now on `D:\src\canopytrove`, dev build queued |
| App Store Connect privacy nutrition label entered          | ⏳ blocked on founder — enter verbatim from `docs/APP_STORE_PRIVACY_LABEL.md`                                                                            |
| 17+ age rating declared via ASC questionnaire              | ⏳ blocked on founder                                                                                                                                    |
| Final screenshots uploaded to ASC                          | ⏳ blocked on founder — Verify + age gate + clean review shot + neutral storefronts; captions ready                                                      |
| "Fast checkout" review tag source removal                  | ✅ removed Apr 20 2026 from `reviewComposerShared.ts`, `API_CONTRACT.md`, `reactionGifCatalog.ts`                                                        |

**Approval odds (current posture):** 75–82% first-submit, 90%+ by round 2.

**Most likely round-2 vector:** 1.4.3 geo-restriction question — if ASC availability is all-US, a reviewer may ask why the app is available in states where cannabis is illegal. Fix: limit ASC availability to states with legal adult-use cannabis, OR ship an in-app geo-check that blocks non-legal states.

**Second-most-likely round-2 vector:** privacy nutrition label in ASC doesn't match the privacy policy URL verbatim. Fix: enter the label straight from `docs/APP_STORE_PRIVACY_LABEL.md`.

## Recent Shipped Work

| Commit    | What                                                                                                               |
| --------- | ------------------------------------------------------------------------------------------------------------------ |
| `d415475` | chore(compliance): remove "Fast checkout" review tag from source + docs + GIF keyword list (1.4.3 trip wire)       |
| `d6a2a66` | docs(apple-review): Scan shop QR description matches actual code path (Linking.openURL → Safari for state placard) |
| `d79dfe1` | docs(apple-review): OCM Scan-to-Verify placard context + pre-launch reviewer framing + scan-logging claim fix      |
| `26765ce` | docs: privacy nutrition label corrected to match shipped reality (scan-logging toggle planned, not shipped)        |
| `b79d932` | public site: normalize support email to `askmehere@canopytrove.com` across 15 HTML pages                           |
| `e786011` | docs(memory): capture confirmed Apple launch readiness + open items                                                |
| `87c6ee1` | fix(scan-camera): safe-area insets on Menu/back pills — clears notch/status bar                                    |
| `4cb8384` | fix(route-card): trust resolved `openNow` boolean when hours are missing (Android)                                 |
| `a6ee24e` | Add `NSLocationWhenInUseUsageDescription` plist key (native, requires EAS build)                                   |
| `538ba60` | Payment badges on listing cards — drop batch timeout, `Promise.allSettled` fan-out                                 |
| `5ae4956` | Music default off + 500ms watchdog for playlist loop reliability                                                   |

## Orphan Worktree Harvest (Apr 20 2026)

Found a linked worktree at `C:/Users/eleve/Documents/New project/canopytrove-profile-fix` orphaned by the Apr 20 repo relocation. Its `.git` pointer referenced `C:/dev/canopytrove/.git/worktrees/canopytrove-profile-fix` — dead after the rename, revived by repointing to `C:/dev/canopytrove.OLD-2026-04-20/.git/worktrees/canopytrove-profile-fix`. Broken pointer backed up at `<wt>/.git.broken-pointer-backup` — leave until harvest complete.

Branch: `codex/gamification-profile-fix` @ `e2b9938`. Commit message: "Fix canonical profile reuse for gamification state." Branch tip is behind current master `2a228ce` by many shipped commits (Apple submission, OCM verifier, product scan, UI polish, Fast checkout removal, etc.). No blind apply — full per-file reconciliation.

**Harvest census:** 31 files modified, 3 new files, ~2,113 insertions / 1,643 deletions. Full patch cached at `D:/src/canopytrove/.harvest-*.diff`.

**Branch intent (prioritize):** profile screen + gamification state models. Everything outside that scope (sitemap, eas.json, storefront detail, hot deals, report, review, saved, post-export script, package-lock, icon renderer, etc.) is scope creep or drift on a stale base; port only if clearly improves shipped state.

**Per-file ritual (translucence-safe):**

1. Read `D:/src/canopytrove/<file>` — current master version
2. `git -C <wt> diff -- <file>` — worktree delta vs `e2b9938`
3. Look for region conflicts — did master move the same lines?
4. Decide: full port / partial port / skip (record reason)
5. Apply via user-run PowerShell against `D:/src/canopytrove` — never the worktree
6. `git diff --stat` + visual review
7. `git commit -m "harvest: <file> — <what>"` scoped and small
8. Push after each file or small related group

**Ordering (smallest -> largest, rhythm-first):**

- Phase 1: icons + icon test + rewards-model test (additive, low conflict)
- Phase 2: config + infra (app.json, eas.json, sitemap, assetlinks, splash-observer)
- Phase 3: controller shared + small screens (HotDeals, Report, Saved, PostVisitPrompt, StorefrontDetailScreen, profileUtils, useProfileScreenModel)
- Phase 4: profileStyles, profile/rewards models + tests, WriteReview + model, Google Play packet
- Phase 5: StorefrontDetail Hero / Community sections, storefront detail hooks
- Phase 6: ProfileScreen (+583), post-export.js (+686), package-lock regen (not port)
- Phase 7: `git worktree remove --force` + delete worktree directory

**Anti-patterns re-confirmed:**

- `FALLBACK_ICON_NAME` routing unknown icons to `help-buoy-outline` — same shape as the "See more button." Fix renderers at source; don't add silent fallbacks. If harvesting AppUiIcon, drop the fallback and add the real missing renderers (`beaker-outline`, `leaf-outline`) explicitly.
- Blind `git apply` of the harvest patch — stale base causes conflicts. Per-file only.
- Committing from inside the orphan worktree — writes would land in the OLD repo's object DB, not `D:/src/canopytrove`.

**Still-missing fix after harvest:** `beaker-outline` and `leaf-outline` renderers. Harvest adds `people`, `diamond-outline`, `chatbubbles-outline`, `brush-outline` but NOT beaker/leaf. Write those fresh in phase 1.
**Phase 1 complete (Apr 20 2026):** `4ca92e0` adds `beaker-outline` + `leaf-outline` renderers directly to `AppUiIcon.tsx` (rejected harvest's `FALLBACK_ICON_NAME` pattern per anti-pattern above). `0074f6a` ports harvest's dynamic coverage test — reads `AppUiIcon.tsx` via regex and asserts every `CANOPYTROVE_BADGES` + `OWNER_EXCLUSIVE_BADGES` icon has a renderer. Catches future drift.

**Phase 2 complete (Apr 20 2026):** six surgical commits on top of Phase 1, each sub-6-line diff:

- `d9631bd` sitemap trailing slashes on `/nearby`, `/browse`, `/hot-deals` (SEO normalization)
- `8992c59` iOS `associatedDomains` gains `applinks:app.canopytrove.com` — master was only claiming `canopytrove.com` + `www`, missing the actual live web app host
- `b58d972` Android `intentFilters` gain `app.canopytrove.com` (same fix, Android half)
- `7559581` CLAUDE.md: LF-on-Windows heredoc anchor gotcha (captured in Dev environment gotchas above)
- `310bfaf` `eas.json` `submit.production.android` gains `track: "internal"` — Google Play Internal Testing lane; aspirational given Play readiness still 4/10
- `d0e40b3` `public-release-pages/.well-known/assetlinks.json` placeholder → real SHA256 `BA:AD:A4:A5:B2:C9:FB:C5:F0:33:A0:16:1B:DE:62:39:E2:1E:51:D9:7C:8A:29:02:D4:D2:92:58:5B:07:E6:FF` from `D:/src/canopytrove/credentials/android/keystore.jks`, verified via `keytool -list -v`

**Harvest values for secret-material are untrustworthy.** The harvest branch's `assetlinks.json` fingerprint was `FD:43:1C:F0:...` but the actual release keystore signs with `BA:AD:A4:A5:...` — different keys entirely. Rule: for anything that matches `REPLACE_WITH_*`, or any fingerprint / API key / token / project ID / OAuth client ID, the harvest's concrete value is a guess until re-derived from the actual source. Always re-derive; never copy harvest's concrete value for secret material.

**Keystore layout — decision deferred:** release-signing `keystore.jks` (2196 bytes, Apr 9 2026) currently lives in three places: `D:/src/canopytrove/credentials/android/keystore.jks` (active repo, gitignored via `.gitignore:53:credentials/`), `C:/dev/canopytrove.OLD-2026-04-20/credentials/android/keystore.jks` (OneDrive OLD copy), and stashed `D:/src/_secrets-canopytrove/credentials.json` references it via relative `keystorePath: "credentials/android/keystore.jks"` (only resolves from repo root, not from the stash dir). `.gitignore` has triple coverage (`*.jks` line 16, `credentials/` line 53, `credentials.json` line 54) so zero leak risk, but the OLD OneDrive duplicate should be removed post-May-4 along with the rest of the OLD repo. Canonical layout (stash-everything-absolute vs repo-root-relative) to be decided after harvest reconciliation closes.

**assetlinks redeploy TODO:** master's `public-release-pages/.well-known/assetlinks.json` now has the real fingerprint, but the live `https://app.canopytrove.com/.well-known/assetlinks.json` still serves a 2-byte empty file (observed Apr 20 2026 via `Invoke-WebRequest`). Until `public-release-pages/` gets deployed to the live host (probably Firebase Hosting), Android App Link auto-verification will fail for `app.canopytrove.com/storefronts/*` — intents still open the app but without the "verified" badge. Not a shipping blocker, but `b58d972`'s intent-filter commit depends on this redeploy to be fully effective.

## ★ Orphan Worktree Harvest — POST-MORTEM (Apr 20 2026, closed no-op)

**Result: closed without porting the named harvest commit.** The branch `codex/gamification-profile-fix` (HEAD `e2b9938`, "Fix canonical profile reuse for gamification state", Danielle Tuper, Apr 10 2026) was one commit on top of orphan master `699a100` — and that parent is fully reachable from D master. By the time I inspected it on Apr 20, D master had moved ~10 days forward with the product scan pipeline, OCM verification, owner portal payment methods, product reviews, music, Blender plugin packaging, and dozens more features. The diff `master..e2b9938` was 836 files / +11,219 / −1,198,560 — master-forward-motion, not harvest content.

**Surgical check on the actual fix: OBVIATED.** Danielle's patch added a useEffect that queried `getStorefrontBackendCanonicalProfile()` to swap locally-minted `profileId` for the backend canonical when account IDs matched but profile IDs diverged, plus extracted `areProfilesEquivalent` and `getPreferredDisplayName` helpers, plus a `lastCanonicalResolutionKeyRef` dedup guard. Master's current `src/context/useStorefrontProfileModel.ts` has ALL of those primitives — imports (useRef, getStorefrontBackendCanonicalProfile), ref, both helpers — refactored into named callbacks (`resolveCanonicalAuthenticatedProfile` at line 108, `persistResolvedProfile` at line 96, `repairProfileForCurrentSession` at line 139). Same semantics, cleaner structure. The fix was absorbed into a subsequent master refactor.

**Six commits shipped during the "harvest" phases (Apr 20) that were NOT from `e2b9938`** — sourced from orphan's working-tree drift, all legitimate on their own merits:

- `d9631bd` — `public/sitemap.xml` trailing slashes on `/nearby/`, `/browse/`, `/hot-deals/` (SEO normalization)
- `8992c59` — `app.json` iOS `associatedDomains` adds `applinks:app.canopytrove.com` (deep-link host parity with live domain)
- `b58d972` — `app.json` Android `intentFilters` adds `app.canopytrove.com` host with `autoVerify` (Android App Links)
- `310bfaf` — `eas.json` production Android submit adds `"track": "internal"` for Play Store Internal Testing
- `d0e40b3` — `public-release-pages/.well-known/assetlinks.json` real keystore SHA256 `BA:AD:A4:A5:B2:C9:FB:C5:F0:33:A0:16:1B:DE:62:39:E2:1E:51:D9:7C:8A:29:02:D4:D2:92:58:5B:07:E6:FF` via keytool extraction from `credentials/android/keystore.jks`, replacing placeholder. `https://app.canopytrove.com/.well-known/assetlinks.json` still serves empty until Firebase Hosting redeploys — not a ship blocker.
- `57f1a8a` — `src/screens/profile/useProfileScreenModel.ts` exposes `isAuthenticatedMember` (derived from `authSession.status === 'authenticated'`) so downstream consumers branch on member state without re-deriving.

**Rejected patterns (newly locked in):**

- **Trusting a diff-stat list produced at Time T as harvest scope when refs can move between T and now.** Always re-derive at the moment of use: `git merge-base master HEAD` + `git show --stat <commit>` + `git merge-base --is-ancestor <commit> master`. If `--is-ancestor` exits 0, the harvest is already landed.
- **Attributing commits to "the harvest branch" when the provenance was orphan working-tree drift or loose session context.** Be precise about provenance ("sourced from orphan's working tree on Apr 20") or don't claim it.
- **Assuming `orphan/master` tracks `D/master`.** They're separate repos with separate local refs. Orphan's local `master` was frozen at `699a100` when the worktree was created; D's master kept moving. Always verify with `git merge-base --is-ancestor <orphan-master> <D-master>` before treating them as equivalent.
- **Reading `git merge-base master <old-commit>` as "current work to port."** If the merge-base IS the old commit, that commit is an ancestor and everything else in the diff is master moving forward past it (appears as "deletions" in `master..old`), not new work to land.
- **Using literal non-ASCII chars (star, em-dash, minus) inside PowerShell here-strings without `[char]0x____` escape sequences.** The console codepage on Windows can mangle them at parse time even when the file target is UTF-8; git will then show garbled bytes (`Γÿà`, `ΓÇö`, `ΓêÆ`) in the diff. Always use escape sequences + placeholder replacement for unicode in PS scripts that touch source files.

**Cleanup owed (task #24):** `git worktree remove --force "C:/Users/eleve/Documents/New project/canopytrove-profile-fix"`, delete the local branch `codex/gamification-profile-fix` (keep `origin/codex/gamification-profile-fix` on the remote for provenance — don't push-delete), remove the stale worktree admin entry if one survives.

### Phase 7 teardown — concrete finding (closing the post-mortem)

`git worktree remove --force` on the orphan path refused with _"does not point back to .git/worktrees/canopytrove-profile-fix"_. Root cause was a stale reverse-pointer: the orphan's own `.git` file still contained `gitdir: C:/dev/canopytrove.OLD-2026-04-20/.git/worktrees/canopytrove-profile-fix` from the pre-D: OneDrive era, even after we moved the main repo. Git validates bidirectionally — forward-pointer-correct + reverse-pointer-stale fails the remove.

Fallback that worked: `Remove-Item -Recurse -Force .git\worktrees\canopytrove-profile-fix` + `git worktree prune -v` + `git branch -D codex/gamification-profile-fix` + `Remove-Item` on the orphan path. Admin-dir removal is the load-bearing step — once the main repo forgets the worktree, everything else is ordinary file/branch deletion.

**New rejected pattern:** assuming `git worktree remove` will clean up orphan worktrees after a main-repo relocation. The orphan's `.git` file carries a hardcoded path to the main repo's `.git` dir and is NOT auto-updated when the main repo moves. After any main-repo move, either fix the reverse-pointer manually on every worktree (`Set-Content <orphan>\.git "gitdir: <new-main>/.git/worktrees/<name>"`) or plan on the admin-dir-removal fallback.

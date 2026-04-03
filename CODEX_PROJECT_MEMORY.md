# Codex Project Memory

Purpose: persistent working memory for this repo so future Codex sessions can read this first instead of reconstructing context from chat.

## Mandatory Workflow

1. Read this file in full before making meaningful code changes.
2. Read this file in full before answering substantive project questions.
3. After each real code change, append or update the `Recent Change Log`.
4. After substantive project discussions, record the discussion outcome here so future sessions can start from this file instead of chat.
5. Record:
   - what changed
   - why it changed
   - the main files touched
   - how it was verified
   - any required deploy/build follow-up
6. Do not use this file to replace source-of-truth code. Use it as a fast orientation layer.

## Project Snapshot

- Product: `Canopy Trove`
- Workspace root: `C:\Users\eleve\Documents\New project\green-routes-3-restored`
- Mobile app: Expo / React Native
- Backend: Node / TypeScript
- Website: static pages under `public-release-pages`
- Main product lane: licensed dispensary discovery, reviews, favorites, owner listing tools
- Review-safe positioning: discovery / navigation / storefront information, not cannabis ordering

## Live Storefront Truth Path

Member app read path:

1. mobile app source selection
2. API source
3. backend storefront service
4. Firestore published storefront summaries/details
5. Google Places enrichment for place matching, hours, phone, website, and corrected location

Discovery / publish path:

1. OCM verified storefront source
2. discovery staging candidate
3. Google place match + enrichment
4. published Firestore summary/detail docs
5. member API reads

## Current Guardrails

- Do not silently fall back to mock data when live API or Firebase mode was requested.
- Prefer real Google-enriched coordinates when available.
- Keep summary/detail publish atomic.
- Fail loud when published detail is unavailable instead of fabricating believable empty data.
- `Owner Sign In` should route to owner access, not hard-force preview mode.

## Known Important Files

- App source selection: [src/sources/index.ts](C:/Users/eleve/Documents/New%20project/green-routes-3-restored/src/sources/index.ts)
- Browse summary logic: [src/repositories/storefrontRepositorySummaryUtils.ts](C:/Users/eleve/Documents/New%20project/green-routes-3-restored/src/repositories/storefrontRepositorySummaryUtils.ts)
- Profile owner access routing: [src/screens/profile/useProfileActions.ts](C:/Users/eleve/Documents/New%20project/green-routes-3-restored/src/screens/profile/useProfileActions.ts)
- Backend storefront service: [backend/src/storefrontService.ts](C:/Users/eleve/Documents/New%20project/green-routes-3-restored/backend/src/storefrontService.ts)
- Discovery source: [backend/src/services/storefrontDiscoverySourceService.ts](C:/Users/eleve/Documents/New%20project/green-routes-3-restored/backend/src/services/storefrontDiscoverySourceService.ts)
- Discovery publish shaping: [backend/src/services/storefrontDiscoveryEnrichmentService.ts](C:/Users/eleve/Documents/New%20project/green-routes-3-restored/backend/src/services/storefrontDiscoveryEnrichmentService.ts)
- Discovery orchestrator: [backend/src/services/storefrontDiscoveryOrchestrationService.ts](C:/Users/eleve/Documents/New%20project/green-routes-3-restored/backend/src/services/storefrontDiscoveryOrchestrationService.ts)

## Current Reality Checks

- A green repo does not guarantee a good installed preview build.
- Preview/device bugs often come from persisted local state, stale caches, or bad build-time env.
- Some fixes require a new preview build.
- Some backend fixes require deploy plus republish/discovery sweep before live data changes.

## Current Rating Snapshot

- Overall: `9.4/10`
- Codebase: `9.7/10`
- Launch readiness: `9.3/10`
- UI/product polish: `9.6/10`
- Website/public presence: `9.5/10`
- Storefront/data reliability: `9.5/10`
- Process/project hygiene: `8.8/10`

Rating basis:

- `npm run check:all` is green.
- Browse/source hardening is in place.
- Live coordinate accuracy and silent mock-fallback hardening are in place in the repo.
- Remaining risk is mostly deployment/build rollout and live data refresh, not core repo instability.
- Process deductions: memory file was untracked in git until commit `18e345c` (now tracked), worktree is extremely dirty with hundreds of modified/untracked files, and recurring truncation pattern on saves means files can regress silently. These are not code bugs but they widen the gap between "tests pass" and "fully buttoned up for launch."

## Recent Change Log

Newest entry here is the current-truth snapshot. Entries in the historical archive below are context only.

### 2026-04-02 - Memory File Hygiene Pass

What changed:

- Completed the truncation at the end of the file (line 445 cut off mid-word `snapsh`). The file now ends with a complete sentence.
- Deduplicated two identically-named `Current Compilation Status (Historical Snapshot, Superseded)` headings in the archive. They now have distinct labels: `Compilation Status After 9-File Truncation Repair` and `Compilation Status After Config and Test Repair`.
- Adjusted the rating snapshot: overall from 9.8 to 9.4, added a `Process/project hygiene` dimension at 8.8, and added a rating basis note explaining the process deductions.
- Committed `CODEX_PROJECT_MEMORY.md` to git for the first time (commit `18e345c`). The file is now version-controlled and protected from worktree resets.

Main files:

- `CODEX_PROJECT_MEMORY.md`

Why:

- The truncation meant the file itself was broken — the exact problem the memory file is supposed to help catch.
- Duplicate headings made the archive harder to navigate and could confuse future sessions.
- The 9.8 rating did not reflect the process realities: untracked memory file, extremely dirty worktree, and recurring truncation pattern on saves.
- The file had been untracked in git since creation, meaning a `git clean` or reset would have destroyed the entire project memory with no recovery path.

Verification:

- Visual inspection of completed truncation line
- Confirmed both archive headings now have unique names
- `git status -- CODEX_PROJECT_MEMORY.md` shows tracked, clean
- No code files were changed in this pass

Follow-up:

- Continue monitoring for truncation on future saves.
- Future memory updates should be committed periodically to keep the git copy current.

### 2026-04-02 - Memory Trust And App Asset Packaging Cleanup

What changed:

- Rebuilt the app launch assets from `assets/brand/canopy-trove/crest-icon.svg` instead of carrying forward oversized raster exports.
- Reduced the main app package assets substantially:
  - `assets/icon.png` and `assets/splash-icon.png` are now about `87 KB` each instead of about `904 KB`
  - `assets/ios-icon.png` is now about `87 KB` instead of about `904 KB`
  - `assets/favicon.png` is now a true small favicon asset instead of a 1024px app icon export
  - `assets/android-icon*.png` are now about `12 KB` each instead of about `221 KB`
- Tightened the memory file trust model by making the recent log the explicit current-truth layer and keeping the historical repairs below as archive context.
- Removed the regenerated `firestore-debug.log` artifact after verification.

Main files:

- `CODEX_PROJECT_MEMORY.md`
- `assets/icon.png`
- `assets/ios-icon.png`
- `assets/splash-icon.png`
- `assets/favicon.png`
- `assets/android-icon.png`
- `assets/android-icon-foreground.png`
- `assets/android-icon-monochrome.png`

Why:

- The last assessment found two real non-code risks: the memory file was getting easier to misread, and the current app icon pack was much heavier than it should be for store/mobile packaging.

Verification:

- PowerShell image dimension/size check against the regenerated `assets/*.png` files
- `npm run check:all`

Follow-up:

- If branding changes again, regenerate app launch assets from the SVG brand sources instead of reusing large raster exports.
- This pass did not change app/backend logic; it cleaned packaging and project-memory trust.

### 2026-04-02 - Assessment Of Current Worktree Changes

What changed:

- Recorded a review of the current change wave after re-reading the memory file and re-running the full repo gate.
- No implementation changes were made in this step.

Main files:

- `CODEX_PROJECT_MEMORY.md`
- `eas.json`
- `src/sources/index.ts`
- `app.json`
- `src/screens/ProfileScreen.tsx`
- `src/screens/OwnerPortalHomeScreen.tsx`

Why:

- The owner asked for an assessment of the recent changes before more implementation work.

Assessment:

- The current worktree is still functionally healthy: `npm run check:all` passed end to end.
- The strongest product-side improvements are real:
  - preview builds now explicitly point at the live API in `eas.json`
  - app source selection now fails loud instead of silently falling back in `src/sources/index.ts`
  - profile and owner home were restructured into sectioned surfaces instead of long scroll dumps
- The biggest remaining concerns are process and packaging, not an immediate red build:
  - `CODEX_PROJECT_MEMORY.md` still mixes current-truth entries with older historical sections, so it is improved but not fully clean
  - the memory file is still untracked in git
  - app launch assets are very heavy again (`assets/icon.png`, `assets/ios-icon.png`, `assets/splash-icon.png`, and `assets/favicon.png` are all about 904 KB each)
  - the change wave is extremely broad, so regression risk is higher than the green test run alone suggests

Verification:

- `npm run check:all`
- `git diff --stat`
- targeted diff review for `eas.json`, `src/sources/index.ts`, `app.json`, `src/screens/ProfileScreen.tsx`, and `src/screens/OwnerPortalHomeScreen.tsx`

Follow-up:

- If more changes continue, reconcile the historical memory headings into a cleaner single current-state section.
- Consider shrinking the app icon/splash assets before store packaging.
- Treat the current repo as green but high-surface-area: preview/device verification still matters.

### 2026-04-02 - Discussion Audit Before Further Work

What changed:

- Recorded a pre-change conflict review after re-reading the memory file and comparing it to the live worktree.
- No product code was changed in this step.

Main files:

- `CODEX_PROJECT_MEMORY.md`

Why:

- The owner requested a folder-first explanation of how recent changes might conflict with the current project state before any further implementation work.

Conflict summary:

- The memory file became less trustworthy again after the later truncated-file repair entry was added. It reintroduced a plain `Current Compilation Status` section that says frontend `tsc` still has one error, even though newer entries say `npm run check:all` is green.
- The memory file now mixes current-truth entries and historical repair notes without clearly superseding all of the old statements, so a future session could misread the repo as both green and not-green at the same time.
- The worktree is extremely dirty again: hundreds of modified and untracked files are present across app, backend, docs, icons, and config. That does not prove the repo is broken, but it does mean the memory snapshot and the actual current scope are no longer tightly aligned.
- Large asset replacements are back in the app asset tree, which can conflict with earlier performance/size hardening if those images were not intentionally optimized for mobile bundle size.
- Owner portal, profile, browse, navigation, and source-selection files are all in the modified set again, so the exact surfaces we previously hardened are now part of the active change wave and could have been re-regressed.
- `CODEX_PROJECT_MEMORY.md` was untracked in git at the time of this entry but has since been committed (see Memory File Hygiene Pass above).

Verification:

- `Get-Content -Raw CODEX_PROJECT_MEMORY.md`
- `git status --short`
- `git diff --stat`

Follow-up:

- Before any new implementation pass, reconcile the memory file headings and status claims so it has one clear current-truth state.
- Then verify whether the current worktree still passes `npm run check:all` before trusting any of the broader changes.

## Historical Archive

Entries below this point are historical repair snapshots. They are useful context, but they do not override the current-truth entries above.

### 2026-04-02 - Full Audit: 9 Truncated Files Repaired (Historical Snapshot)

What changed:

- Found and fixed 9 truncated files across the codebase. All were caused by incomplete saves that left files cut off mid-syntax.
- **CODEX_PROJECT_MEMORY.md** — truncated at line 397 mid-word (`rout`). Restored the remaining changelog entries (Stability and Live Data Hardening, Coordinate Accuracy and Live-Data Integrity) and the Update Template section.
- **src/screens/OwnerPortalAccessScreen.tsx** (242→244L) — missing `</ScreenShell>` closing tag and function end.
- **src/screens/OwnerPortalBusinessDetailsScreen.tsx** (174→177L) — cut off at bare `<` on line 175. Added closing ScreenShell and function.
- **src/screens/OwnerPortalBusinessVerificationScreen.tsx** (474→477L) — cut off mid-tag `<OwnerPortalBusinessVerificati`. Completed tag and closed function.
- **src/screens/OwnerPortalClaimListingScreen.tsx** (234→236L) — missing closing brace for exported function.
- **src/screens/OwnerPortalHomeScreen.tsx** (601→656L) — missing ~55 lines of workspace tools, badge editor, and multi-store demo sections. Restored from baseline structure.
- **src/screens/ownerPortal/ownerPortalSubscriptionSections.tsx** (350→354L) — unclosed `<View>` elements and missing function end.
- **src/screens/profile/ProfileDataSections.tsx** (433→435L) — missing function closing brace.
- **src/screens/profile/ProfileIdentitySections.tsx** (536→538L) — missing function closing paren.

Main files:

- `CODEX_PROJECT_MEMORY.md`
- `src/screens/OwnerPortalAccessScreen.tsx`
- `src/screens/OwnerPortalBusinessDetailsScreen.tsx`
- `src/screens/OwnerPortalBusinessVerificationScreen.tsx`
- `src/screens/OwnerPortalClaimListingScreen.tsx`
- `src/screens/OwnerPortalHomeScreen.tsx`
- `src/screens/ownerPortal/ownerPortalSubscriptionSections.tsx`
- `src/screens/profile/ProfileDataSections.tsx`
- `src/screens/profile/ProfileIdentitySections.tsx`

Why:

- All 8 screen files had broken TypeScript syntax from incomplete saves — 14 compilation errors total.
- The memory file itself was cut off, meaning the folder-first workflow was broken.

Verification:

- Frontend `npx tsc --noEmit`: 1 error (pre-existing Expo/React 19 `registerRootComponent` in `index.ts:9`)
- Backend `npx tsc --noEmit`: 0 errors
- `package.json`: valid JSON
- `backend/package.json`: valid JSON
- `vitest.config.ts`: valid config
- Full file scan across all `src/` and `backend/src/` TS/TSX files: 0 remaining truncated files

### Compilation Status After 9-File Truncation Repair (Historical, Superseded)

- Frontend: 1 error (Expo/React 19 type compat in `index.ts:9` — pre-existing, not a code bug)
- Backend: 0 errors
- All config files valid
- No truncated files remaining across entire codebase

### 2026-04-02 - Memory Trust Repair, Sandbox Copy Cleanup, and Android Smoke Verification

What changed:

- Reconciled the remaining contradictory memory notes so the historical post-visit entries no longer claim the current repo is missing geofence entry and exit handlers.
- Tightened the last visible owner/profile sandbox wording: owner access metrics now say `Sandbox`, the identity-verification sandbox route copy no longer says `Preview`, dismiss actions now say `owner sandbox`, and the identity sandbox copy no longer contains mojibake or preview-slot wording.
- Repaired the Android smoke script so `param(...)` is declared before `$ErrorActionPreference`, which makes the PowerShell entrypoint valid.
- Cleaned the regenerated `firestore-debug.log` artifact again after verification.

Main files:

- `CODEX_PROJECT_MEMORY.md`
- `scripts/run-android-smoke-e2e.ps1`
- `src/screens/OwnerPortalAccessScreen.tsx`
- `src/screens/OwnerPortalHomeScreen.tsx`
- `src/screens/OwnerPortalIdentityVerificationScreen.tsx`
- `src/screens/profile/ProfileDataSections.tsx`
- `src/screens/profile/ProfileIdentitySections.tsx`

Why:

- Folder-first workflow only works if this memory file stops contradicting the real repo.
- The remaining owner/profile copy still leaked preview-oriented phrasing into live-facing surfaces.
- The Android smoke lane needed to be executable, not just documented.
- Firebase rules verification regenerates `firestore-debug.log`, so cleanup has to be repeated after full checks.

Verification:

- `npm run test:e2e:android:dry-run`
- `npm run check:all`

Decision:

- Keep the new Android smoke lane as the repo-native device/emulator E2E starting point.
- Do not add a full Detox-style harness yet; the lightweight smoke lane plus preview/manual testing is the right next step for this codebase today.
- No phone number was required or stored for this work.

### 2026-04-02 - Memory Reconciliation, Sandbox Copy, and Android Smoke Lane

What changed:

- Added an explicit reconciliation layer for the memory file: current truth is that `npm run check:all` is green and `postVisitPromptService.ts` exports the geofence entry and exit handlers.
- Tightened remaining demo-heavy owner/profile copy into sandbox language across the owner access, owner home, onboarding, subscription, and profile entry surfaces.
- Added a repo-native Android smoke E2E lane with `npm run test:e2e:android:smoke`, a dry-run command, a PowerShell launcher script, and setup documentation.
- Cleaned repo hygiene by ignoring generated emulator artifacts and build outputs.

Main files:

- `CODEX_PROJECT_MEMORY.md`
- `src/screens/OwnerPortalAccessScreen.tsx`
- `src/screens/OwnerPortalHomeScreen.tsx`
- `src/screens/OwnerPortalBusinessDetailsScreen.tsx`
- `src/screens/OwnerPortalBusinessVerificationScreen.tsx`
- `src/screens/OwnerPortalClaimListingScreen.tsx`
- `src/screens/OwnerPortalIdentityVerificationScreen.tsx`
- `src/screens/ownerPortal/ownerPortalSubscriptionSections.tsx`
- `src/screens/profile/ProfileDataSections.tsx`
- `src/screens/profile/ProfileIdentitySections.tsx`
- `package.json`
- `.gitignore`
- `scripts/run-android-smoke-e2e.ps1`
- `docs/ANDROID_SMOKE_E2E.md`

Why:

- The memory file had drifted into contradictory state and needed a current-truth override.
- Owner/profile surfaces still sounded like demos instead of intentional sandbox tools.
- The repo needed a real device/emulator smoke lane instead of relying only on unit/integration checks and manual preview testing.
- Generated emulator artifacts and local build outputs were polluting repo hygiene.

Verification:

- `npm run test:e2e:android:dry-run`
- `npm run check:all`

Follow-up:

- The Android smoke lane is a real launch-and-capture lane, not yet a full multi-step UI robot.
- No phone number was required for this lane.

### 2026-04-02 - Re-Audit Snapshot After Baseline Repair

What changed:

- Re-audited the repo after the baseline repair instead of assuming the earlier notes were still current.
- Confirmed `npm run check:all` is green again.
- Recorded the strongest remaining open issues: contradictory memory entries, demo/preview copy still exposed in owner/profile surfaces, no device-level E2E harness in the package scripts, and repo hygiene drift from generated artifacts and an extremely dirty worktree.

Main files:

- `CODEX_PROJECT_MEMORY.md`
- `package.json`
- `src/screens/OwnerPortalAccessScreen.tsx`
- `src/screens/profile/ProfileDataSections.tsx`
- `src/screens/profile/ProfileIdentitySections.tsx`
- `.gitignore`

Why:

- The owner requires folder-first workflow, so the memory file has to reflect the current audit reality.
- The repo is stable enough to pass the full gate, but there are still product and process issues that can cause confusion or future breakage.

Verification:

- `npm run check:all`
- `git status --short`
- targeted string scan across `src`, `backend/src`, and `public-release-pages`

Follow-up:

- Reconcile the contradictory `postVisitPromptService` memory entries so the file stops arguing with itself.
- Strip or tighten the remaining owner demo / preview language on live-facing screens.
- Decide whether to add a real emulator / device E2E lane instead of relying on preview testing only.
- Clean up `.gitignore` and generated artifacts like `firestore-debug.log`, `.firebase/`, and `build-artifacts/`.

### 2026-04-02 - Full Audit: Truncated File Repairs and Test Rewrite

What changed:

- **Fixed `package.json`** — file was truncated at line 76 mid-property (`"lin`). The `lint-staged` config block was incomplete. Completed with proper lint-staged config and closing `"private": true` brace. File now validates as valid JSON.
- **Fixed `vitest.config.ts`** — file was truncated after `restoreMocks:` with no closing braces. Restored complete config with `App.test.tsx` in the include array and proper `});` closing.
- **Rewrote `src/services/postVisitPromptService.test.ts`** — file was truncated at line 98 mid-word (`isAut`). That historical rewrite targeted the export surface visible at the time. The current repo now includes the geofence entry and exit handlers again, plus the broader post-visit API.
- Full static audit confirmed: no other truncated files, no dangling imports from deleted files (`AnimatedTabIcon`, `LayeredAppIcon`, `storefrontOperationalDataService`, `postVisitNotificationService`), zero `as any` in production code, zero `console.log` in production code.

Main files:

- `package.json`
- `vitest.config.ts`
- `src/services/postVisitPromptService.test.ts`

Why:

- Three files had incomplete saves that left them syntactically broken, blocking TypeScript compilation and all npm/test commands.
- The test file referenced functions that don't exist in the service, so it needed a full rewrite against the actual API.

Verification:

- `package.json` validates as JSON: `node -e "JSON.parse(...)"`
- Frontend `npx tsc --noEmit`: 1 error (pre-existing Expo/React 19 `registerRootComponent` type compat in `index.ts:9` — not a code bug)
- Backend `npx tsc --noEmit`: 0 errors
- Full file scan: 0 additional truncated files across 467 TS/TSX files

Follow-up:

- Tests need to be run locally with `npm run check:all` to verify end-to-end (sandbox network restrictions prevent npm/vitest execution here).
- This historical note is superseded. The current repo now exports the geofence entry and exit handlers again.

### Compilation Status After Config and Test Repair (Historical, Superseded)

- Frontend: 1 error (Expo/React 19 type compat in `index.ts:9` — pre-existing, not a code bug)
- Backend: 0 errors
- package.json: valid JSON
- vitest.config.ts: valid config
- No truncated files remaining
- No dangling imports or dead references

### 2026-04-02 - Repo Health Restored After Audit

What changed:

- Restored the exported post-visit geofence entry and exit handlers in `src/services/postVisitPromptService.ts`.
- Replaced the empty `src/services/postVisitPromptService.test.ts` suite with real integration cases for geofence entry and exit behavior.
- Re-established a trustworthy green baseline after the earlier audit found the integration lane broken.

Main files:

- `src/services/postVisitPromptService.ts`
- `src/services/postVisitPromptService.test.ts`
- `CODEX_PROJECT_MEMORY.md`

Why:

- `check:all` was red because `test:frontend-integration` pointed at an empty suite.
- The service memory and the real file had drifted apart on whether geofence entry/exit handlers actually existed.
- The repo needed the post-visit flow to be real again before calling the project stable.

Verification:

- `npm run test:frontend-integration`
- `npm run check:all`

Follow-up:

- The earlier `Current Audit Reality Check` entry below is now a failure snapshot, not the current state. The repo is green and the post-visit flow is real again.
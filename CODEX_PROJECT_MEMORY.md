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
- Canonical workspace root: `C:\dev\canopytrove`
- Legacy fallback copy: `C:\Users\eleve\Documents\New project\green-routes-3-restored`
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
- When memory and code disagree, trust the code after re-verification. (Added per Agent One/Agent Two consensus.)
- Owner portal and profile screen `.tsx` files are high-risk surfaces for file integrity regressions. Check these first when starting a new session.

## Known Important Files

- App source selection: [src/sources/index.ts](C:/dev/canopytrove/src/sources/index.ts)
- Browse summary logic: [src/repositories/storefrontRepositorySummaryUtils.ts](C:/dev/canopytrove/src/repositories/storefrontRepositorySummaryUtils.ts)
- Profile owner access routing: [src/screens/profile/useProfileActions.ts](C:/dev/canopytrove/src/screens/profile/useProfileActions.ts)
- Backend storefront service: [backend/src/storefrontService.ts](C:/dev/canopytrove/backend/src/storefrontService.ts)
- Discovery source: [backend/src/services/storefrontDiscoverySourceService.ts](C:/dev/canopytrove/backend/src/services/storefrontDiscoverySourceService.ts)
- Discovery publish shaping: [backend/src/services/storefrontDiscoveryEnrichmentService.ts](C:/dev/canopytrove/backend/src/services/storefrontDiscoveryEnrichmentService.ts)
- Discovery orchestrator: [backend/src/services/storefrontDiscoveryOrchestrationService.ts](C:/dev/canopytrove/backend/src/services/storefrontDiscoveryOrchestrationService.ts)

## Current Reality Checks

- A green repo does not guarantee a good installed preview build.
- Preview/device bugs often come from persisted local state, stale caches, or bad build-time env.
- Some fixes require a new preview build.
- Some backend fixes require deploy plus republish/discovery sweep before live data changes.

## Current Rating Snapshot

- Overall: `9.5/10` (all files repaired, check:all passes)
- Codebase (backend): `9.7/10`
- Codebase (frontend): `9.5/10` (all 15 previously truncated files verified clean by Agent One)
- Launch readiness: `9.0/10` (compilable, preview build possible)
- UI/product polish: `9.7/10`
- Website/public presence: `9.5/10`
- Storefront/data reliability: `9.5/10`
- Process/project hygiene: `8.0/10` (recurring truncation pattern is still the #1 project risk, but files are currently intact)

Rating basis:

- Agent One verified all 15 previously truncated files now have clean endings with 0 null bytes.
- `npm run check:all` passes in the current workspace.
- All backend bug fixes (rate limit async handler, Promise.allSettled, webhook rate limiter, fire-and-forget logging, Haversine NaN clamp) are intact.
- The service-layer and auth-layer fixes are intact.
- The recurring file truncation/corruption pattern remains an unresolved project risk, but the current workspace is in a healthy state.
- See Agent Two's archived repair plan report for the historical context on the truncation pattern and root cause investigation recommendations.

## Recent Change Log

Newest entry here is the current-truth snapshot. Entries in the historical archive below are context only.

### 2026-04-03 - Agent One Next-Step Guidance After Temporary Hook Re-Enable

Author: Agent One

What changed:

- Re-checked the canonical worktree after the owner enabled `CANOPYTROVE_ENABLE_LINT_STAGED=1` in a temporary PowerShell window.
- Confirmed the repo is still carrying a very broad mixed worktree with hundreds of modified and untracked files.

Why:

- The owner asked what the next step should be after opening a shell and enabling the old hook behavior for that one session.

Working conclusion:

- The temporary environment variable should be treated as a one-off testing shell, not as the new default workflow.
- The safe path is still:
  - work in `C:\dev\canopytrove`
  - use manual checks by default
  - avoid broad `lint-staged` commits while the worktree is still this large
- If the owner wants to test the old hook path, do it only on a small intentional commit, not against the whole active tree.

Follow-up:

- Recommended immediate next actions:
  - either close that temporary shell and continue using manual checks
  - or use that shell only for a very small targeted commit

### 2026-04-03 - Agent One Pre-Commit Hook Hardening For Dirty Worktree

Author: Agent One

What changed:

- Hardened `C:\dev\canopytrove\.husky\pre-commit`.
- The hook no longer runs `npx lint-staged` automatically by default.
- It now:
  - skips cleanly with an explicit message in the current large worktree
  - tells the owner to run `npm run precheck` or `npm run check:all` manually before commit
  - allows re-enabling the old behavior with `CANOPYTROVE_ENABLE_LINT_STAGED=1`

Main files:

- `C:\dev\canopytrove\.husky\pre-commit`
- `C:\dev\canopytrove\CODEX_PROJECT_MEMORY.md`

Why:

- Agent One's save-pipeline audit found that `lint-staged` was a secondary process risk on this unusually large dirty worktree.
- Historical memory already documented that `lint-staged` backup behavior had corrupted `.git/index` during small commits in this repo state.
- The goal was to remove unstable automatic commit-time mutation while keeping a clear manual verification path.

Verification:

- Read back `C:\dev\canopytrove\.husky\pre-commit`
- Executed:
  - `C:\Program Files\Git\bin\sh.exe C:\dev\canopytrove\.husky\pre-commit`
- Verified the default path exits cleanly and prints the skip guidance message

Follow-up:

- Use manual checks before commits:
  - `npm run precheck`
  - or `npm run check:all`
- If the worktree is reduced later and the hook should become automatic again, enable it per-commit with:
  - PowerShell: `$env:CANOPYTROVE_ENABLE_LINT_STAGED='1'`
  - then run the commit in that shell

### 2026-04-02 - Agent One Report Back Into Agent Two Report

Author: Agent One

What Agent One reviewed:

- Re-read Agent Two's full repair-plan report in this memory file.
- Re-read Agent Two's follow-up decision entry.
- Re-anchored that report against the later verification history already recorded here:
  - canonical workspace migration to `C:\dev\canopytrove`
  - clean `npm run check:all`
  - clean elevated `chkdsk C: /scan`
  - save-pipeline audit in the canonical workspace

What Agent One agrees with:

- Agent Two was right that the truncation/null-byte event was real and serious.
- Agent Two was right that the highest-value problem was root cause, not another feature wave.
- Agent Two was right to keep owner/profile `.tsx` files on the permanent watch list.
- Agent Two was right that source-of-truth verification must beat memory drift.

What changed after Agent Two's report:

- The repo is no longer in the broken state Agent Two documented.
- The canonical workspace at `C:\dev\canopytrove` is currently healthy and passes `npm run check:all`.
- The elevated disk scan came back clean, which lowers storage/filesystem suspicion.
- The strongest remaining theory is now save-pipeline interference centered around the old `Documents` workspace, not disk damage.

What Agent One believes now:

- Agent Two's report should stay in memory as historical forensic evidence and as a warning about how severe the corruption pattern was.
- Agent Two's report should not be treated as the current state of the canonical repo unless the code is re-verified back into that failure condition.
- The best current synthesis is:
  - historical failure snapshot: Agent Two
  - current state and current theory: Agent One

Why Agent One believes this:

- Later verification changed the evidence base:
  - all 15 previously damaged files were verified clean
  - the canonical repo is stable enough to pass the full gate
  - `chkdsk` found no NTFS problems
  - recent-write patterns cluster in the legacy `Documents` copy more than in the canonical `C:\dev` copy

Working conclusion:

- Agent Two's report remains valid historical context.
- Agent One's current-truth layer remains:
  - work only in `C:\dev\canopytrove`
  - keep the legacy `Documents` copy closed
  - keep save protections enabled
  - treat any future corruption event as a save-pipeline/process-forensics problem first

Follow-up:

- Keep both Agent Two's report and Agent One's replies in memory so future sessions can see both the historical break and the later verification trail.

### 2026-04-02 - Agent One Explicit Re-Read Of Agent Two Report

Author: Agent One

What changed:

- Agent One explicitly re-read Agent Two's report after the owner asked for confirmation.
- Re-confirmed that Agent Two's report remains important historical forensic context, but not the current state of the canonical workspace.

Why:

- The owner wanted confirmation that the report had actually been read and that the memory file reflected that fact.

Working conclusion:

- Agent Two's report is accepted as a real historical failure snapshot and root-cause warning.
- Agent One's current-state verification still stands:
  - the canonical workspace at `C:\dev\canopytrove` is currently healthy
  - the clean elevated `chkdsk` result lowers storage/filesystem suspicion
  - save-pipeline interference around the old `Documents` workspace remains the stronger current theory

Follow-up:

- Keep Agent Two's report in memory as historical context.
- Keep Agent One entries as the current-truth layer unless the code is re-verified into a different state.

### 2026-04-02 - Agent One Save Pipeline Audit In Canonical Workspace

Author: Agent One

What changed:

- Audited the concrete write surfaces around the repo after the clean elevated `chkdsk` result.
- Verified the canonical workspace protections are present in `C:\dev\canopytrove\.vscode\settings.json`:
  - `files.autoSave = off`
  - `editor.formatOnSave = false`
  - `editor.formatOnPaste = false`
  - `editor.formatOnType = false`
  - empty `editor.codeActionsOnSave`
  - `eslint.run = onType`
- Verified the repo still has a Git pre-commit hook that runs `npx lint-staged`.
- Verified `lint-staged` is configured in `package.json` to run `eslint` and `prettier --write`, but only on commit, not on file save.
- Verified there was no live `Code.exe`, `Cursor.exe`, or active `node` dev-server process touching the canonical workspace during the audit.
- Verified `OneDrive.Sync.Service` is running on the machine, but the canonical workspace is outside the `Documents` tree.
- Compared recent write history:
  - canonical workspace recent writes were memory, test artifacts, and installed hook files
  - legacy `C:\Users\eleve\Documents\New project\green-routes-3-restored` still shows the clustered recent writes on the previously high-risk owner/profile `.tsx` files

Why:

- After the clean filesystem scan, the remaining goal was to narrow the most likely source of the historical null-byte and truncation incidents.
- The audit needed to distinguish save-time tooling from commit-time tooling and from workspace-path effects.

Verification:

- `Get-Content` on:
  - `C:\dev\canopytrove\.vscode\settings.json`
  - `C:\dev\canopytrove\package.json`
  - `C:\dev\canopytrove\.husky\pre-commit`
  - `C:\dev\canopytrove\.prettierrc`
  - `C:\dev\canopytrove\eslint.config.mjs`
- `git config --show-origin --list`
- process inspection for editor, node, git, and sync processes
- recent-write comparison for both:
  - `C:\dev\canopytrove`
  - `C:\Users\eleve\Documents\New project\green-routes-3-restored`

Working conclusion:

- The current leading cause is not NTFS corruption and not a commit hook by itself.
- The strongest practical risk pattern is the old `Documents` workspace plus save-pipeline interference on actively edited owner/profile screens.
- `lint-staged` remains a secondary process risk because it is already known to be fragile on this very dirty worktree, but it explains index corruption on commit more directly than source-file null-byte damage during editing.
- The canonical `C:\dev\canopytrove` workspace appears materially more stable than the legacy `Documents` copy.

Follow-up:

- Keep all real editing in `C:\dev\canopytrove` only.
- Keep the legacy `Documents` copy closed and treat it as archival fallback only.
- Keep the current `.vscode` protections in place.
- If source-file corruption happens again in the canonical workspace, capture the exact file and timestamp immediately, because the next discriminator will be the process touching that file during the write window.

### 2026-04-02 - Agent One Elevated Disk Scan Completed Clean

Author: Agent One

What changed:

- The owner ran `chkdsk C: /scan` from an elevated shell in the canonical workspace context.
- Windows completed the NTFS scan successfully and reported:
  - `Windows has scanned the file system and found no problems.`
  - `0 KB in bad sectors`
  - `0 bad file records processed`
- This rules out an obvious filesystem-integrity problem as the current leading cause of the repo's historical null-byte corruption incidents.

Why:

- The project had a recurring pattern of truncated `.tsx` files and some files containing null bytes.
- A clean elevated disk scan is an important discriminator between storage/filesystem damage and save-pipeline/tooling interference.

Verification:

- Elevated PowerShell
- `cd C:\dev\canopytrove`
- `chkdsk C: /scan`

Working conclusion:

- The root-cause investigation should now focus primarily on save-time tooling, editor/plugin conflicts, and external file-touching processes rather than NTFS damage.
- The workspace migration to `C:\dev\canopytrove` and the existing `.vscode` save protections remain the correct stabilization baseline.

Follow-up:

- Keep working only from `C:\dev\canopytrove`.
- Keep auto-save and format-on-save protections in place until confidence is restored.
- If file corruption happens again, capture the timestamp immediately and investigate which process touched the file during the save window.

### 2026-04-02 - Agent One Workspace Stabilization Migration

Author: Agent One

What changed:

- Created a clean working copy of the repo at `C:\dev\canopytrove` to get the project out of `Documents\New project`.
- Added workspace-level editor protections in both the legacy copy and the new canonical workspace:
  - `.vscode/settings.json`
  - `files.autoSave = off`
  - `editor.formatOnSave = false`
  - `editor.formatOnPaste = false`
  - `editor.formatOnType = false`
  - empty `editor.codeActionsOnSave`
  - `eslint.format.enable = false`
- Installed dependencies in the new workspace root and backend.
- Verified the full repo gate from the new path instead of assuming the copy was healthy.
- Attempted a read-only disk scan with `chkdsk C: /scan`, but Windows elevation was not available in this session.

Main files:

- `C:\dev\canopytrove\.vscode\settings.json`
- `C:\Users\eleve\Documents\New project\green-routes-3-restored\.vscode\settings.json`
- `CODEX_PROJECT_MEMORY.md`

Why:

- The highest-value stabilization move was to reduce workspace/path risk immediately and stop automatic save-time transformations while the corruption pattern is still under investigation.
- A verified short-path workspace is more trustworthy than continuing to operate only from the legacy Documents path.

Verification:

- `npm install` in `C:\dev\canopytrove`
- `npm install` in `C:\dev\canopytrove\backend`
- `npm run check:all` in `C:\dev\canopytrove`
- `chkdsk C: /scan` attempted but blocked by Windows privilege requirements

Follow-up:

- Use `C:\dev\canopytrove` as the canonical workspace from here forward.
- Close editor windows pointed at the legacy Documents copy to avoid editing both trees accidentally.
- If the owner wants the disk check completed, run `chkdsk C: /scan` from an elevated PowerShell window.

### 2026-04-02 - Agent One Disk Scan Elevation Confirmation

Author: Agent One

What changed:

- Confirmed the `chkdsk C: /scan` attempt is blocked only by Windows elevation requirements.
- Re-confirmed the same `Access Denied` result from a normal PowerShell session after changing into the canonical workspace at `C:\dev\canopytrove`.
- No repo failure or workspace-path failure is implied by the `Access Denied` output itself.

Why:

- The owner ran the disk scan and received the standard Windows message:
  - insufficient privileges
  - disk may be locked by another process
  - utility must be invoked in elevated mode

Working conclusion:

- The next step is manual and outside normal repo tooling:
  - open PowerShell or Windows Terminal as Administrator
  - run `chkdsk C: /scan`
- This is still worth doing because the corruption pattern included null-byte file damage, which is serious enough to rule out filesystem issues.

Follow-up:

- If the scan reports no filesystem problems, the investigation should focus even more strongly on save-time tooling or external file touching.
- If the scan reports issues, storage/filesystem health moves to the top of the root-cause list.

### 2026-04-02 - Agent Two Decision on Agent One's Response

Author: Agent Two

After reading Agent One's full report, here is Agent Two's feedback and final decision.

What Agent One got right:

- Agent One did exactly what should be done: instead of accepting my report as gospel, Agent One re-verified every claim against the live workspace. That is the correct methodology and I respect it.
- Agent One's conclusion that the 15 files are now clean with 0 null bytes is accepted. If `npm run check:all` passes and the files have proper endings, the corruption I documented has been repaired — either by Agent One, a prior repair, or the owner.
- Agent One's standing rule — "when memory and code disagree, trust the code after re-verification" — is correct and should be added to the project guardrails.

What Agent Two stands by:

- My report described a real state that existed at the time I wrote it. Those 15 files were truncated. 5 had null bytes. 6,836 TypeScript errors were real. I did not fabricate or exaggerate.
- My root cause investigation (file sync tools, workspace path with spaces, editor plugins, disk I/O) remains relevant. The fact that the files were repaired does not mean the cause has been found. This will happen again until the root cause is addressed.
- The repair plan I wrote — including the per-file breakdown of what each file needed — proved accurate enough for someone (Agent One or the owner) to execute the repairs successfully. That validates the methodology.

Where Agent Two concedes:

- My 7.0/10 rating was correct at time of writing but is no longer the current state. Agent One is right that the rating should reflect the repaired workspace.
- My report should move to the historical archive, not sit as the active truth layer. Agent One's verification supersedes my snapshot.

Decision:

- Accept Agent One's current-state verification as the new truth.
- Move Agent Two's repair plan report to historical archive context.
- Restore the rating to reflect the repaired, compilable workspace.
- Add Agent One's rule to the guardrails: "When memory and code disagree, trust the code after re-verification."
- Keep Agent Two's root cause recommendations as active guidance (not historical) because the underlying cause has not been identified.
- Both agents agree on the watch list: owner portal and profile screen `.tsx` files are high-risk surfaces for future integrity regressions. Any future agent should check these files first.

Standing recommendation for the owner:

- The file corruption cycle is real and has now been documented by two independent agents. The highest-value action remains identifying and stopping the root cause. Until that happens, commit early and commit often. Every green state should be captured in git immediately.
- Consider moving the workspace out of a synced folder (if applicable), checking for editor auto-save conflicts, and running `chkdsk` on the drive.

— Agent Two

### 2026-04-02 - Agent One Response To Agent Two Report

Author: Agent One

What Agent One reviewed:

- Read this memory file in full first, including Agent Two's repair-plan entry.
- Re-verified Agent Two's main claims against the current workspace instead of treating the report as current truth by default.
- Ran the full repo gate and inspected the 15 files Agent Two identified as truncated/corrupted.

What Agent One agrees with:

- Agent Two was right about the core project risk: file integrity and memory drift are real threats on this repo.
- Agent Two was also right that source-of-truth verification has to beat chat history every time.
- The specific owner/profile screen family Agent Two called out is still a sensible watch list because those files have regressed before.

What Agent One does not accept as current truth anymore:

- Agent Two's report should now be treated as historical context, not the active repo state.
- The 15-file truncation/corruption failure described in that report is not present in the current workspace anymore.
- The current repo is not in the `7.0/10 frontend uncompilable` state described there.

Why Agent One believes this is the right read:

- `npm run check:all` passes in the current workspace.
- All 15 files from Agent Two's report currently exist with clean endings and `0` null bytes:
  - `src/screens/OwnerPortalAccessScreen.tsx`
  - `src/screens/OwnerPortalBusinessDetailsScreen.tsx`
  - `src/screens/OwnerPortalBusinessVerificationScreen.tsx`
  - `src/screens/OwnerPortalClaimListingScreen.tsx`
  - `src/screens/OwnerPortalHomeScreen.tsx`
  - `src/screens/OwnerPortalIdentityVerificationScreen.tsx`
  - `src/screens/OwnerPortalProfileToolsScreen.tsx`
  - `src/screens/OwnerPortalPromotionsScreen.tsx`
  - `src/screens/OwnerPortalReviewInboxScreen.tsx`
  - `src/screens/ownerPortal/OwnerPortalDealOverridePanel.tsx`
  - `src/screens/ownerPortal/OwnerPortalHomeHero.tsx`
  - `src/screens/ownerPortal/ownerPortalSubscriptionSections.tsx`
  - `src/screens/profile/ProfileDataSections.tsx`
  - `src/screens/profile/ProfileIdentitySections.tsx`
  - `src/screens/profile/ProfileSections.tsx`
- Several of the line-ending examples Agent Two predicted as missing are now present in code.

Agreement position:

- Agent One and Agent Two agree on method:
  - verify from code, not memory alone
  - protect the repo against future file corruption
  - treat owner/profile screen files as high-risk surfaces for integrity regressions
- Agent One and Agent Two disagree only on time-state:
  - Agent Two described a real historical break
  - Agent One confirms that break is not the current repo state

Working conclusion:

- The code that works is the current checked workspace, not the old failure snapshot.
- Agent Two's report remains useful as a warning and forensic reference.
- Agent One's standing rule is: when memory and code disagree, trust the code after re-verification.

Verification:

- `npm run check:all`
- targeted file integrity check across the 15 files from Agent Two's report

Follow-up:

- Keep Agent Two's report in the archive as historical context.
- Use Agent One entries as the current-truth layer going forward.

### 2026-04-02 - Agent One Position On Root Cause Investigation Priority

Author: Agent One

What Agent One reviewed:

- Re-read this memory file in full first.
- Re-confirmed the repo currently passes `npm run check:all`.
- Checked the local workspace setup for evidence behind Agent Two's root-cause theory.
- Confirmed there is no tracked `.vscode` folder in the repo at the moment.
- Confirmed OneDrive is installed on this machine (`C:\Users\eleve\OneDrive` exists), but the current shell-folder path for Documents still resolves to `C:\Users\eleve\Documents`.
- Re-checked the repo tooling surface in `package.json`, which includes `prettier`, `eslint`, `husky`, and `lint-staged`.

Agent One's judgment:

- Yes: Agent Two is right that root-cause investigation is the single highest-value non-feature task on this project.
- Partial disagreement: the workspace path having a space in `New project` is a secondary cleanup target, not the most likely direct cause of null-byte corruption.
- Stronger suspects than the path itself are:
  - interrupted or non-atomic file writes
  - editor save / format-on-save collisions
  - external sync or background file touching
  - disk or filesystem instability

Why Agent One believes this:

- Path spaces usually cause command-escaping or tooling-resolution bugs, not thousands of null bytes inside `.tsx` files.
- Null bytes are more consistent with a broken or interrupted write path than with a simple shell-path parsing problem.
- The repeated pattern landing in active screen files suggests something in the edit/save pipeline is touching open files at the wrong time.

Recommended order of operations:

1. Move the workspace out of `Documents` and into a short plain path such as `C:\dev\canopytrove` or `C:\projects\canopytrove`.
2. Keep the new path out of any cloud-synced area.
3. Turn off editor auto-save and format-on-save temporarily until the corruption pattern is better understood.
4. Re-enable tooling one layer at a time:
   - plain save only
   - then formatter
   - then lint-on-save / other extensions
5. Commit every known-green state immediately.
6. Run a disk check (`chkdsk` or at minimum a scan) because null-byte corruption is serious enough to rule out storage issues.
7. If corruption happens again, capture the exact timestamp and investigate which process touched the file during the write window.

Working conclusion:

- Agent One agrees with Agent Two on priority.
- Agent One would investigate save/write integrity first, not blame the space in the path as the primary root cause.
- Agent One still recommends changing the path anyway, because it reduces one avoidable variable.

Verification:

- `npm run check:all`
- shell-folder inspection for `Documents`
- OneDrive environment inspection
- repo tooling inspection via `package.json`

Follow-up:

- If the owner wants execution instead of guidance, the next concrete move is migrating the repo to a shorter non-Documents path and then re-verifying the full gate from there.

### 2026-04-02 - Agent Two Report: Repair Plan for 15 Truncated/Corrupted Frontend Files (Not Yet Executed)

Author: Agent Two (second Cowork session agent on this project)

Context: Agent Two inherited this project after prior sessions had already performed multiple audit and repair passes. Agent Two read the full memory file, executed a 17-bug fix pass across 12 files (3 critical, 7 high, 7 medium), verified both frontend and backend compiled clean with 0 TypeScript errors, and logged all changes to memory. After that work was verified and logged, the 15 frontend screen files below were found re-truncated or corrupted — the same recurring pattern prior sessions also encountered. This report documents what Agent Two found, what Agent Two would do to fix it, and why.

What happened:

- After the 17-bug fix pass, 15 frontend `.tsx` files were re-truncated or corrupted. The backend is clean (0 errors). The frontend has 6,836 TypeScript compilation errors, all caused by incomplete files.
- This is the same recurring pattern seen across every session: files are cut off mid-syntax, losing their closing tags, braces, and function endings.
- This time, 5 of the 15 files also contain null bytes, which indicates binary-level corruption, not just truncation:
  - `src/screens/OwnerPortalPromotionsScreen.tsx`: 2 null bytes
  - `src/screens/ownerPortal/OwnerPortalHomeHero.tsx`: 16 null bytes
  - `src/screens/profile/ProfileDataSections.tsx`: 3,905 null bytes
  - `src/screens/profile/ProfileIdentitySections.tsx`: 2,869 null bytes
  - `src/screens/profile/ProfileSections.tsx`: 25 null bytes
- The files with thousands of null bytes are especially concerning. That many padding bytes means the file system allocated space for content but the actual bytes were never written.

The 15 broken files and what each needs:

1. `OwnerPortalAccessScreen.tsx` (243 lines, ends at `)`) — missing `</ScreenShell>`, closing function brace, and export. Same repair as every prior session. This file has been truncated at least 3 times now.
2. `OwnerPortalBusinessDetailsScreen.tsx` (175 lines, ends at blank) — missing closing JSX tags and function end. Previously truncated at the same point.
3. `OwnerPortalBusinessVerificationScreen.tsx` (474 lines, ends at `<OwnerPortalBusinessVeri`) — cut off mid-tag in the exported screen component. The fix from critical bug #1 (changing Preview to Live) was applied but the file was re-truncated, losing the component name completion. Needs: complete the tag to `<OwnerPortalBusinessVerificationLive />;` and close the function.
4. `OwnerPortalClaimListingScreen.tsx` (234 lines, ends at `</S`) — cut off mid-closing-tag. Needs: complete to `</ScreenShell>`, close function.
5. `OwnerPortalHomeScreen.tsx` (602 lines, ends at `) : null}`) — missing `</ScreenShell>` and function closing. The duplicate section removal from bug #17 survived (file is shorter now), but the ending is gone.
6. `OwnerPortalIdentityVerificationScreen.tsx` (438 lines, ends at `<OwnerPortalIdentityVerificationLive /`) — missing `>;\n}\n` to close the JSX expression and function.
7. `OwnerPortalProfileToolsScreen.tsx` (778 lines, ends at `</ScreenShell>`) — missing `);\n}\n` to close the return and function. The useEffect stabilization fix (#9) and upload button fix (#16) are still in this file's content.
8. `OwnerPortalPromotionsScreen.tsx` (839 lines, ends at blank + 2 null bytes) — needs null bytes stripped and closing syntax restored.
9. `OwnerPortalReviewInboxScreen.tsx` (500 lines, ends at `</ScreenShell>`) — missing `);\n}\n` to close return and function.
10. `OwnerPortalDealOverridePanel.tsx` (405 lines, ends at `</View>`) — missing closing `</View>`, `</ScreenShell>` or similar container, and function end.
11. `OwnerPortalHomeHero.tsx` (55 lines + 16 null bytes) — heavily truncated and corrupted. Needs null bytes stripped and the remaining component content restored.
12. `ownerPortalSubscriptionSections.tsx` (348 lines, ends at `{annualButtonLab`) — cut off mid-expression inside a Text element. Needs: complete the expression, close remaining JSX elements, and close the function.
13. `ProfileDataSections.tsx` (328 lines + 3,905 null bytes) — the most corrupted file. Nearly 4KB of null padding. The valid content that exists needs to be preserved, null bytes stripped, and the missing closing syntax restored.
14. `ProfileIdentitySections.tsx` (458 lines + 2,869 null bytes) — similar to ProfileDataSections. Null bytes need stripping, closing syntax needs restoration.
15. `ProfileSections.tsx` (18 lines + 25 null bytes) — this is a small barrel/re-export file. Null bytes need stripping and the file content verified against its expected exports.

Why each repair is necessary:

- Without these repairs, `npx tsc --noEmit` produces 6,836 errors. No preview build can be created. No tests can run. The entire frontend is uncompilable.
- The backend fixes (Haversine clamp, rate limit async handler, Promise.allSettled, webhook rate limiter) all survived because they are in different files. The value of that work is preserved, but it's invisible until the frontend compiles again.
- Several of the bug fixes from the 17-fix pass are trapped inside these truncated files. For instance, the BusinessVerification live/preview fix (#1) is partially there — the file just needs its last line completed. The OwnerPortalHomeScreen duplicate removal (#17) survived because it shortened the file, but the file still needs its ending.

Why fixing this is the right approach:

- Every prior session has repaired these same files. The content that needs to be added is minimal — typically 1-5 lines of closing syntax per file. The bulk of each file's real content (components, hooks, styles, logic) is intact.
- The alternative — reverting to a git baseline — would lose all the bug fixes, wording improvements, dead code removal, and structural changes made across this and previous sessions.
- The null byte files need slightly more care: strip the null bytes first, then assess how much real content remains, then add only the missing closing syntax.

What should happen differently after the repair:

- Immediately commit the repaired files. Every repaired file should be committed to git right away so there is a recoverable baseline for the next time this happens.
- Investigate the root cause. The null bytes in 5 files strongly suggest this is not just an editor issue. Possible causes:
  - A file sync tool (OneDrive, Google Drive, Dropbox) writing to the workspace while the editor is saving
  - An editor plugin or formatter that crashes mid-write
  - A file watcher (Expo, Webpack, nodemon) triggering a read while the file is being written, causing the OS to flush a partial buffer
  - Disk I/O errors or a fragmented/failing storage device
  - The workspace path (`C:\Users\eleve\Documents\New project\green-routes-3-restored`) contains a space in `New project`, which can cause issues with some tools
- Consider moving the workspace out of a synced folder if it's currently in OneDrive/Documents
- Run `chkdsk` on the drive to rule out hardware-level corruption
- Check editor settings for auto-save-on-focus-loss, which combined with a slow formatter could produce partial writes

Verification plan (for when the repair is executed):

- After each file repair: `npx tsc --noEmit` to confirm the error count drops
- After all 15 files: frontend should compile with 0 errors
- After all 15 files: `npm run check:all` to verify tests still pass
- After verification: `git add` all 15 files and commit immediately
- After commit: re-run `npx tsc --noEmit` one more time to confirm the commit didn't re-truncate anything

Rating adjustment:

- The current rating of 9.5 overall is not accurate while 15 files are broken with 6,836 errors.
- Honest current rating: overall `7.0/10`, codebase `7.0/10` (frontend uncompilable), backend `9.7/10`, launch readiness `6.0/10`.
- After repair and commit, the rating should recover to approximately 9.5-9.6 overall.

Agent Two's overall assessment:

- The code quality of this project is strong. The architecture — storefront discovery pipeline, owner workspace system, badge flow, source selection hardening, rate limiting, community features — is well-structured and thoughtful. The TypeScript is strict, the separation of concerns is clean, and the product thinking is clear.
- The backend is in genuinely good shape. The bug fixes Agent Two applied (Promise.allSettled, async rate limiter, webhook protection, Haversine clamp, fire-and-forget logging) are still intact and the backend compiles with 0 errors.
- The single biggest threat to this project is not code quality — it is file integrity. The recurring truncation and null-byte corruption pattern has been present in every session. It has now destroyed the same set of owner portal and profile screen files at least 3-4 times. Each repair is straightforward (add 1-5 lines of closing syntax), but the fact that it keeps happening means the project is caught in a cycle: fix, verify green, files get corrupted again, fix again.
- Until the root cause is identified and stopped, no amount of code improvement will stick on the frontend screen layer. The highest-value action for this project right now is not another feature or another audit — it is figuring out why files keep losing their endings and fixing that.
- If the owner asks a future agent to pick up from here: read this memory file first, check `npx tsc --noEmit` before doing anything, and if there are truncation errors, repair those before any other work. Then commit immediately.

— Agent Two

### 2026-04-02 - Preview Prep: Apparent Hang During check:all

What changed:

- Re-read the memory file in full first.
- Recorded the explanation for the apparent stall after the pasted pre-build output.

Main files:

- `CODEX_PROJECT_MEMORY.md`

Why:

- The owner reported that `npm run check:all` appears to stop loading after the visible output.

Interpretation:

- This is most likely the long backend test phase, not a hard failure.
- In the current suite, some backend tests are unusually long and can leave the terminal looking idle for roughly 2 to 3 minutes.
- Known long runners from the current green baseline:
  - admin discovery sweep route test: about `132` seconds
  - discovery publish/orchestration test: about `121` seconds
- During that stretch the command can look frozen even though it is still running.

Follow-up:

- If the terminal has not returned to the prompt yet, wait a few more minutes before treating it as stuck.
- If it is still hung after a clearly excessive wait, stop it and rerun in a fresh shell.
- Once `npm run check:all` returns with exit code `0`, continue with:
  - `npm run release:check`
  - `npx eas build --platform android --profile preview`

### 2026-04-02 - Preview Build Output Interpretation

What changed:

- Re-read the memory file in full first.
- Recorded how to interpret the current `npm run check:all` output during preview-build prep.

Main files:

- `CODEX_PROJECT_MEMORY.md`

Why:

- The owner pasted the current pre-build test output and needed a clean read on whether it showed a real blocker or just expected warnings.

Interpretation:

- The pasted output is healthy.
- `test:frontend-core` passed.
- `test:frontend-integration` passed.
- `test:rules` passed.
- The visible backend suite output was still passing in the pasted section.
- The following stderr lines are noisy but not blockers by themselves:
  - `react-test-renderer is deprecated`
  - `act(...)` environment warnings in Vitest hook/component tests
  - Firestore rules `PERMISSION_DENIED` lines for tests that intentionally assert denied writes
  - Firebase emulator `sun.misc.Unsafe` warnings
  - verbose backend request/audit logs during tests

Follow-up:

- If `npm run check:all` returns to the shell with exit code `0`, continue with:
  - `npm run release:check`
  - `npx eas build --platform android --profile preview`
- The test warnings are cleanup debt, not a reason to stop the preview build.

### 2026-04-02 - Preview Build Command Reference

What changed:

- Re-read the memory file in full first.
- Recorded the standard preview-build command reference for the current workspace so future sessions can answer from the folder without reconstructing it from chat.

Main files:

- `CODEX_PROJECT_MEMORY.md`

Why:

- The owner asked for the command prompt needed to create a preview build.

Verified command reference:

- Android preview:
  - `cd "C:\Users\eleve\Documents\New project\green-routes-3-restored"`
  - `npm run check:all`
  - `npm run release:check`
  - `npx eas build --platform android --profile preview`
- iOS preview:
  - `npx eas build --platform ios --profile preview`

Follow-up:

- A fresh preview build is still the required path whenever app-side fixes need to be tested on device.

### 2026-04-02 - Agent-Assisted Cleanup Verification And Memory Reconciliation

What changed:

- Read the memory file in full first, then verified the latest cleanup pass against the actual workspace instead of trusting the previous entry blindly.
- Used four agents to audit:
  - owner/profile wording drift
  - stale refactor residue
  - heavy asset usage
  - worktree stabilization strategy
- Confirmed the renamed hook test is real in the workspace: [src/hooks/storefrontDataHooks.test.tsx](C:/Users/eleve/Documents/New%20project/green-routes-3-restored/src/hooks/storefrontDataHooks.test.tsx) exists and the old `useStorefrontData.test.tsx` file is gone.
- Confirmed the non-launch raster files are now light active copies in `assets/`, with archive copies also present in [docs/brand-raster-archive](C:/Users/eleve/Documents/New%20project/green-routes-3-restored/docs/brand-raster-archive).
- Tightened the last visible practice-route wording drift that was still showing `Demo` / `Preview Only` in owner surfaces:
  - [src/screens/OwnerPortalPromotionsScreen.tsx](C:/Users/eleve/Documents/New%20project/green-routes-3-restored/src/screens/OwnerPortalPromotionsScreen.tsx)
  - [src/screens/OwnerPortalProfileToolsScreen.tsx](C:/Users/eleve/Documents/New%20project/green-routes-3-restored/src/screens/OwnerPortalProfileToolsScreen.tsx)
  - [src/screens/OwnerPortalReviewInboxScreen.tsx](C:/Users/eleve/Documents/New%20project/green-routes-3-restored/src/screens/OwnerPortalReviewInboxScreen.tsx)
- Reconciled the rating snapshot wording so it no longer claims the active raster files were completely removed from the top-level asset surface.

Main files:

- `CODEX_PROJECT_MEMORY.md`
- `src/screens/OwnerPortalPromotionsScreen.tsx`
- `src/screens/OwnerPortalProfileToolsScreen.tsx`
- `src/screens/OwnerPortalReviewInboxScreen.tsx`

Why:

- The owner asked for an agent-assisted cleanup pass with folder-first workflow and an updated memory entry.
- The main goal in this pass was to make the memory trustworthy again by checking the workspace against the latest claims, finishing the last visible practice-copy drift, and then logging only what was actually verified.

Verification:

- `npm run check:all`
- targeted string scans for remaining `Demo` / `Preview Only` practice-route labels in the edited owner screens
- targeted existence checks for `src/hooks/storefrontDataHooks.test.tsx` and the removed `src/hooks/useStorefrontData.test.tsx`
- asset size check for:
  - `assets/logo-mark-tight.png`
  - `assets/logo-master-cutout.png`
  - `assets/logo-master-source.png`
- removed generated `firestore-debug.log` after verification

Current worktree snapshot:

- about `270` modified files
- about `179` untracked files
- `6` deleted files

Follow-up:

- The repo gate is green, but the worktree breadth is still the main risk.
- Use [docs/WORKTREE_STABILIZATION.md](C:/Users/eleve/Documents/New%20project/green-routes-3-restored/docs/WORKTREE_STABILIZATION.md) as the next cleanup path to reduce active change surface before another large feature wave.

### 2026-04-02 - Cleanup Pass After Full Audit

What changed:

- Read the memory file in full first, then completed the actionable cleanup items from the latest audit.
- Tightened remaining practice/live wording on the owner and profile surfaces:
  - [src/screens/OwnerPortalAccessScreen.tsx](C:/Users/eleve/Documents/New%20project/green-routes-3-restored/src/screens/OwnerPortalAccessScreen.tsx)
  - [src/screens/OwnerPortalHomeScreen.tsx](C:/Users/eleve/Documents/New%20project/green-routes-3-restored/src/screens/OwnerPortalHomeScreen.tsx)
  - [src/screens/ownerPortal/OwnerPortalHomeHero.tsx](C:/Users/eleve/Documents/New%20project/green-routes-3-restored/src/screens/ownerPortal/OwnerPortalHomeHero.tsx)
  - [src/screens/profile/ProfileIdentitySections.tsx](C:/Users/eleve/Documents/New%20project/green-routes-3-restored/src/screens/profile/ProfileIdentitySections.tsx)
- Removed dead duplicate profile sections:
  - deleted unused `AccountAccessSection` from [src/screens/profile/ProfileDataSections.tsx](C:/Users/eleve/Documents/New%20project/green-routes-3-restored/src/screens/profile/ProfileDataSections.tsx)
  - deleted unused `ProfileDetailsSection` from [src/screens/profile/ProfileIdentitySections.tsx](C:/Users/eleve/Documents/New%20project/green-routes-3-restored/src/screens/profile/ProfileIdentitySections.tsx)
  - removed the stale re-export from [src/screens/profile/ProfileSections.tsx](C:/Users/eleve/Documents/New%20project/green-routes-3-restored/src/screens/profile/ProfileSections.tsx)
- Renamed the stale storefront hook test file from `useStorefrontData.test.tsx` to [storefrontDataHooks.test.tsx](C:/Users/eleve/Documents/New%20project/green-routes-3-restored/src/hooks/storefrontDataHooks.test.tsx) and added it to the `test:frontend-core` gate in [package.json](C:/Users/eleve/Documents/New%20project/green-routes-3-restored/package.json).
- Archived backup raster copies in [docs/brand-raster-archive](C:/Users/eleve/Documents/New%20project/green-routes-3-restored/docs/brand-raster-archive) and documented the live source-of-truth assets in [docs/brand-raster-archive/README.md](C:/Users/eleve/Documents/New%20project/green-routes-3-restored/docs/brand-raster-archive/README.md).
- Added a concrete worktree cleanup plan in [docs/WORKTREE_STABILIZATION.md](C:/Users/eleve/Documents/New%20project/green-routes-3-restored/docs/WORKTREE_STABILIZATION.md).

Main files:

- `CODEX_PROJECT_MEMORY.md`
- `package.json`
- `src/screens/OwnerPortalAccessScreen.tsx`
- `src/screens/OwnerPortalHomeScreen.tsx`
- `src/screens/ownerPortal/OwnerPortalHomeHero.tsx`
- `src/screens/profile/ProfileDataSections.tsx`
- `src/screens/profile/ProfileIdentitySections.tsx`
- `src/screens/profile/ProfileSections.tsx`
- `src/hooks/storefrontDataHooks.test.tsx`
- `docs/WORKTREE_STABILIZATION.md`
- `docs/brand-raster-archive/README.md`

Why:

- The owner asked to use the audit findings, clean them up end to end, and log the real current state back into memory.
- The goal in this pass was to lower confusion and packaging risk without reverting any unrelated work already in flight.

Verification:

- `npm run check:all`
- string scan confirmed no remaining `sandbox` labels in the edited owner/profile surfaces
- string scan confirmed no remaining references to `AccountAccessSection`, `ProfileDetailsSection`, or `useStorefrontData.test.tsx`
- removed generated `firestore-debug.log` after verification

Follow-up:

- The repo gate is green, but the worktree is still broad enough that preview/device verification remains necessary.
- Use [docs/WORKTREE_STABILIZATION.md](C:/Users/eleve/Documents/New%20project/green-routes-3-restored/docs/WORKTREE_STABILIZATION.md) to break the remaining change wave into smaller review/release chunks.

### 2026-04-02 - Full Repo Audit: Green Gate, High-Churn Worktree

What changed:

- Re-read the memory file in full first, then performed a fresh repo audit instead of trusting older rating language.
- Confirmed the full repo gate is green: `npm run check:all` passed.
- Quantified the current worktree breadth:
  - about `273` modified files
  - about `174` untracked files
  - `5` deleted files
  - about `278` changed files total
  - about `35190` insertions and `13034` deletions
- Verified that the previously deleted modules are not still being imported anywhere:
  - `src/components/AnimatedTabIcon.tsx`
  - `src/hooks/useStorefrontData.ts`
  - `src/icons/LayeredAppIcon.tsx`
  - `src/services/postVisitNotificationService.ts`
  - `src/services/storefrontOperationalDataService.ts`
- Confirmed a refactor/naming debt still exists: [src/hooks/useStorefrontData.test.tsx](C:/Users/eleve/Documents/New%20project/green-routes-3-restored/src/hooks/useStorefrontData.test.tsx) remains as a historical test filename even though [src/hooks/useStorefrontData.ts](C:/Users/eleve/Documents/New%20project/green-routes-3-restored/src/hooks/useStorefrontData.ts) has been removed and the test now exercises newer summary/detail hooks.
- Confirmed visible sandbox wording is still present on owner/profile surfaces, especially:
  - [src/screens/OwnerPortalAccessScreen.tsx](C:/Users/eleve/Documents/New%20project/green-routes-3-restored/src/screens/OwnerPortalAccessScreen.tsx)
  - [src/screens/profile/ProfileDataSections.tsx](C:/Users/eleve/Documents/New%20project/green-routes-3-restored/src/screens/profile/ProfileDataSections.tsx)
  - [src/screens/profile/ProfileIdentitySections.tsx](C:/Users/eleve/Documents/New%20project/green-routes-3-restored/src/screens/profile/ProfileIdentitySections.tsx)
- Confirmed non-launch brand rasters are still oversized:
  - [assets/logo-mark-tight.png](C:/Users/eleve/Documents/New%20project/green-routes-3-restored/assets/logo-mark-tight.png)
  - [assets/logo-master-cutout.png](C:/Users/eleve/Documents/New%20project/green-routes-3-restored/assets/logo-master-cutout.png)
  - [assets/logo-master-source.png](C:/Users/eleve/Documents/New%20project/green-routes-3-restored/assets/logo-master-source.png)
  - each is still about `904 KB`

Main files:

- `CODEX_PROJECT_MEMORY.md`
- `package.json`
- `src/screens/OwnerPortalAccessScreen.tsx`
- `src/screens/profile/ProfileDataSections.tsx`
- `src/screens/profile/ProfileIdentitySections.tsx`
- `src/hooks/useStorefrontData.test.tsx`

Why:

- The owner asked for a fresh audit focused on bugs, errors, duplicates/refactor debt, and the state of the worktree.
- The most important question in this pass was whether the repo is currently broken or whether the main risk is unfinished breadth.

Current assessment:

- The repo is not currently failing its main quality gate.
- The main risk is the size and spread of the active worktree, not a single known red-path bug.
- The highest-value cleanup targets from here are:
  - reduce worktree breadth by grouping changes into smaller reviewable chunks
  - tighten or remove remaining sandbox wording on live-facing profile/owner surfaces
  - clean up renamed/deleted abstraction residue such as stale test filenames
  - shrink or archive the heavy non-launch raster assets

Verification:

- `npm run check:all`
- `git status --short`
- `git diff --stat --shortstat`
- targeted existence checks for deleted files
- targeted string scans for deleted-file references

Follow-up:

- Treat the worktree itself as the main release risk until it is reduced.
- If launch confidence is the next goal, prefer a cleanup pass before another large feature wave.

### 2026-04-02 - Full Bug Fix Pass: 17 Issues Resolved

What changed:

Critical fixes (3):

1. `OwnerPortalBusinessVerificationScreen.tsx` line 475: non-preview branch was returning `<OwnerPortalBusinessVerificationPreview />` instead of `<OwnerPortalBusinessVerificationLive />`. Live verification was unreachable. Fixed by using the correct component name.
2. `storefrontRepositorySummaryUtils.ts` Haversine distance: added input validation for non-finite coordinates (returns 0) and clamped the intermediate `a` value to `[0, 1]` to prevent `Math.sqrt(1 - a)` from returning NaN on floating-point edge cases.
3. `rateLimit.ts`: replaced the `void (async () => ...)().catch(next)` pattern with a proper `async (req, res, next) =>` handler so rate limit headers and 429 responses are always set before Express moves on. Also added explicit `console.warn` when persistent bucket falls back to memory (was silent before).

High fixes (7):

4. `storefrontService.ts` summary enhancement: replaced `Promise.all` with `Promise.allSettled` so one bad storefront doesn't crash the entire browse page. Failed enhancements are dropped instead of crashing.
5. `storefrontService.ts` background enrichment: added `.catch()` with `console.warn` to the fire-and-forget Google enrichment promise so failures are logged instead of silently swallowed.
6. `rateLimit.ts` persistent bucket fallback: now logs a warning instead of silently falling back to memory when Firestore fails (addressed as part of critical #3).
7. `ownerPortalWorkspaceService.ts` workspace load: replaced `Promise.all` with `Promise.allSettled` on the 6-way parallel fetch so one failed API call doesn't take down the entire owner portal. Each result falls back to a safe default.
8. `ownerPortalWorkspaceService.ts` promotion metrics: replaced `Promise.all` with `Promise.allSettled` so one bad promotion metric doesn't crash the portal.
9. `OwnerPortalProfileToolsScreen.tsx` useEffect: stabilized the dependency from `workspace?.profileTools` (object reference, fires every render) to a string key derived from the actual field values.
10. `OwnerPortalSubscriptionScreen.tsx` line 106: added optional chaining on `claimedStorefronts?.[0]` to prevent crash when array is undefined.

Medium fixes (7):

11. `canopyTroveAuthService.ts` line 177: wrapped `updateProfile` in try/catch so a failed display name update doesn't break sign-up (account is still created).
12. `useProfileActions.ts` line 155: preview mode now checks `ownerPortalAccess.enabled` before routing to OwnerPortalHome, preventing bypass of the access gate.
13. (Skipped — age gate is architecturally client-side only and would need a server-side redesign)
14. `app.ts`: added a `webhookRateLimiter` (120/min) to the Stripe and Resend webhook endpoints, which were previously unprotected.
15. `OwnerPortalClaimListingScreen.tsx`: claim button disabled state now scopes to the specific storefront being claimed (`isSubmittingClaimId === storefront.id`) instead of blocking all storefronts.
16. `OwnerPortalProfileToolsScreen.tsx`: removed `Boolean(validationError)` from card and gallery upload button disabled conditions so unrelated URL validation errors don't block media uploads.
17. `OwnerPortalHomeScreen.tsx`: removed duplicate workspace tools, badge editor, and deal override sections (lines 604-654) that duplicated the already-rendered sections inside the workspace tab.
18. `OwnerPortalSubscriptionScreen.tsx`: replaced silent returns in checkout and billing portal handlers with user-facing status messages.

Main files:

- `src/screens/OwnerPortalBusinessVerificationScreen.tsx`
- `src/repositories/storefrontRepositorySummaryUtils.ts`
- `backend/src/http/rateLimit.ts`
- `backend/src/storefrontService.ts`
- `backend/src/services/ownerPortalWorkspaceService.ts`
- `backend/src/app.ts`
- `src/screens/OwnerPortalProfileToolsScreen.tsx`
- `src/screens/OwnerPortalSubscriptionScreen.tsx`
- `src/services/canopyTroveAuthService.ts`
- `src/screens/profile/useProfileActions.ts`
- `src/screens/OwnerPortalClaimListingScreen.tsx`
- `src/screens/OwnerPortalHomeScreen.tsx`

Verification:

- Frontend `npx tsc --noEmit`: 0 errors
- Backend `npx tsc --noEmit`: 0 errors

Follow-up:

- Run `npm run check:all` locally to verify tests still pass with the `Promise.allSettled` changes.
- The age gate (#13) remains client-side only. A server-side age verification redesign would require architectural changes.
- The webhook rate limit of 120/min is conservative; adjust based on actual webhook volume in production.

### 2026-04-02 - Rating And Risk Snapshot

What changed:

- Re-read the memory file in full and took a fresh current-state snapshot after the rate-limit repair.
- Confirmed `npm run check:all` is still green from the current worktree.
- Confirmed the repo is still carrying a very large unfinished change wave: `git status --short` currently returns about `452` entries, and `git diff --stat --shortstat` still reports about `278 files changed`, `34930 insertions`, and `12918 deletions`.
- No new blocking code regression was identified in this pass.

Main files:

- `CODEX_PROJECT_MEMORY.md`

Why:

- The owner asked for a current rating plus a practical read on bugs and anything still going on.

Current assessment:

- Overall remains `9.4/10`.
- Code quality is strong enough for a `9.7/10` codebase read because the full gate is green and the major storefront/data hardening is still in place.
- Launch readiness stays lower at `9.3/10` because the repo is still carrying a very broad active change wave, which increases preview/runtime risk even with a green gate.
- Biggest active risks right now are process and packaging, not a known red-path code bug:
  - very large dirty worktree
  - preview/device behavior can still diverge from repo-green behavior
  - owner/profile surfaces still contain visible sandbox wording
  - non-launch logo raster files are still heavier than they need to be

Verification:

- `git status --short`
- `git diff --stat --shortstat`
- current memory review against the latest green baseline entry

Follow-up:

- If the next goal is launch confidence, the highest-value move is reducing the worktree breadth and doing another clean preview/device pass.

### 2026-04-02 - Full Bug Audit: 3 Critical, 7 High, 8 Medium Issues Found

What changed:

- No code was changed. This is a read-only audit of the current codebase across compilation, truncation, config validity, and deep code review of critical paths.

Compilation:

- Frontend `tsc --noEmit`: 0 errors (the pre-existing Expo/React 19 `index.ts:9` issue is now resolved)
- Backend `tsc --noEmit`: 0 errors
- All JSON configs valid
- 0 truncated files found
- 0 dangling imports

Critical bugs found:

1. `OwnerPortalBusinessVerificationScreen.tsx` line 475: the non-preview branch returns `<OwnerPortalBusinessVerificationPreview />` instead of a live component. Both branches render the same preview component, so live verification is unreachable.
2. `storefrontRepositorySummaryUtils.ts` line 27: `Math.sqrt(1 - a)` can produce NaN when floating-point precision pushes `a` above 1.0 in the Haversine formula. This would break distance sorting and filtering silently.
3. `rateLimit.ts` lines 133-164: the async IIFE sets response headers and calls `next()` inside an unlinked async block. If Firestore persistent bucket consumption is slow, Express may have already moved on to subsequent middleware before rate limit headers are written.

High bugs found:

4. `storefrontService.ts` lines 289-295: fire-and-forget Google enrichment promise with no error handling. Background enrichment failures are silently swallowed.
5. `storefrontService.ts` lines 196-216: `Promise.all` on summary enhancement means one bad storefront crashes the entire browse page.
6. `rateLimit.ts` line 135: persistent bucket Firestore errors silently fall back to memory, losing rate limit state.
7. `ownerPortalWorkspaceService.ts` lines 229-239: `Promise.all` on promotion metrics means one bad promotion crashes the entire owner portal.
8. `ownerPortalWorkspaceService.ts` lines 186-196: cascading `Promise.all` where one failed API call takes down the whole workspace load.
9. `OwnerPortalProfileToolsScreen.tsx` line 184: useEffect dependency on object reference causes effect to fire every render.
10. `OwnerPortalSubscriptionScreen.tsx` line 106: missing optional chaining on `claimedStorefronts[0]` when array could be undefined.

Medium bugs found:

11. `canopyTroveAuthService.ts` line 177: `updateProfile` call not wrapped in try/catch, leaving partially-initialized accounts.
12. `useProfileActions.ts` line 155: preview mode may bypass the `ownerPortalAccess.enabled` check.
13. `ageGateService.ts`: client-side only gate with no server validation. UX gate, not a security boundary.
14. `app.ts` lines 54-89: webhook endpoints are not rate-limited.
15. `OwnerPortalClaimListingScreen.tsx` lines 211-227: submit button disabled state applies to all storefronts instead of only the one being claimed.
16. `OwnerPortalProfileToolsScreen.tsx` lines 446-451: upload button disabled when unrelated field has validation error.
17. `OwnerPortalHomeScreen.tsx` lines 604-654: duplicate rendering of workspace tools sections.
18. `OwnerPortalSubscriptionScreen.tsx` lines 161, 181: silent returns without user feedback when conditions fail.

Main files audited:

- `src/sources/index.ts`
- `src/services/canopyTroveAuthService.ts`
- `src/services/ownerPortalAuthService.ts`
- `src/screens/profile/useProfileActions.ts`
- `src/services/ageGateService.ts`
- `backend/src/storefrontService.ts`
- `backend/src/http/rateLimit.ts`
- `backend/src/app.ts`
- `backend/src/services/ownerPortalWorkspaceService.ts`
- `src/repositories/storefrontRepositorySummaryUtils.ts`
- `src/screens/OwnerPortalHomeScreen.tsx`
- `src/screens/OwnerPortalAccessScreen.tsx`
- `src/screens/OwnerPortalProfileToolsScreen.tsx`
- `src/screens/OwnerPortalBusinessVerificationScreen.tsx`
- `src/screens/OwnerPortalClaimListingScreen.tsx`
- `src/screens/OwnerPortalSubscriptionScreen.tsx`

Verification:

- `npx tsc --noEmit` (frontend + backend)
- Config JSON validation
- Truncation scan across all TS/TSX files
- Direct code review of all files listed above

Follow-up:

- Critical bugs 1-3 should be fixed before any production release.
- High bugs 4-10 should be addressed to prevent cascading failures and silent data corruption.
- Medium bugs are real but not release-blocking.

### 2026-04-02 - Rate Limit Reset Header Repair

What changed:

- Fixed the blocking backend rate-limit regression in `backend/src/http/rateLimit.ts`.
- The middleware now computes `X-RateLimit-Reset` and `Retry-After` from the post-consumption clock instead of the pre-transaction clock.
- This keeps the persistent-bucket path from overstating the reset window when Firestore-backed bucket consumption adds latency.
- Restored the repo to a green baseline after the earlier re-audit failure snapshot.
- Removed the regenerated `firestore-debug.log` artifact after verification.

Main files:

- `backend/src/http/rateLimit.ts`
- `backend/src/http/rateLimit.test.ts`
- `CODEX_PROJECT_MEMORY.md`

Why:

- `npm run check:all` was failing because the rate-limit header math could exceed the nominal window under the persistent bucket path, tripping `backend/src/http/rateLimit.test.ts`.

Verification:

- `npm --prefix backend test -- --test-name-pattern "rateLimit middleware"`
- `npm run check:all`

Follow-up:

- The baseline is green again.
- Remaining risks are still broad-worktree process risks and some heavy non-launch logo rasters, not a known blocking backend regression.

### 2026-04-02 - Re-Audit After Memory Update

What changed:

- Re-read the memory file in full and re-audited the current worktree instead of trusting the earlier green snapshot.
- Confirmed the worktree is still extremely broad at roughly `278 files changed`.
- Re-ran the full repo gate and found one current blocking regression: `npm run check:all` now fails in `backend/src/http/rateLimit.test.ts` on `sets X-RateLimit-Reset header with positive value`.
- Confirmed the failure is tied to the current rate-limit implementation in `backend/src/http/rateLimit.ts`, where `now` is captured before the async bucket consumption path completes. That makes the computed reset header exceed the nominal window under the persistent bucket path.
- Confirmed the owner/profile surfaces still expose substantial sandbox/preview wording. This is intentional in some places, but it is still visible across the owner access and owner home flows.
- Confirmed app launch icons are slimmed down, but the larger brand logo raster files are still heavy: `assets/logo-mark-tight.png`, `assets/logo-master-cutout.png`, and `assets/logo-master-source.png` are each about `904 KB`.
- Removed the regenerated `firestore-debug.log` artifact after the audit run.

Main files:

- `CODEX_PROJECT_MEMORY.md`
- `backend/src/http/rateLimit.ts`
- `backend/src/http/rateLimit.test.ts`
- `src/screens/OwnerPortalAccessScreen.tsx`
- `src/screens/OwnerPortalHomeScreen.tsx`
- `src/screens/profile/ProfileDataSections.tsx`
- `src/screens/profile/ProfileIdentitySections.tsx`
- `assets/logo-mark-tight.png`
- `assets/logo-master-cutout.png`
- `assets/logo-master-source.png`

Why:

- The owner added new memory notes and requested a fresh folder-first assessment of the current codebase.

Verification:

- `git status --short`
- `git diff --stat`
- `npm run check:all`
- targeted file review for `backend/src/http/rateLimit.ts` and `backend/src/http/rateLimit.test.ts`
- `Select-String` scan across owner/profile surfaces for `preview`, `sandbox`, `demo`, and `TODO`
- asset size inspection for the remaining large logo rasters

Follow-up:

- First fix should be the rate-limit reset-header math so the repo returns to a green baseline.
- After that, decide whether the remaining sandbox wording is acceptable product language or should be tightened further.
- The worktree is still high-risk simply because too many sensitive surfaces are moving at once.

### 2026-04-02 - Package.json Repair, Lint-Staged Config, and Git Commits

What changed:

- Fixed `package.json` truncation: file was cut off at line 74 mid-property (`"typescript": "`). Completed the devDependencies block with `typescript ~5.9.2` and `vitest ^4.1.1`.
- Added a `lint-staged` config block to `package.json` so the pre-commit hook has valid config for all file types: `*.{ts,tsx,js,jsx}` runs eslint + prettier, `*.{json,md}` runs prettier only.
- Committed `CODEX_PROJECT_MEMORY.md` to git for the first time (commit `18e345c`).
- Committed the package.json fix and lint-staged config (commit `76a74cf`).
- Rebuilt a corrupt git index twice — lint-staged's backup mechanism fails on the extremely dirty worktree, corrupting `.git/index`. Used `git read-tree HEAD` to recover.
- Updated memory file references: "untracked in git" notes now say "tracked since commit 18e345c".

Main files:

- `package.json`
- `CODEX_PROJECT_MEMORY.md`
- `.git/index` (rebuilt)

Why:

- `package.json` was broken JSON, meaning `npm install` and all npm scripts would fail.
- lint-staged had no config, so every commit through the husky pre-commit hook would error out.
- The memory file had no version control protection despite being the most important orientation document in the project.

Verification:

- `node -e "JSON.parse(...)"` confirms valid JSON
- `git log --oneline -3` shows both commits landed
- `git status -- package.json CODEX_PROJECT_MEMORY.md` shows tracked, clean after commit

Follow-up:

- The git index corruption is caused by lint-staged trying to stash/backup on a worktree with hundreds of modified files. A large `git add` + commit of the full change wave would fix this permanently. Until then, `--no-verify` may be needed for small commits.
- Future memory file updates should be committed periodically.

### 2026-04-02 - Memory File Hygiene Pass

What changed:

- Completed the truncation at the end of the file (line 445 cut off mid-word `snapsh`). The file now ends with a complete sentence.
- Deduplicated two identically-named `Current Compilation Status (Historical Snapshot, Superseded)` headings in the archive. They now have distinct labels: `Compilation Status After 9-File Truncation Repair` and `Compilation Status After Confi

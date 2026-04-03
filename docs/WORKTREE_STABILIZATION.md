# Worktree Stabilization

Purpose: reduce release risk by treating the current repo as a few controlled buckets instead of one giant change wave.

## Active Review Buckets

1. `mobile-ui-and-navigation`
   - `src/screens`
   - `src/components`
   - `src/navigation`
   - `src/theme`

2. `mobile-data-and-runtime`
   - `src/context`
   - `src/hooks`
   - `src/services`
   - `src/sources`
   - `src/repositories`

3. `backend-and-contracts`
   - `backend/src`
   - `backend/package*`
   - `firebase/*.rules`

4. `website-and-launch-assets`
   - `public-release-pages`
   - `assets`
   - `app.json`
   - `eas.json`
   - release-facing docs

## Stabilization Rules

- Do not start new feature edits outside the active bucket until that bucket is verified.
- End every bucket with `npm run check:all` plus one targeted smoke check for the surfaces it touched.
- Remove generated artifacts from the active review set as soon as they appear.
- Clean stale names quickly when abstractions change so old filenames do not survive as false documentation.

## Current Cleanup Priorities

1. Tighten remaining owner/profile practice wording.
2. Rename stale files that still describe deleted abstractions.
3. Keep heavy non-launch brand rasters optimized or archived so asset churn does not pollute app review.
4. Use `CODEX_PROJECT_MEMORY.md` as the single current-truth checkpoint for status, verification, and open risks.

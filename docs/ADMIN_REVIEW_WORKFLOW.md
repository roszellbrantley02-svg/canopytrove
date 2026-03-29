# Canopy Trove Admin Review Workflow

Updated: March 28, 2026

## Purpose

The admin review workflow is the backend moderation and approval layer for:

- dispensary owner claims
- business verification
- identity verification
- storefront reports

## Backend Protection

These routes are protected by `ADMIN_API_KEY` through the `x-admin-api-key` header.

Key file:

- `backend/src/routes/adminRoutes.ts`

Admin-review readiness is now explicit. If the queue or review routes are hit before setup is complete, the backend returns a `503` listing the missing requirement names instead of a generic failure.

Current readiness requirements:

- `ADMIN_API_KEY`
- backend Firebase admin access through `FIREBASE_SERVICE_ACCOUNT_JSON` or `GOOGLE_APPLICATION_CREDENTIALS`

## Queue Endpoint

Read the open review queue:

```text
GET /admin/reviews/queue?limit=25
```

Returns:

- `claims`
- `businessVerifications`
- `identityVerifications`
- `storefrontReports`

## Review Actions

Owner claim:

```text
POST /admin/reviews/claims/:claimId
```

Business verification:

```text
POST /admin/reviews/business-verifications/:ownerUid
```

Identity verification:

```text
POST /admin/reviews/identity-verifications/:ownerUid
```

Storefront report:

```text
POST /admin/reviews/storefront-reports/:reportId
```

Expected body:

```json
{
  "status": "approved",
  "reviewNotes": "Optional reviewer notes"
}
```

## Status Mapping

Admin review decisions map into owner-visible records as follows:

- `approved` business verification -> `verified`
- `approved` identity verification -> `verified`
- `rejected` stays `rejected`
- `needs_resubmission` stays `needs_resubmission`

Storefront reports map to moderation fields:

- `approved` -> `reviewed`
- `rejected` -> `dismissed`
- `needs_resubmission` -> `open`

## Operational Notes

- Owner claim review advances onboarding toward business verification when approved.
- Business verification review advances onboarding toward identity verification when approved.
- Identity verification review advances onboarding toward billing when approved.
- Storefront report review writes moderation status, reviewer notes, and review timestamps.
- If `ADMIN_API_KEY` is present but backend Firebase admin access is missing, `/admin/reviews/*` now returns a clear `503` setup error instead of a generic `500`.

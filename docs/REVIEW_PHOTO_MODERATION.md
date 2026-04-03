# Review Photo Moderation

Updated: March 30, 2026

Canopy Trove treats member review photos as moderated community uploads, not instant-public content.

## Policy

- members can upload their own review photos
- uploads are private until moderation approves them
- unsafe, sexual, hateful, or otherwise noncompliant images are rejected or quarantined
- approved images may appear publicly on the storefront detail surface
- public review photos must never be available directly from the pending upload path

## Path Model

Storage paths:

- `community-review-media/pending/{profileId}/{storefrontId}/{draftId}/{fileName}`
- `community-review-media/quarantine/{storefrontId}/{reviewId}/{mediaId}/{fileName}`
- `community-review-media/approved/{storefrontId}/{reviewId}/{mediaId}/{fileName}`

Rules summary:

- pending uploads are writable only by the signed-in uploader or admins
- pending uploads are readable only by the signed-in uploader or admins
- quarantine is admin-only
- approved media is public-read and admin-write only

## Moderation Queue

Firestore moderation records live in:

- `storefront_review_photos`

Suggested fields:

- `id`
- `storefrontId`
- `profileId`
- `reviewId`
- `storagePath`
- `approvedStoragePath`
- `fileName`
- `mimeType`
- `size`
- `moderationStatus`
- `createdAt`
- `reviewedAt`
- `reviewNotes`

Suggested statuses:

- `pending`
- `needs_manual_review`
- `approved`
- `rejected`

## Notes

- The current rules are strict by default: nothing in the pending path is public.
- Storefront review photo URLs should only be generated from approved media.
- Owner storefront media remains a separate path and policy surface.

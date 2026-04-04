# Launch Operations Verification

Updated: March 31, 2026

## Purpose

These are the launch checks that code cannot prove by itself. They need one real human pass before store submission and launch week.

## Support Responsiveness Drill

Owner for launch week: `danielletuper@canopytrove.com`

Run this from an external inbox that is not already logged into the Canopy Trove domain:

1. Send a plain-text test email to `askmehere@canopytrove.com`.
2. Confirm the message lands in the monitored inbox within 5 minutes.
3. Reply from the real support mailbox identity.
4. Confirm the reply arrives back at the external inbox and shows the correct sender identity.
5. Open the support mailbox on mobile and desktop once each.
6. Verify spam/junk is not catching the inbound test.

Record:

- send timestamp
- receive timestamp
- reply timestamp
- sender identity shown to the customer
- any forwarding or deliverability issues

## Store Review Readiness Pack

Before submission, confirm these are assembled in one place:

1. Final screenshots from the exact release build.
2. Reviewer notes explaining any gated owner or admin surfaces.
3. Test credentials or a reviewer-safe path if a login is required.
4. Public links for support, privacy, terms, community guidelines, and account deletion.
5. A short description of what the app does and does not do:
   - licensed discovery
   - reviews
   - owner-managed storefront tools
   - not ordering or delivery

## Real Device Launch Sweep

Run this on the exact build intended for release:

1. Sign up and sign in as a customer.
2. Browse storefronts and open a storefront detail page.
3. Save a storefront.
4. Submit a text review.
5. Submit a review photo and confirm the moderation state is clear.
6. Sign in as an owner.
7. Upload a storefront card photo.
8. Upload a storefront gallery photo.
9. Confirm the media appears on the live storefront surfaces after publish.
10. Open billing and confirm the launch path is coherent.
11. Open support, privacy, terms, community guidelines, and deletion links from inside the build.
12. Run account deletion and verify the help flow still matches the shipped behavior.

## Ship Decision

The release is operationally ready when:

- the support drill passes end to end
- the reviewer pack is assembled
- the real-device sweep passes on the release build
- no blocker issue appears in Sentry or runtime monitoring during the sweep

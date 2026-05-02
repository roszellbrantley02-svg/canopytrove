# Multi-Location Claim Patterns — Research & Recommendations

**Prepared:** May 2026 · **Goal:** let chain owners (FlynnStoned, Verilife, Curaleaf NY, etc.) claim 3–10+ NY licensed dispensary storefronts without forcing them through full Twilio Voice OTP verification N times, and without lowering our security bar.

## Patterns Ranked (Recommendation Table)

Ranked best fit for Canopy Trove first. "Effort" assumes existing stack: Twilio Voice OTP, Firebase Auth, Cloud Run/Express, OCM SODA integration, Stripe (Pro-tier billing), no Plaid/POS today.

| #     | Pattern                                                                                                                                                                          | Security                                                                        | Owner UX (5 locations)                 | Implementation Effort                                                                            | Requires Existing Relationship          |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------- |
| **1** | **OCM-license-cluster auto-claim** (one Voice OTP unlocks every storefront whose OCM record shares a `license_holder_name` / parent entity)                                      | High — borrows from regulator's KYB                                             | **~3 min** (one OTP)                   | **Low** — we already query OCM SODA API + cache it server-side                                   | None — OCM data is public               |
| **2** | **Domain-email verification** (owner proves control of `@flynnstoned.com`, all storefronts whose website matches domain become claimable)                                        | Medium-High — domain TLS + DNS is hard to forge but spoofable for cheap domains | **~2 min** if email arrives instantly  | **Low-Medium** — SendGrid signed magic link + simple domain match against `dispensaries.website` | Domain ownership (most chains have one) |
| **3** | **Voice OTP to corporate HQ phone + multi-storefront token** (one OTP to a single number — typically the chain's HQ from OCM data — that grants claim on every sibling location) | Medium-High — phone control of HQ line                                          | **~3 min**                             | **Low** — tiny extension to current Voice OTP service                                            | None                                    |
| **4** | **Per-location Voice OTP, queued + parallelized** (UI lets owner trigger 5 OTPs in parallel and bounce between them; no batching, just better choreography)                      | High — same as today                                                            | ~10–15 min for 5                       | **Very Low** — pure frontend + queue endpoint                                                    | None                                    |
| **5** | **Manual admin review with documentary evidence** (owner uploads NY OCM license PDF + corporate filing per chain; admin batch-approves all locations under that entity)          | High — documents are auditable                                                  | **~10 min owner time + 24–48h review** | **Medium** — claim doc upload + admin queue (we have admin queue infra)                          | None                                    |
| **6** | **Stripe Connect / Atlas KYB tie-in** (chain links Stripe business account; we trust Stripe's KYB for the entity, then auto-claim every OCM-license-matched storefront)          | Very High — borrows Stripe's full KYB                                           | ~5 min if owner already has Stripe     | **High** — net-new Stripe Connect onboarding + identity matching                                 | Owner needs Stripe business account     |
| 7     | **POS integration (Dutchie / Treez / Flowhub)**                                                                                                                                  | High                                                                            | ~10 min                                | Very High — net-new OAuth integrations                                                           | Owner uses one of those POS systems     |

**Top recommendation:** Ship #1 (OCM-cluster auto-claim) as the headline multi-location feature, gated behind one #3-style HQ Voice OTP. Use #4 (parallelized per-location OTP) as the universal fallback. Defer #2 (domain email) to v2 — it's a nice cherry but adds an attack surface (cheap-domain spoof) without solving anything OCM-cluster doesn't already solve cleanly.

---

## Platform Research

### 1. Google Business Profile — "Bulk Verification" for chains

**Eligibility:** 10+ locations of the same merchant. Bulk-verified status attaches to the _merchant_, not the account — agencies can't bulk-verify across unrelated clients.

**Flow:** Owner creates a Google account on the business's domain (Gmail accounts get scrutinized harder). Creates a Business Group, uploads a spreadsheet of all locations (name/address/phone/website/category), fixes errors inline, submits **Verifications → Chain → Start**. Google reviews 1–12 weeks (community guides cite 8–12 typical). Weak-signal applications get bumped to **video verification** — a continuous unedited walk-through showing exterior signage, interior pan, and a "live management action" like unlocking the cash drawer or logging into a tablet. Once approved, all current and future locations under the Business Group skip individual verification.

**Identity proofing:** No formal documentary evidence up front. Google leans on domain-email signal + Business Group size matching the spreadsheet + discretionary video + ongoing audits. Bulk-verified status is _revocable_ if Google later finds the chain doesn't actually exist.

**What's clever:** Trades up-front friction (10 weeks of review + video) for amortized-near-zero per-location cost forever. The pre-Bulk era's per-location postcard mailing was the real pain — for a 50-store chain, months of lost cards and fraud risk every time a card was intercepted.

**What's broken:** 8–12 week review is brutal for new chains. Sterling Sky's documented advice: "expect to be rejected the first time and resubmit." Reviewers can't tell a 12-store franchise from a fake Business Group with 12 invented addresses, so chains under ~20 locations often bounce.

**Takeaway:** The Business-Group + spreadsheet model is the right information architecture (group locations under one merchant entity). The slow human review is unaffordable for a startup. We can borrow the "one identity proof unlocks the group" pattern but use **OCM regulator data as the proof** instead of human review.

### 2. Yelp — SMB Claiming API + 9-location aggregate accounts

**Two paths:**

**(a) Self-serve aggregate account** — Up to **9 locations** under one login. Each claim still goes through Yelp's standard phone-PIN verification (robocall to listed business phone, 4-digit PIN). The aggregate account is purely a unified dashboard — there's no skipped verification. Cap at 9 forces 10+ chains to either spawn multiple logins (split metrics) or escalate to sales ("a representative will contact you").

**(b) SMB Claiming API for partners** — Yelp Partners (agencies, Yext, etc.) get programmatic claim submission. POST `/v1/ingest/create` with `businesses[]` array (up to 500 IDs per request) + owner name/email + a `partner_name` field that customizes the email. Yelp emails the owner a signup link (PENDING). Owner clicks, signs up → APPROVED. Some claims drop to NEEDS_REVERIFY and require a phone-PIN call anyway. Partner polls `/v2/partner_biz_claim/request/status` (up to 500 IDs/query).

**Identity proofing:** Email-ownership-proves-claim + fallback phone-PIN on suspicious cases. Partner status itself is the gate.

**What's clever:** "One email → one click → claim resolves." Owner never leaves their inbox to confirm 50 claims. The 500-ID batch status query is operationally clean.

**What's broken:** The 9-location self-serve cap is arbitrary; mid-sized chains (3–8 locations) rarely qualify for Partner API and live with the per-location PIN grind.

**Takeaway:** The owner-side UX of one magic link claiming a whole batch is a great mental model. We can replicate it without the Partner API tier — single in-app confirmation claims all OCM-clustered storefronts at once.

### 3. Weedmaps for Business — direct competitor, lightest verification

**Flow (per location):** Visit weedmaps.com/business → "Claim Your Business." Enter legal name (must match license), address, phone, website, dispensary type. Upload photos (interior, exterior, products). Verification "usually completed via email or phone confirmation." For issues, contact Weedmaps Support with licensing status.

**Multi-location pattern:** Each profile claimed individually. Marketing copy says "manage multiple dispensary locations from a unified dashboard" — but the dashboard unifies _post-claim_; the claim itself is per-store. Curaleaf/Verilife/Trulieve onboard via enterprise sales, not the public flow.

**Identity proofing:** Email or phone — explicitly the same bar as a single location.

**What's clever:** Photo upload as a soft identity signal — interior shots of a NY licensed sales floor are hard to fake without breaking the law.

**What's broken:** No public bulk path at all. Chains either go through enterprise sales (slow, gated, contract required) or claim each location manually. This is the gap to exploit.

**Takeaway:** Weedmaps' enterprise-sales gate is a moat we can break by automating it. Our OCM SODA integration is the unlock — Weedmaps doesn't have it because per-state regulator integrations don't pencil out for a national platform; we're NY-only, so the cost is bounded.

### 4. Yext — enterprise listings management aggregator

**Flow:** Yext sits _above_ Google/Yelp/Facebook/Apple/200+ publishers as a syndication layer. A chain authorizes Yext once (sales-led enterprise onboarding), and Yext handles bulk verification on each downstream publisher on the chain's behalf. For Google specifically, Yext applies for Bulk Verification using its trusted-partner relationship.

**Identity proofing:** The contract is the gate — enterprise pricing ($999+/month minimum) prices out hobbyists and most fraud.

**What's clever:** Role-based approvals + audit trails per location — "the NY regional manager can edit hours but only the brand director can change the logo." This is the right pattern for chains where corporate HQ and the local store manager are different people.

**What's broken:** B2B enterprise pricing puts it out of reach for the 3–10 store chains that are Canopy Trove's wheelhouse.

**Takeaway:** Borrow the role-based access pattern for our Pro-tier multi-location dashboard. Don't compete with Yext on syndication.

---

## Synthesis — Patterns for Canopy Trove

### Pattern #1 (RECOMMENDED LEAD): OCM-license-cluster auto-claim

**Mechanism:** Owner passes Voice OTP for one storefront as today. Backend looks up that storefront's OCM record, extracts the **license holder name** (e.g., "FlynnStoned Cannabis Co LLC"), queries OCM for all other licenses held by the same legal entity. UI surfaces: _"We see [Holder Name] also operates 4 other licensed locations: [list]. Add them to your account?"_ — owner taps "Add all" → all four claimed in one transaction, no further OTP.

**Why this works for us:**

- We already cache the OCM SODA API (`ocmLicenseCacheService.ts`, TTL 1h) — joining on `license_holder_name` is one indexed lookup.
- The regulator has already done the KYB. If FlynnStoned Cannabis Co LLC owns 4 NY licenses, it's because OCM verified the entity during licensing. We piggyback on the strongest identity signal in the NY cannabis space.
- Voice OTP on the first location proves the human controls a phone listed on a licensed storefront. Combined with OCM-cluster lookup we have (a) phone control + (b) regulator-confirmed entity identity.
- Zero new vendor integrations. Backend-only.

**Failure modes:**

- Fuzzy matching: "FlynnStoned Cannabis Co LLC" vs "Flynnstoned Cannabis Co., LLC". Normalize aggressively (lowercase, strip punctuation, strip suffix tokens), confidence score, auto-claim only above 0.95, surface ambiguous matches as opt-in.
- License transfers: parent sells one location. OCM updates on hourly refresh; daily reconciliation job flags drift to admin queue, doesn't auto-revoke.
- Holding-company structures with single-purpose LLCs sharing only a beneficial owner — license-name match misses these. Falls back to Pattern #5.

**Implementation sketch:**

```
backend/src/services/ownerLicenseClusterService.ts
  - getLicenseClusterForStorefront(storefrontId)
  - confirmClaimCluster(ownerUid, primaryStorefrontId)

POST /owner-portal/locations/cluster-claim
  body: { primaryStorefrontId }
  response: { clustered: [...], requiresReview: [...] }
```

**Owner UX delta:** ~5 seconds beyond today's single-location flow. Instead of 5×3min = 15min, it's 3min + tap.

### Pattern #2: Domain-email verification

Owner enters `name@flynnstoned.com`, we send a signed magic link, click verifies. Storefronts whose `dispensaries.website` matches the domain become claimable in one batch.

**Why #2 not #1:** Cheap-domain spoofing is real — `flynnstoned-cannabis.com` is $12/year. Need a domain-age + WHOIS-stability heuristic plus manual review for domains registered <30 days. OCM-license matching has no such exposure.

**Where it shines:** Chains using single-purpose LLCs with a consistent public brand — domain catches what license-cluster misses.

**Effort:** Medium. Firebase Email Link + signed-token route + WHOIS API age check.

### Pattern #3: HQ-phone Voice OTP unlocking the cluster

Detect chain claim attempt. Offer: _"Verify the corporate HQ phone once instead of each store?"_ Voice OTP to the HQ number listed on OCM records. Single OTP grants claim on every license held by that corporate entity.

**Why #3:** Many small NY chains don't have a separate HQ phone — the founder's cell is the HQ phone. Pattern #1 covers them better. Most useful as the **OTP step inside Pattern #1** when we want one human-in-the-loop confirmation before auto-claiming a 6-location cluster.

**Effort:** Trivial. Existing Voice OTP service, different "to" number.

### Pattern #4: Parallelized per-location Voice OTP

Pure UI/queue work. After first claim succeeds, surface "Add another location?" — owner picks from typeahead, taps Verify; UI lets them queue up to 3 OTPs in flight simultaneously (different shop phones rarely collide). Progress chips show each call's state.

**Why this matters:** Universal fallback requiring zero new identity primitives. Even if Patterns #1–3 don't fit, parallelization collapses 5 sequential 3-min OTPs (15 min) into a 4–5 min queued session. Ships in days, not weeks — the right _first_ shipping target.

**Effort:** Very low. Frontend state machine + queue-aware claim status endpoint.

### Pattern #5: Manual admin review with OCM license PDFs

The escape hatch. Owner uploads NY OCM license PDFs per location + a corporate filing showing beneficial-owner / officer status. Admin batch-approves.

**Why we keep this:** Catches what Pattern #1 misses (holding-companies, recent acquisitions not yet in OCM cache, license transfers in flight). 24–48h SLA is reasonable for the long tail.

**Effort:** Medium. Reuse `adminReviewService.ts`; add multi-storefront claim type + document upload (Firebase Storage).

### Pattern #6: Stripe-KYB tie-in

Owner connects a Stripe Standard/Express account during Pro signup. Pull Stripe's verified business name + EIN, fuzzy-match against OCM holders, auto-claim cluster.

**Why #6:** Most NY dispensaries don't have Stripe business accounts (cannabis is largely cash + debit; Stripe excludes cannabis from standard ToS). Solves a problem only ~10% of our users have. Park for v2 if we expand to ancillary cannabis businesses.

### Pattern #7: POS integration (Dutchie / Treez / Flowhub)

Owner OAuths into their POS. POS confirms locations the user is provisioned at. We trust the POS signal.

**Why #7:** Three integrations to build, each multi-week with vendor approval cycles. Net-new attack surface. Pattern #1 covers the same chains for free.

---

## Recommended Build Sequence

1. **Week 1 — Pattern #4 (parallelized OTP):** Tactical UX fix. 3 stores drops from 15min to ~5min, today.
2. **Week 2–3 — Pattern #1 (OCM-license-cluster):** Headline feature. Index `ocmLicenseCacheService` by normalized holder name; cluster lookup; `POST /owner-portal/locations/cluster-claim`; "add all 3 sibling locations" prompt in post-OTP success flow.
3. **Week 4 — Pattern #5 (admin escape hatch):** Productize manual review for weird corporate structures.
4. **v2 — Pattern #2 (domain email):** After we have data on which clusters Pattern #1 misses.
5. **Defer indefinitely — Patterns #6 (Stripe) and #7 (POS):** Only revisit if a major chain blocks adoption.

## Key Risks & Mitigations

- **Fuzzy-match false positives.** Confidence ≥0.95 for auto-add; below, opt-in gating screen. Log every cluster-claim with the normalized name pair for audit.
- **License transfers leaving stale `additionalLocationIds`.** Daily reconciliation job comparing claimed locations against current OCM holder; flag drift to admin queue, don't auto-revoke.
- **Insider at one OCM-listed store uses Pattern #1 to claim the whole cluster.** For clusters of 3+ siblings, require Pattern #3-style HQ OTP confirmation as a second factor. 1–2 location cases skip (no escalation).
- **Apple App Review concern.** Pattern #1's identity story is _stronger_ than today's flow — adds regulator-confirmed entity identity on top of phone control. Document in `docs/OWNER_PORTAL_ARCHITECTURE.md`.

---

## Sources

- [Google: Verify Business Profiles in bulk](https://support.google.com/business/answer/4490296?hl=en) · [Bulk location management](https://support.google.com/business/answer/3217744?hl=en) · [Video verification](https://support.google.com/business/answer/14271705?hl=en) · [Sterling Sky bulk-verification tips](https://www.sterlingsky.ca/passing-gbp-bulk-verification/)
- [Yelp SMB Claiming API](https://docs.developer.yelp.com/docs/claiming) · [Claim Status API](https://docs.developer.yelp.com/reference/get_partner_biz_claim_status_v1) · [Multi-location management](https://business.yelp.com/resources/articles/managing-yelp-presence-multiple-locations/) · [9-location cap forum thread](https://localsearchforum.com/threads/yelp-limits-for-claiming-multiple-sites.48430/)
- [Weedmaps for Business](https://weedmaps.com/business/retailers-verification/) · [Weedmaps profile setup — CMA](https://www.thecannabismarketingagency.com/cannabis-seo/weedmaps-profile-setup)
- [Yext: Bulk Verification for GBP](https://help.yext.com/hc/en-us/articles/360032518772-Bulk-Verification-for-Google-Business-Profile) · [Yext Listings platform](https://www.yext.com/platform/listings)
- [Plaid Identity Verification](https://plaid.com/use-cases/instant-onboarding-identity-verification/)

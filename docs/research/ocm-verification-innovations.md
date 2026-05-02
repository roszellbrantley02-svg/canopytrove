# OCM Owner Verification — Innovative Approaches

Research date: 2026-05-02. Scope: cleverer ways to verify "this person actually owns this NY-licensed dispensary," specific to the NY OCM domain. Generic KYC vendors (Plaid, Persona, Veriff) deliberately deprioritized.

## Approaches ranked

| #   | Approach                                                                                                                                                                                                                               | Forgery resistance                                                                                          | Owner UX (steps / time)                    | Implementation effort                                                               | Cost / verification        | Multi-location?                                        |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------- | -------------------------- | ------------------------------------------------------ |
| 1   | **`entity_name` SODA group + Twilio shop-phone OTP at parent level** (claim parent entity once, auto-grant all child locations)                                                                                                        | Medium-High (current Twilio strength + structural rollup)                                                   | 1 call, ~90s                               | **1–2 days** (we already have Twilio Voice + jskf-tt3q)                             | $0.02 once vs $0.02×N      | **Yes — native**                                       |
| 2   | **`primary_contact_name` cross-check + government-ID selfie via on-device DocV** (Apple's `DataScannerViewController` + `Vision` for OCR — no vendor)                                                                                  | Very High (state-listed contact name must match ID)                                                         | 2 photos, ~60s                             | 5–7 days (RN bridge to native OCR + face-match heuristic)                           | ~$0                        | Yes — once per parent entity                           |
| 3   | **State Tax-ID (`external_tpid`) match from `gttd-5u6y`** — owner enters their NY business tax ID; we match against the Tax & Finance registered-retailer dataset                                                                      | Very High (tax ID is non-public to non-operators)                                                           | 1 form field, ~20s                         | **0.5–1 day** (just add the dataset to backend cache)                               | $0 (free SODA)             | Yes — `external_tpid` rolls up multi-location entities |
| 4   | **OCM Scan-to-Verify placard** — owner scans their _own_ state-issued placard from inside our app, we verify the encoded URL against `cannabis.ny.gov/dispensary-location-verification`                                                | Medium (placard is physically accessible to staff, not just owners)                                         | 1 scan, ~10s                               | 3–5 days (scope out the QR encoding empirically; today the QR is just a static URL) | $0                         | Per-location only                                      |
| 5   | **NY DOS (Division of Corporations) `entity_name` exact-match + postal magic-link to principal-office address**                                                                                                                        | Very High (mail interception is felony)                                                                     | Mail wait 5–10 days, 1 click               | 4–6 days (DOS scrape + Lob/USPS Informed Visibility + Resend signed link)           | ~$1.50 (postcard + Lob)    | Yes if the parent entity is the same                   |
| 6   | **Domain-control (`TXT` record on `business_website`)** — `business_website` is populated for ~741 records on jskf-tt3q                                                                                                                | High (DNS access ≈ ownership)                                                                               | 5–10 min (depends on owner's DNS literacy) | 1–2 days                                                                            | $0                         | Per-website only                                       |
| 7   | **METRC Retail-ID QR scan within active business hours from on-site GPS** — owner scans 3 random retail-ID QRs from their inventory; we cross-check that license_id is theirs and the geofence matches the OCM-listed `address_line_1` | Very High (METRC IDs are physically inside the locked sales floor; geofence + recency guards remote replay) | 3 scans + GPS, ~45s                        | 7–10 days (METRC API access not public — would need OCM partnership)                | $0 once API access secured | Per-location                                           |

**Recommended stack:** ship #3 (Tax ID match — cheapest, fastest) + #1 (entity-rollup Twilio call to the _parent entity's_ primary public number) for v1. Add #2 (gov-ID selfie + `primary_contact_name` match) as a "high-trust" tier for owners who want verified-badge perks. #5 (postal magic-link) only for disputed or contested claims.

---

## 1. Confirmed `jskf-tt3q` fields you can use today

Verified live against `https://data.ny.gov/resource/jskf-tt3q.json` on 2026-05-02:

| Field                                     | Confirmed? | Population                   | Verification value                                                                                                                                                                                                                                                                                                                             |
| ----------------------------------------- | ---------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `entity_name`                             | **Yes**    | 100%                         | Legal entity — groups multi-location operators (e.g. `Curaleaf NY, LLC` has 3 retail locations, `Twisted Cannabis FLX LLC` has 3, `Fiorello Pharmaceuticals` has 3, ~14 entities own ≥2 retail licenses)                                                                                                                                       |
| `primary_contact_name`                    | **Yes**    | ~99%                         | A real person's name. Does NOT specify role (owner / officer / GM), but is the OCM's authoritative contact — match this to a government ID and you have a high-trust signal. Top contacts each have 7–11 licenses (e.g. `Peter Shafer` is on 11 licenses, `Jason Minard` on 9 — these are likely cultivation/processing operators, not retail) |
| `application_number`                      | **Yes**    | 100%                         | Maps to a separate (currently non-public) application packet — could be useful as a knowledge-test challenge ("what's your application number?") that only an actual applicant would know                                                                                                                                                      |
| `business_website`                        | **Yes**    | 741 of 2786 records (~26.6%) | Enables domain-control verification (DNS TXT) for the subset of operators with a registered website                                                                                                                                                                                                                                            |
| `location_id`                             | **Yes**    | 100%                         | UUID per operating address. Useful as the canonical location key for multi-location claim flows and for the placard QR (probable encoding)                                                                                                                                                                                                     |
| `dba`                                     | **Yes**    | High                         | The consumer-facing name that should match the storefront sign and Google listing — useful as a sanity check                                                                                                                                                                                                                                   |
| `see_category`                            | **Yes**    | Subset                       | Social-equity flags (`Women-Owned Business`, `Service-Disabled Veteran`, `Justice-Involved Individual`). Could power equity-priority badges separately                                                                                                                                                                                         |
| `principal_officer` / `responsible_party` | **No**     | —                            | **Confirmed absent.** OCM does not publish principal-officer names. The `primary_contact_name` field is the closest analog — but it's a "primary contact," not a legal owner attestation                                                                                                                                                       |
| Cryptographic signature                   | **No**     | —                            | OCM does not publish signed/sealed verification artifacts. No PKI. No attestation envelope. Trust is "you fetched it from a `data.ny.gov` HTTPS endpoint"                                                                                                                                                                                      |

## 2. Other NY datasets that complement `jskf-tt3q`

Verified by querying `https://data.ny.gov/api/catalog/v1?q=cannabis`:

- **`gttd-5u6y` — NYS Registered Retail Dealers of Adult-use Cannabis Products** (Department of Taxation and Finance). Contains `external_tpid` (8–9-digit Taxpayer ID), `legal_name`, `dba_name`, `ocm_license_number`, georeferenced coordinates. **The `external_tpid` is the killer field — it's the state's tax-collection identifier, only known to actual operators and their accountants.** Asking an owner to confirm their tax ID and matching it to this dataset is essentially free, requires no third party, and is much harder to forge than a public phone number.
- **`4r7n-55mm` — Current Cannabinoid Hemp Licenses** (lower-trust hemp-only operators; not NY adult-use cannabis, ignore for dispensary verification but useful for a future hemp brand registry).
- **`f382-bnu5` — Cannabis Retail Sales by Month** (aggregate, no per-licensee data — not useful for verification).
- **`bqby-dyzr` — Cannabis Applications** (this is the **Connecticut** Cannabis Applications dataset, not NY — confirmed via SODA 404 and metadata). NY does not publish a per-applicant dataset.

## 3. OCM Scan-to-Verify placard

**Confirmed empirical findings:**

- The placard is a static QR encoding the URL `https://cannabis.ny.gov/dispensary-location-verification` (a single static HTML table of all licensees).
- **The URL does NOT carry a `location_id` or `license_number` parameter** — `?location_id=<uuid>` produced a 200 but the page rendering doesn't change. The QR scope is "this state has authorized dispensaries; here's the list" — not "this specific shop is licensed."
- This is the **honest reviewer-facing position** Canopy Trove already encodes in its review notes: scanning the state placard from our Verify tab opens Safari to the OCM list page; we don't intercept it.
- **Innovative use:** even though the QR isn't location-specific today, you can build a flow where an owner takes a photo of _their physical placard_ + their storefront sign + a selfie holding a one-time code on a piece of paper. Combine with on-device EXIF GPS + reverse geocode + match against `jskf-tt3q` `address_line_1`. That's **photo-evidence-of-physical-presence** verification — geofence + photo + visible state-issued artifact + visible operator face. No API needed. ~$0 cost. Low-tech, high-trust for in-person reviewer-style audits. Implementation 4–6 days; UX is heavier (3 photos + GPS), so reserve for high-trust tier.

## 4. NY DOS (Division of Corporations) cross-reference

`https://apps.dos.ny.gov/publicInquiry/` exposes a free public web inquiry. **No first-party JSON API**, but the public records include CEO name, registered agent name, and principal office address — all of which an OCM `entity_name` should match exactly.

**Verification flow (high-trust, low-volume):**

1. Owner enters their OCM license number → we look up `entity_name` from `jskf-tt3q`.
2. We scrape DOS public inquiry for that exact entity (or use a third-party scraper API like Apify's `parseforge/ny-business-entity-scraper`).
3. We extract the registered-agent address (this is the legal service-of-process address, often different from the storefront).
4. We mail a postcard via Lob with a one-time signed magic-link to that address.
5. Owner clicks the link from the postcard, attests to the claim.

Mail interception is a federal felony (18 U.S.C. §1708), so this is the highest-trust verification short of in-person video. Cost ~$1.50 per postcard, latency 5–10 business days. Reserve for **disputed claims** and **high-value owner-portal features** (financial reporting, multi-location admin) — not for first-touch claim.

The DOS dataset also enables **legal-name fuzzy match flagging**: if `OCM.entity_name = "100 North 3rd Ltd"` but DOS has no exact match (e.g. only `"100 North 3rd, Limited"`), that's a corporate-records hygiene flag worth surfacing in the owner portal.

## 5. Federal / cross-state signals

- **METRC** is now NY's seed-to-sale system as of Dec 2025 (mandatory by Jan 2026). The METRC Connect API is open to integrators _with OCM authorization_ — not a public API. If you can become a METRC integration partner, you'd unlock per-license inventory data including who's actually selling product, what's been sold, and the Retail-ID QR codes printed on every retail unit. **The killer move:** ask an owner to scan 3 random Retail-ID QRs from their on-shelf inventory in their store (geofenced + within business hours). Each Retail-ID resolves to a `package_id` → `license_id` chain. If all three match the claimed license_id and the GPS matches the OCM `address_line_1`, you have proof of physical-inventory-control — which is essentially proof of operation.
- **CCA (Cannabiz Credit Association) 2.0** launched April 2026 with a "proprietary cannabis license matching system" backed by $2.6B+ in receivables data. This solves the entity-name normalization problem (e.g. `"100 North 3rd Ltd"` ≠ `"100 NORTH 3RD LTD."` ≠ `"100 N. 3rd Limited"`). Worth evaluating as a paid name-resolution layer for the multi-state expansion phase, not v1.
- **No federal cannabis registry exists** (Schedule I federal status precludes it). The DEA registrant database covers Schedule II–V medical marijuana programs only, not adult-use.

## 6. Cannabis-specific KYC / verification vendors

- **Treez / Flowhub / Dutchie / Blaze / Cova** — POS systems with built-in license verification, but they verify _during onboarding for their POS service_ — they're not a verification API you can call. None of them sell standalone owner-verification APIs.
- **CannabisVerify** — patient verification only; not for owners.
- **IDScan.net / VeriScan** — customer age verification at register; not owner verification.
- **Confia** — was a cannabis-banking compliance platform; **shut down 2023**. Don't include.
- **SureTec / BigPicture** — not currently active in cannabis-specific compliance per 2026 search; SureTec is bonds/insurance-adjacent.
- **Simplifya / Cova compliance / BioTrack** — license-management software for _operators_, not third-party verification APIs.

**Net:** there is no off-the-shelf "verify this NY cannabis owner" API. You either build it (rec) or partner with METRC.

## 7. Modern owner-side verification patterns (re-evaluated for cannabis)

| Pattern                                                               | Verdict for Canopy Trove                                                                                                                                                                                                                                                                                                                                                                                                                                |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bank micro-deposit / micro-charge                                     | **Skip.** Cannabis banking is fragmented (most NY dispensaries use credit unions or specialty processors like Aeropay/Hypur). Plaid coverage is weak in this segment, and asking for bank credentials adds enormous friction for marginal trust gain over Tax ID match (#3).                                                                                                                                                                            |
| Selfie + driver's license + name match against `primary_contact_name` | **Use as Tier-2.** Build with on-device Vision OCR (free) + a face-match heuristic (Apple's `LocalAuthentication.LAContext` won't do face-match against a static photo, but `Vision.VNDetectFaceLandmarksRequest` will, and there's no API cost). Match the OCR-extracted name against `primary_contact_name`. Confidence is medium since `primary_contact_name` is "primary contact" not "owner," but combined with #1 (Twilio shop call) it's strong. |
| Domain-control (TXT record)                                           | **Ship for the 26.6% of licensees with `business_website`.** Cheap, hard to forge, requires DNS access which 90% of small shops don't have direct access to — but their web developer or marketing agency does, and asking the owner to ask their developer to add a TXT record is a meaningful trust signal in itself (only an owner has authority to make that ask).                                                                                  |
| Social media handle verification                                      | **Skip.** The OCM dataset doesn't include verified social handles, and Instagram/TikTok cannabis content is heavily suppressed/shadow-banned, making OCR detection unreliable.                                                                                                                                                                                                                                                                          |
| Knowledge-test challenge (`application_number`)                       | **Add as a low-cost CAPTCHA-style add-on.** Ask the claimant to enter their `application_number` (e.g. `OCMRETL-2023-000090`). It's listed in `jskf-tt3q` so a sufficiently motivated bad actor can find it, but it raises the floor and pairs well with #1 + #3.                                                                                                                                                                                       |

---

## Recommended phased rollout

**Phase 1 (this sprint, 2–3 days):**

- Add `gttd-5u6y` to backend cache as a sibling of `ocmLicenseCacheService.ts`.
- New owner-claim flow: enter OCM license number → display masked entity name → owner enters Tax ID → match against `external_tpid` → if match, proceed to Twilio call to public phone for OTP.
- For multi-location entities: after a single verified claim, surface "Claim N other locations registered to this entity" (uses `entity_name` group from jskf-tt3q).

**Phase 2 (3–5 days, after multi-location-claim research lands):**

- Add Tier-2 verified-badge: gov-ID selfie + `primary_contact_name` exact match via on-device Vision OCR.
- Add `application_number` knowledge challenge as anti-bot guard.

**Phase 3 (next quarter, opportunistic):**

- METRC integrator partnership conversation with OCM.
- Lob-based postal magic-link for disputed claims and owner-portal high-value actions (e.g. payouts, deletion).
- Domain-control TXT verification for the 741 licensees with `business_website`.

## Things to verify before shipping

1. **`external_tpid` collision rate.** Same TPID can theoretically appear on multiple OCM licenses if the same parent entity holds e.g. retail + processor + cultivation. Confirm with `SELECT external_tpid, count(ocm_license_number) FROM gttd-5u6y GROUP BY external_tpid HAVING count > 1` — if collisions exist, that's a _feature_ (it's the rollup key for multi-location).
2. **`primary_contact_name` semantics.** Is this always a principal officer, or is it sometimes a compliance attorney or a third-party agent? Ask OCM directly; if it's frequently a non-owner agent, demote #2 from "Very High" to "Medium-High" forgery resistance.
3. **OCM placard QR encoding empirical test.** Take a photo of an actual placard at a real NY dispensary and decode the QR before assuming it's the static URL. There's a non-zero chance the QR includes a `?location_id=` param the static-page logic ignores but the _intended_ design supported.
4. **Tax ID privacy posture.** Ensure UI never displays the entered TPID after match — store as a salted hash. NY tax IDs aren't SSNs but they're business-sensitive (federally an EIN is non-public for the same reason).

## Sources

- [Current OCM Licenses dataset (jskf-tt3q)](https://data.ny.gov/resource/jskf-tt3q.json)
- [NYS Registered Retail Dealers of Adult-use Cannabis (gttd-5u6y)](https://data.ny.gov/resource/gttd-5u6y.json)
- [OCM Dispensary Location Verification](https://cannabis.ny.gov/dispensary-location-verification)
- [OCM Buy Legal map (Next.js front-end backed by `https://buylegal.cannabis.ny.gov/api/map/...` proxy)](https://buylegal.cannabis.ny.gov/)
- [NY DOS Division of Corporations Public Inquiry](https://apps.dos.ny.gov/publicInquiry/)
- [OCM Seed-to-Sale (METRC) FAQs](https://cannabis.ny.gov/sts-faqs)
- [METRC Retail ID Resource Center](https://www.metrc.com/retailid/retail-id-resource-center/)
- [Cannabiz Credit Association CCA 2.0 announcement](https://www.globenewswire.com/news-release/2026/04/28/3283012/0/en/The-Cannabis-Industry-Has-a-Credit-Bureau-CCA-2-0-Sets-the-Standard.html)
- [data.ny.gov SODA API discovery for "cannabis" tag](https://data.ny.gov/api/catalog/v1?q=cannabis)
- [Distru — How to Verify OCM Dispensary Identification](https://www.distru.com/cannabis-blog/how-to-verify-ocm-dispensary-identification-in-2025)
- [Apify NY Business Entity Scraper (third-party DOS data)](https://apify.com/parseforge/ny-business-entity-scraper)

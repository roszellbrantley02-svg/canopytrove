# Android Moderation & Compliance Spec

**Version:** 2026-04-05-android-v1
**Status:** Implementation-ready draft (not legal advice)
**Policy basis:** Google Play marijuana-sales facilitation policy + UGC moderation requirements

---

## Core Rule

On Android, owner-created cards may **inform** but may **not** help a user buy cannabis.

Android can show: store updates, events, educational notices, hours changes, amenities, community announcements, brand/news content.

Android must not show: cannabis discounts, product specials, price-led promos, ordering/pickup/delivery/reserve language, anything that behaves like a sales funnel.

---

## 1. Moderation Data Model

Add these types to `backend/src/types.ts` and `src/types/ownerPortal.ts`.

```typescript
// --- Platform & content classification ---

type ClientPlatform = 'android' | 'ios' | 'web';

type ContentCategory =
  | 'announcement'
  | 'event'
  | 'community'
  | 'hours_update'
  | 'amenity_update'
  | 'education'
  | 'promotion';

type ModerationDecision = 'allowed' | 'review_required' | 'blocked';

type ModerationReasonCode =
  | 'PRICE_OR_DISCOUNT'
  | 'PRODUCT_TERM'
  | 'TRANSACTION_CTA'
  | 'ORDER_FLOW_LANGUAGE'
  | 'DELIVERY_OR_PICKUP'
  | 'MENU_SHOPPING_LANGUAGE'
  | 'AMBIGUOUS_EVENT_PROMO'
  | 'IMAGE_TEXT_REVIEW_REQUIRED'
  | 'UNKNOWN_RISK';

// --- Per-platform moderation result ---

interface PlatformModeration {
  decision: ModerationDecision;
  reasons: ModerationReasonCode[];
  reviewedAt?: string | null;
  reviewedBy?: string | null;
}

// --- Attached to every owner card/promotion ---

interface OwnerCardModeration {
  category: ContentCategory;
  overallDecision: ModerationDecision;
  android: PlatformModeration;
  ios: PlatformModeration;
  web: PlatformModeration;
  classifierVersion: string; // e.g. "2026-04-05-android-v1"
}

interface PlatformVisibility {
  android: boolean;
  ios: boolean;
  web: boolean;
}
```

### Where to add

Extend `OwnerStorefrontPromotionDocument` (currently in `src/types/ownerPortal.ts` line 225) with:

```typescript
export type OwnerStorefrontPromotionDocument = {
  // ... existing fields (id, storefrontId, ownerUid, title, description, etc.) ...

  // NEW: moderation fields
  moderation?: OwnerCardModeration;
  platformVisibility?: PlatformVisibility;
};
```

Mirror the same additions on the backend type in `backend/src/types.ts` (promotion fields near line 134).

---

## 2. Input Fields to Moderate

Concatenate all of these into one normalized text blob before classification:

- `title`
- `description` / body
- `badges` / chips
- CTA label
- CTA destination label
- Image OCR text (if available)
- Event summary text
- Chat / event pinned message text

### Normalization steps

1. Lowercase
2. Collapse whitespace
3. Strip punctuation except `%` and `$`
4. Convert Unicode quotes/dashes to ASCII equivalents
5. Split hyphenated terms (`pre-roll` -> `pre roll`)
6. Detect obfuscation: `d e a l`, `d!scount`, `b0go`

---

## 3. Red List -- Auto-Block on Android

If **any** red rule matches, `android.decision = 'blocked'`.

### Price / discount patterns

| Pattern                        | Catches           |
| ------------------------------ | ----------------- |
| `\b\d{1,3}%\s*off\b`           | 20% off, 50% off  |
| `\$\d+\s*off\b`                | $5 off, $10 off   |
| `\bdiscount\b`                 | discount          |
| `\bdeal\b` / `\bdeals\b`       | deal, deals       |
| `\bsale\b`                     | sale              |
| `\bspecial\b` / `\bspecials\b` | special, specials |
| `\bbogo\b`                     | BOGO              |
| `\bbuy one get one\b`          | buy one get one   |
| `\bdoorbuster\b`               | doorbuster        |

### Product terms

| Pattern              | Catches                   |
| -------------------- | ------------------------- |
| `\bflower\b`         | flower                    |
| `\bpre[- ]?rolls?\b` | pre-roll, prerolls        |
| `\bedibles?\b`       | edible, edibles           |
| `\bcarts?\b`         | cart, carts               |
| `\bvapes?\b`         | vape, vapes               |
| `\bconcentrates?\b`  | concentrate, concentrates |
| `\bthc\b`            | THC                       |
| `\bindica\b`         | indica                    |
| `\bsativa\b`         | sativa                    |
| `\bhybrid\b`         | hybrid                    |
| `\bounces?\b`        | ounce, ounces             |
| `\bgrams?\b`         | gram, grams               |

### Transaction / order language

| Pattern             | Catches       |
| ------------------- | ------------- |
| `\border now\b`     | order now     |
| `\border\b`         | order         |
| `\bbuy now\b`       | buy now       |
| `\bshop now\b`      | shop now      |
| `\breserve\b`       | reserve       |
| `\bpre[- ]?order\b` | pre-order     |
| `\bpickup\b`        | pickup        |
| `\bcurbside\b`      | curbside      |
| `\bdelivery\b`      | delivery      |
| `\bshop our menu\b` | shop our menu |

### Compound red rule

Block if any single line contains **both**:

- one product term, **and**
- one price/discount **or** transaction term

Compound examples that trigger block: `20% off flower`, `cart deals tonight`, `reserve pickup now`, `shop our menu`, `THC specials`.

### `\bmenu\b` special rule

`menu` alone is yellow. `menu` paired with an order verb (`shop`, `order`, `buy`, `reserve`) is red.

---

## 4. Yellow List -- Manual Review on Android

If no red rule matches but a yellow pattern matches, `android.decision = 'review_required'`.

| Pattern                   | Catches             |
| ------------------------- | ------------------- |
| `\blimited time\b`        | limited time        |
| `\bexclusive\b`           | exclusive           |
| `\bfeatured\b`            | featured            |
| `\bmember appreciation\b` | member appreciation |
| `\bcelebration\b`         | celebration         |
| `\bvendor day\b`          | vendor day          |
| `\bguest vendor\b`        | guest vendor        |
| `\b420\b` / `\b4\/20\b`   | 420, 4/20           |
| `\bdrop\b`                | drop                |
| `\blaunch\b`              | launch              |
| `\bmenu spotlight\b`      | menu spotlight      |
| `\bsamples?\b`            | sample, samples     |
| `\bpop[- ]?up\b`          | pop-up, popup       |

### Reviewer rule

Approve only if the content reads like store/event/community information, not purchase encouragement.

---

## 5. Green List -- Auto-Allow on Android

Auto-allow when **all** of the following are true:

- No red matches
- No yellow matches
- Category is one of: `announcement`, `event`, `community`, `hours_update`, `amenity_update`, `education`

Safe examples: "Open late Friday", "Yoga event Sunday morning", "Parking entrance moved", "Veteran-owned business", "Educational session on terpenes", "Live music and food trucks".

---

## 6. Decision Logic

```
normalize(text)
ocrText = ocrImage(image) if image exists
text = text + ' ' + ocrText

if (matchesRedRule(text)):
    android.decision = 'blocked'
    android.reasons = [matched red codes]
elif (matchesYellowRule(text)):
    android.decision = 'review_required'
    android.reasons = [matched yellow codes]
else:
    android.decision = 'allowed'
    android.reasons = []

// iOS and web default to 'allowed' (or apply your own policy)
ios.decision = 'allowed'
web.decision = 'allowed'
```

---

## 7. Review Queue

### New backend service

Create: `backend/src/services/ownerContentModerationService.ts`

### Queue entry fields

```typescript
interface ModerationQueueEntry {
  contentId: string;
  storefrontId: string;
  submittedByOwnerId: string;
  submittedAt: string;
  platform: ClientPlatform;
  normalizedText: string;
  matchedRules: ModerationReasonCode[];
  imageOcrText: string | null;
  reviewStatus: 'pending_review' | 'approved' | 'rejected' | 'published' | 'removed';
  reviewNotes: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
}
```

### Queue rules

| Content class                        | Action                          |
| ------------------------------------ | ------------------------------- |
| Green                                | Skip queue, publish immediately |
| Yellow                               | Enter queue for Android review  |
| Red                                  | Reject immediately for Android  |
| iOS/web approved but Android blocked | Split visibility                |

### Reviewer actions

- `approve_android`
- `reject_android`
- `approve_ios_web_only`
- `request_edit`

---

## 8. API Contract

### Platform header

Every relevant request sends:

```
X-Client-Platform: android | ios | web
```

Prefer header + server-side auth context. Backend filters responses accordingly.

### POST /owner/cards -- Create

**Request:**

```json
{
  "title": "Community cleanup this Saturday",
  "description": "Join us at 10 AM for a neighborhood cleanup.",
  "badges": ["Community", "Saturday"],
  "category": "community",
  "imageUrl": null
}
```

**Green response (published everywhere):**

```json
{
  "id": "card_123",
  "status": "published",
  "platformVisibility": {
    "android": true,
    "ios": true,
    "web": true
  },
  "moderation": {
    "category": "community",
    "overallDecision": "allowed",
    "android": { "decision": "allowed", "reasons": [] },
    "ios": { "decision": "allowed", "reasons": [] },
    "web": { "decision": "allowed", "reasons": [] },
    "classifierVersion": "2026-04-05-android-v1"
  }
}
```

**Yellow response (Android pending review):**

```json
{
  "id": "card_124",
  "status": "pending_review",
  "platformVisibility": {
    "android": false,
    "ios": true,
    "web": true
  },
  "moderation": {
    "category": "event",
    "overallDecision": "review_required",
    "android": { "decision": "review_required", "reasons": ["AMBIGUOUS_EVENT_PROMO"] },
    "ios": { "decision": "allowed", "reasons": [] },
    "web": { "decision": "allowed", "reasons": [] },
    "classifierVersion": "2026-04-05-android-v1"
  }
}
```

**Red response (Android blocked):**

```json
{
  "error": {
    "code": "ANDROID_PROMOTION_BLOCKED",
    "message": "This content cannot be shown on Android because it includes cannabis sales or order-driving language.",
    "reasons": ["PRICE_OR_DISCOUNT", "PRODUCT_TERM"]
  }
}
```

### Read path filtering

All consumer APIs strip blocked content before responding to Android. Android **never** receives blocked content in payloads. Blocked cards are absent entirely -- not hidden client-side, not flagged, just missing.

---

## 9. Backend Enforcement Points

### New file

`backend/src/services/ownerPortalPromotionModerationService.ts`

Responsibilities: normalize text, classify green/yellow/red, return per-platform visibility, emit reason codes, optionally process OCR text.

### Write path (create/update)

Files: `backend/src/routes/ownerPortalWorkspaceRoutes.ts`, `backend/src/services/ownerPortalWorkspaceService.ts`

On every create/update of an owner card or promotion:

1. Run moderation classifier
2. Persist moderation fields on the document
3. Reject Android-blocked content (return error to owner)
4. Queue Android-review content
5. Set `platformVisibility` accordingly

### Read path (consumer APIs)

Files: `backend/src/storefrontService.ts`, `backend/src/services/ownerPortalWorkspaceService.ts`

Key surfaces to filter:

- Storefront list payloads (promotion text, badges, card variant)
- Storefront detail payloads (activePromotions array)
- Browse/discovery feeds
- Search results
- Notification payloads

Rule: if `X-Client-Platform: android`, strip any card/promotion where `platformVisibility.android === false` or `moderation.android.decision !== 'allowed'`.

---

## 10. Platform-Aware Client Requests

Files: `src/services/storefrontBackendHttp.ts`, `src/services/ownerPortalWorkspaceService.ts`

Add to every API call:

```typescript
import { Platform } from 'react-native';

const headers = {
  'X-Client-Platform':
    Platform.OS === 'android' ? 'android' : Platform.OS === 'ios' ? 'ios' : 'web',
};
```

---

## 11. Owner Composer UI

File: `src/screens/OwnerPortalPromotionsScreen.tsx`

### Android behavior in composer

- Show policy helper text explaining what Android allows
- Run local red/yellow validation before submit (mirror backend rules)
- If content is red: block publish on Android, show inline explanation
- If yellow: mark `review_required`, show "pending review" state
- If green: mark `allowed`

### Suggested UX copy

- "Announcements and events can appear on Android."
- "Discounts, product deals, and order-driving language are not allowed on Android."
- "This content will appear on iOS and web only." (for red content the owner insists on)

### Utility layer

File: `src/screens/ownerPortal/ownerPortalPromotionUtils.ts`

Centralize:

- Android-safe label generation
- Blocked-phrase local checks (red/yellow regex)
- Category defaults
- Platform-aware helper text

---

## 12. Android Consumer UI Renaming

### Browse filters

File: `src/components/BrowseFiltersBar.tsx` (lines 186, 196)

| Current (risky)                              | Android replacement                           |
| -------------------------------------------- | --------------------------------------------- |
| "Toggle specials"                            | "Toggle updates"                              |
| "Shows only storefronts with live specials." | "Shows only storefronts with recent updates." |
| "Specials" chip                              | "Updates" chip                                |

### Card rendering

File: `src/components/storefrontRouteCard/StorefrontRouteCardSections.tsx` (lines 115, 120)

| Current field                    | Android treatment                       |
| -------------------------------- | --------------------------------------- |
| `promotionText`                  | Render as update text (no deal framing) |
| `promotionBadges`                | Suppress discount/product badges        |
| `activePromotionCount`           | Rename context to "updates"             |
| `hasLiveDeals`                   | Do not expose on Android                |
| `premiumCardVariant: 'hot_deal'` | Map to `'standard'` on Android          |

### Tabs and sections

Files: `src/components/CanopyTroveTabBar.tsx`, `src/screens/browse/BrowseSections.tsx`

Remove or rename on Android: "Hot Deals", "Specials", "Deals near you".

### General Android UI rules

- No deal wording
- No price wording
- No urgency copy tied to buying
- No "shop menu" or "reserve now"
- No discount badges
- Keep the card visually strong, textually informational

---

## 13. Notifications

Files: `src/services/devicePushNotificationService.ts`, `backend/src/services/ownerPortalPromotionSchedulerService.ts`

### Android allowed

- Event reminders
- Hours updates
- Community announcements
- Amenity updates

### Android blocked

- Discount alerts
- Product promos
- Order nudges
- Pickup/delivery reminders tied to cannabis

---

## 14. Event Chat Moderation (Future)

If you ship event chat, apply the same red/yellow rules on every message.

### Required controls

- Keyword filter at submit time (same red/yellow engine)
- Report button
- Block / mute / remove tools
- Abuse escalation path
- Owner / user suspension policy
- Audit logs for moderation actions

### Red examples in chat (always blocked on Android)

- "20% off all flower tonight"
- "DM for pickup"
- "Reserve in comments"
- "Delivery available after 8"

---

## 15. Search & Ranking

Android ranking must **not** boost cannabis sales language.

### Do not rank higher because of

- deals / discounts
- price urgency
- product-sale terms

### Safer Android ranking signals

- Follow activity
- Event attendance
- Review quality
- Verification status
- Freshness of store updates
- Operating hours accuracy

---

## 16. Operational Policy

### Auto-approve

Green content only.

### Manual review required

- Yellow content
- Image-only cards
- OCR uncertainty
- First-time owner posts
- Posts flagged by users

### Auto-reject on Android

- Red content
- Repeated attempts to evade filters
- Coded pricing language after warnings

### Repeat offender handling

| Offense | Action                                         |
| ------- | ---------------------------------------------- |
| 1st     | Reject + explain rule                          |
| 2nd     | Temporary Android posting restriction          |
| 3rd     | Suspend Android card publishing pending review |

---

## 17. Admin Tools

### New backend routes

`backend/src/routes/adminOwnerContentModerationRoutes.ts`
`backend/src/services/ownerContentModerationService.ts`

### Required features

- List pending Android reviews
- Content preview with matched rule reasons
- Approve / reject per platform
- Audit trail (who reviewed, when)
- Remove already-published content if reported
- Owner strike count
- Bulk remove by rule code

---

## 18. Enforcement Matrix

| Owner content | Android         | iOS                 | Web                 |
| ------------- | --------------- | ------------------- | ------------------- |
| Green text    | Publish         | Publish             | Publish             |
| Yellow text   | Review required | Publish (or review) | Publish (or review) |
| Red text      | Reject          | Your policy         | Your policy         |

---

## 19. Data Migration

Existing promotions need backfill classification.

### Migration steps

1. Existing promotions default to `platformVisibility: { ios: true, web: true, android: false }`
2. Run classifier against all existing promotion text
3. Green results flip `android: true`
4. Yellow results enter review queue
5. Red results stay `android: false`

### Script location

`backend/scripts/backfill-promotion-moderation.ts`

---

## 20. Play Store Submission Language

Describe the Android app as:

- A dispensary **discovery** and **business-information** platform
- **Not** a marketplace
- **Not** an ordering app
- **Not** a pickup/delivery facilitator
- Owner-created Android cards are moderated to allow **informational announcements and events only**

Your code and your store description must tell the same story.

---

## 21. Rollout Order

| Phase | Work                                                                  | Priority |
| ----- | --------------------------------------------------------------------- | -------- |
| 1     | Add moderation fields to shared types                                 | Highest  |
| 2     | Build backend classifier (`ownerPortalPromotionModerationService.ts`) | Highest  |
| 3     | Server-side Android filtering on read path                            | Highest  |
| 4     | Owner composer validation + helper text                               | High     |
| 5     | Rename Android consumer surfaces (browse, cards, tabs)                | High     |
| 6     | Notification gating                                                   | Medium   |
| 7     | Admin review queue                                                    | Medium   |
| 8     | Event / chat moderation (if shipping chat)                            | Lower    |
| 9     | Data backfill migration                                               | Lower    |

---

## 22. Hardened Current Files

These were the highest-risk Google Play files earlier in April. The Android
review build now keeps them behind platform gates or strips risky data before
Android responses are sent:

| File                                                                 | Current Android posture                                  |
| -------------------------------------------------------------------- | -------------------------------------------------------- |
| `src/navigation/rootNavigatorConfig.tsx`                             | Owner, product, and brand routes show policy fallbacks   |
| `src/navigation/linkingConfig.ts`                                    | Owner deep links are omitted from Android linking config |
| `src/screens/OwnerPortalPromotionsScreen.tsx`                        | Not reachable in the Android review build                |
| `src/components/BrowseFiltersBar.tsx`                                | Hot Deals control is hidden on Android                   |
| `src/components/storefrontRouteCard/StorefrontRouteCardSections.tsx` | Promotion text and badges are suppressed on Android      |
| `backend/src/storefrontService.ts`                                   | Android responses strip promo/menu/photo/owner fields    |
| `backend/src/services/ownerPortalWorkspaceService.ts`                | Classifies owner content for platform visibility         |
| `backend/src/types.ts`                                               | Includes Android promotion visibility fields             |
| `src/types/ownerPortal.ts`                                           | Includes Android moderation and visibility fields        |

---

## Appendix A: Full Red Keyword Regex (Copy-Paste Ready)

```typescript
const RED_PRICE_DISCOUNT = [
  /\b\d{1,3}%\s*off\b/i,
  /\$\d+\s*off\b/i,
  /\bdiscount\b/i,
  /\bdeal\b/i,
  /\bdeals\b/i,
  /\bsale\b/i,
  /\bspecial\b/i,
  /\bspecials\b/i,
  /\bbogo\b/i,
  /\bbuy one get one\b/i,
  /\bdoorbuster\b/i,
];

const RED_PRODUCT_TERMS = [
  /\bflower\b/i,
  /\bpre[- ]?rolls?\b/i,
  /\bedibles?\b/i,
  /\bcarts?\b/i,
  /\bvapes?\b/i,
  /\bconcentrates?\b/i,
  /\bthc\b/i,
  /\bindica\b/i,
  /\bsativa\b/i,
  /\bhybrid\b/i,
  /\bounces?\b/i,
  /\bgrams?\b/i,
];

const RED_TRANSACTION_LANGUAGE = [
  /\border now\b/i,
  /\border\b/i,
  /\bbuy now\b/i,
  /\bshop now\b/i,
  /\breserve\b/i,
  /\bpre[- ]?order\b/i,
  /\bpickup\b/i,
  /\bcurbside\b/i,
  /\bdelivery\b/i,
  /\bshop our menu\b/i,
];
```

## Appendix B: Full Yellow Keyword Regex (Copy-Paste Ready)

```typescript
const YELLOW_PATTERNS = [
  /\blimited[- ]?time\b/i,
  /\bexclusive\b/i,
  /\bfeatured\b/i,
  /\bmember appreciation\b/i,
  /\bcelebration\b/i,
  /\bvendor day\b/i,
  /\bguest vendor\b/i,
  /\b4[\/ ]?20\b/i,
  /\bdrop\b/i,
  /\blaunch\b/i,
  /\bmenu spotlight\b/i,
  /\bsamples?\b/i,
  /\bpop[- ]?up\b/i,
];
```

## Appendix C: Compound Rule Implementation

```typescript
function hasCompoundRedViolation(text: string): boolean {
  const hasProduct = RED_PRODUCT_TERMS.some((r) => r.test(text));
  const hasPrice = RED_PRICE_DISCOUNT.some((r) => r.test(text));
  const hasTransaction = RED_TRANSACTION_LANGUAGE.some((r) => r.test(text));
  return hasProduct && (hasPrice || hasTransaction);
}
```

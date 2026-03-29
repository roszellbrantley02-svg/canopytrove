# Product Plan

## Product goal

Canopy Trove is a cannabis dispensary navigation app focused on legal storefront discovery, routing, and store trust.

The app should answer three user questions quickly:

1. What legal dispensaries are near me?
2. How do I get there?
3. What do I need to know before I go?

## Product promise

The app should feel:

- fast
- reliable
- visually premium
- location-aware
- trustworthy about whether a store is real and licensed

## Core user flows

### 1. Nearby

User opens app and immediately sees:

- nearest verified dispensaries
- distance and travel time
- route preview
- quick actions:
  - `View Shop`
  - `Go Now`

### 2. Browse

User searches or changes area and sees:

- dispensary cards
- map preview on card
- sort/filter without slowing first paint
- only valid New York storefronts in the result set

### 3. Details

User opens a shop and sees:

- photos
- hours
- phone
- website
- Google reviews
- app reviews
- directions
- favorite/save

### 4. Reviews

User can:

- read app reviews
- read Google reviews
- write an app review
- upload compliant product-only photos

## MVP scope

### In scope

- New York only
- legal adult-use storefront discovery
- nearby list
- browse list
- dispensary detail page
- favorites
- reviews
- directions / navigation handoff
- verified licensing status

### Out of scope for MVP

- multi-state expansion
- social feed
- delivery marketplace logic
- loyalty platform
- business admin dashboard beyond basic ownership flow
- advanced gamification

## Product rules

1. Default list screens must render from summary data only.
2. Photos are detail-screen content first, not list-screen blockers.
3. The app should never show a storefront as verified unless it matches official source data.
4. If a licensed store is not yet publicly open enough to have stable storefront data, it should be hidden from browseable consumer lists until it is ready.
5. Navigation previews may use lighter map data, but actual navigation must use trusted destination coordinates.

## UX rules

1. Nearby must feel immediate.
2. Browse must feel broad but controlled.
3. Details may take slightly longer than list screens, but must feel intentional.
4. Loading states should look designed, not accidental.
5. Users should not see blank media slots.

## Success metrics

### Product

- user can open app and see first nearby cards in under 1 second perceived time on repeat opens
- user can open Browse without waiting on full detail hydration
- user can trust that tapping `Go Now` leads to the correct storefront

### Quality

- no duplicate storefront cards
- no wrong-business matches
- no out-of-state results
- no blank route card on first paint

## Launch target

Target first release as:

- New York soft beta
- trust and speed first
- feature completeness second

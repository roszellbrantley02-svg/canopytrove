# Roadmap

## Phase 0 - Planning

Goal:

- define scope
- define architecture
- define data contracts

Deliverables:

- product plan
- architecture plan
- phased roadmap

## Phase 1 - Foundation

Goal:

- create clean app shell
- establish design tokens
- set up routing
- set up backend configuration

Deliverables:

- new Expo app
- theme system
- navigation shell
- auth bootstrap
- empty screens with real layout primitives

## Phase 2 - Data pipeline

Goal:

- build trusted storefront source

Deliverables:

- NY OCM importer
- normalized license record storage
- retail-only filter
- exclusion logic for not-ready storefronts
- Google matching job
- summary/detail collections

Definition of done:

- the app can fetch verified summary rows without live client-side matching

## Phase 3 - Nearby

Goal:

- make the first screen fast and trustworthy

Deliverables:

- nearby summaries
- route preview card layout
- view shop / go now actions
- cached first paint
- skeleton/loading polish

Definition of done:

- first three cards appear quickly and route correctly

## Phase 4 - Browse

Goal:

- make wider discovery stable and scalable

Deliverables:

- searchable browse list
- location change flow
- sort/filter
- paginated summary list
- background enrichment only where needed

Definition of done:

- Browse feels broad but does not block on details

## Phase 5 - Details and reviews

Goal:

- make the detail page rich and dependable

Deliverables:

- photos
- hours
- phone
- website
- Google reviews
- app reviews
- favorite/save
- report / moderation hooks

Definition of done:

- users can trust the detail page as the source of store info

## Phase 6 - Polish and launch prep

Goal:

- raise the app from working to launchable

Deliverables:

- visual QA pass
- performance QA pass
- store identity QA pass
- analytics
- crash reporting
- launch checklist

Definition of done:

- soft-beta ready for New York

## Build order recommendation

Do not build in this order:

- UI first
- then live Google logic
- then licensing logic later

Build in this order instead:

1. trusted data model
2. summary/detail API
3. Nearby
4. Browse
5. Details
6. polish

That order is less exciting, but it is the one most likely to hold up under real use.

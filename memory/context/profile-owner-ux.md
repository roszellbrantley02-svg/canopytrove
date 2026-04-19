# Profile & Owner Portal UX Research for Canopy Trove

Research compiled April 2026. Patterns drawn from modern mobile apps, SaaS dashboards, and marketplace platforms.

## Current State Assessment

### User Profile (ProfileScreen.tsx)

**Structure:** Three-tab surface (Overview | Activity | Safety)
**Issues identified:**

- Too much crammed into one screen — hero card, account section, stats, email updates all in Overview
- Three tabs feel arbitrary — "Safety" is really "Settings" and "Activity" is really "My Stuff"
- Stats section (6 cards) takes up a lot of space but isn't actionable
- No clear visual hierarchy — everything has equal weight
- Email updates section buried in Overview tab
- No quick actions or shortcuts for common tasks
- Saved/Recent storefronts hidden behind Activity tab

### Owner Portal (OwnerPortalHomeScreen.tsx)

**Structure:** Three-tab surface (Overview | Workspace | Setup)
**Issues identified:**

- Workspace tab is just a list of links — feels like a settings menu, not a workspace
- Metrics dashboard (ROI section) shows many numbers but no context (trends, comparisons)
- No quick actions for the most frequent tasks (reply to review, create promotion)
- Onboarding steps shown on every screen even after completion
- AI action plan buried in Setup tab — should be front and center
- Deal badge editor and override panel create visual clutter on Overview
- No visual feedback for what needs attention (unread reviews, expiring licenses)

---

## Recommended UX Patterns

### 1. Card-Based Progressive Disclosure

**Pattern:** Replace monolithic tab sections with self-contained cards that expand for detail.
**Why:** Cards reduce cognitive load, let users scan quickly, and make each section independently actionable.
**Apply to:**

- Profile stats → compact summary card that expands to full stats
- Owner metrics → "at a glance" card with 3-4 key numbers, tap to see full dashboard
- Account settings → grouped setting cards (Account, Notifications, Privacy)

### 2. Quick Actions Bar

**Pattern:** Horizontal scrollable row of primary action buttons at the top of the screen.
**Why:** Reduces taps to most common tasks from 3-4 to 1.
**Apply to:**

- Profile: "Write Review", "View Saved", "Leaderboard", "Settings"
- Owner: "Reply to Reviews", "Create Deal", "View Metrics", "Edit Listing"

### 3. Attention Badges (Notification Dots)

**Pattern:** Small badge indicators on sections that need user attention.
**Why:** Guides the user to what matters without overwhelming.
**Apply to:**

- Owner: Unread reviews count, expiring license warning, new followers
- Profile: New badge earned, streak about to break, new leaderboard rank

### 4. Section Headers with "See All" Links

**Pattern:** Each section shows 2-3 items with a "See All →" link to the full list.
**Why:** Keeps the main screen scannable while providing depth on demand.
**Apply to:**

- Saved storefronts: Show top 3, "See All (12) →"
- Recent reviews: Show latest 2, "See All →"
- Promotions: Show active deal, "Manage All →"

### 5. Contextual Empty States

**Pattern:** When a section has no data, show an illustration + CTA instead of blank space.
**Why:** Turns empty into an onboarding/engagement opportunity.
**Apply to:**

- No saved storefronts: "Explore nearby dispensaries" CTA
- No reviews written: "Share your first experience" CTA
- No promotions: "Create your first deal to attract customers" CTA

### 6. Grouped Settings Pattern

**Pattern:** Settings organized into visual groups (Account, Preferences, About) with icons.
**Why:** iOS-native feel, reduces cognitive load vs flat list.
**Apply to:**

- Move Safety tab content into proper Settings screen
- Group: Account (name, email, password) → Preferences (notifications, email) → Safety (guidelines, blocked) → About (legal, version, delete)

---

## User Profile Redesign Plan

### New Structure (replace 3-tab layout):

```
ProfileScreen (single scrollable view)
├── ProfileHeroCard (avatar, name, level, rank — compact)
├── QuickActionsRow (Write Review, Saved, Leaderboard, Settings)
├── StatsSnapshotCard (3 key stats: points, reviews, streak — tap for full)
├── SavedStorefrontsPreview (top 3 cards + "See All →")
├── RecentActivityPreview (top 3 recent + "See All →")
├── BadgeShowcase (featured 3 badges + "Trophy Case →")
└── Footer (app version, legal links)
```

### New Screens to Extract:

- **SettingsScreen** — Account, Notifications, Privacy, About sections
- **SavedStorefrontsScreen** — Full list of saved storefronts
- **BadgeGalleryScreen** — Full trophy case with categories
- **StatsDetailScreen** — Full gamification breakdown

### Key Changes:

1. **Flatten the tabs** — single scroll view with card sections
2. **Promote saved storefronts** — most-used feature shouldn't be 2 taps deep
3. **Quick actions at top** — write review, saved, leaderboard are primary actions
4. **Settings as separate screen** — gear icon in header navigates to settings
5. **Stats as snapshot** — show 3 numbers, not 6 cards; detail on tap
6. **Badge showcase** — visually appealing grid of top 3, not a full gallery on main screen

---

## Owner Portal Redesign Plan

### New Structure (replace 3-tab layout):

```
OwnerPortalHomeScreen (single scrollable view)
├── OwnerHeroCard (business name, verification badge, subscription status)
├── AttentionBar (cards for items needing action: reviews to reply, expiring license, etc.)
├── QuickActionsRow (Reply Reviews, Create Deal, Edit Listing, View Metrics)
├── MetricsSnapshotCard (followers, impressions 7d, avg rating — tap for full)
├── ActivePromotionCard (current deal status + performance — or empty CTA)
├── RecentReviewsPreview (2 latest + reply buttons + "Inbox →")
├── AiInsightsCard (action plan headline + top priority — tap for full)
└── SetupChecklist (only show if onboarding incomplete)
```

### Key Changes:

1. **Attention-first layout** — what needs action appears at the top
2. **Kill the Workspace tab** — promote quick actions to the main view, move tools to a settings/tools screen
3. **AI insights front and center** — the action plan is a differentiator, don't bury it
4. **Contextual onboarding** — only show setup steps if incomplete, collapse when done
5. **Review replies inline** — let owners tap "Reply" directly from the preview card
6. **Metrics with context** — show trends (↑12% vs last week) not just raw numbers

### New Screens to Extract:

- **OwnerMetricsScreen** — Full analytics dashboard with charts
- **OwnerToolsScreen** — All workspace tools in grouped settings pattern

---

## Implementation Priority (Impact × Effort)

### P0 — High Impact, Moderate Effort

1. Flatten profile tabs into single scroll view with card sections
2. Add QuickActionsRow to both profile and owner home
3. Create SettingsScreen extracted from Safety tab
4. Add attention badges to owner portal (review count, license warning)

### P1 — High Impact, Higher Effort

5. Redesign owner portal home with attention-first layout
6. Extract SavedStorefrontsScreen from Activity tab
7. Add "See All →" pattern to profile sections
8. Metrics snapshot with trend indicators for owner

### P2 — Polish

9. Contextual empty states for all sections
10. Badge showcase with visual grid
11. AI insights card on owner home
12. Animated transitions between profile sections

---

## Design Token Additions Needed

```
// New semantic tokens for profile/owner sections
colors.cardActive    — subtle highlight for attention cards
colors.badgeSuccess  — green dot for completed/earned
colors.badgeWarning  — amber dot for attention needed
colors.badgeDanger   — red dot for urgent action

// Quick action button style
quickAction: {
  height: 72,
  borderRadius: radii.lg,
  backgroundColor: colors.surfaceElevated,
  iconSize: 24,
  labelStyle: textStyles.caption,
}
```

## Sources

- [Card UI Design Examples (2025)](https://bricxlabs.com/blogs/card-ui-design-examples)
- [SaaS Dashboard Trends (2025)](https://uitop.design/blog/design/top-dashboard-design-trends/)
- [Mobile UX Design Examples](https://www.eleken.co/blog-posts/mobile-ux-design-examples)
- [Marketplace UX Best Practices](https://excited.agency/blog/marketplace-ux-design)
- [Dashboard Design Principles](https://medium.com/@allclonescript/20-best-dashboard-ui-ux-design-principles-you-need-in-2025-30b661f2f795)
- [Mobile Dashboard UI Best Practices](https://www.toptal.com/designers/dashboard-design/mobile-dashboard-ui)

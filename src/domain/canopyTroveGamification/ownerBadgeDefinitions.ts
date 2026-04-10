import type { GamificationBadgeDefinition } from '../../types/storefront';

/**
 * Owner-specific badge category extension.
 *
 * Owner badges use a superset of the consumer category list, adding
 * `owner` and `owner_special` for badges that only make sense in a
 * storefront-management context.
 */
export type OwnerBadgeCategory =
  | 'owner'
  | 'owner_special'
  | 'review'
  | 'milestone'
  | 'community'
  | 'social'
  | 'explorer';

/**
 * Minimum fields the Early Partner eligibility check needs.
 * Kept deliberately narrow so callers don't need a full Firestore read.
 */
export type EarlyPartnerEligibility = {
  /** ISO-8601 timestamp of the first-ever owner signup (system-wide). */
  firstOwnerSignupAt: string | null;
  /** How many Early Partner badges have already been awarded. */
  earlyPartnerAwardedCount: number;
  /** ISO-8601 timestamp of the current owner's *approved* claim. */
  ownerClaimApprovedAt: string | null;
};

/** Maximum Early Partner badges that will ever be awarded. */
export const EARLY_PARTNER_CAP = 10;

/** Window (ms) from first owner signup during which Early Partner can be earned. */
export const EARLY_PARTNER_WINDOW_DAYS = 60;
export const EARLY_PARTNER_WINDOW_MS = EARLY_PARTNER_WINDOW_DAYS * 24 * 60 * 60 * 1000;

/** Maximum badges an owner can display on their storefront card at once. */
export const OWNER_MAX_FEATURED_BADGES = 5;

/** Minimum duration (days) an earned owner badge remains valid. */
export const OWNER_BADGE_MIN_DURATION_DAYS = 365;

// ---------------------------------------------------------------------------
// Owner-specific badge definitions
// ---------------------------------------------------------------------------

/**
 * Owner badge definitions.
 *
 * The list is split into two groups:
 *  1. Owner-exclusive badges (category `owner` or `owner_special`)
 *  2. Shared consumer badges that owners can also earn
 *
 * The `id` field must be globally unique — owner badges are prefixed with
 * `owner_` so they never collide with the consumer `CANOPYTROVE_BADGES` set.
 */
export const OWNER_EXCLUSIVE_BADGES: GamificationBadgeDefinition[] = [
  // ── Limited edition ──────────────────────────────────────────────────
  {
    id: 'owner_early_partner',
    name: 'Early Partner',
    description:
      'Awarded to the first 10 stores that claim within 60 days of the first owner signup. Limited edition — no more will be issued.',
    icon: 'diamond-outline',
    color: '#FFD166',
    category: 'special',
    points: 500,
    requirement: 0, // special eligibility logic, not count-based
    hidden: false,
    tier: 'diamond',
  },

  // ── Owner milestone badges ───────────────────────────────────────────
  {
    id: 'owner_verified_business',
    name: 'Verified Business',
    description: 'Complete business and identity verification.',
    icon: 'shield-checkmark-outline',
    color: '#40D6FF',
    category: 'special',
    points: 150,
    requirement: 0, // triggered on verification completion
    hidden: false,
    tier: 'gold',
  },
  {
    id: 'owner_profile_complete',
    name: 'Polished Presence',
    description: 'Fill out all profile tools — menu, card photo, summary, and badges.',
    icon: 'brush-outline',
    color: '#7CFFB6',
    category: 'milestone',
    points: 100,
    requirement: 0,
    hidden: false,
    tier: 'silver',
  },
  {
    id: 'owner_first_promotion',
    name: 'Deal Maker',
    description: 'Publish your first promotion or deal.',
    icon: 'pricetag-outline',
    color: '#FF7A7A',
    category: 'community',
    points: 100,
    requirement: 1,
    hidden: false,
    tier: 'bronze',
  },
  {
    id: 'owner_promotions_5',
    name: 'Promo Pro',
    description: 'Publish 5 promotions.',
    icon: 'pricetags-outline',
    color: '#FF7A7A',
    category: 'community',
    points: 250,
    requirement: 5,
    hidden: false,
    tier: 'silver',
  },
  {
    id: 'owner_active_responder',
    name: 'Active Responder',
    description: 'Reply to 10 customer reviews.',
    icon: 'chatbubble-ellipses-outline',
    color: '#8C3BFF',
    category: 'social',
    points: 200,
    requirement: 10,
    hidden: false,
    tier: 'silver',
  },
  {
    id: 'owner_reply_streak_50',
    name: 'Voice of the Shop',
    description: 'Reply to 50 customer reviews.',
    icon: 'chatbubbles-outline',
    color: '#8C3BFF',
    category: 'social',
    points: 500,
    requirement: 50,
    hidden: false,
    tier: 'gold',
  },
  {
    id: 'owner_followers_25',
    name: 'Growing Following',
    description: 'Reach 25 followers on your storefront.',
    icon: 'people-outline',
    color: '#7CFFB6',
    category: 'social',
    points: 150,
    requirement: 25,
    hidden: false,
    tier: 'silver',
  },
  {
    id: 'owner_followers_100',
    name: 'Community Anchor',
    description: 'Reach 100 followers on your storefront.',
    icon: 'people',
    color: '#7CFFB6',
    category: 'social',
    points: 500,
    requirement: 100,
    hidden: false,
    tier: 'gold',
  },
  {
    id: 'owner_high_rating',
    name: 'Top Rated',
    description: 'Maintain a 4.5+ average rating with at least 10 reviews.',
    icon: 'star',
    color: '#FFD166',
    category: 'review',
    points: 300,
    requirement: 10, // minimum review count
    hidden: false,
    tier: 'gold',
  },
  {
    id: 'owner_member_30',
    name: 'Committed Owner',
    description: 'Active owner account for 30 days.',
    icon: 'ribbon-outline',
    color: '#7CFFB6',
    category: 'milestone',
    points: 100,
    requirement: 30,
    hidden: false,
    tier: 'bronze',
  },
  {
    id: 'owner_member_365',
    name: 'Year One Partner',
    description: 'Active owner account for 1 year.',
    icon: 'ribbon',
    color: '#FFD166',
    category: 'milestone',
    points: 1000,
    requirement: 365,
    hidden: false,
    tier: 'platinum',
  },
];

/**
 * IDs of consumer badges that owners can also earn.
 *
 * These reference badges from `CANOPYTROVE_BADGES` by id. The owner earns
 * them under the same rules as consumers — the evaluation service checks
 * both the owner-exclusive list and this shared set.
 */
export const OWNER_SHARED_CONSUMER_BADGE_IDS: string[] = [
  'member_30',
  'member_365',
  'helpful_25',
  'ambassador',
  'verified_user',
];

/**
 * Combined owner badge catalogue — owner-exclusive + consumer-shared
 * definitions merged into one lookup-friendly array.
 *
 * Consumer-shared badges are *not* duplicated here; callers that need
 * their full definitions should import `CANOPYTROVE_BADGES` and filter
 * by `OWNER_SHARED_CONSUMER_BADGE_IDS`.
 */
export const ALL_OWNER_BADGE_IDS = [
  ...OWNER_EXCLUSIVE_BADGES.map((b) => b.id),
  ...OWNER_SHARED_CONSUMER_BADGE_IDS,
];

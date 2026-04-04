import type { GamificationBadgeDefinition } from '../../types/storefront';
import type { OwnerProfileDocument } from '../../types/ownerPortal';
import { CANOPYTROVE_BADGES } from './badgeDefinitions';
import {
  EARLY_PARTNER_CAP,
  EARLY_PARTNER_WINDOW_MS,
  OWNER_BADGE_MIN_DURATION_DAYS,
  OWNER_EXCLUSIVE_BADGES,
  OWNER_MAX_FEATURED_BADGES,
  OWNER_SHARED_CONSUMER_BADGE_IDS,
  type EarlyPartnerEligibility,
} from './ownerBadgeDefinitions';
import { MAX_GAMIFICATION_LEVEL } from './levelDefinitions';

// ---------------------------------------------------------------------------
// Snapshot of owner activity used for evaluation
// ---------------------------------------------------------------------------

export type OwnerBadgeEvalContext = {
  /** Owner profile (for earnedBadgeIds, createdAt, badgeLevel). */
  ownerProfile: OwnerProfileDocument;

  /** Whether business + identity verification are both 'verified'. */
  isFullyVerified: boolean;

  /** Whether all profile tool fields are filled (menu, photo, summary, badges). */
  isProfileComplete: boolean;

  /** Number of promotions the owner has published. */
  publishedPromotionCount: number;

  /** Number of review replies the owner has sent. */
  reviewReplyCount: number;

  /** Current follower count for the storefront. */
  followerCount: number;

  /** Average rating with at least N reviews; null if not enough data. */
  averageRating: number | null;

  /** Total review count for the storefront. */
  storefrontReviewCount: number;

  /** Early Partner eligibility data (system-wide). */
  earlyPartner: EarlyPartnerEligibility;
};

// ---------------------------------------------------------------------------
// Evaluation result
// ---------------------------------------------------------------------------

export type OwnerBadgeEvalResult = {
  /** Newly earned badge IDs (not previously in earnedBadgeIds). */
  newlyEarned: string[];

  /** Full list of earned badge IDs after evaluation. */
  allEarned: string[];

  /** Badge definitions for the newly earned badges. */
  newBadgeDefinitions: GamificationBadgeDefinition[];

  /** Total points from owner badges (existing + new). */
  totalOwnerBadgePoints: number;

  /** Owner badge level (capped at MAX_GAMIFICATION_LEVEL). */
  ownerBadgeLevel: number;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ownerBadgeLookup(): Map<string, GamificationBadgeDefinition> {
  const map = new Map<string, GamificationBadgeDefinition>();
  for (const badge of OWNER_EXCLUSIVE_BADGES) {
    map.set(badge.id, badge);
  }
  for (const badge of CANOPYTROVE_BADGES) {
    if (OWNER_SHARED_CONSUMER_BADGE_IDS.includes(badge.id)) {
      map.set(badge.id, badge);
    }
  }
  return map;
}

const OWNER_BADGE_MAP = ownerBadgeLookup();

function daysSince(isoDate: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(isoDate).getTime()) / 86_400_000));
}

/** Simple level formula — mirrors consumer gamification (100 pts per level). */
function pointsToLevel(points: number): number {
  return Math.min(Math.max(1, Math.floor(points / 100) + 1), MAX_GAMIFICATION_LEVEL);
}

// ---------------------------------------------------------------------------
// Core evaluation
// ---------------------------------------------------------------------------

/**
 * Evaluate which owner badges are earned given the current context.
 *
 * This is a **pure function** — it has no side effects and does not
 * write to Firestore. The caller is responsible for persisting the
 * result (updating `OwnerProfileDocument.earnedBadgeIds`, etc.).
 */
export function evaluateOwnerBadges(ctx: OwnerBadgeEvalContext): OwnerBadgeEvalResult {
  const previouslyEarned = new Set(ctx.ownerProfile.earnedBadgeIds);
  const earned = new Set(previouslyEarned);

  // ── Early Partner ──────────────────────────────────────────────────
  if (!earned.has('owner_early_partner') && isEarlyPartnerEligible(ctx.earlyPartner)) {
    earned.add('owner_early_partner');
  }

  // ── Verified Business ──────────────────────────────────────────────
  if (!earned.has('owner_verified_business') && ctx.isFullyVerified) {
    earned.add('owner_verified_business');
  }

  // ── Profile Complete ───────────────────────────────────────────────
  if (!earned.has('owner_profile_complete') && ctx.isProfileComplete) {
    earned.add('owner_profile_complete');
  }

  // ── Promotions ─────────────────────────────────────────────────────
  if (!earned.has('owner_first_promotion') && ctx.publishedPromotionCount >= 1) {
    earned.add('owner_first_promotion');
  }
  if (!earned.has('owner_promotions_5') && ctx.publishedPromotionCount >= 5) {
    earned.add('owner_promotions_5');
  }

  // ── Review replies ─────────────────────────────────────────────────
  if (!earned.has('owner_active_responder') && ctx.reviewReplyCount >= 10) {
    earned.add('owner_active_responder');
  }
  if (!earned.has('owner_reply_streak_50') && ctx.reviewReplyCount >= 50) {
    earned.add('owner_reply_streak_50');
  }

  // ── Followers ──────────────────────────────────────────────────────
  if (!earned.has('owner_followers_25') && ctx.followerCount >= 25) {
    earned.add('owner_followers_25');
  }
  if (!earned.has('owner_followers_100') && ctx.followerCount >= 100) {
    earned.add('owner_followers_100');
  }

  // ── High rating ────────────────────────────────────────────────────
  if (
    !earned.has('owner_high_rating') &&
    ctx.averageRating !== null &&
    ctx.averageRating >= 4.5 &&
    ctx.storefrontReviewCount >= 10
  ) {
    earned.add('owner_high_rating');
  }

  // ── Membership tenure ──────────────────────────────────────────────
  const memberDays = daysSince(ctx.ownerProfile.createdAt);
  if (!earned.has('owner_member_30') && memberDays >= 30) {
    earned.add('owner_member_30');
  }
  if (!earned.has('owner_member_365') && memberDays >= 365) {
    earned.add('owner_member_365');
  }

  // ── Shared consumer badges ─────────────────────────────────────────
  // member_30, member_365 overlap with owner tenure badges above.
  // verified_user — awarded if fully verified.
  if (!earned.has('verified_user') && ctx.isFullyVerified) {
    earned.add('verified_user');
  }
  // helpful_25 and ambassador are tracked through consumer gamification;
  // they stay in the earned set if previously awarded.

  // ── Build result ───────────────────────────────────────────────────
  const allEarned = Array.from(earned);
  const newlyEarned = allEarned.filter((id) => !previouslyEarned.has(id));
  const newBadgeDefinitions = newlyEarned
    .map((id) => OWNER_BADGE_MAP.get(id))
    .filter((d): d is GamificationBadgeDefinition => d !== undefined);

  let totalPoints = 0;
  for (const id of allEarned) {
    totalPoints += OWNER_BADGE_MAP.get(id)?.points ?? 0;
  }

  return {
    newlyEarned,
    allEarned,
    newBadgeDefinitions,
    totalOwnerBadgePoints: totalPoints,
    ownerBadgeLevel: pointsToLevel(totalPoints),
  };
}

// ---------------------------------------------------------------------------
// Early Partner eligibility
// ---------------------------------------------------------------------------

/**
 * Determine whether the current owner qualifies for the Early Partner badge.
 *
 * Conditions (all must be true):
 * 1. A first-owner-signup timestamp exists (program has started).
 * 2. Fewer than `EARLY_PARTNER_CAP` badges have been awarded.
 * 3. The owner's claim was approved within `EARLY_PARTNER_WINDOW_MS`
 *    of the first-ever owner signup.
 */
export function isEarlyPartnerEligible(data: EarlyPartnerEligibility): boolean {
  if (!data.firstOwnerSignupAt || !data.ownerClaimApprovedAt) return false;
  if (data.earlyPartnerAwardedCount >= EARLY_PARTNER_CAP) return false;

  const firstSignup = new Date(data.firstOwnerSignupAt).getTime();
  const claimApproved = new Date(data.ownerClaimApprovedAt).getTime();
  return claimApproved - firstSignup <= EARLY_PARTNER_WINDOW_MS;
}

// ---------------------------------------------------------------------------
// Badge selection helpers
// ---------------------------------------------------------------------------

/**
 * Validate and cap the owner's selected badge IDs.
 *
 * - Only IDs that appear in `earnedBadgeIds` are kept.
 * - At most `OWNER_MAX_FEATURED_BADGES` are returned.
 */
export function validateOwnerSelectedBadges(selectedIds: string[], earnedIds: string[]): string[] {
  const earnedSet = new Set(earnedIds);
  return selectedIds.filter((id) => earnedSet.has(id)).slice(0, OWNER_MAX_FEATURED_BADGES);
}

/**
 * Map selected badge IDs to display-friendly label strings for the
 * storefront card's `ownerFeaturedBadges` field.
 */
export function selectedBadgeIdsToLabels(selectedIds: string[]): string[] {
  return selectedIds
    .map((id) => OWNER_BADGE_MAP.get(id)?.name)
    .filter((name): name is string => name !== undefined);
}

/**
 * Get the full badge definition for a given owner badge ID.
 */
export function getOwnerBadgeDefinition(id: string): GamificationBadgeDefinition | undefined {
  return OWNER_BADGE_MAP.get(id);
}

/**
 * Get all owner badge definitions (exclusive + shared).
 */
export function getAllOwnerBadgeDefinitions(): GamificationBadgeDefinition[] {
  return Array.from(OWNER_BADGE_MAP.values());
}

/**
 * Check whether an owner badge is still valid (not expired).
 * Badges last at least OWNER_BADGE_MIN_DURATION_DAYS from the date earned.
 */
export function isOwnerBadgeValid(earnedAtIso: string): boolean {
  const earnedAt = new Date(earnedAtIso).getTime();
  const expiresAt = earnedAt + OWNER_BADGE_MIN_DURATION_DAYS * 24 * 60 * 60 * 1000;
  return Date.now() < expiresAt;
}

import { describe, expect, it } from 'vitest';
import type { OwnerProfileDocument } from '../../types/ownerPortal';
import type { OwnerBadgeEvalContext } from './ownerBadgeEvaluation';
import {
  evaluateOwnerBadges,
  getOwnerBadgeDefinition,
  isEarlyPartnerEligible,
  validateOwnerSelectedBadges,
  selectedBadgeIdsToLabels,
  isOwnerBadgeValid,
} from './ownerBadgeEvaluation';
import { EARLY_PARTNER_CAP, EARLY_PARTNER_WINDOW_DAYS } from './ownerBadgeDefinitions';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NOW = '2026-04-04T12:00:00.000Z';
const THIRTY_ONE_DAYS_AGO = '2026-03-04T12:00:00.000Z';
const ONE_YEAR_AGO = '2025-04-04T12:00:00.000Z';

function makeOwnerProfile(overrides: Partial<OwnerProfileDocument> = {}): OwnerProfileDocument {
  return {
    uid: 'owner-1',
    legalName: 'Test Owner',
    phone: null,
    companyName: 'Test Co',
    identityVerificationStatus: 'unverified',
    businessVerificationStatus: 'unverified',
    dispensaryId: 'store-1',
    onboardingStep: 'completed',
    subscriptionStatus: 'active',
    badgeLevel: 0,
    earnedBadgeIds: [],
    selectedBadgeIds: [],
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makeCtx(overrides: Partial<OwnerBadgeEvalContext> = {}): OwnerBadgeEvalContext {
  return {
    ownerProfile: makeOwnerProfile(),
    isFullyVerified: false,
    isProfileComplete: false,
    publishedPromotionCount: 0,
    reviewReplyCount: 0,
    followerCount: 0,
    averageRating: null,
    storefrontReviewCount: 0,
    earlyPartner: {
      firstOwnerSignupAt: null,
      earlyPartnerAwardedCount: 0,
      ownerClaimApprovedAt: null,
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('evaluateOwnerBadges', () => {
  it('returns no new badges for a brand-new owner with no activity', () => {
    const result = evaluateOwnerBadges(makeCtx());
    expect(result.newlyEarned).toEqual([]);
    expect(result.allEarned).toEqual([]);
    expect(result.totalOwnerBadgePoints).toBe(0);
    expect(result.ownerBadgeLevel).toBe(1);
  });

  it('awards owner_verified_business and verified_user when fully verified', () => {
    const result = evaluateOwnerBadges(makeCtx({ isFullyVerified: true }));
    expect(result.newlyEarned).toContain('owner_verified_business');
    expect(result.newlyEarned).toContain('verified_user');
    expect(result.allEarned).toContain('owner_verified_business');
    expect(result.allEarned).toContain('verified_user');
  });

  it('awards owner_profile_complete when profile is complete', () => {
    const result = evaluateOwnerBadges(makeCtx({ isProfileComplete: true }));
    expect(result.newlyEarned).toContain('owner_profile_complete');
  });

  it('awards promotion badges at correct thresholds', () => {
    const result1 = evaluateOwnerBadges(makeCtx({ publishedPromotionCount: 1 }));
    expect(result1.newlyEarned).toContain('owner_first_promotion');
    expect(result1.newlyEarned).not.toContain('owner_promotions_5');

    const result5 = evaluateOwnerBadges(makeCtx({ publishedPromotionCount: 5 }));
    expect(result5.newlyEarned).toContain('owner_first_promotion');
    expect(result5.newlyEarned).toContain('owner_promotions_5');
  });

  it('awards review reply badges at correct thresholds', () => {
    const result10 = evaluateOwnerBadges(makeCtx({ reviewReplyCount: 10 }));
    expect(result10.newlyEarned).toContain('owner_active_responder');
    expect(result10.newlyEarned).not.toContain('owner_reply_streak_50');

    const result50 = evaluateOwnerBadges(makeCtx({ reviewReplyCount: 50 }));
    expect(result50.newlyEarned).toContain('owner_active_responder');
    expect(result50.newlyEarned).toContain('owner_reply_streak_50');
  });

  it('awards follower badges at correct thresholds', () => {
    const result25 = evaluateOwnerBadges(makeCtx({ followerCount: 25 }));
    expect(result25.newlyEarned).toContain('owner_followers_25');
    expect(result25.newlyEarned).not.toContain('owner_followers_100');

    const result100 = evaluateOwnerBadges(makeCtx({ followerCount: 100 }));
    expect(result100.newlyEarned).toContain('owner_followers_25');
    expect(result100.newlyEarned).toContain('owner_followers_100');
  });

  it('awards owner_high_rating when rating is 4.5+ with 10+ reviews', () => {
    const noReviews = evaluateOwnerBadges(
      makeCtx({ averageRating: 4.8, storefrontReviewCount: 5 }),
    );
    expect(noReviews.newlyEarned).not.toContain('owner_high_rating');

    const enough = evaluateOwnerBadges(makeCtx({ averageRating: 4.5, storefrontReviewCount: 10 }));
    expect(enough.newlyEarned).toContain('owner_high_rating');
  });

  it('awards tenure badges based on createdAt', () => {
    const result31d = evaluateOwnerBadges(
      makeCtx({
        ownerProfile: makeOwnerProfile({ createdAt: THIRTY_ONE_DAYS_AGO }),
      }),
    );
    expect(result31d.newlyEarned).toContain('owner_member_30');
    expect(result31d.newlyEarned).not.toContain('owner_member_365');

    const result1y = evaluateOwnerBadges(
      makeCtx({
        ownerProfile: makeOwnerProfile({ createdAt: ONE_YEAR_AGO }),
      }),
    );
    expect(result1y.newlyEarned).toContain('owner_member_30');
    expect(result1y.newlyEarned).toContain('owner_member_365');
  });

  it('does not duplicate already-earned badges', () => {
    const ctx = makeCtx({
      ownerProfile: makeOwnerProfile({
        earnedBadgeIds: ['owner_verified_business', 'verified_user'],
      }),
      isFullyVerified: true,
    });
    const result = evaluateOwnerBadges(ctx);
    expect(result.newlyEarned).not.toContain('owner_verified_business');
    expect(result.allEarned).toContain('owner_verified_business');
  });

  it('calculates points and level correctly', () => {
    // verified_business = 150pts, verified_user = 100pts, profile_complete = 100pts
    const result = evaluateOwnerBadges(makeCtx({ isFullyVerified: true, isProfileComplete: true }));
    expect(result.totalOwnerBadgePoints).toBe(150 + 100 + 100);
    expect(result.ownerBadgeLevel).toBe(4); // 350 / 100 + 1 = 4
  });
});

describe('isEarlyPartnerEligible', () => {
  it('returns false when no first owner signup exists', () => {
    expect(
      isEarlyPartnerEligible({
        firstOwnerSignupAt: null,
        earlyPartnerAwardedCount: 0,
        ownerClaimApprovedAt: '2026-03-01T00:00:00.000Z',
      }),
    ).toBe(false);
  });

  it('returns false when no claim is approved', () => {
    expect(
      isEarlyPartnerEligible({
        firstOwnerSignupAt: '2026-03-01T00:00:00.000Z',
        earlyPartnerAwardedCount: 0,
        ownerClaimApprovedAt: null,
      }),
    ).toBe(false);
  });

  it('returns false when cap is reached', () => {
    expect(
      isEarlyPartnerEligible({
        firstOwnerSignupAt: '2026-03-01T00:00:00.000Z',
        earlyPartnerAwardedCount: EARLY_PARTNER_CAP,
        ownerClaimApprovedAt: '2026-03-02T00:00:00.000Z',
      }),
    ).toBe(false);
  });

  it('returns false when claim is outside the 60-day window', () => {
    expect(
      isEarlyPartnerEligible({
        firstOwnerSignupAt: '2026-01-01T00:00:00.000Z',
        earlyPartnerAwardedCount: 0,
        ownerClaimApprovedAt: '2026-04-01T00:00:00.000Z', // 90 days later
      }),
    ).toBe(false);
  });

  it('returns true when all conditions are met', () => {
    expect(
      isEarlyPartnerEligible({
        firstOwnerSignupAt: '2026-03-01T00:00:00.000Z',
        earlyPartnerAwardedCount: 5,
        ownerClaimApprovedAt: '2026-03-15T00:00:00.000Z', // 14 days later, under cap
      }),
    ).toBe(true);
  });

  it('returns true at exactly the boundary (day 60)', () => {
    const first = new Date('2026-03-01T00:00:00.000Z');
    const atBoundary = new Date(first.getTime() + EARLY_PARTNER_WINDOW_DAYS * 86_400_000);
    expect(
      isEarlyPartnerEligible({
        firstOwnerSignupAt: first.toISOString(),
        earlyPartnerAwardedCount: 9, // one slot left
        ownerClaimApprovedAt: atBoundary.toISOString(),
      }),
    ).toBe(true);
  });
});

describe('validateOwnerSelectedBadges', () => {
  it('filters out unearned badge IDs', () => {
    expect(
      validateOwnerSelectedBadges(
        ['owner_verified_business', 'owner_high_rating', 'owner_member_30'],
        ['owner_verified_business', 'owner_member_30'],
      ),
    ).toEqual(['owner_verified_business', 'owner_member_30']);
  });

  it('caps at OWNER_MAX_FEATURED_BADGES (5)', () => {
    const earned = ['a', 'b', 'c', 'd', 'e'];
    const selected = ['a', 'b', 'c', 'd', 'e', 'f'];
    expect(validateOwnerSelectedBadges(selected, earned)).toHaveLength(5);
  });
});

describe('selectedBadgeIdsToLabels', () => {
  it('maps known badge IDs to display names', () => {
    const labels = selectedBadgeIdsToLabels(['owner_verified_business', 'owner_early_partner']);
    expect(labels).toContain('Verified Business');
    expect(labels).toContain('Early Partner');
  });

  it('uses owner-facing labels for shared consumer badges', () => {
    const labels = selectedBadgeIdsToLabels(['helpful_25', 'ambassador', 'verified_user']);
    expect(labels).toContain('Trusted by Shoppers');
    expect(labels).toContain('Growth Partner');
    expect(labels).toContain('Verified Operator');
  });

  it('filters out unknown IDs', () => {
    const labels = selectedBadgeIdsToLabels(['nonexistent_badge']);
    expect(labels).toEqual([]);
  });
});

describe('getOwnerBadgeDefinition', () => {
  it('returns owner-facing copy for shared consumer badges in the owner catalog', () => {
    expect(getOwnerBadgeDefinition('helpful_25')).toMatchObject({
      name: 'Trusted by Shoppers',
      description: 'Earn 25 helpful votes across your storefront reviews and replies.',
    });
    expect(getOwnerBadgeDefinition('ambassador')).toMatchObject({
      name: 'Growth Partner',
      description: 'Bring 5 new shoppers or supporters into your storefront community.',
    });
  });
});

describe('isOwnerBadgeValid', () => {
  it('returns true for a badge earned less than a year ago', () => {
    const recent = new Date(Date.now() - 30 * 86_400_000).toISOString();
    expect(isOwnerBadgeValid(recent)).toBe(true);
  });

  it('returns false for a badge earned over a year ago', () => {
    const old = new Date(Date.now() - 400 * 86_400_000).toISOString();
    expect(isOwnerBadgeValid(old)).toBe(false);
  });
});

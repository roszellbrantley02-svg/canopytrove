/**
 * Owner Tier Gating Service
 *
 * Resolves the current owner's subscription tier and enforces
 * feature access based on tier level.
 *
 * Tiers:
 *   verified ($79/mo)  — basic presence and analytics
 *   growth   ($149/mo) — full analytics, promotions, messaging
 *   pro      ($249/mo) — AI, multi-location, full suite
 */

import { getBackendFirebaseDb } from '../firebase';

export type OwnerSubscriptionTier = 'verified' | 'growth' | 'pro';

const SUBSCRIPTIONS_COLLECTION = 'subscriptions';
const OWNER_PROFILES_COLLECTION = 'ownerProfiles';

const TIER_RANK: Record<OwnerSubscriptionTier, number> = {
  verified: 0,
  growth: 1,
  pro: 2,
};

const TIER_LIMITS: Record<OwnerSubscriptionTier, TierFeatureLimits> = {
  verified: {
    maxPromotions: 0,
    maxFeaturedPhotos: 0,
    maxFollowerMessages: 0,
    aiEnabled: false,
    multiLocationEnabled: false,
    fullAnalyticsEnabled: false,
    weeklyEmailEnabled: false,
    badgeCustomizationEnabled: false,
    audienceTargetingEnabled: false,
    promotionAnalyticsEnabled: false,
  },
  growth: {
    maxPromotions: 2,
    maxFeaturedPhotos: 3,
    maxFollowerMessages: 4,
    aiEnabled: false,
    multiLocationEnabled: false,
    fullAnalyticsEnabled: true,
    weeklyEmailEnabled: true,
    badgeCustomizationEnabled: true,
    audienceTargetingEnabled: false,
    promotionAnalyticsEnabled: false,
  },
  pro: {
    maxPromotions: 5,
    maxFeaturedPhotos: -1, // unlimited
    maxFollowerMessages: -1, // unlimited
    aiEnabled: true,
    multiLocationEnabled: true,
    fullAnalyticsEnabled: true,
    weeklyEmailEnabled: true,
    badgeCustomizationEnabled: true,
    audienceTargetingEnabled: true,
    promotionAnalyticsEnabled: true,
  },
};

export type TierFeatureLimits = {
  maxPromotions: number;
  maxFeaturedPhotos: number;
  maxFollowerMessages: number;
  aiEnabled: boolean;
  multiLocationEnabled: boolean;
  fullAnalyticsEnabled: boolean;
  weeklyEmailEnabled: boolean;
  badgeCustomizationEnabled: boolean;
  audienceTargetingEnabled: boolean;
  promotionAnalyticsEnabled: boolean;
};

export class TierAccessError extends Error {
  constructor(
    message: string,
    public readonly requiredTier: OwnerSubscriptionTier,
    public readonly currentTier: OwnerSubscriptionTier,
    public readonly statusCode = 403,
  ) {
    super(message);
  }
}

function normalizeTier(value: unknown): OwnerSubscriptionTier {
  if (value === 'verified' || value === 'growth' || value === 'pro') {
    return value;
  }
  return 'verified';
}

/**
 * Resolves the current subscription tier for an owner.
 * Returns 'verified' as default if no subscription or tier is found.
 */
export async function resolveOwnerTier(ownerUid: string): Promise<OwnerSubscriptionTier> {
  const db = getBackendFirebaseDb();
  if (!db) {
    return 'verified';
  }

  const subscriptionDoc = await db.collection(SUBSCRIPTIONS_COLLECTION).doc(ownerUid).get();

  if (!subscriptionDoc.exists) {
    return 'verified';
  }

  const data = subscriptionDoc.data();
  const status = data?.status;

  // Only active or trial subscriptions get their tier level
  if (status !== 'active' && status !== 'trial') {
    return 'verified';
  }

  return normalizeTier(data?.tier);
}

/**
 * Returns the feature limits for a given tier.
 */
export function getTierLimits(tier: OwnerSubscriptionTier): TierFeatureLimits {
  return TIER_LIMITS[tier] ?? TIER_LIMITS.verified;
}

/**
 * Checks if the current tier meets the minimum required tier.
 */
export function hasTierAccess(
  currentTier: OwnerSubscriptionTier,
  requiredTier: OwnerSubscriptionTier,
): boolean {
  return TIER_RANK[currentTier] >= TIER_RANK[requiredTier];
}

/**
 * Asserts that the owner's tier meets the minimum requirement.
 * Throws TierAccessError if not.
 */
export function assertTierAccess(
  currentTier: OwnerSubscriptionTier,
  requiredTier: OwnerSubscriptionTier,
  featureLabel: string,
): void {
  if (!hasTierAccess(currentTier, requiredTier)) {
    const tierLabel =
      requiredTier === 'pro'
        ? 'Pro ($249/mo)'
        : requiredTier === 'growth'
          ? 'Growth ($149/mo)'
          : 'Verified Presence ($79/mo)';

    throw new TierAccessError(
      `${featureLabel} requires the ${tierLabel} plan. Upgrade to unlock this feature.`,
      requiredTier,
      currentTier,
    );
  }
}

/**
 * Resolves tier and asserts access in one call. Returns the resolved tier.
 */
export async function requireTierAccess(
  ownerUid: string,
  requiredTier: OwnerSubscriptionTier,
  featureLabel: string,
): Promise<OwnerSubscriptionTier> {
  const tier = await resolveOwnerTier(ownerUid);
  assertTierAccess(tier, requiredTier, featureLabel);
  return tier;
}

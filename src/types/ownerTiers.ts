/**
 * Owner subscription tiers for Canopy Trove.
 *
 * - verified:  $49/mo  — Verified Presence (one location, basics)
 * - growth:    $149/mo — Growth (analytics, promotions, messaging)
 * - pro:       $249/mo — Pro (AI, multi-location, full suite)
 */

export type OwnerSubscriptionTier = 'verified' | 'growth' | 'pro';

export type OwnerTierBillingCycle = 'monthly' | 'annual';

export type OwnerTierDefinition = {
  tier: OwnerSubscriptionTier;
  label: string;
  tagline: string;
  monthlyPrice: number;
  annualPrice: number;
  features: string[];
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

export const OWNER_TIERS: Record<OwnerSubscriptionTier, OwnerTierDefinition> = {
  verified: {
    tier: 'verified',
    label: 'Verified Presence',
    tagline: 'Get found. Get trusted.',
    monthlyPrice: 49,
    annualPrice: 490,
    features: [
      'OCM verified badge on listing',
      'Claim and manage your storefront',
      'Hours management',
      'Basic profile editing',
      'License compliance tracking with renewal alerts',
      'Review replies (text only)',
      'Basic analytics: total views, taps, and average rating',
    ],
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
    tier: 'growth',
    label: 'Growth',
    tagline: 'See what works. Grow your traffic.',
    monthlyPrice: 149,
    annualPrice: 1490,
    features: [
      'Everything in Verified Presence',
      'Full ROI funnel analytics with trends',
      'Week-over-week and month-over-month comparisons',
      'Up to 2 active promotions with scheduling',
      'Featured photos on storefront card (up to 3)',
      'Badge customization',
      'Owner-to-follower messaging (up to 4/month)',
      'Weekly performance email',
    ],
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
    tier: 'pro',
    label: 'Pro',
    tagline: 'AI-powered tools. Multiple locations. Full control.',
    monthlyPrice: 249,
    annualPrice: 2490,
    features: [
      'Everything in Growth',
      'Multi-location management from one dashboard',
      'AI review reply drafts',
      'AI weekly action plans',
      'AI promotion drafts',
      'AI profile suggestions',
      'Up to 5 promotions per location with audience targeting',
      'Promotion-level analytics with attribution',
      'Unlimited featured photos',
    ],
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

export const OWNER_TIER_ORDER: OwnerSubscriptionTier[] = ['verified', 'growth', 'pro'];

export const ADDITIONAL_LOCATION_MONTHLY_PRICE = 99;

/**
 * Returns the tier definition for a given tier, defaulting to 'verified'.
 */
export function getOwnerTierDefinition(
  tier: OwnerSubscriptionTier | null | undefined,
): OwnerTierDefinition {
  return OWNER_TIERS[tier ?? 'verified'] ?? OWNER_TIERS.verified;
}

/**
 * Checks if the given tier has access to a capability at or above the required tier.
 */
export function hasTierAccess(
  currentTier: OwnerSubscriptionTier | null | undefined,
  requiredTier: OwnerSubscriptionTier,
): boolean {
  const tierRank: Record<OwnerSubscriptionTier, number> = {
    verified: 0,
    growth: 1,
    pro: 2,
  };

  return tierRank[currentTier ?? 'verified'] >= tierRank[requiredTier];
}

/**
 * Returns a user-friendly upgrade message for a gated feature.
 */
export function getTierUpgradeMessage(
  requiredTier: OwnerSubscriptionTier,
  featureLabel: string,
): string {
  const tierDef = OWNER_TIERS[requiredTier];
  return `${featureLabel} is available on the ${tierDef.label} plan ($${tierDef.monthlyPrice}/mo). Upgrade to unlock this feature.`;
}

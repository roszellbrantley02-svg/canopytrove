/**
 * Owner subscription tiers for Canopy Trove.
 *
 * - free:      $0           — Free (sign in, claim storefront, OCM badge, basic management)
 * - verified:  $49/mo       — Verified Presence (hours, analytics, review replies, compliance)
 * - growth:    $149/mo      — Growth (analytics, promotions, messaging)
 * - pro:       $249.99/mo   — Pro launch promo (regular: $499.99/mo)
 *                             • Promo window: now → 2026-11-02 (6 months)
 *                             • Subscribers during the promo lock the $249.99 rate for
 *                               12 months from their subscription date, then convert to
 *                               the regular $499.99 rate at month 13.
 *                             • New subscribers after 2026-11-02 pay $499.99 from day 1.
 *
 * Apple-side mechanics: when the promo ends we publish a NEW IAP product
 * (com.rezell.canopytrove.owner.pro.monthly.v4 at $499.99) and switch the
 * app's productId. Existing subscribers on the old promo product (v3 at
 * $249.99) keep that rate as long as their Apple subscription stays
 * active. After 12 months, the backend cancels their old sub and prompts
 * them to resubscribe at the new product. See docs/PRICING_PROMO.md.
 */

export type OwnerSubscriptionTier = 'free' | 'verified' | 'growth' | 'pro';

export type OwnerTierBillingCycle = 'monthly' | 'annual';

export type OwnerTierDefinition = {
  tier: OwnerSubscriptionTier;
  label: string;
  tagline: string;
  /**
   * The price an owner pays TODAY when subscribing to this tier. For Pro
   * during the launch promo window this is $249.99; after 2026-11-02 it
   * flips to $499.99.
   */
  monthlyPrice: number;
  annualPrice: number;
  /**
   * The post-promo "list price" for this tier. When set, the UI renders a
   * strikethrough version above `monthlyPrice` to communicate the deal.
   * Null/undefined for tiers without a promo.
   */
  regularMonthlyPrice?: number;
  regularAnnualPrice?: number;
  /**
   * If true, the tier is currently in a promotional pricing window and
   * the UI should show the "lock in this rate" framing.
   */
  isPromoPricing?: boolean;
  /**
   * ISO date when the launch promo window closes — after this date, new
   * subscribers pay regularMonthlyPrice. Used for "Lock in by [date]"
   * urgency on the marketing pages.
   */
  promoEndsAt?: string;
  /**
   * How many months a promo subscriber's rate is locked. After this
   * many months the subscription converts to regularMonthlyPrice.
   */
  promoLockMonths?: number;
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

/**
 * Pricing promo end date — when the $249.99 launch rate flips to $499.99
 * for new Pro subscribers. Anyone who subscribes before this date keeps
 * the $249.99 rate for 12 months from their subscription start.
 *
 * Single source of truth — used by the in-app subscription screen and
 * the public-release-pages marketing site.
 */
export const PRO_LAUNCH_PROMO_ENDS_AT = '2026-11-02';
export const PRO_LAUNCH_PROMO_LOCK_MONTHS = 12;

export const OWNER_TIERS: Record<OwnerSubscriptionTier, OwnerTierDefinition> = {
  free: {
    tier: 'free',
    label: 'Free',
    tagline: 'Claim your spot. Get verified.',
    monthlyPrice: 0,
    annualPrice: 0,
    features: [
      'Sign in and create owner account',
      'Claim your storefront',
      'OCM verified badge on listing',
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
  verified: {
    tier: 'verified',
    label: 'Verified Presence',
    tagline: 'Get found. Get trusted.',
    monthlyPrice: 49,
    annualPrice: 490,
    features: [
      'Everything in Free',
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
    monthlyPrice: 249.99,
    annualPrice: 2499,
    regularMonthlyPrice: 499.99,
    regularAnnualPrice: 4999,
    isPromoPricing: true,
    promoEndsAt: PRO_LAUNCH_PROMO_ENDS_AT,
    promoLockMonths: PRO_LAUNCH_PROMO_LOCK_MONTHS,
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

export const OWNER_TIER_ORDER: OwnerSubscriptionTier[] = ['free', 'verified', 'growth', 'pro'];

export const ADDITIONAL_LOCATION_MONTHLY_PRICE = 99;

/**
 * Returns the tier definition for a given tier, defaulting to 'verified'.
 */
export function getOwnerTierDefinition(
  tier: OwnerSubscriptionTier | null | undefined,
): OwnerTierDefinition {
  return OWNER_TIERS[tier ?? 'free'] ?? OWNER_TIERS.free;
}

/**
 * Checks if the given tier has access to a capability at or above the required tier.
 */
export function hasTierAccess(
  currentTier: OwnerSubscriptionTier | null | undefined,
  requiredTier: OwnerSubscriptionTier,
): boolean {
  const tierRank: Record<OwnerSubscriptionTier, number> = {
    free: 0,
    verified: 1,
    growth: 2,
    pro: 3,
  };

  return tierRank[currentTier ?? 'free'] >= tierRank[requiredTier];
}

/**
 * Returns a user-friendly upgrade message for a gated feature.
 */
export function getTierUpgradeMessage(
  requiredTier: OwnerSubscriptionTier,
  featureLabel: string,
): string {
  const tierDef = OWNER_TIERS[requiredTier];
  // Show the strikethrough-style "promo from $X" framing when the
  // required tier is on launch promo so the upgrade prompt reinforces
  // the deal rather than just quoting the discounted price.
  if (tierDef.isPromoPricing && tierDef.regularMonthlyPrice) {
    return `${featureLabel} is available on the ${tierDef.label} plan — launch pricing $${tierDef.monthlyPrice}/mo (regular $${tierDef.regularMonthlyPrice}/mo). Upgrade to unlock this feature.`;
  }
  return `${featureLabel} is available on the ${tierDef.label} plan ($${tierDef.monthlyPrice}/mo). Upgrade to unlock this feature.`;
}

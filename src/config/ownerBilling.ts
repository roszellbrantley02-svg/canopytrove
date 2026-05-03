export type OwnerBillingCycle = 'monthly' | 'annual';
export type AppleOwnerPaidTier = 'verified' | 'growth' | 'pro';

/**
 * Per-extra-location seat — quantity-based price added to the owner's
 * Stripe subscription as a separate line item. Mirrors the backend
 * STRIPE_ADDITIONAL_LOCATION_PRICE_ID configuration. Display-only
 * constant — actual billing is sourced from the live Stripe price ID
 * server-side. If you change the Stripe amount, also bump this constant
 * so the UI cost preview stays in sync.
 */
export const ADDITIONAL_LOCATION_PRICE_PER_MONTH_USD = 99.99;
export const ADDITIONAL_LOCATION_PRICE_LABEL = '$99.99/mo';

export function formatAdditionalLocationCost(extraLocationCount: number): string {
  if (extraLocationCount <= 0) return '$0.00/mo';
  const total = extraLocationCount * ADDITIONAL_LOCATION_PRICE_PER_MONTH_USD;
  return `$${total.toFixed(2)}/mo`;
}

function readValue(name: string) {
  return process.env[name]?.trim() || null;
}

const OWNER_BILLING_PUBLIC_CHECKOUT_ENV_VARS = {
  monthly: 'EXPO_PUBLIC_OWNER_PORTAL_MONTHLY_CHECKOUT_URL',
  annual: 'EXPO_PUBLIC_OWNER_PORTAL_ANNUAL_CHECKOUT_URL',
} as const;

const OWNER_BILLING_PUBLIC_PORTAL_ENV_VAR = 'EXPO_PUBLIC_OWNER_PORTAL_BILLING_PORTAL_URL';
const APPLE_OWNER_IAP_PRODUCT_IDS = {
  verified: {
    envVar: 'EXPO_PUBLIC_APPLE_OWNER_IAP_VERIFIED_PRODUCT_ID',
    fallback: 'com.rezell.canopytrove.owner.verified.monthly.v3',
  },
  growth: {
    envVar: 'EXPO_PUBLIC_APPLE_OWNER_IAP_GROWTH_PRODUCT_ID',
    fallback: 'com.rezell.canopytrove.owner.growth.monthly.v3',
  },
  pro: {
    envVar: 'EXPO_PUBLIC_APPLE_OWNER_IAP_PRO_PRODUCT_ID',
    fallback: 'com.rezell.canopytrove.owner.pro.monthly.v3',
  },
} as const;

export const ownerBillingConfig = {
  monthlyPriceLabel: readValue('EXPO_PUBLIC_OWNER_PORTAL_MONTHLY_PRICE_LABEL'),
  annualPriceLabel: readValue('EXPO_PUBLIC_OWNER_PORTAL_ANNUAL_PRICE_LABEL'),
  monthlyCheckoutUrl: readValue('EXPO_PUBLIC_OWNER_PORTAL_MONTHLY_CHECKOUT_URL'),
  annualCheckoutUrl: readValue('EXPO_PUBLIC_OWNER_PORTAL_ANNUAL_CHECKOUT_URL'),
  billingPortalUrl: readValue('EXPO_PUBLIC_OWNER_PORTAL_BILLING_PORTAL_URL'),
  appleIapProductIds: {
    verified:
      readValue(APPLE_OWNER_IAP_PRODUCT_IDS.verified.envVar) ??
      APPLE_OWNER_IAP_PRODUCT_IDS.verified.fallback,
    growth:
      readValue(APPLE_OWNER_IAP_PRODUCT_IDS.growth.envVar) ??
      APPLE_OWNER_IAP_PRODUCT_IDS.growth.fallback,
    pro:
      readValue(APPLE_OWNER_IAP_PRODUCT_IDS.pro.envVar) ?? APPLE_OWNER_IAP_PRODUCT_IDS.pro.fallback,
  },
} as const;

export function getOwnerBillingPublicCheckoutUrl(cycle: OwnerBillingCycle) {
  return cycle === 'annual'
    ? ownerBillingConfig.annualCheckoutUrl
    : ownerBillingConfig.monthlyCheckoutUrl;
}

export function getMissingOwnerBillingPublicCheckoutEnvVars() {
  const missingEnvVars: string[] = [];

  if (!ownerBillingConfig.monthlyCheckoutUrl) {
    missingEnvVars.push(OWNER_BILLING_PUBLIC_CHECKOUT_ENV_VARS.monthly);
  }

  if (!ownerBillingConfig.annualCheckoutUrl) {
    missingEnvVars.push(OWNER_BILLING_PUBLIC_CHECKOUT_ENV_VARS.annual);
  }

  return missingEnvVars;
}

export function hasConfiguredOwnerBillingPublicCheckoutLinks() {
  return getMissingOwnerBillingPublicCheckoutEnvVars().length === 0;
}

export function getMissingOwnerBillingPublicPortalEnvVars() {
  return ownerBillingConfig.billingPortalUrl ? [] : [OWNER_BILLING_PUBLIC_PORTAL_ENV_VAR];
}

export function hasConfiguredOwnerBillingPublicPortalLink() {
  return getMissingOwnerBillingPublicPortalEnvVars().length === 0;
}

export function getAppleOwnerIapProductId(tier: AppleOwnerPaidTier) {
  return ownerBillingConfig.appleIapProductIds[tier];
}

export function getAppleOwnerIapProductIds() {
  return Object.values(ownerBillingConfig.appleIapProductIds);
}

export function getAppleOwnerIapTierFromProductId(productId: string | null | undefined) {
  const normalizedProductId = productId?.trim();
  if (!normalizedProductId) {
    return null;
  }

  const match = (
    Object.entries(ownerBillingConfig.appleIapProductIds) as Array<[AppleOwnerPaidTier, string]>
  ).find(([, configuredProductId]) => configuredProductId === normalizedProductId);

  return match?.[0] ?? null;
}

export function isAppleOwnerIapProductId(productId: string | null | undefined) {
  return getAppleOwnerIapTierFromProductId(productId) !== null;
}

export function hasConfiguredAppleOwnerBillingProducts() {
  return getAppleOwnerIapProductIds().every(Boolean);
}

export function getOwnerBillingPublicSetupMessage(target: 'checkout' | 'portal') {
  const missingEnvVars =
    target === 'portal'
      ? getMissingOwnerBillingPublicPortalEnvVars()
      : getMissingOwnerBillingPublicCheckoutEnvVars();

  if (!missingEnvVars.length) {
    return target === 'portal'
      ? 'Public owner billing management is configured.'
      : 'Public owner checkout links are configured.';
  }

  return `Missing public owner billing env: ${missingEnvVars.join(', ')}.`;
}

export type OwnerBillingCycle = 'monthly' | 'annual';

function readValue(name: string) {
  return process.env[name]?.trim() || null;
}

const OWNER_BILLING_PUBLIC_CHECKOUT_ENV_VARS = {
  monthly: 'EXPO_PUBLIC_OWNER_PORTAL_MONTHLY_CHECKOUT_URL',
  annual: 'EXPO_PUBLIC_OWNER_PORTAL_ANNUAL_CHECKOUT_URL',
} as const;

const OWNER_BILLING_PUBLIC_PORTAL_ENV_VAR = 'EXPO_PUBLIC_OWNER_PORTAL_BILLING_PORTAL_URL';

export const ownerBillingConfig = {
  monthlyPriceLabel: readValue('EXPO_PUBLIC_OWNER_PORTAL_MONTHLY_PRICE_LABEL'),
  annualPriceLabel: readValue('EXPO_PUBLIC_OWNER_PORTAL_ANNUAL_PRICE_LABEL'),
  monthlyCheckoutUrl: readValue('EXPO_PUBLIC_OWNER_PORTAL_MONTHLY_CHECKOUT_URL'),
  annualCheckoutUrl: readValue('EXPO_PUBLIC_OWNER_PORTAL_ANNUAL_CHECKOUT_URL'),
  billingPortalUrl: readValue('EXPO_PUBLIC_OWNER_PORTAL_BILLING_PORTAL_URL'),
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

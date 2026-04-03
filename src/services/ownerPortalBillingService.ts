import { storefrontApiBaseUrl } from '../config/storefrontSourceConfig';
import type { OwnerBillingCycle } from '../config/ownerBilling';
import {
  getMissingOwnerBillingPublicCheckoutEnvVars,
  getMissingOwnerBillingPublicPortalEnvVars,
  getOwnerBillingPublicCheckoutUrl,
  hasConfiguredOwnerBillingPublicCheckoutLinks,
  ownerBillingConfig,
} from '../config/ownerBilling';
import { requestJson } from './storefrontBackendHttp';

type OwnerBillingSessionSource = 'backend_stripe' | 'payment_link';

export type OwnerBillingCheckoutSessionResponse = {
  ok: boolean;
  billingCycle: OwnerBillingCycle;
  source: OwnerBillingSessionSource;
  url: string;
};

export type OwnerBillingPortalSessionResponse = {
  ok: boolean;
  source: OwnerBillingSessionSource;
  url: string;
};

export function hasConfiguredOwnerBillingFlow() {
  return Boolean(storefrontApiBaseUrl || hasConfiguredOwnerBillingPublicCheckoutLinks());
}

export async function createOwnerBillingCheckoutSession(billingCycle: OwnerBillingCycle) {
  const fallbackUrl = getOwnerBillingPublicCheckoutUrl(billingCycle);

  if (storefrontApiBaseUrl) {
    try {
      return await requestJson<OwnerBillingCheckoutSessionResponse>(
        '/owner-billing/checkout-session',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            billingCycle,
          }),
        },
      );
    } catch (error) {
      if (!fallbackUrl) {
        throw error;
      }
    }
  }

  if (!fallbackUrl) {
    throw new Error(
      `Owner checkout is not configured for this build. Missing public env: ${getMissingOwnerBillingPublicCheckoutEnvVars().join(', ')}.`,
    );
  }

  return {
    ok: true,
    billingCycle,
    source: 'payment_link' as const,
    url: fallbackUrl,
  };
}

export async function createOwnerBillingPortalSession() {
  if (storefrontApiBaseUrl) {
    return requestJson<OwnerBillingPortalSessionResponse>('/owner-billing/portal-session', {
      method: 'POST',
    });
  }

  if (!ownerBillingConfig.billingPortalUrl) {
    throw new Error(
      `Owner billing management is not configured for this build. Missing public env: ${getMissingOwnerBillingPublicPortalEnvVars().join(', ')}.`,
    );
  }

  return {
    ok: true,
    source: 'payment_link' as const,
    url: ownerBillingConfig.billingPortalUrl,
  };
}

import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('ownerBilling config', () => {
  it('treats monthly and annual public checkout links as one required pair', async () => {
    vi.stubEnv('EXPO_PUBLIC_OWNER_PORTAL_MONTHLY_CHECKOUT_URL', 'https://example.com/monthly');
    vi.stubEnv('EXPO_PUBLIC_OWNER_PORTAL_ANNUAL_CHECKOUT_URL', '');
    vi.stubEnv('EXPO_PUBLIC_OWNER_PORTAL_BILLING_PORTAL_URL', '');

    const config = await import('./ownerBilling');

    expect(config.hasConfiguredOwnerBillingPublicCheckoutLinks()).toBe(false);
    expect(config.getMissingOwnerBillingPublicCheckoutEnvVars()).toEqual([
      'EXPO_PUBLIC_OWNER_PORTAL_ANNUAL_CHECKOUT_URL',
    ]);
    expect(config.getOwnerBillingPublicSetupMessage('checkout')).toContain(
      'EXPO_PUBLIC_OWNER_PORTAL_ANNUAL_CHECKOUT_URL',
    );
  });

  it('reports ready states when all public owner billing URLs exist', async () => {
    vi.stubEnv('EXPO_PUBLIC_OWNER_PORTAL_MONTHLY_CHECKOUT_URL', 'https://example.com/monthly');
    vi.stubEnv('EXPO_PUBLIC_OWNER_PORTAL_ANNUAL_CHECKOUT_URL', 'https://example.com/annual');
    vi.stubEnv('EXPO_PUBLIC_OWNER_PORTAL_BILLING_PORTAL_URL', 'https://example.com/manage');

    const config = await import('./ownerBilling');

    expect(config.hasConfiguredOwnerBillingPublicCheckoutLinks()).toBe(true);
    expect(config.hasConfiguredOwnerBillingPublicPortalLink()).toBe(true);
    expect(config.getOwnerBillingPublicSetupMessage('portal')).toBe(
      'Public owner billing management is configured.',
    );
  });
});

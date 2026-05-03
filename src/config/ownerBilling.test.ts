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

  it('formatAdditionalLocationCost returns $0.00/mo for zero or negative counts', async () => {
    const config = await import('./ownerBilling');
    expect(config.formatAdditionalLocationCost(0)).toBe('$0.00/mo');
    expect(config.formatAdditionalLocationCost(-1)).toBe('$0.00/mo');
    expect(config.formatAdditionalLocationCost(-100)).toBe('$0.00/mo');
  });

  it('formatAdditionalLocationCost multiplies $99.99 by the location count', async () => {
    const config = await import('./ownerBilling');
    expect(config.formatAdditionalLocationCost(1)).toBe('$99.99/mo');
    expect(config.formatAdditionalLocationCost(2)).toBe('$199.98/mo');
    expect(config.formatAdditionalLocationCost(3)).toBe('$299.97/mo');
    expect(config.formatAdditionalLocationCost(5)).toBe('$499.95/mo');
  });

  it('exposes the canonical price label that matches the Stripe price', async () => {
    const config = await import('./ownerBilling');
    // If you change ADDITIONAL_LOCATION_PRICE_PER_MONTH_USD, this test
    // forces you to update the Stripe price too (or vice versa).
    expect(config.ADDITIONAL_LOCATION_PRICE_PER_MONTH_USD).toBe(99.99);
    expect(config.ADDITIONAL_LOCATION_PRICE_LABEL).toBe('$99.99/mo');
  });
});

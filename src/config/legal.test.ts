import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('legal config', () => {
  it('normalizes configured public links and marks readiness when all required links exist', async () => {
    vi.stubEnv('EXPO_PUBLIC_SUPPORT_EMAIL', ' help@canopytrove.com ');
    vi.stubEnv('EXPO_PUBLIC_PRIVACY_POLICY_URL', ' https://canopytrove.com/privacy ');
    vi.stubEnv('EXPO_PUBLIC_TERMS_URL', ' https://canopytrove.com/terms ');
    vi.stubEnv('EXPO_PUBLIC_COMMUNITY_GUIDELINES_URL', ' https://canopytrove.com/guidelines ');
    vi.stubEnv('EXPO_PUBLIC_APP_WEBSITE_URL', ' https://canopytrove.com ');
    vi.stubEnv('EXPO_PUBLIC_ACCOUNT_DELETION_HELP_URL', ' https://canopytrove.com/delete-account ');

    const config = await import('./legal');

    expect(config.legalConfig.supportEmail).toBe('help@canopytrove.com');
    expect(config.legalConfig.supportEmailUrl).toBe('mailto:help@canopytrove.com');
    expect(config.legalConfig.privacyPolicyUrl).toBe('https://canopytrove.com/privacy');
    expect(config.hasPublishedLegalLinks).toBe(true);
    expect(config.missingPublishedLegalLinks).toHaveLength(0);
    expect(config.legalSupportLinks[0]?.url).toBe('https://canopytrove.com');
  });

  it('reports missing required public legal links when env vars are absent', async () => {
    vi.stubEnv('EXPO_PUBLIC_SUPPORT_EMAIL', '');
    vi.stubEnv('EXPO_PUBLIC_PRIVACY_POLICY_URL', '');
    vi.stubEnv('EXPO_PUBLIC_TERMS_URL', '');
    vi.stubEnv('EXPO_PUBLIC_COMMUNITY_GUIDELINES_URL', '');

    const config = await import('./legal');

    expect(config.legalConfig.supportEmail).toBe('askmehere@canopytrove.com');
    expect(config.hasPublishedLegalLinks).toBe(false);
    expect(config.missingPublishedLegalLinks.map((link) => link.key)).toEqual([
      'privacy',
      'terms',
      'guidelines',
    ]);
    expect(config.legalReadinessText).toContain('Privacy Policy');
  });
});

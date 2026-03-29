import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('ownerPortalConfig', () => {
  it('enables the prelaunch portal and keeps .test access when the allowlist is empty', async () => {
    vi.stubEnv('EXPO_PUBLIC_OWNER_PORTAL_PRELAUNCH_ENABLED', 'true');
    vi.stubEnv('EXPO_PUBLIC_OWNER_PORTAL_PREVIEW_ENABLED', 'true');
    vi.stubEnv('EXPO_PUBLIC_OWNER_PORTAL_ALLOWLIST', '');

    const config = await import('./ownerPortalConfig');

    expect(config.ownerPortalPrelaunchEnabled).toBe(true);
    expect(config.ownerPortalPreviewEnabled).toBe(true);
    expect(config.isOwnerPortalEmailAllowlisted('owner@canopytrove.test')).toBe(true);
    expect(config.isOwnerPortalEmailAllowlisted('owner@canopytrove.com')).toBe(false);
  });

  it('restricts prelaunch portal access to allowlisted emails', async () => {
    vi.stubEnv('EXPO_PUBLIC_OWNER_PORTAL_PRELAUNCH_ENABLED', '1');
    vi.stubEnv('EXPO_PUBLIC_OWNER_PORTAL_PREVIEW_ENABLED', '0');
    vi.stubEnv(
      'EXPO_PUBLIC_OWNER_PORTAL_ALLOWLIST',
      'owner@canopytrove.test, second@canopytrove.test'
    );

    const config = await import('./ownerPortalConfig');

    expect(config.ownerPortalPreviewEnabled).toBe(false);
    expect(config.isOwnerPortalEmailAllowlisted('owner@canopytrove.test')).toBe(true);
    expect(config.isOwnerPortalEmailAllowlisted('blocked@canopytrove.test')).toBe(false);
  });
});

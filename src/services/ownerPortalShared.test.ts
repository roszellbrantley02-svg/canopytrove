import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('getOwnerPortalAccessState', () => {
  it('does not mark member sessions as owner-approved when prelaunch is off', async () => {
    vi.stubEnv('EXPO_PUBLIC_OWNER_PORTAL_PRELAUNCH_ENABLED', 'false');
    vi.stubEnv('EXPO_PUBLIC_OWNER_PORTAL_ALLOWLIST', '');

    const shared = await import('./ownerPortalShared');

    expect(shared.getOwnerPortalAccessState({ claimRole: null })).toEqual({
      enabled: false,
      restricted: false,
      allowlisted: false,
    });
  });

  it('marks owner claims as approved when prelaunch is off', async () => {
    vi.stubEnv('EXPO_PUBLIC_OWNER_PORTAL_PRELAUNCH_ENABLED', 'false');
    vi.stubEnv('EXPO_PUBLIC_OWNER_PORTAL_ALLOWLIST', '');

    const shared = await import('./ownerPortalShared');

    expect(shared.getOwnerPortalAccessState({ claimRole: 'owner' })).toEqual({
      enabled: false,
      restricted: false,
      allowlisted: true,
    });
  });

  it('keeps prelaunch-gated sessions restricted until an owner claim exists', async () => {
    vi.stubEnv('EXPO_PUBLIC_OWNER_PORTAL_PRELAUNCH_ENABLED', 'true');
    vi.stubEnv('EXPO_PUBLIC_OWNER_PORTAL_ALLOWLIST', 'owner@example.com');

    const shared = await import('./ownerPortalShared');

    expect(shared.getOwnerPortalAccessState({ claimRole: null })).toEqual({
      enabled: true,
      restricted: true,
      allowlisted: false,
    });
  });
});

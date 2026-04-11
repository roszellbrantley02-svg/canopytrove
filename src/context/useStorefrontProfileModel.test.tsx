import React from 'react';
import type { ReactTestRenderer } from 'react-test-renderer';
import { act, create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppProfile } from '../types/storefront';

const appProfileMocks = vi.hoisted(() => ({
  createAppProfileId: vi.fn(),
  ensureAppProfile: vi.fn(),
  getCachedAppProfile: vi.fn(),
  saveAppProfile: vi.fn(),
}));

const backendProfileMocks = vi.hoisted(() => ({
  getStorefrontBackendCanonicalProfile: vi.fn(),
}));

const authMocks = vi.hoisted(() => {
  let listener:
    | ((session: {
        status: 'disabled' | 'checking' | 'signed-out' | 'anonymous' | 'authenticated';
        uid: string | null;
        isAnonymous: boolean;
        displayName: string | null;
        email: string | null;
      }) => void)
    | null = null;

  return {
    getInitialCanopyTroveAuthSession: vi.fn(),
    signOutCanopyTroveSession: vi.fn(),
    startCanopyTroveGuestSession: vi.fn(),
    subscribeToCanopyTroveAuthSession: vi.fn((nextListener) => {
      listener = nextListener;
      return () => {
        listener = null;
      };
    }),
    emit(session: {
      status: 'disabled' | 'checking' | 'signed-out' | 'anonymous' | 'authenticated';
      uid: string | null;
      isAnonymous: boolean;
      displayName: string | null;
      email: string | null;
    }) {
      listener?.(session);
    },
  };
});

vi.mock('../services/appProfileService', () => ({
  createAppProfileId: appProfileMocks.createAppProfileId,
  ensureAppProfile: appProfileMocks.ensureAppProfile,
  getCachedAppProfile: appProfileMocks.getCachedAppProfile,
  saveAppProfile: appProfileMocks.saveAppProfile,
}));

vi.mock('../services/canopyTroveAuthService', () => ({
  getInitialCanopyTroveAuthSession: authMocks.getInitialCanopyTroveAuthSession,
  signOutCanopyTroveSession: authMocks.signOutCanopyTroveSession,
  startCanopyTroveGuestSession: authMocks.startCanopyTroveGuestSession,
  subscribeToCanopyTroveAuthSession: authMocks.subscribeToCanopyTroveAuthSession,
}));

vi.mock('../services/storefrontBackendService', () => ({
  getStorefrontBackendCanonicalProfile: backendProfileMocks.getStorefrontBackendCanonicalProfile,
}));

import { useStorefrontProfileModel } from './useStorefrontProfileModel';

function createProfile(id: string, overrides?: Partial<AppProfile>): AppProfile {
  return {
    id,
    kind: 'anonymous',
    accountId: null,
    displayName: null,
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
    ...overrides,
  };
}

function flushPromises() {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
}

describe('useStorefrontProfileModel', () => {
  let renderer: ReactTestRenderer | null = null;
  let latestValue: ReturnType<typeof useStorefrontProfileModel> | null = null;

  beforeEach(() => {
    renderer?.unmount();
    renderer = null;
    latestValue = null;
    appProfileMocks.createAppProfileId.mockReset();
    appProfileMocks.ensureAppProfile.mockReset();
    appProfileMocks.getCachedAppProfile.mockReset();
    appProfileMocks.saveAppProfile.mockReset();
    backendProfileMocks.getStorefrontBackendCanonicalProfile.mockReset();
    authMocks.getInitialCanopyTroveAuthSession.mockReset();
    authMocks.signOutCanopyTroveSession.mockReset();
    authMocks.startCanopyTroveGuestSession.mockReset();
    authMocks.subscribeToCanopyTroveAuthSession.mockClear();
    appProfileMocks.createAppProfileId.mockReturnValue('generated-profile');
    appProfileMocks.getCachedAppProfile.mockReturnValue(null);
    appProfileMocks.saveAppProfile.mockImplementation(async (profile: AppProfile) => {
      appProfileMocks.getCachedAppProfile.mockReturnValue(profile);
    });
    backendProfileMocks.getStorefrontBackendCanonicalProfile.mockRejectedValue(
      new Error('not available'),
    );
    authMocks.getInitialCanopyTroveAuthSession.mockReturnValue({
      status: 'signed-out',
      uid: null,
      isAnonymous: false,
      displayName: null,
      email: null,
    });
  });

  function HookHarness() {
    latestValue = useStorefrontProfileModel({ cachedProfileId: 'prefs-profile' });
    return null;
  }

  it('hydrates immediately from the cached app profile', async () => {
    const cachedProfile = createProfile('cached-profile');
    appProfileMocks.getCachedAppProfile.mockReturnValue(cachedProfile);

    act(() => {
      renderer = create(<HookHarness />);
    });

    await act(async () => {
      await flushPromises();
    });

    expect(latestValue?.appProfile).toEqual(cachedProfile);
    expect(latestValue?.profileId).toBe('cached-profile');
    expect(appProfileMocks.ensureAppProfile).not.toHaveBeenCalled();
  });

  it('updates and persists the display name', async () => {
    const cachedProfile = createProfile('cached-profile');
    appProfileMocks.getCachedAppProfile.mockReturnValue(cachedProfile);

    act(() => {
      renderer = create(<HookHarness />);
    });

    await act(async () => {
      await latestValue?.updateDisplayName('CanopyTrove User');
    });

    expect(appProfileMocks.saveAppProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'cached-profile',
        displayName: 'CanopyTrove User',
      }),
    );
    expect(latestValue?.appProfile?.displayName).toBe('CanopyTrove User');
  });

  it('rotates an anonymous profile to a fresh authenticated profile on sign-in', async () => {
    const cachedProfile = createProfile('cached-profile');
    appProfileMocks.getCachedAppProfile.mockReturnValue(cachedProfile);
    appProfileMocks.createAppProfileId.mockReturnValue('authenticated-profile');

    act(() => {
      renderer = create(<HookHarness />);
    });

    act(() => {
      authMocks.emit({
        status: 'authenticated',
        uid: 'user-123',
        isAnonymous: false,
        displayName: 'Real User',
        email: 'user@example.com',
      });
    });

    await act(async () => {
      await flushPromises();
    });

    await act(async () => {
      await flushPromises();
    });

    expect(latestValue?.authSession.status).toBe('authenticated');
    expect(appProfileMocks.createAppProfileId).toHaveBeenCalled();
    expect(appProfileMocks.saveAppProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'authenticated-profile',
        kind: 'authenticated',
        accountId: 'user-123',
        displayName: 'Real User',
      }),
    );
  });

  it('reuses the canonical authenticated profile returned by the backend', async () => {
    const cachedProfile = createProfile('cached-profile');
    const canonicalProfile = createProfile('canonical-profile', {
      kind: 'authenticated',
      accountId: 'user-123',
      displayName: 'Daniellett',
      createdAt: '2026-04-06T14:28:51.387Z',
      updatedAt: '2026-04-10T10:26:26.796Z',
    });
    appProfileMocks.getCachedAppProfile.mockReturnValue(cachedProfile);
    backendProfileMocks.getStorefrontBackendCanonicalProfile.mockResolvedValue(canonicalProfile);

    act(() => {
      renderer = create(<HookHarness />);
    });

    act(() => {
      authMocks.emit({
        status: 'authenticated',
        uid: 'user-123',
        isAnonymous: false,
        displayName: 'Daniellett',
        email: 'danielle@example.com',
      });
    });

    await act(async () => {
      await flushPromises();
    });

    await act(async () => {
      await flushPromises();
    });

    expect(latestValue?.profileId).toBe('canonical-profile');
    expect(appProfileMocks.saveAppProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'canonical-profile',
        kind: 'authenticated',
        accountId: 'user-123',
        displayName: 'Daniellett',
      }),
    );
  });

  it('reconciles an already-authenticated cached profile to the canonical backend profile', async () => {
    const cachedProfile = createProfile('duplicate-profile', {
      kind: 'authenticated',
      accountId: 'user-123',
      displayName: 'Daniellett',
    });
    const canonicalProfile = createProfile('canonical-profile', {
      kind: 'authenticated',
      accountId: 'user-123',
      displayName: 'Daniellett',
      createdAt: '2026-04-06T14:28:51.387Z',
      updatedAt: '2026-04-10T10:26:26.796Z',
    });
    appProfileMocks.getCachedAppProfile.mockReturnValue(cachedProfile);
    authMocks.getInitialCanopyTroveAuthSession.mockReturnValue({
      status: 'authenticated',
      uid: 'user-123',
      isAnonymous: false,
      displayName: 'Daniellett',
      email: 'danielle@example.com',
    });
    backendProfileMocks.getStorefrontBackendCanonicalProfile.mockResolvedValue(canonicalProfile);

    act(() => {
      renderer = create(<HookHarness />);
    });

    await act(async () => {
      await flushPromises();
    });

    await act(async () => {
      await flushPromises();
    });

    expect(latestValue?.profileId).toBe('canonical-profile');
    expect(appProfileMocks.saveAppProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'canonical-profile',
        accountId: 'user-123',
      }),
    );
  });

  it('keeps the existing authenticated profile when canonical lookup returns null for the same account', async () => {
    const cachedProfile = createProfile('cached-authenticated-profile', {
      kind: 'authenticated',
      accountId: 'user-123',
      displayName: 'Daniellett',
    });
    appProfileMocks.getCachedAppProfile.mockReturnValue(cachedProfile);
    backendProfileMocks.getStorefrontBackendCanonicalProfile.mockResolvedValue(null);

    act(() => {
      renderer = create(<HookHarness />);
    });

    act(() => {
      authMocks.emit({
        status: 'authenticated',
        uid: 'user-123',
        isAnonymous: false,
        displayName: 'Daniellett',
        email: 'danielle@example.com',
      });
    });

    await act(async () => {
      await flushPromises();
    });

    await act(async () => {
      await flushPromises();
    });

    expect(latestValue?.profileId).toBe('cached-authenticated-profile');
    expect(appProfileMocks.createAppProfileId).not.toHaveBeenCalled();
  });
});

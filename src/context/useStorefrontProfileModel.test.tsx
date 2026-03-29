import React from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppProfile } from '../types/storefront';

const appProfileMocks = vi.hoisted(() => ({
  createAppProfileId: vi.fn(),
  ensureAppProfile: vi.fn(),
  getCachedAppProfile: vi.fn(),
  saveAppProfile: vi.fn(),
}));

const authMocks = vi.hoisted(() => {
  let listener: ((session: {
    status: 'disabled' | 'checking' | 'signed-out' | 'anonymous' | 'authenticated';
    uid: string | null;
    isAnonymous: boolean;
    displayName: string | null;
    email: string | null;
  }) => void) | null = null;

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
    authMocks.getInitialCanopyTroveAuthSession.mockReset();
    authMocks.signOutCanopyTroveSession.mockReset();
    authMocks.startCanopyTroveGuestSession.mockReset();
    authMocks.subscribeToCanopyTroveAuthSession.mockClear();
    appProfileMocks.createAppProfileId.mockReturnValue('generated-profile');
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
      })
    );
    expect(latestValue?.appProfile?.displayName).toBe('CanopyTrove User');
  });

  it('projects authenticated session data into the profile', async () => {
    const cachedProfile = createProfile('cached-profile');
    appProfileMocks.getCachedAppProfile.mockReturnValue(cachedProfile);

    act(() => {
      renderer = create(<HookHarness />);
    });

    await act(async () => {
      authMocks.emit({
        status: 'authenticated',
        uid: 'user-123',
        isAnonymous: false,
        displayName: 'Real User',
        email: 'user@example.com',
      });
      await flushPromises();
    });

    expect(latestValue?.authSession.status).toBe('authenticated');
    expect(latestValue?.appProfile).toEqual(
      expect.objectContaining({
        kind: 'authenticated',
        accountId: 'user-123',
        displayName: 'Real User',
      })
    );
  });
});

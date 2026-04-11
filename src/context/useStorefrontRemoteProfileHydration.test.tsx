import React from 'react';
import type { ReactTestRenderer } from 'react-test-renderer';
import { act, create } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultGamificationState } from '../services/canopyTroveGamificationService';
import type { AppProfile } from '../types/storefront';

const recentMocks = vi.hoisted(() => ({
  getCachedRecentStorefrontIds: vi.fn(() => []),
  getLastRecentStorefrontMutationAt: vi.fn(() => 0),
  saveRecentStorefrontIds: vi.fn(),
}));

const remoteProfileMocks = vi.hoisted(() => ({
  loadRemoteStorefrontProfileState: vi.fn(),
}));

vi.mock('../services/recentStorefrontService', () => ({
  getCachedRecentStorefrontIds: recentMocks.getCachedRecentStorefrontIds,
  getLastRecentStorefrontMutationAt: recentMocks.getLastRecentStorefrontMutationAt,
  saveRecentStorefrontIds: recentMocks.saveRecentStorefrontIds,
}));

vi.mock('../services/storefrontProfileStateService', () => ({
  loadRemoteStorefrontProfileState: remoteProfileMocks.loadRemoteStorefrontProfileState,
}));

import { useStorefrontRemoteProfileHydration } from './useStorefrontRemoteProfileHydration';

function createProfile(id: string, accountId: string): AppProfile {
  return {
    id,
    kind: 'authenticated',
    accountId,
    displayName: `User ${id}`,
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
  };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

describe('useStorefrontRemoteProfileHydration', () => {
  let renderer: ReactTestRenderer | null = null;

  beforeEach(() => {
    renderer?.unmount();
    renderer = null;
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    renderer?.unmount();
  });

  it('ignores a stale remote profile response after the local profile switches', async () => {
    const deferred = createDeferred<{
      profile: AppProfile;
      routeState: { savedStorefrontIds: string[]; recentStorefrontIds: string[] };
      gamificationState: ReturnType<typeof createDefaultGamificationState>;
    } | null>();

    remoteProfileMocks.loadRemoteStorefrontProfileState.mockReturnValue(deferred.promise);

    const capture: {
      current: {
        appProfile: AppProfile | null;
        profileId: string;
        hasHydratedRemoteProfileState: boolean;
        setAppProfile: React.Dispatch<React.SetStateAction<AppProfile | null>>;
        setProfileId: React.Dispatch<React.SetStateAction<string>>;
      } | null;
    } = { current: null };

    function HookHarness() {
      const [appProfile, setAppProfile] = React.useState<AppProfile | null>(
        createProfile('profile-1', 'account-1'),
      );
      const [profileId, setProfileId] = React.useState('profile-1');
      const [savedStorefrontIds, setSavedStorefrontIds] = React.useState<string[]>([]);
      const [recentStorefrontIds, setRecentStorefrontIds] = React.useState<string[]>([]);
      const [gamificationState, setGamificationState] = React.useState(
        createDefaultGamificationState('profile-1', '2026-04-01T00:00:00.000Z'),
      );
      const [hasHydratedRemoteProfileState, setHasHydratedRemoteProfileState] =
        React.useState(false);
      const gamificationStateRef = React.useRef(gamificationState);
      const latestAppProfileRef = React.useRef(appProfile);
      const latestSavedStorefrontIdsRef = React.useRef(savedStorefrontIds);
      const latestRecentStorefrontIdsRef = React.useRef(recentStorefrontIds);
      const lastSavedRemoteStatePayloadRef = React.useRef<string | null>(null);
      const lastRemoteHydrationAtRef = React.useRef(0);
      const remoteHydrationInFlightRef = React.useRef<Promise<void> | null>(null);

      gamificationStateRef.current = gamificationState;
      latestAppProfileRef.current = appProfile;
      latestSavedStorefrontIdsRef.current = savedStorefrontIds;
      latestRecentStorefrontIdsRef.current = recentStorefrontIds;

      capture.current = {
        appProfile,
        profileId,
        hasHydratedRemoteProfileState,
        setAppProfile,
        setProfileId,
      };

      useStorefrontRemoteProfileHydration({
        appProfile,
        gamificationStateRef,
        hasHydratedPreferences: true,
        latestAppProfileRef,
        latestRecentStorefrontIdsRef,
        latestSavedStorefrontIdsRef,
        profileId,
        setAppProfile,
        setGamificationState,
        setHasHydratedRemoteProfileState,
        setProfileId,
        setRecentStorefrontIds,
        setSavedStorefrontIds,
        shouldSyncRemoteProfileState: true,
        lastSavedRemoteStatePayloadRef,
        lastRemoteHydrationAtRef,
        remoteHydrationInFlightRef,
      });

      return null;
    }

    act(() => {
      renderer = create(<HookHarness />);
    });

    await act(async () => {
      vi.advanceTimersByTime(1000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(remoteProfileMocks.loadRemoteStorefrontProfileState).toHaveBeenCalledWith('profile-1');

    await act(async () => {
      capture.current?.setAppProfile(createProfile('profile-current', 'account-current'));
      capture.current?.setProfileId('profile-current');
      await Promise.resolve();
    });

    await act(async () => {
      deferred.resolve({
        profile: createProfile('profile-remote', 'account-remote'),
        routeState: {
          savedStorefrontIds: ['remote-save'],
          recentStorefrontIds: ['remote-recent'],
        },
        gamificationState: createDefaultGamificationState(
          'profile-remote',
          '2026-04-01T00:00:00.000Z',
        ),
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(capture.current?.profileId).toBe('profile-current');
    expect(capture.current?.appProfile?.id).toBe('profile-current');
    expect(capture.current?.hasHydratedRemoteProfileState).toBe(true);
  });
});

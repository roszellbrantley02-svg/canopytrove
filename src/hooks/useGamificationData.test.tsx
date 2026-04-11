import React from 'react';
import type { ReactTestRenderer } from 'react-test-renderer';
import { act, create } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultGamificationState } from '../services/canopyTroveGamificationService';

const controllerMocks = vi.hoisted(() => ({
  useStorefrontProfileController: vi.fn(),
  useStorefrontRewardsController: vi.fn(),
}));

const leaderboardMocks = vi.hoisted(() => ({
  loadStorefrontLeaderboard: vi.fn(),
  loadStorefrontLeaderboardRank: vi.fn(),
}));

vi.mock('../config/storefrontSourceConfig', () => ({
  storefrontSourceMode: 'api',
}));

vi.mock('../context/StorefrontController', () => ({
  useStorefrontProfileController: controllerMocks.useStorefrontProfileController,
  useStorefrontRewardsController: controllerMocks.useStorefrontRewardsController,
}));

vi.mock('../services/storefrontLeaderboardService', () => ({
  loadStorefrontLeaderboard: leaderboardMocks.loadStorefrontLeaderboard,
  loadStorefrontLeaderboardRank: leaderboardMocks.loadStorefrontLeaderboardRank,
}));

import { useGamificationLeaderboard, useGamificationLeaderboardRank } from './useGamificationData';

describe('useGamificationData', () => {
  let renderer: ReactTestRenderer | null = null;

  beforeEach(() => {
    renderer?.unmount();
    renderer = null;
    vi.clearAllMocks();

    controllerMocks.useStorefrontProfileController.mockReturnValue({
      profileId: 'profile-1',
      appProfile: {
        id: 'profile-1',
        kind: 'authenticated',
        displayName: 'Tester',
      },
    });
    controllerMocks.useStorefrontRewardsController.mockReturnValue({
      gamificationState: createDefaultGamificationState('profile-1', '2026-04-01T00:00:00.000Z'),
    });
  });

  afterEach(() => {
    renderer?.unmount();
    renderer = null;
  });

  it('returns leaderboard errors without leaving the hook loading forever', async () => {
    const capture: {
      current:
        | {
            data: { items: unknown[] };
            isLoading: boolean;
            error: string | null;
          }
        | null;
    } = { current: null };
    leaderboardMocks.loadStorefrontLeaderboard.mockRejectedValue(new Error('leaderboard failed'));

    function HookHarness() {
      capture.current = useGamificationLeaderboard(10, 0);
      return null;
    }

    await act(async () => {
      renderer = create(<HookHarness />);
      await Promise.resolve();
      await Promise.resolve();
    });

    if (!capture.current) {
      throw new Error('Expected leaderboard hook value.');
    }
    const result = capture.current;
    expect(leaderboardMocks.loadStorefrontLeaderboard).toHaveBeenCalledWith(10, 0);
    expect(result.error).toBe('leaderboard failed');
    expect(result.isLoading).toBe(false);
    expect(result.data.items).toEqual([]);
  });

  it('returns rank errors without leaving the hook loading forever', async () => {
    const capture: {
      current:
        | {
            data: { profileId: string };
            isLoading: boolean;
            error: string | null;
          }
        | null;
    } = { current: null };
    leaderboardMocks.loadStorefrontLeaderboardRank.mockRejectedValue(new Error('rank failed'));

    function HookHarness() {
      capture.current = useGamificationLeaderboardRank();
      return null;
    }

    await act(async () => {
      renderer = create(<HookHarness />);
      await Promise.resolve();
      await Promise.resolve();
    });

    if (!capture.current) {
      throw new Error('Expected leaderboard rank hook value.');
    }
    const result = capture.current;
    expect(leaderboardMocks.loadStorefrontLeaderboardRank).toHaveBeenCalledWith('profile-1');
    expect(result.error).toBe('rank failed');
    expect(result.isLoading).toBe(false);
    expect(result.data.profileId).toBe('profile-1');
  });
});

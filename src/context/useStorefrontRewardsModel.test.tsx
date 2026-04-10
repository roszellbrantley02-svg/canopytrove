import React from 'react';
import type { ReactTestRenderer } from 'react-test-renderer';
import { act, create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultGamificationState } from '../services/canopyTroveGamificationService';
import type { GamificationRewardResult } from '../types/storefront';

const syncMocks = vi.hoisted(() => ({
  syncStorefrontGamificationEvent: vi.fn(async () => null),
}));

vi.mock('../config/storefrontSourceConfig', () => ({
  storefrontSourceMode: 'api',
}));

vi.mock('../services/storefrontGamificationSyncService', () => ({
  syncStorefrontGamificationEvent: syncMocks.syncStorefrontGamificationEvent,
}));

import { useStorefrontRewardsModel } from './useStorefrontRewardsModel';

type HookResult = ReturnType<typeof useStorefrontRewardsModel>;

function HookHarness({ capture }: { capture: (value: HookResult) => void }) {
  const value = useStorefrontRewardsModel({
    profileId: 'profile-1',
    profileCreatedAt: '2026-04-01T00:00:00.000Z',
    initialState: createDefaultGamificationState('profile-1', '2026-04-01T00:00:00.000Z'),
  });
  capture(value);
  return null;
}

describe('useStorefrontRewardsModel', () => {
  let renderer: ReactTestRenderer | null = null;
  let latestValue: HookResult | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    renderer?.unmount();
    renderer = null;
    latestValue = null;
  });

  it('tracks verified route starts as visits and syncs the event', async () => {
    act(() => {
      renderer = create(
        <HookHarness
          capture={(value) => {
            latestValue = value;
          }}
        />,
      );
    });

    let rewardResult: GamificationRewardResult | null = null;
    await act(async () => {
      rewardResult = latestValue!.trackRouteStartedReward({
        storefrontId: 'store-1',
        routeMode: 'verified',
      });
      await Promise.resolve();
    });

    expect(rewardResult).not.toBeNull();
    if (!rewardResult) {
      throw new Error('Expected a reward result for verified route tracking.');
    }
    const verifiedReward = rewardResult as GamificationRewardResult;
    expect(verifiedReward.updatedState.dispensariesVisited).toBe(1);
    expect(verifiedReward.updatedState.visitedStorefrontIds).toEqual(['store-1']);
    expect(verifiedReward.updatedState.totalRoutesStarted).toBe(1);
    expect(syncMocks.syncStorefrontGamificationEvent).toHaveBeenCalledWith('profile-1', {
      activityType: 'route_started',
      payload: {
        storefrontId: 'store-1',
        routeMode: 'verified',
      },
    });
  });

  it('ignores preview route starts so visits only count for verified trips', () => {
    act(() => {
      renderer = create(
        <HookHarness
          capture={(value) => {
            latestValue = value;
          }}
        />,
      );
    });

    let rewardResult: GamificationRewardResult | null = null;
    act(() => {
      rewardResult = latestValue!.trackRouteStartedReward({
        storefrontId: 'store-1',
        routeMode: 'preview',
      });
    });

    expect(rewardResult).not.toBeNull();
    if (!rewardResult) {
      throw new Error('Expected a reward result for preview route tracking.');
    }
    const previewReward = rewardResult as GamificationRewardResult;
    expect(previewReward.pointsEarned).toBe(0);
    expect(previewReward.updatedState.dispensariesVisited).toBe(0);
    expect(previewReward.updatedState.totalRoutesStarted).toBe(0);
    expect(syncMocks.syncStorefrontGamificationEvent).not.toHaveBeenCalled();
  });
});

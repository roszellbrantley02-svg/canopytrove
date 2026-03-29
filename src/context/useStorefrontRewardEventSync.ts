import React from 'react';
import { storefrontSourceMode } from '../config/storefrontSourceConfig';
import { syncStorefrontGamificationEvent } from '../services/storefrontGamificationSyncService';
import {
  GamificationEventRequest,
  GamificationRewardResult,
  StorefrontGamificationState,
} from '../types/storefront';
import { normalizeRewardResult, shouldSurfaceRewardResult } from './storefrontRewardsShared';
import { areGamificationStatesEqual } from './storefrontControllerShared';

type UseStorefrontRewardEventSyncArgs = {
  gamificationStateRef: React.MutableRefObject<StorefrontGamificationState>;
  profileCreatedAt?: string | null;
  profileId: string;
  setGamificationState: React.Dispatch<React.SetStateAction<StorefrontGamificationState>>;
  setLastRewardResult: React.Dispatch<React.SetStateAction<GamificationRewardResult | null>>;
};

export function useStorefrontRewardEventSync({
  gamificationStateRef,
  profileCreatedAt,
  profileId,
  setGamificationState,
  setLastRewardResult,
}: UseStorefrontRewardEventSyncArgs) {
  const gamificationSyncChainRef = React.useRef(Promise.resolve());

  return React.useCallback(
    (event: GamificationEventRequest) => {
      if (storefrontSourceMode !== 'api') {
        return;
      }

      gamificationSyncChainRef.current = gamificationSyncChainRef.current
        .catch(() => undefined)
        .then(async () => {
          const remoteRewardResult = await syncStorefrontGamificationEvent(profileId, event);
          if (!remoteRewardResult) {
            return;
          }

          const normalizedRemoteReward = normalizeRewardResult(
            profileId,
            remoteRewardResult,
            profileCreatedAt
          );

          gamificationStateRef.current = normalizedRemoteReward.updatedState;
          setGamificationState((current) =>
            areGamificationStatesEqual(current, normalizedRemoteReward.updatedState)
              ? current
              : normalizedRemoteReward.updatedState
          );

          if (shouldSurfaceRewardResult(normalizedRemoteReward)) {
            setLastRewardResult(normalizedRemoteReward);
          }
        });
    },
    [
      gamificationStateRef,
      profileCreatedAt,
      profileId,
      setGamificationState,
      setLastRewardResult,
    ]
  );
}

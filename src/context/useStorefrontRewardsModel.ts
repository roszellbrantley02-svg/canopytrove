import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  GamificationRewardResult,
  StorefrontGamificationState,
} from '../types/storefront';
import {
  applyFollowersUpdatedReward,
  applyFriendInvitedReward,
  applyHelpfulVoteReceivedReward,
  applyPhotoUploadedReward,
  applyReportSubmittedReward,
  applyReviewSubmittedReward,
  getBadgeDefinitions,
  getLevelTitle,
  normalizeGamificationState,
} from '../services/canopyTroveGamificationService';
import { useStorefrontRewardEventSync } from './useStorefrontRewardEventSync';
import {
  areGamificationStatesEqual,
  StorefrontRewardsControllerValue,
} from './storefrontControllerShared';
import { normalizeRewardResult, shouldSurfaceRewardResult } from './storefrontRewardsShared';

type UseStorefrontRewardsModelArgs = {
  profileId: string;
  profileCreatedAt?: string | null;
  initialState: StorefrontGamificationState;
};

export type StorefrontRewardsModel = StorefrontRewardsControllerValue & {
  setGamificationState: React.Dispatch<React.SetStateAction<StorefrontGamificationState>>;
  gamificationStateRef: React.MutableRefObject<StorefrontGamificationState>;
};

export function useStorefrontRewardsModel({
  profileId,
  profileCreatedAt,
  initialState,
}: UseStorefrontRewardsModelArgs): StorefrontRewardsModel {
  const [gamificationState, setGamificationState] = useState<StorefrontGamificationState>(
    initialState
  );
  const [lastRewardResult, setLastRewardResult] = useState<GamificationRewardResult | null>(null);
  const gamificationStateRef = useRef(gamificationState);
  const badgeDefinitions = useMemo(() => getBadgeDefinitions(), []);

  useEffect(() => {
    gamificationStateRef.current = gamificationState;
  }, [gamificationState]);

  useEffect(() => {
    setGamificationState((current) => {
      const nextState = normalizeGamificationState(
        profileId,
        current,
        profileCreatedAt ?? current.joinedDate
      );

      return areGamificationStatesEqual(current, nextState) ? current : nextState;
    });
  }, [profileCreatedAt, profileId]);

  const applyRewardResult = useCallback(
    (rewardResult: GamificationRewardResult) => {
      const normalizedRewardResult = normalizeRewardResult(
        profileId,
        rewardResult,
        profileCreatedAt
      );
      const nextState = normalizedRewardResult.updatedState;

      gamificationStateRef.current = nextState;
      setGamificationState((current) =>
        areGamificationStatesEqual(current, nextState) ? current : nextState
      );
      setLastRewardResult(
        shouldSurfaceRewardResult(normalizedRewardResult)
          ? normalizedRewardResult
          : null
      );

      return normalizedRewardResult;
    },
    [profileCreatedAt, profileId]
  );

  const clearLastRewardResult = useCallback(() => {
    setLastRewardResult(null);
  }, []);

  const syncGamificationEvent = useStorefrontRewardEventSync({
    gamificationStateRef,
    profileCreatedAt,
    profileId,
    setGamificationState,
    setLastRewardResult,
  });

  const trackReviewSubmittedReward = useCallback(
    (payload: { rating: number; textLength: number; photoCount?: number }) => {
      const rewardResult = applyRewardResult(
        applyReviewSubmittedReward(gamificationStateRef.current, payload)
      );

      syncGamificationEvent({
        activityType: 'review_submitted',
        payload,
      });

      return rewardResult;
    },
    [applyRewardResult, syncGamificationEvent]
  );

  const trackPhotoUploadedReward = useCallback(() => {
    const rewardResult = applyRewardResult(
      applyPhotoUploadedReward(gamificationStateRef.current)
    );

    syncGamificationEvent({
      activityType: 'photo_uploaded',
    });

    return rewardResult;
  }, [applyRewardResult, syncGamificationEvent]);

  const trackHelpfulVoteReceivedReward = useCallback(
    (count = 1) => {
      const rewardResult = applyRewardResult(
        applyHelpfulVoteReceivedReward(gamificationStateRef.current, { count })
      );

      syncGamificationEvent({
        activityType: 'helpful_vote_received',
        payload: { count },
      });

      return rewardResult;
    },
    [applyRewardResult, syncGamificationEvent]
  );

  const trackReportSubmittedReward = useCallback(() => {
    const rewardResult = applyRewardResult(
      applyReportSubmittedReward(gamificationStateRef.current)
    );

    syncGamificationEvent({
      activityType: 'report_submitted',
    });

    return rewardResult;
  }, [applyRewardResult, syncGamificationEvent]);

  const trackFriendInvitedReward = useCallback(
    (count = 1) => {
      const rewardResult = applyRewardResult(
        applyFriendInvitedReward(gamificationStateRef.current, { count })
      );

      syncGamificationEvent({
        activityType: 'friend_invited',
        payload: { count },
      });

      return rewardResult;
    },
    [applyRewardResult, syncGamificationEvent]
  );

  const trackFollowersUpdatedReward = useCallback(
    (count: number) => {
      const rewardResult = applyRewardResult(
        applyFollowersUpdatedReward(gamificationStateRef.current, { count })
      );

      syncGamificationEvent({
        activityType: 'followers_updated',
        payload: { count },
      });

      return rewardResult;
    },
    [applyRewardResult, syncGamificationEvent]
  );

  return useMemo(
    () => ({
      badgeDefinitions,
      gamificationState,
      setGamificationState,
      gamificationStateRef,
      levelTitle: getLevelTitle(gamificationState.level),
      lastRewardResult,
      clearLastRewardResult,
      applyRewardResult,
      trackReviewSubmittedReward,
      trackPhotoUploadedReward,
      trackHelpfulVoteReceivedReward,
      trackReportSubmittedReward,
      trackFriendInvitedReward,
      trackFollowersUpdatedReward,
    }),
    [
      applyRewardResult,
      badgeDefinitions,
      clearLastRewardResult,
      gamificationState,
      lastRewardResult,
      trackFollowersUpdatedReward,
      trackFriendInvitedReward,
      trackHelpfulVoteReceivedReward,
      trackPhotoUploadedReward,
      trackReportSubmittedReward,
      trackReviewSubmittedReward,
    ]
  );
}

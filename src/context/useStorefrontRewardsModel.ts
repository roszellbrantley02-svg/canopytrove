import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GamificationRewardResult, StorefrontGamificationState } from '../types/storefront';
import {
  applyFollowersUpdatedReward,
  applyFriendInvitedReward,
  applyHelpfulVoteReceivedReward,
  applyPhotoUploadedReward,
  applyReportSubmittedReward,
  applyReviewSubmittedReward,
  applyRouteStartedReward,
  getBadgeDefinitions,
  getLevelTitle,
  normalizeGamificationState,
} from '../services/canopyTroveGamificationService';
import { useStorefrontRewardEventSync } from './useStorefrontRewardEventSync';
import type { StorefrontRewardsControllerValue } from './storefrontControllerShared';
import { areGamificationStatesEqual } from './storefrontControllerShared';
import { normalizeRewardResult, shouldSurfaceRewardResult } from './storefrontRewardsShared';

type UseStorefrontRewardsModelArgs = {
  profileId: string;
  profileCreatedAt?: string | null;
  initialState: StorefrontGamificationState;
  onGamificationStateMutation?: () => void;
};

export type StorefrontRewardsModel = StorefrontRewardsControllerValue & {
  setGamificationState: React.Dispatch<React.SetStateAction<StorefrontGamificationState>>;
  gamificationStateRef: React.MutableRefObject<StorefrontGamificationState>;
};

export function useStorefrontRewardsModel({
  profileId,
  profileCreatedAt,
  initialState,
  onGamificationStateMutation,
}: UseStorefrontRewardsModelArgs): StorefrontRewardsModel {
  const [gamificationState, setGamificationState] =
    useState<StorefrontGamificationState>(initialState);
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
        profileCreatedAt ?? current.joinedDate,
      );

      return areGamificationStatesEqual(current, nextState) ? current : nextState;
    });
  }, [profileCreatedAt, profileId]);

  const applyRewardResult = useCallback(
    (rewardResult: GamificationRewardResult) => {
      const normalizedRewardResult = normalizeRewardResult(
        profileId,
        rewardResult,
        profileCreatedAt,
      );
      const nextState = normalizedRewardResult.updatedState;

      onGamificationStateMutation?.();
      gamificationStateRef.current = nextState;
      setGamificationState((current) =>
        areGamificationStatesEqual(current, nextState) ? current : nextState,
      );
      setLastRewardResult(
        shouldSurfaceRewardResult(normalizedRewardResult) ? normalizedRewardResult : null,
      );

      return normalizedRewardResult;
    },
    [onGamificationStateMutation, profileCreatedAt, profileId],
  );

  const clearLastRewardResult = useCallback(() => {
    setLastRewardResult(null);
  }, []);

  const syncGamificationEvent = useStorefrontRewardEventSync({
    gamificationStateRef,
    onGamificationStateMutation,
    profileCreatedAt,
    profileId,
    setGamificationState,
    setLastRewardResult,
  });

  const trackReviewSubmittedReward = useCallback(
    (payload: { rating: number; textLength: number; photoCount?: number }) => {
      const rewardResult = applyRewardResult(
        applyReviewSubmittedReward(gamificationStateRef.current, payload),
      );

      syncGamificationEvent({
        activityType: 'review_submitted',
        payload,
      });

      return rewardResult;
    },
    [applyRewardResult, syncGamificationEvent],
  );

  const trackRouteStartedReward = useCallback(
    (payload: { storefrontId: string; routeMode: 'preview' | 'verified' }) => {
      if (payload.routeMode !== 'verified') {
        return {
          activityType: 'route_started' as const,
          pointsEarned: 0,
          badgesEarned: [],
          levelBefore: gamificationStateRef.current.level,
          levelAfter: gamificationStateRef.current.level,
          updatedState: gamificationStateRef.current,
        };
      }

      const rewardResult = applyRewardResult(
        applyRouteStartedReward(gamificationStateRef.current, payload),
      );

      syncGamificationEvent({
        activityType: 'route_started',
        payload,
      });

      return rewardResult;
    },
    [applyRewardResult, syncGamificationEvent],
  );

  const trackPhotoUploadedReward = useCallback(() => {
    const rewardResult = applyRewardResult(applyPhotoUploadedReward(gamificationStateRef.current));

    syncGamificationEvent({
      activityType: 'photo_uploaded',
    });

    return rewardResult;
  }, [applyRewardResult, syncGamificationEvent]);

  const trackHelpfulVoteReceivedReward = useCallback(
    (count = 1) => {
      const rewardResult = applyRewardResult(
        applyHelpfulVoteReceivedReward(gamificationStateRef.current, { count }),
      );

      syncGamificationEvent({
        activityType: 'helpful_vote_received',
        payload: { count },
      });

      return rewardResult;
    },
    [applyRewardResult, syncGamificationEvent],
  );

  const trackReportSubmittedReward = useCallback(() => {
    const rewardResult = applyRewardResult(
      applyReportSubmittedReward(gamificationStateRef.current),
    );

    syncGamificationEvent({
      activityType: 'report_submitted',
    });

    return rewardResult;
  }, [applyRewardResult, syncGamificationEvent]);

  const trackFriendInvitedReward = useCallback(
    (count = 1) => {
      const rewardResult = applyRewardResult(
        applyFriendInvitedReward(gamificationStateRef.current, { count }),
      );

      syncGamificationEvent({
        activityType: 'friend_invited',
        payload: { count },
      });

      return rewardResult;
    },
    [applyRewardResult, syncGamificationEvent],
  );

  const trackFollowersUpdatedReward = useCallback(
    (count: number) => {
      const rewardResult = applyRewardResult(
        applyFollowersUpdatedReward(gamificationStateRef.current, { count }),
      );

      syncGamificationEvent({
        activityType: 'followers_updated',
        payload: { count },
      });

      return rewardResult;
    },
    [applyRewardResult, syncGamificationEvent],
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
      trackRouteStartedReward,
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
      trackRouteStartedReward,
      trackFollowersUpdatedReward,
      trackFriendInvitedReward,
      trackHelpfulVoteReceivedReward,
      trackPhotoUploadedReward,
      trackReportSubmittedReward,
      trackReviewSubmittedReward,
    ],
  );
}

import React from 'react';
import type {
  StorefrontControllerContextValue,
  StorefrontProfileControllerValue,
  StorefrontQueryControllerValue,
  StorefrontRewardsControllerValue,
  StorefrontRouteControllerValue,
} from './storefrontControllerShared';
import type { StorefrontRewardsModel } from './useStorefrontRewardsModel';

type UseStorefrontControllerValuesArgs = {
  appProfile: StorefrontProfileControllerValue['appProfile'];
  authSession: StorefrontProfileControllerValue['authSession'];
  isStartingGuestSession: boolean;
  profileId: string;
  signOutSession: StorefrontProfileControllerValue['signOutSession'];
  startGuestSession: StorefrontProfileControllerValue['startGuestSession'];
  repairProfileForCurrentSession: StorefrontProfileControllerValue['repairProfileForCurrentSession'];
  deleteAccount: StorefrontProfileControllerValue['deleteAccount'];
  updateDisplayName: StorefrontProfileControllerValue['updateDisplayName'];
  clearDisplayName: StorefrontProfileControllerValue['clearDisplayName'];
  rewardsModel: StorefrontRewardsModel;
  routeState: {
    savedStorefrontIds: string[];
    isSavedStorefront: StorefrontRouteControllerValue['isSavedStorefront'];
    toggleSavedStorefront: StorefrontRouteControllerValue['toggleSavedStorefront'];
  };
  queryModel: StorefrontQueryControllerValue;
};

export function useStorefrontControllerValues({
  appProfile,
  authSession,
  isStartingGuestSession,
  profileId,
  signOutSession,
  startGuestSession,
  repairProfileForCurrentSession,
  deleteAccount,
  updateDisplayName,
  clearDisplayName,
  rewardsModel,
  routeState,
  queryModel,
}: UseStorefrontControllerValuesArgs) {
  const queryValue = React.useMemo<StorefrontQueryControllerValue>(() => queryModel, [queryModel]);

  const routeValue = React.useMemo<StorefrontRouteControllerValue>(
    () => ({
      savedStorefrontIds: routeState.savedStorefrontIds,
      isSavedStorefront: routeState.isSavedStorefront,
      toggleSavedStorefront: routeState.toggleSavedStorefront,
    }),
    [routeState.isSavedStorefront, routeState.savedStorefrontIds, routeState.toggleSavedStorefront],
  );

  const profileValue = React.useMemo<StorefrontProfileControllerValue>(
    () => ({
      appProfile,
      clearDisplayName,
      authSession,
      isStartingGuestSession,
      profileId,
      signOutSession,
      startGuestSession,
      repairProfileForCurrentSession,
      deleteAccount,
      updateDisplayName,
    }),
    [
      appProfile,
      authSession,
      clearDisplayName,
      deleteAccount,
      isStartingGuestSession,
      profileId,
      repairProfileForCurrentSession,
      signOutSession,
      startGuestSession,
      updateDisplayName,
    ],
  );

  const rewardsValue = React.useMemo<StorefrontRewardsControllerValue>(
    () => ({
      badgeDefinitions: rewardsModel.badgeDefinitions,
      gamificationState: rewardsModel.gamificationState,
      levelTitle: rewardsModel.levelTitle,
      lastRewardResult: rewardsModel.lastRewardResult,
      clearLastRewardResult: rewardsModel.clearLastRewardResult,
      applyRewardResult: rewardsModel.applyRewardResult,
      trackReviewSubmittedReward: rewardsModel.trackReviewSubmittedReward,
      trackPhotoUploadedReward: rewardsModel.trackPhotoUploadedReward,
      trackHelpfulVoteReceivedReward: rewardsModel.trackHelpfulVoteReceivedReward,
      trackReportSubmittedReward: rewardsModel.trackReportSubmittedReward,
      trackFriendInvitedReward: rewardsModel.trackFriendInvitedReward,
      trackFollowersUpdatedReward: rewardsModel.trackFollowersUpdatedReward,
    }),
    [rewardsModel],
  );

  const controllerValue = React.useMemo<StorefrontControllerContextValue>(
    () => ({
      profile: profileValue,
      query: queryValue,
      rewards: rewardsValue,
      route: routeValue,
    }),
    [profileValue, queryValue, rewardsValue, routeValue],
  );

  return {
    controllerValue,
  };
}

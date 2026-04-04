import {
  applyFollowersUpdatedReward,
  applyFriendInvitedReward,
  applyHelpfulVoteReceivedReward,
  applyPhotoUploadedReward,
  applyReportSubmittedReward,
  applyReviewSubmittedReward,
  applyRouteStartedReward,
  normalizeGamificationState,
} from '../../../src/domain/canopyTroveGamification';
import {
  GamificationActivityType,
  GamificationEventRequest,
  GamificationRewardResult,
  StorefrontGamificationState,
} from '../../../src/types/storefront';
import { getGamificationState, saveGamificationState } from './gamificationPersistenceService';
import { getProfile } from './profileService';

function buildNoRewardResult(
  activityType: GamificationActivityType,
  currentState: StorefrontGamificationState,
): GamificationRewardResult {
  return {
    activityType,
    pointsEarned: 0,
    badgesEarned: [],
    levelBefore: currentState.level,
    levelAfter: currentState.level,
    updatedState: currentState,
  };
}

export async function applyGamificationEvent(
  profileId: string,
  event: GamificationEventRequest,
): Promise<GamificationRewardResult> {
  const profile = await getProfile(profileId);
  const currentState = normalizeGamificationState(
    profileId,
    await getGamificationState(profileId, profile.createdAt),
    profile.createdAt,
  );

  let rewardResult: GamificationRewardResult;

  switch (event.activityType) {
    case 'route_started':
      if (event.payload.routeMode !== 'verified') {
        return buildNoRewardResult(event.activityType, currentState);
      }
      rewardResult = applyRouteStartedReward(currentState, {
        storefrontId: event.payload.storefrontId,
        occurredAt: event.payload.occurredAt,
      });
      break;
    case 'review_submitted':
      rewardResult = applyReviewSubmittedReward(currentState, event.payload);
      break;
    case 'photo_uploaded':
      rewardResult = applyPhotoUploadedReward(currentState, event.payload);
      break;
    case 'helpful_vote_received':
      rewardResult = applyHelpfulVoteReceivedReward(currentState, event.payload);
      break;
    case 'report_submitted':
      rewardResult = applyReportSubmittedReward(currentState, event.payload);
      break;
    case 'friend_invited':
      rewardResult = applyFriendInvitedReward(currentState, event.payload);
      break;
    case 'followers_updated':
      rewardResult = applyFollowersUpdatedReward(currentState, event.payload);
      break;
  }

  const updatedState = normalizeGamificationState(
    profileId,
    rewardResult.updatedState,
    profile.createdAt,
  );

  await saveGamificationState(profileId, updatedState, profile.createdAt);

  return {
    ...rewardResult,
    updatedState,
  };
}

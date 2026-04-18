import {
  applyFollowersUpdatedReward,
  applyFriendInvitedReward,
  applyHelpfulVoteReceivedReward,
  applyPhotoUploadedReward,
  applyReportSubmittedReward,
  applyReviewSubmittedReward,
  applyRouteStartedReward,
  applyScanCompletedReward,
  applyCoaOpenedReward,
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
import { checkGamificationEventAllowed } from '../http/gamificationGuard';

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
  options?: { clientIp?: string },
): Promise<GamificationRewardResult> {
  const profile = await getProfile(profileId);
  const currentState = normalizeGamificationState(
    profileId,
    await getGamificationState(profileId, profile.createdAt),
    profile.createdAt,
  );

  // Enforce per-activity daily caps and cooldowns
  const guardResult = checkGamificationEventAllowed(
    profileId,
    event.activityType,
    options?.clientIp ?? 'unknown',
  );

  if (!guardResult.allowed) {
    return buildNoRewardResult(event.activityType, currentState);
  }

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
    case 'scan_completed':
      rewardResult = applyScanCompletedReward(currentState, {
        scanKind: event.payload.scanKind,
        brandId: event.payload.brandId,
        labName: event.payload.labName,
        thcPercent: event.payload.thcPercent,
        contaminants: event.payload.contaminants,
        isNewBrandForUser: event.payload.isNewBrandForUser,
        terpenes: event.payload.terpenes,
        occurredAt: event.payload.occurredAt,
      });
      break;
    case 'coa_opened':
      rewardResult = applyCoaOpenedReward(currentState, {
        brandId: event.payload.brandId,
        labName: event.payload.labName,
        batchId: event.payload.batchId,
        occurredAt: event.payload.occurredAt,
      });
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

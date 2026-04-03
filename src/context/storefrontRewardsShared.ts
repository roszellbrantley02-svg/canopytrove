import type { GamificationRewardResult } from '../types/storefront';
import { normalizeGamificationState } from '../services/canopyTroveGamificationService';

export function normalizeRewardResult(
  profileId: string,
  rewardResult: GamificationRewardResult,
  profileCreatedAt?: string | null,
) {
  const nextState = normalizeGamificationState(
    profileId,
    rewardResult.updatedState,
    profileCreatedAt ?? rewardResult.updatedState.joinedDate,
  );

  return {
    ...rewardResult,
    updatedState: nextState,
  };
}

export function shouldSurfaceRewardResult(rewardResult: GamificationRewardResult) {
  return (
    rewardResult.pointsEarned > 0 ||
    rewardResult.badgesEarned.length > 0 ||
    rewardResult.levelAfter !== rewardResult.levelBefore
  );
}

import { CANOPYTROVE_BADGES, CANOPYTROVE_POINTS } from './canopyTroveGamification/definitions';
import {
  createDefaultGamificationState,
  getLevelFromPoints,
  getLevelTitle,
  getPointsForLevel,
  normalizeGamificationState,
} from './canopyTroveGamification/state';
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
  getBadgeDefinition,
  getBadgeDefinitions,
} from './canopyTroveGamification/rewards';

export { CANOPYTROVE_BADGES, CANOPYTROVE_POINTS } from './canopyTroveGamification/definitions';
export {
  createDefaultGamificationState,
  getLevelFromPoints,
  getLevelTitle,
  getPointsForLevel,
  normalizeGamificationState,
} from './canopyTroveGamification/state';
export {
  applyFollowersUpdatedReward,
  applyFriendInvitedReward,
  applyHelpfulVoteReceivedReward,
  applyPhotoUploadedReward,
  applyReportSubmittedReward,
  applyReviewSubmittedReward,
  applyRouteStartedReward,
  applyScanCompletedReward,
  applyCoaOpenedReward,
  getBadgeDefinition,
  getBadgeDefinitions,
} from './canopyTroveGamification/rewards';

export const canopyTroveGamificationService = {
  badges: CANOPYTROVE_BADGES,
  points: CANOPYTROVE_POINTS,
  createDefaultGamificationState,
  normalizeGamificationState,
  getLevelFromPoints,
  getPointsForLevel,
  getLevelTitle,
  getBadgeDefinitions,
  getBadgeDefinition,
  applyRouteStartedReward,
  applyReviewSubmittedReward,
  applyPhotoUploadedReward,
  applyHelpfulVoteReceivedReward,
  applyReportSubmittedReward,
  applyFriendInvitedReward,
  applyFollowersUpdatedReward,
  applyScanCompletedReward,
  applyCoaOpenedReward,
};

export default canopyTroveGamificationService;

import { deleteFavoriteDealAlertRecord } from './favoriteDealAlertService';
import { deleteGamificationState } from './gamificationPersistenceService';
import { deleteProfile } from './profileService';
import { deleteRouteState } from './routeStateService';
import { deleteCommunityContentForProfile } from './storefrontCommunityService';

export async function deleteProfileAccountData(profileId: string) {
  await Promise.all([
    deleteProfile(profileId),
    deleteRouteState(profileId),
    deleteGamificationState(profileId),
    deleteFavoriteDealAlertRecord(profileId),
    deleteCommunityContentForProfile(profileId),
  ]);

  return {
    ok: true,
    profileId,
  };
}

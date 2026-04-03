import { deleteFavoriteDealAlertRecord } from './favoriteDealAlertService';
import { deleteGamificationState } from './gamificationPersistenceService';
import { deleteProfile } from './profileService';
import { deleteRouteState } from './routeStateService';
import { deleteCommunityContentForProfile } from './storefrontCommunityService';
import {
  deleteOwnerBusinessVerificationRecord,
  deleteOwnerLicenseComplianceRecordsForOwner,
} from './ownerPortalLicenseComplianceService';

type AccountCleanupDependencies = {
  deleteFavoriteDealAlertRecord: typeof deleteFavoriteDealAlertRecord;
  deleteGamificationState: typeof deleteGamificationState;
  deleteProfile: typeof deleteProfile;
  deleteRouteState: typeof deleteRouteState;
  deleteCommunityContentForProfile: typeof deleteCommunityContentForProfile;
  deleteOwnerLicenseComplianceRecordsForOwner: typeof deleteOwnerLicenseComplianceRecordsForOwner;
  deleteOwnerBusinessVerificationRecord: typeof deleteOwnerBusinessVerificationRecord;
};

type AccountCleanupFailure = {
  step: string;
  message: string;
};

const defaultDependencies: AccountCleanupDependencies = {
  deleteFavoriteDealAlertRecord,
  deleteGamificationState,
  deleteProfile,
  deleteRouteState,
  deleteCommunityContentForProfile,
  deleteOwnerLicenseComplianceRecordsForOwner,
  deleteOwnerBusinessVerificationRecord,
};

export class AccountCleanupError extends Error {
  readonly statusCode = 500;

  constructor(
    message: string,
    public readonly failures: AccountCleanupFailure[]
  ) {
    super(message);
  }
}

async function runCleanupStep(
  step: string,
  task: () => Promise<unknown>
): Promise<AccountCleanupFailure | null> {
  try {
    await task();
    return null;
  } catch (error) {
    return {
      step,
      message: error instanceof Error ? error.message : 'Unknown cleanup failure.',
    };
  }
}

export async function deleteProfileAccountData(
  profileId: string,
  dependencies: AccountCleanupDependencies = defaultDependencies
) {
  const preProfileFailures = (
    await Promise.all([
      runCleanupStep('route_state', () => dependencies.deleteRouteState(profileId)),
      runCleanupStep('gamification_state', () => dependencies.deleteGamificationState(profileId)),
      runCleanupStep('favorite_deal_alerts', () =>
        dependencies.deleteFavoriteDealAlertRecord(profileId)
      ),
      runCleanupStep('community_content', () =>
        dependencies.deleteCommunityContentForProfile(profileId)
      ),
      runCleanupStep('owner_license_compliance', () =>
        dependencies.deleteOwnerLicenseComplianceRecordsForOwner(profileId)
      ),
      runCleanupStep('owner_business_verification', () =>
        dependencies.deleteOwnerBusinessVerificationRecord(profileId)
      ),
    ])
  ).filter((failure): failure is AccountCleanupFailure => Boolean(failure));

  if (preProfileFailures.length) {
    throw new AccountCleanupError(
      'Profile deletion could not complete cleanly before removing the profile record.',
      preProfileFailures
    );
  }

  const profileDeletionFailure = await runCleanupStep('profile_record', () =>
    dependencies.deleteProfile(profileId)
  );
  if (profileDeletionFailure) {
    throw new AccountCleanupError(
      'Profile deletion could not remove the profile record cleanly.',
      [profileDeletionFailure]
    );
  }

  return {
    ok: true,
    profileId,
  };
}

import {
  AppProfileApiDocument,
  StorefrontGamificationStateApiDocument,
  StorefrontRouteStateApiDocument,
} from '../types';
import {
  getGamificationState,
  saveGamificationState,
} from './gamificationPersistenceService';
import { getProfile, saveProfile } from './profileService';
import { getRouteState, saveRouteState } from './routeStateService';

type SaveProfileStateInput = {
  profile?: Partial<AppProfileApiDocument>;
  routeState?: Partial<StorefrontRouteStateApiDocument>;
  gamificationState?: Partial<StorefrontGamificationStateApiDocument>;
};

export async function getProfileState(profileId: string) {
  const [profile, routeState] = await Promise.all([
    getProfile(profileId),
    getRouteState(profileId),
  ]);

  return {
    profile,
    routeState,
    gamificationState: await getGamificationState(profileId, profile.createdAt),
  };
}

function buildProfileDocument(
  profileId: string,
  profile: Partial<AppProfileApiDocument> | undefined
): AppProfileApiDocument {
  const now = new Date().toISOString();
  return {
    id: profileId,
    kind: profile?.kind === 'authenticated' ? 'authenticated' : 'anonymous',
    accountId: typeof profile?.accountId === 'string' ? profile.accountId : null,
    displayName: typeof profile?.displayName === 'string' ? profile.displayName : null,
    createdAt: profile?.createdAt ?? now,
    updatedAt: profile?.updatedAt ?? now,
  };
}

function buildRouteStateDocument(
  profileId: string,
  routeState: Partial<StorefrontRouteStateApiDocument> | undefined
): StorefrontRouteStateApiDocument {
  return {
    profileId,
    savedStorefrontIds: Array.isArray(routeState?.savedStorefrontIds)
      ? routeState.savedStorefrontIds
      : [],
    recentStorefrontIds: Array.isArray(routeState?.recentStorefrontIds)
      ? routeState.recentStorefrontIds
      : [],
    activeRouteSession: routeState?.activeRouteSession ?? null,
    routeSessions: Array.isArray(routeState?.routeSessions) ? routeState.routeSessions : [],
    plannedRouteStorefrontIds: Array.isArray(routeState?.plannedRouteStorefrontIds)
      ? routeState.plannedRouteStorefrontIds
      : [],
  };
}

export async function saveProfileState(
  profileId: string,
  profileState: SaveProfileStateInput | undefined
) {
  const profileDocument = buildProfileDocument(profileId, profileState?.profile);
  const [profile, routeState, gamificationState] = await Promise.all([
    saveProfile(profileDocument),
    saveRouteState(buildRouteStateDocument(profileId, profileState?.routeState)),
    saveGamificationState(profileId, profileState?.gamificationState, profileDocument.createdAt),
  ]);

  return {
    profile,
    routeState,
    gamificationState,
  };
}

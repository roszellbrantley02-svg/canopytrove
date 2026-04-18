import AsyncStorage from '@react-native-async-storage/async-storage';
import { brand } from '../config/brand';
import { storefrontSourceMode } from '../config/storefrontSourceConfig';
import {
  getStorefrontBackendProfile,
  saveStorefrontBackendProfile,
} from './storefrontBackendService';
import {
  getCachedAppProfile as readCachedAppProfile,
  setCachedAppProfile,
} from './appProfileCache';
import type { AppProfile } from '../types/storefront';

const APP_PROFILE_KEY = `${brand.storageNamespace}:app-profile`;

// Re-export so existing callers that import getCachedAppProfile from
// './appProfileService' keep working. New imports in the backend HTTP
// layer should go straight to './appProfileCache' to avoid re-introducing
// the require cycle.
export { getCachedAppProfile } from './appProfileCache';

export function createAppProfileId() {
  return `canopytrove-profile-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function createAppProfile(): AppProfile {
  const now = new Date().toISOString();
  return {
    id: createAppProfileId(),
    kind: 'anonymous',
    accountId: null,
    displayName: null,
    createdAt: now,
    updatedAt: now,
  };
}

export async function createFreshAppProfile() {
  const nextProfile = createAppProfile();
  await saveAppProfile(nextProfile);
  return nextProfile;
}

export async function clearStoredAppProfile() {
  setCachedAppProfile(null);

  try {
    await AsyncStorage.removeItem(APP_PROFILE_KEY);
  } catch {
    // App profile cleanup should never block account deletion.
  }
}

export async function loadAppProfile(): Promise<AppProfile | null> {
  try {
    const rawValue = await AsyncStorage.getItem(APP_PROFILE_KEY);
    if (!rawValue) {
      return null;
    }

    const profile = JSON.parse(rawValue) as AppProfile;
    setCachedAppProfile(profile);
    return profile;
  } catch {
    return null;
  }
}

export async function saveAppProfile(profile: AppProfile): Promise<void> {
  setCachedAppProfile(profile);

  try {
    await AsyncStorage.setItem(APP_PROFILE_KEY, JSON.stringify(profile));
  } catch {
    // App profile persistence should never block app boot.
  }
}

export async function ensureAppProfile(): Promise<AppProfile> {
  const existingProfile = readCachedAppProfile() ?? (await loadAppProfile());
  if (existingProfile) {
    const nextProfile: AppProfile = {
      ...existingProfile,
      accountId: existingProfile.accountId ?? null,
      displayName: existingProfile.displayName ?? null,
      kind: existingProfile.kind ?? 'anonymous',
    };

    const needsNormalization =
      nextProfile.accountId !== existingProfile.accountId ||
      nextProfile.displayName !== existingProfile.displayName ||
      nextProfile.kind !== existingProfile.kind;

    if (needsNormalization) {
      await saveAppProfile(nextProfile);
    } else {
      setCachedAppProfile(existingProfile);
    }

    return nextProfile;
  }

  const nextProfile = createAppProfile();
  await saveAppProfile(nextProfile);
  return nextProfile;
}

export async function syncRemoteAppProfile(profile: AppProfile) {
  if (storefrontSourceMode !== 'api') {
    return null;
  }

  try {
    const remoteProfile = await getStorefrontBackendProfile(profile.id);
    const nextProfile: AppProfile = {
      accountId: remoteProfile.accountId ?? null,
      createdAt: remoteProfile.createdAt,
      displayName: remoteProfile.displayName ?? null,
      id: remoteProfile.id,
      kind: remoteProfile.kind ?? 'anonymous',
      updatedAt: new Date().toISOString(),
    };
    await saveStorefrontBackendProfile(nextProfile);
    await saveAppProfile(nextProfile);
    return nextProfile;
  } catch {
    try {
      const remoteProfile = await saveStorefrontBackendProfile(profile);
      await saveAppProfile(remoteProfile);
      return remoteProfile;
    } catch {
      return null;
    }
  }
}

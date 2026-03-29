import AsyncStorage from '@react-native-async-storage/async-storage';
import { brand } from '../config/brand';
import { storefrontSourceMode } from '../config/storefrontSourceConfig';
import {
  getStorefrontBackendProfile,
  saveStorefrontBackendProfile,
} from './storefrontBackendService';
import { AppProfile } from '../types/storefront';

const APP_PROFILE_KEY = `${brand.storageNamespace}:app-profile`;

let memoryCachedAppProfile: AppProfile | null = null;

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

export function getCachedAppProfile() {
  return memoryCachedAppProfile;
}

export async function clearStoredAppProfile() {
  memoryCachedAppProfile = null;

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
    memoryCachedAppProfile = profile;
    return profile;
  } catch {
    return null;
  }
}

export async function saveAppProfile(profile: AppProfile): Promise<void> {
  memoryCachedAppProfile = profile;

  try {
    await AsyncStorage.setItem(APP_PROFILE_KEY, JSON.stringify(profile));
  } catch {
    // App profile persistence should never block app boot.
  }
}

export async function ensureAppProfile(): Promise<AppProfile> {
  const existingProfile = memoryCachedAppProfile ?? (await loadAppProfile());
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
      memoryCachedAppProfile = existingProfile;
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

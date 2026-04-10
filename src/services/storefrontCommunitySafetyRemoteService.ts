import { storefrontSourceMode } from '../config/storefrontSourceConfig';
import {
  getStorefrontBackendCommunitySafetyState,
  saveStorefrontBackendCommunitySafetyState,
} from './storefrontBackendService';
import type { CommunitySafetyState } from '../types/storefront';

export async function loadRemoteCommunitySafetyState(profileId: string) {
  if (storefrontSourceMode !== 'api') {
    return null;
  }

  try {
    return await getStorefrontBackendCommunitySafetyState(profileId);
  } catch {
    return null;
  }
}

export async function saveRemoteCommunitySafetyState(
  profileId: string,
  state: CommunitySafetyState,
) {
  if (storefrontSourceMode !== 'api') {
    return null;
  }

  try {
    return await saveStorefrontBackendCommunitySafetyState(profileId, state);
  } catch {
    return null;
  }
}

import { storefrontSourceMode } from '../config/storefrontSourceConfig';
import {
  getStorefrontBackendProfileState,
  saveStorefrontBackendProfileState,
} from './storefrontBackendService';
import { StorefrontProfileState } from '../types/storefront';

export async function loadRemoteStorefrontProfileState(profileId: string) {
  if (storefrontSourceMode !== 'api') {
    return null;
  }

  try {
    return await getStorefrontBackendProfileState(profileId);
  } catch {
    return null;
  }
}

export async function saveRemoteStorefrontProfileState(profileState: StorefrontProfileState) {
  if (storefrontSourceMode !== 'api') {
    return null;
  }

  try {
    return await saveStorefrontBackendProfileState(profileState);
  } catch {
    return null;
  }
}

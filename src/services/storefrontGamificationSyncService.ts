import { storefrontSourceMode } from '../config/storefrontSourceConfig';
import {
  GamificationEventRequest,
  GamificationRewardResult,
} from '../types/storefront';
import { postStorefrontBackendGamificationEvent } from './storefrontBackendService';

export async function syncStorefrontGamificationEvent(
  profileId: string,
  event: GamificationEventRequest
): Promise<GamificationRewardResult | null> {
  if (storefrontSourceMode !== 'api') {
    return null;
  }

  try {
    return await postStorefrontBackendGamificationEvent(profileId, event);
  } catch {
    return null;
  }
}

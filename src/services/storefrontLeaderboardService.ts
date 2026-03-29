import { storefrontSourceMode } from '../config/storefrontSourceConfig';
import {
  GamificationLeaderboardResponse,
} from '../types/storefront';
import {
  getStorefrontBackendLeaderboard,
  getStorefrontBackendLeaderboardRank,
} from './storefrontBackendService';

const EMPTY_LEADERBOARD: GamificationLeaderboardResponse = {
  items: [],
  total: 0,
  limit: 25,
  offset: 0,
};

export async function loadStorefrontLeaderboard(limit = 25, offset = 0) {
  if (storefrontSourceMode !== 'api') {
    return {
      ...EMPTY_LEADERBOARD,
      limit,
      offset,
    };
  }

  try {
    return await getStorefrontBackendLeaderboard(limit, offset);
  } catch {
    return {
      ...EMPTY_LEADERBOARD,
      limit,
      offset,
    };
  }
}

export async function loadStorefrontLeaderboardRank(profileId: string) {
  if (storefrontSourceMode !== 'api') {
    return {
      profileId,
      rank: 0,
      total: 0,
    };
  }

  try {
    return await getStorefrontBackendLeaderboardRank(profileId);
  } catch {
    return {
      profileId,
      rank: 0,
      total: 0,
    };
  }
}

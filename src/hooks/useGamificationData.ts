import { useEffect, useState } from 'react';
import { storefrontSourceMode } from '../config/storefrontSourceConfig';
import {
  useStorefrontProfileController,
  useStorefrontRewardsController,
} from '../context/StorefrontController';
import {
  GamificationLeaderboardEntry,
  GamificationLeaderboardResponse,
} from '../types/storefront';
import {
  loadStorefrontLeaderboard,
  loadStorefrontLeaderboardRank,
} from '../services/storefrontLeaderboardService';

function buildLocalLeaderboardEntry(
  profileId: string,
  displayName: string | null,
  profileKind: 'anonymous' | 'authenticated',
  gamificationState: ReturnType<typeof useStorefrontRewardsController>['gamificationState']
): GamificationLeaderboardEntry {
  return {
    profileId,
    displayName,
    profileKind,
    totalPoints: gamificationState.totalPoints,
    level: gamificationState.level,
    badgeCount: gamificationState.badges.length,
    totalReviews: gamificationState.totalReviews,
    totalPhotos: gamificationState.totalPhotos,
    dispensariesVisited: gamificationState.dispensariesVisited,
    totalRoutesStarted: gamificationState.totalRoutesStarted,
    rank: 1,
    updatedAt: gamificationState.lastActiveDate ?? gamificationState.joinedDate,
  };
}

export function useGamificationLeaderboard(limit = 25, offset = 0) {
  const { profileId, appProfile } = useStorefrontProfileController();
  const { gamificationState } = useStorefrontRewardsController();
  const [data, setData] = useState<GamificationLeaderboardResponse>(() => ({
    items:
      storefrontSourceMode === 'api'
        ? []
        : [
            buildLocalLeaderboardEntry(
              profileId,
              appProfile?.displayName ?? null,
              appProfile?.kind ?? 'anonymous',
              gamificationState
            ),
          ],
    total: storefrontSourceMode === 'api' ? 0 : 1,
    limit,
    offset,
  }));
  const [isLoading, setIsLoading] = useState(storefrontSourceMode === 'api');

  useEffect(() => {
    let alive = true;

    if (storefrontSourceMode !== 'api') {
      setData({
        items: [
          buildLocalLeaderboardEntry(
            profileId,
            appProfile?.displayName ?? null,
            appProfile?.kind ?? 'anonymous',
            gamificationState
          ),
        ],
        total: 1,
        limit,
        offset,
      });
      setIsLoading(false);
      return () => {
        alive = false;
      };
    }

    setIsLoading(true);
    void (async () => {
      const nextData = await loadStorefrontLeaderboard(limit, offset);
      if (!alive) {
        return;
      }

      setData(nextData);
      setIsLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, [
    appProfile?.displayName,
    appProfile?.kind,
    gamificationState,
    limit,
    offset,
    profileId,
  ]);

  return { data, isLoading };
}

export function useGamificationLeaderboardRank() {
  const { profileId } = useStorefrontProfileController();
  const { gamificationState } = useStorefrontRewardsController();
  const [data, setData] = useState(() => ({
    profileId,
    rank: storefrontSourceMode === 'api' ? 0 : 1,
    total: storefrontSourceMode === 'api' ? 0 : gamificationState.totalPoints > 0 ? 1 : 0,
  }));
  const [isLoading, setIsLoading] = useState(storefrontSourceMode === 'api');

  useEffect(() => {
    let alive = true;

    if (storefrontSourceMode !== 'api') {
      setData({
        profileId,
        rank: 1,
        total: gamificationState.totalPoints > 0 ? 1 : 0,
      });
      setIsLoading(false);
      return () => {
        alive = false;
      };
    }

    setIsLoading(true);
    void (async () => {
      const nextRank = await loadStorefrontLeaderboardRank(profileId);
      if (!alive) {
        return;
      }

      setData(nextRank);
      setIsLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, [gamificationState.totalPoints, profileId]);

  return { data, isLoading };
}

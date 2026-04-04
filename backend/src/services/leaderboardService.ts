import {
  GamificationLeaderboardApiResponse,
  GamificationLeaderboardEntryApiDocument,
} from '../types';
import { listGamificationStates } from './gamificationPersistenceService';
import { listProfiles } from './profileService';

function normalizeLimit(limit: number | undefined) {
  if (!Number.isFinite(limit)) {
    return 25;
  }

  return Math.max(1, Math.min(100, Math.floor(limit!)));
}

function normalizeOffset(offset: number | undefined) {
  if (!Number.isFinite(offset)) {
    return 0;
  }

  return Math.max(0, Math.floor(offset!));
}

export async function getLeaderboard(
  limit?: number,
  offset?: number,
): Promise<GamificationLeaderboardApiResponse> {
  const [profiles, gamificationStates] = await Promise.all([
    listProfiles(),
    listGamificationStates(),
  ]);

  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const sortedEntries = gamificationStates
    .slice()
    .sort((left, right) => {
      if (right.totalPoints !== left.totalPoints) {
        return right.totalPoints - left.totalPoints;
      }

      if (right.level !== left.level) {
        return right.level - left.level;
      }

      if (right.badges.length !== left.badges.length) {
        return right.badges.length - left.badges.length;
      }

      return left.joinedDate.localeCompare(right.joinedDate);
    })
    .map<GamificationLeaderboardEntryApiDocument>((state, index) => {
      const profile = profileById.get(state.profileId);

      return {
        profileId: state.profileId,
        displayName: profile?.displayName ?? null,
        profileKind: profile?.kind ?? 'anonymous',
        totalPoints: state.totalPoints,
        level: state.level,
        badgeCount: state.badges.length,
        totalReviews: state.totalReviews,
        totalPhotos: state.totalPhotos,
        dispensariesVisited: state.dispensariesVisited,
        totalRoutesStarted: state.totalRoutesStarted,
        rank: index + 1,
        updatedAt: profile?.updatedAt ?? state.lastActiveDate ?? state.joinedDate,
      };
    });

  const normalizedLimit = normalizeLimit(limit);
  const normalizedOffset = normalizeOffset(offset);

  return {
    items: sortedEntries.slice(normalizedOffset, normalizedOffset + normalizedLimit),
    total: sortedEntries.length,
    limit: normalizedLimit,
    offset: normalizedOffset,
  };
}

export async function getLeaderboardRank(profileId: string) {
  const leaderboard = await getLeaderboard(5000, 0);
  const entry = leaderboard.items.find((item) => item.profileId === profileId);

  return {
    profileId,
    rank: entry?.rank ?? 0,
    total: leaderboard.total,
  };
}

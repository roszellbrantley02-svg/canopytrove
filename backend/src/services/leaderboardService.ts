import {
  AppProfileApiDocument,
  GamificationLeaderboardApiResponse,
  GamificationLeaderboardEntryApiDocument,
  StorefrontGamificationStateApiDocument,
} from '../types';
import { getOptionalFirestoreCollection } from '../firestoreCollections';
import { listGamificationStates } from './gamificationPersistenceService';
import { listProfiles } from './profileService';

const USERS_COLLECTION = 'users';

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

/**
 * Load the set of Firebase UIDs that belong to owner or admin accounts.
 * These users are excluded from the community leaderboard.
 */
async function loadOwnerAccountIds(): Promise<Set<string>> {
  const collectionRef = getOptionalFirestoreCollection<{
    uid: string;
    role: string;
  }>(USERS_COLLECTION);

  if (!collectionRef) {
    return new Set();
  }

  const snapshot = await collectionRef.where('role', 'in', ['owner', 'admin']).select('uid').get();

  return new Set(snapshot.docs.map((doc) => doc.id));
}

/**
 * When the same authenticated user has multiple profiles (e.g. different
 * devices, cache clears), the leaderboard can show them twice — once per
 * profileId. This function merges gamification states that share the same
 * `accountId`, keeping the profile with the highest total points and summing
 * any metrics the secondary profile accumulated.
 */
function deduplicateByAccount(
  gamificationStates: StorefrontGamificationStateApiDocument[],
  profileById: Map<string, AppProfileApiDocument>,
) {
  const accountToPrimary = new Map<
    string,
    {
      primary: StorefrontGamificationStateApiDocument;
      merged: StorefrontGamificationStateApiDocument[];
    }
  >();

  const deduplicatedStates: StorefrontGamificationStateApiDocument[] = [];

  for (const state of gamificationStates) {
    const profile = profileById.get(state.profileId);
    const accountId = profile?.accountId ?? null;

    if (!accountId) {
      deduplicatedStates.push(state);
      continue;
    }

    const existing = accountToPrimary.get(accountId);
    if (!existing) {
      accountToPrimary.set(accountId, { primary: state, merged: [state] });
      continue;
    }

    existing.merged.push(state);
    if (state.totalPoints > existing.primary.totalPoints) {
      existing.primary = state;
    }
  }

  for (const { primary, merged } of accountToPrimary.values()) {
    if (merged.length === 1) {
      deduplicatedStates.push(primary);
      continue;
    }

    let totalPoints = 0;
    let totalReviews = 0;
    let totalPhotos = 0;
    let dispensariesVisited = 0;
    let totalRoutesStarted = 0;
    let badgeCount = 0;
    let highestLevel = 0;
    let earliestJoined = primary.joinedDate;

    for (const state of merged) {
      totalPoints += state.totalPoints;
      totalReviews += state.totalReviews;
      totalPhotos += state.totalPhotos;
      dispensariesVisited += state.dispensariesVisited;
      totalRoutesStarted += state.totalRoutesStarted;
      badgeCount = Math.max(badgeCount, state.badges.length);
      highestLevel = Math.max(highestLevel, state.level);
      if (state.joinedDate < earliestJoined) {
        earliestJoined = state.joinedDate;
      }
    }

    deduplicatedStates.push({
      ...primary,
      totalPoints,
      totalReviews,
      totalPhotos,
      dispensariesVisited,
      totalRoutesStarted,
      level: highestLevel,
      joinedDate: earliestJoined,
    });
  }

  return deduplicatedStates;
}

export async function getLeaderboard(
  limit?: number,
  offset?: number,
): Promise<GamificationLeaderboardApiResponse> {
  const [profiles, gamificationStates, ownerAccountIds] = await Promise.all([
    listProfiles(5000),
    listGamificationStates(5000),
    loadOwnerAccountIds(),
  ]);

  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));

  // Exclude owners and admins — the leaderboard is for regular users only.
  const nonOwnerStates = gamificationStates.filter((state) => {
    const profile = profileById.get(state.profileId);
    const accountId = profile?.accountId ?? null;
    return !accountId || !ownerAccountIds.has(accountId);
  });

  const deduplicatedStates = deduplicateByAccount(nonOwnerStates, profileById);

  const sortedEntries = deduplicatedStates
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

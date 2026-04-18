import { StorefrontGamificationStateApiDocument } from '../types';

const MAX_LEVEL = 200;

function getLevelFromPoints(points: number): number {
  if (points < 1000) {
    return Math.min(10, Math.floor(points / 100) + 1);
  }

  if (points < 10000) {
    return Math.min(50, Math.floor(Math.sqrt(points / 10)) + 10);
  }

  return Math.min(MAX_LEVEL, Math.floor(Math.pow(points / 1000, 0.7)) + 50);
}

function getPointsForLevel(level: number): number {
  if (level <= 10) {
    return (level - 1) * 100;
  }

  if (level <= 50) {
    return Math.pow(level - 10, 2) * 10;
  }

  return Math.pow((level - 50) / 0.7, 1.43) * 1000;
}

export function createDefaultGamificationStateDocument(
  profileId: string,
  joinedDate?: string | null,
): StorefrontGamificationStateApiDocument {
  const totalPoints = 0;
  const level = getLevelFromPoints(totalPoints);
  const now = joinedDate || new Date().toISOString();

  return {
    profileId,
    totalPoints,
    totalReviews: 0,
    totalPhotos: 0,
    totalHelpfulVotes: 0,
    currentStreak: 0,
    longestStreak: 0,
    lastReviewDate: null,
    lastActiveDate: null,
    dispensariesVisited: 0,
    visitedStorefrontIds: [],
    badges: [],
    joinedDate: now,
    level,
    nextLevelPoints: getPointsForLevel(Math.min(level + 1, MAX_LEVEL)),
    reviewsWithPhotos: 0,
    detailedReviews: 0,
    fiveStarReviews: 0,
    oneStarReviews: 0,
    commentsWritten: 0,
    reportsSubmitted: 0,
    friendsInvited: 0,
    followersCount: 0,
    totalRoutesStarted: 0,
    scanStats: {
      productScanCount: 0,
      uniqueBrandIds: [],
      uniqueTerpenes: [],
      coaOpenCount: 0,
      cleanPassCount: 0,
      highThcScans: 0,
    },
  };
}

export function normalizeGamificationStateDocument(
  profileId: string,
  state: Partial<StorefrontGamificationStateApiDocument> | undefined,
  joinedDate?: string | null,
): StorefrontGamificationStateApiDocument {
  const fallback = createDefaultGamificationStateDocument(profileId, joinedDate);
  const totalPoints = Number(state?.totalPoints ?? fallback.totalPoints);
  const level = getLevelFromPoints(totalPoints);

  const scanStats = state?.scanStats ?? fallback.scanStats;
  const normalizedScanStats = scanStats
    ? {
        productScanCount: Number(scanStats.productScanCount ?? 0),
        uniqueBrandIds: Array.isArray(scanStats.uniqueBrandIds)
          ? scanStats.uniqueBrandIds.slice(0, 500)
          : [],
        uniqueTerpenes: Array.isArray(scanStats.uniqueTerpenes)
          ? scanStats.uniqueTerpenes.slice(0, 100)
          : [],
        coaOpenCount: Number(scanStats.coaOpenCount ?? 0),
        cleanPassCount: Number(scanStats.cleanPassCount ?? 0),
        highThcScans: Number(scanStats.highThcScans ?? 0),
      }
    : fallback.scanStats;

  return {
    profileId,
    totalPoints,
    totalReviews: Number(state?.totalReviews ?? fallback.totalReviews),
    totalPhotos: Number(state?.totalPhotos ?? fallback.totalPhotos),
    totalHelpfulVotes: Number(state?.totalHelpfulVotes ?? fallback.totalHelpfulVotes),
    currentStreak: Number(state?.currentStreak ?? fallback.currentStreak),
    longestStreak: Number(state?.longestStreak ?? fallback.longestStreak),
    lastReviewDate: state?.lastReviewDate ?? fallback.lastReviewDate,
    lastActiveDate: state?.lastActiveDate ?? fallback.lastActiveDate,
    dispensariesVisited: Number(state?.dispensariesVisited ?? fallback.dispensariesVisited),
    visitedStorefrontIds: Array.isArray(state?.visitedStorefrontIds)
      ? state!.visitedStorefrontIds.slice(0, 256)
      : fallback.visitedStorefrontIds,
    badges: Array.isArray(state?.badges) ? state!.badges.slice(0, 128) : fallback.badges,
    joinedDate: state?.joinedDate ?? fallback.joinedDate,
    level,
    nextLevelPoints: getPointsForLevel(Math.min(level + 1, MAX_LEVEL)),
    reviewsWithPhotos: Number(state?.reviewsWithPhotos ?? fallback.reviewsWithPhotos),
    detailedReviews: Number(state?.detailedReviews ?? fallback.detailedReviews),
    fiveStarReviews: Number(state?.fiveStarReviews ?? fallback.fiveStarReviews),
    oneStarReviews: Number(state?.oneStarReviews ?? fallback.oneStarReviews),
    commentsWritten: Number(state?.commentsWritten ?? fallback.commentsWritten),
    reportsSubmitted: Number(state?.reportsSubmitted ?? fallback.reportsSubmitted),
    friendsInvited: Number(state?.friendsInvited ?? fallback.friendsInvited),
    followersCount: Number(state?.followersCount ?? fallback.followersCount),
    totalRoutesStarted: Number(state?.totalRoutesStarted ?? fallback.totalRoutesStarted),
    scanStats: normalizedScanStats,
  };
}

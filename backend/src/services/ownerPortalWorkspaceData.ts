import { logger } from '../observability/logger';
import {
  OwnerPortalWorkspaceDocument,
  OwnerWorkspaceMetrics,
  OwnerWorkspacePatternFlag,
  OwnerWorkspaceReviewRecord,
  OwnerStorefrontProfileToolsDocument,
  OwnerStorefrontPromotionDocument,
} from '../../../src/types/ownerPortal';
import { StorefrontDetailApiDocument, StorefrontSummaryApiDocument } from '../types';
import { backendStorefrontSourceStatus, backendStorefrontSource } from '../sources';
import { getBackendFirebaseDb } from '../firebase';
import { ROUTE_STATE_COLLECTION } from '../constants/collections';
import {
  listStorefrontAppReviews,
  listStorefrontReports,
  StoredStorefrontReportRecord,
} from './storefrontCommunityService';
import { getRouteState, isFollowingStorefront, isFrequentVisitor } from './routeStateService';
import { getOwnerPortalAlertStatus } from './ownerPortalAlertService';
import { dispatchFavoriteDealAlertsForStorefront } from './favoriteDealAlertService';
import { assertRuntimePolicyAllowsOwnerAction, getRuntimeOpsStatus } from './runtimeOpsService';
import { getOwnerLicenseCompliance } from './ownerPortalLicenseComplianceService';
import { hydrateOwnerStorefrontProfileToolsMedia } from './storefrontMediaAccessService';
import {
  collectProfileAttachmentUrls,
  createId,
  derivePromotionStatus,
  getNowIso,
  isPromotionActive,
  normalizeBadges,
  normalizeProfileTools,
  normalizePromotion,
  parseIsoDate,
  sanitizeProfileToolsRecord,
} from './ownerPortalWorkspaceHelpers';
import {
  DailyDealMetricRecord,
  DailyStorefrontMetricRecord,
  getDailyDealMetricsCollection,
  getDailyStorefrontMetricsCollection,
  getOwnerClaimCollection,
  getOwnerProfileCollection,
  getOwnerStorefrontProfileToolsCollection,
  getOwnerStorefrontPromotionsCollection,
  OwnerClaimRecord,
  OwnerProfileRecord,
} from './ownerPortalWorkspaceCollections';

const ownerProfileStore = new Map<string, OwnerProfileRecord>();
const ownerClaimStore = new Map<string, OwnerClaimRecord>();
const ownerStorefrontProfileToolsStore = new Map<string, OwnerStorefrontProfileToolsDocument>();
const ownerStorefrontPromotionStore = new Map<string, OwnerStorefrontPromotionDocument[]>();
const ownerStorefrontProfileToolsCache = new Map<
  string,
  { expiresAt: number; value: OwnerStorefrontProfileToolsDocument | null }
>();
const ownerStorefrontPromotionCache = new Map<
  string,
  { expiresAt: number; value: OwnerStorefrontPromotionDocument[] }
>();
const storefrontSummaryEnhancementCache = new Map<
  string,
  { expiresAt: number; value: Partial<StorefrontSummaryApiDocument> }
>();
const storefrontDetailEnhancementCache = new Map<
  string,
  { expiresAt: number; value: Partial<StorefrontDetailApiDocument> }
>();

type ViewerContext = {
  profileId: string;
} | null;

type OwnerWorkspaceEnhancementDeps = {
  getProfileTools: (storefrontId: string) => Promise<OwnerStorefrontProfileToolsDocument | null>;
  getActivePromotion: (
    storefrontId: string,
    viewerContext?: ViewerContext,
  ) => Promise<OwnerStorefrontPromotionDocument | null>;
  getFollowerCount: (storefrontId: string) => Promise<number>;
  hydrateProfileTools: (
    profileTools: OwnerStorefrontProfileToolsDocument | null,
  ) => Promise<OwnerStorefrontProfileToolsDocument | null>;
};

const defaultOwnerWorkspaceEnhancementDeps: OwnerWorkspaceEnhancementDeps = {
  getProfileTools: getOwnerStorefrontProfileTools,
  getActivePromotion,
  getFollowerCount: sumStorefrontFollowers,
  hydrateProfileTools: hydrateOwnerStorefrontProfileToolsMedia,
};

function logOwnerWorkspaceEnhancementWarning(
  scope: 'summary' | 'detail',
  storefrontId: string,
  dependency: string,
  error: unknown,
) {
  const message = error instanceof Error ? error.message : String(error);
  logger.warn(
    `owner-workspace-${scope}: failed to load ${dependency} for ${storefrontId}: ${message}`,
    { scope, storefrontId, dependency },
  );
}

async function getOwnerProfile(ownerUid: string) {
  const collectionRef = getOwnerProfileCollection();
  if (collectionRef) {
    const snapshot = await collectionRef.doc(ownerUid).get();
    if (!snapshot.exists) {
      return null;
    }

    return snapshot.data() as OwnerProfileRecord;
  }

  return ownerProfileStore.get(ownerUid) ?? null;
}

async function getOwnerClaim(ownerUid: string, storefrontId: string | null) {
  if (!storefrontId) {
    return null;
  }

  const claimId = `${ownerUid}_${storefrontId}`;
  const collectionRef = getOwnerClaimCollection();
  if (collectionRef) {
    const snapshot = await collectionRef.doc(claimId).get();
    if (!snapshot.exists) {
      return null;
    }

    return snapshot.data() as OwnerClaimRecord;
  }

  return ownerClaimStore.get(claimId) ?? null;
}

async function getOwnerStorefrontProfileTools(storefrontId: string) {
  const cached = ownerStorefrontProfileToolsCache.get(storefrontId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const collectionRef = getOwnerStorefrontProfileToolsCollection();
  let profileTools: OwnerStorefrontProfileToolsDocument | null = null;

  if (collectionRef) {
    const snapshot = await collectionRef.doc(storefrontId).get();
    if (snapshot.exists) {
      profileTools = sanitizeProfileToolsRecord(
        snapshot.data() as OwnerStorefrontProfileToolsDocument,
      );
    }
  } else {
    profileTools = ownerStorefrontProfileToolsStore.get(storefrontId) ?? null;
    if (profileTools) {
      profileTools = sanitizeProfileToolsRecord(profileTools);
    }
  }

  ownerStorefrontProfileToolsCache.set(storefrontId, {
    value: profileTools,
    expiresAt: Date.now() + 20_000,
  });

  return profileTools;
}

async function listOwnerStorefrontPromotions(storefrontId: string) {
  const cached = ownerStorefrontPromotionCache.get(storefrontId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const collectionRef = getOwnerStorefrontPromotionsCollection();
  let promotions: OwnerStorefrontPromotionDocument[] = [];
  if (collectionRef) {
    const snapshot = await collectionRef.where('storefrontId', '==', storefrontId).get();
    promotions = snapshot.docs
      .map((documentSnapshot) =>
        normalizePromotion(
          (documentSnapshot.data() as OwnerStorefrontPromotionDocument).ownerUid,
          storefrontId,
          documentSnapshot.data() as OwnerStorefrontPromotionDocument,
        ),
      )
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  } else {
    promotions = (ownerStorefrontPromotionStore.get(storefrontId) ?? [])
      .map((promotion) => normalizePromotion(promotion.ownerUid, storefrontId, promotion))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  ownerStorefrontPromotionCache.set(storefrontId, {
    value: promotions,
    expiresAt: Date.now() + 20_000,
  });

  return promotions;
}

function compareActivePromotions(
  left: OwnerStorefrontPromotionDocument,
  right: OwnerStorefrontPromotionDocument,
) {
  const startDelta = parseIsoDate(right.startsAt) - parseIsoDate(left.startsAt);
  if (startDelta !== 0) {
    return startDelta;
  }

  const updatedDelta = parseIsoDate(right.updatedAt) - parseIsoDate(left.updatedAt);
  if (updatedDelta !== 0) {
    return updatedDelta;
  }

  return right.id.localeCompare(left.id);
}

async function listActiveOwnerStorefrontPromotions(storefrontId: string, nowIso = getNowIso()) {
  const promotions = await listOwnerStorefrontPromotions(storefrontId);
  return promotions
    .filter((promotion) => isPromotionActive(promotion, nowIso))
    .sort(compareActivePromotions);
}

async function isPromotionVisibleToViewer(
  promotion: OwnerStorefrontPromotionDocument,
  viewerContext: ViewerContext,
): Promise<boolean> {
  if (!viewerContext) {
    // Unauthenticated viewers only see promotions with no audience restriction
    const unauthAudiences = Array.isArray(promotion.audiences)
      ? promotion.audiences
      : [(promotion as any).audience].filter(Boolean);
    return !unauthAudiences.length || unauthAudiences.includes('all_followers');
  }

  const promotionAudiences = Array.isArray(promotion.audiences)
    ? promotion.audiences
    : [(promotion as any).audience].filter(Boolean);

  // If no audiences specified, show to everyone
  if (!promotionAudiences.length) {
    return true;
  }

  for (const aud of promotionAudiences) {
    switch (aud) {
      case 'all_followers':
        if (await isFollowingStorefront(viewerContext.profileId, promotion.storefrontId)) {
          return true;
        }
        break;

      case 'frequent_visitors':
        if (await isFrequentVisitor(viewerContext.profileId, promotion.storefrontId)) {
          return true;
        }
        break;

      case 'new_customers':
        if (!(await isFollowingStorefront(viewerContext.profileId, promotion.storefrontId))) {
          return true;
        }
        break;

      default:
        // Unrecognised audience value — show to everyone as a safe default
        return true;
    }
  }

  return false;
}

async function getActivePromotion(storefrontId: string, viewerContext?: ViewerContext) {
  const promotions = await listActiveOwnerStorefrontPromotions(storefrontId);

  if (!viewerContext) {
    // No viewer context means we're in the owner workspace view — return the
    // top promotion without audience filtering so the owner always sees it.
    return promotions[0] ?? null;
  }

  // Walk the ranked list and return the first promotion visible to this viewer
  for (const promotion of promotions) {
    if (await isPromotionVisibleToViewer(promotion, viewerContext)) {
      return promotion;
    }
  }

  return null;
}

async function saveOwnerStorefrontProfileToolsDocument(
  record: OwnerStorefrontProfileToolsDocument,
) {
  storefrontSummaryEnhancementCache.delete(record.storefrontId);
  storefrontDetailEnhancementCache.delete(record.storefrontId);
  ownerStorefrontProfileToolsCache.delete(record.storefrontId);

  const collectionRef = getOwnerStorefrontProfileToolsCollection();
  if (collectionRef) {
    await collectionRef.doc(record.storefrontId).set(record);
    return record;
  }

  ownerStorefrontProfileToolsStore.set(record.storefrontId, record);
  return record;
}

async function saveOwnerStorefrontPromotionDocument(record: OwnerStorefrontPromotionDocument) {
  storefrontSummaryEnhancementCache.delete(record.storefrontId);
  storefrontDetailEnhancementCache.delete(record.storefrontId);
  ownerStorefrontPromotionCache.delete(record.storefrontId);

  const collectionRef = getOwnerStorefrontPromotionsCollection();
  if (collectionRef) {
    await collectionRef.doc(record.id).set(record);
    return record;
  }

  const currentPromotions = ownerStorefrontPromotionStore.get(record.storefrontId) ?? [];
  const nextPromotions = currentPromotions.filter((promotion) => promotion.id !== record.id);
  nextPromotions.unshift(record);
  ownerStorefrontPromotionStore.set(record.storefrontId, nextPromotions);
  return record;
}

async function deleteOwnerStorefrontPromotionDocument(storefrontId: string, promotionId: string) {
  storefrontSummaryEnhancementCache.delete(storefrontId);
  storefrontDetailEnhancementCache.delete(storefrontId);
  ownerStorefrontPromotionCache.delete(storefrontId);

  const collectionRef = getOwnerStorefrontPromotionsCollection();
  if (collectionRef) {
    await collectionRef.doc(promotionId).delete();
    return;
  }

  const currentPromotions = ownerStorefrontPromotionStore.get(storefrontId) ?? [];
  ownerStorefrontPromotionStore.set(
    storefrontId,
    currentPromotions.filter((p) => p.id !== promotionId),
  );
}

async function sumStorefrontFollowers(storefrontId: string) {
  const db = getBackendFirebaseDb();
  if (!db || backendStorefrontSourceStatus.activeMode !== 'firestore') {
    let followerCount = 0;
    const results = await Promise.allSettled(
      Array.from(ownerProfileStore.keys()).map(async (profileId) => {
        const routeState = await getRouteState(profileId);
        return routeState.savedStorefrontIds.includes(storefrontId);
      }),
    );
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        followerCount += 1;
      }
    }
    return followerCount;
  }

  const routeStateCollection = db.collection(ROUTE_STATE_COLLECTION);
  const snapshot = await routeStateCollection
    .where('savedStorefrontIds', 'array-contains', storefrontId)
    .get();
  return snapshot.size;
}

async function aggregateStorefrontMetrics(storefrontId: string) {
  const collectionRef = getDailyStorefrontMetricsCollection();
  if (!collectionRef) {
    return {
      impressions7d: 0,
      opens7d: 0,
      routes7d: 0,
      websiteTaps7d: 0,
      phoneTaps7d: 0,
      menuTaps7d: 0,
      reviews30d: 0,
    };
  }

  const snapshot = await collectionRef.where('storefrontId', '==', storefrontId).get();
  const now = Date.now();
  let impressions7d = 0;
  let opens7d = 0;
  let routes7d = 0;
  let websiteTaps7d = 0;
  let phoneTaps7d = 0;
  let menuTaps7d = 0;
  let reviews30d = 0;

  snapshot.docs.forEach((documentSnapshot) => {
    const data = documentSnapshot.data() as DailyStorefrontMetricRecord;
    const ageMs = now - parseIsoDate(data.date);
    if (ageMs <= 7 * 24 * 60 * 60 * 1000) {
      impressions7d += data.impressionCount ?? 0;
      opens7d += data.openCount ?? 0;
      routes7d += data.goNowTapCount ?? 0;
      websiteTaps7d += data.websiteTapCount ?? 0;
      phoneTaps7d += data.phoneTapCount ?? 0;
      menuTaps7d += data.menuTapCount ?? 0;
    }
    if (ageMs <= 30 * 24 * 60 * 60 * 1000) {
      reviews30d += data.reviewSubmittedCount ?? 0;
    }
  });

  return {
    impressions7d,
    opens7d,
    routes7d,
    websiteTaps7d,
    phoneTaps7d,
    menuTaps7d,
    reviews30d,
  };
}

async function aggregateDealMetrics(promotionId: string) {
  const collectionRef = getDailyDealMetricsCollection();
  if (!collectionRef) {
    return {
      impressions: 0,
      opens: 0,
      saves: 0,
      redeemStarts: 0,
      redeemed: 0,
      websiteTaps: 0,
      phoneTaps: 0,
      menuTaps: 0,
      clickThroughRate: 0,
      actionRate: 0,
    };
  }

  const snapshot = await collectionRef.where('dealId', '==', promotionId).get();
  let impressions = 0;
  let opens = 0;
  let saves = 0;
  let redeemStarts = 0;
  let redeemed = 0;
  let websiteTaps = 0;
  let phoneTaps = 0;
  let menuTaps = 0;

  snapshot.docs.forEach((documentSnapshot) => {
    const data = documentSnapshot.data() as DailyDealMetricRecord;
    impressions += data.impressionCount ?? 0;
    opens += data.openCount ?? 0;
    saves += data.saveCount ?? 0;
    redeemStarts += data.redeemStartCount ?? 0;
    redeemed += data.redeemedCount ?? 0;
    websiteTaps += data.websiteTapCount ?? 0;
    phoneTaps += data.phoneTapCount ?? 0;
    menuTaps += data.menuTapCount ?? 0;
  });

  const totalActions = redeemStarts + websiteTaps + phoneTaps + menuTaps;
  return {
    impressions,
    opens,
    saves,
    redeemStarts,
    redeemed,
    websiteTaps,
    phoneTaps,
    menuTaps,
    clickThroughRate: impressions > 0 ? Math.round((opens / impressions) * 1000) / 10 : 0,
    actionRate: impressions > 0 ? Math.round((totalActions / impressions) * 1000) / 10 : 0,
  };
}

function buildPatternFlags(options: {
  followerCount: number;
  reviews: OwnerWorkspaceReviewRecord[];
  reports: StoredStorefrontReportRecord[];
  metrics: OwnerWorkspaceMetrics;
  activePromotion: OwnerStorefrontPromotionDocument | null;
}) {
  const flags: OwnerWorkspacePatternFlag[] = [];
  const lowRatingCount = options.reviews.filter((review) => review.rating <= 2).length;
  const openReports = options.reports.filter((report) => report.moderationStatus === 'open').length;

  if (openReports > 0) {
    flags.push({
      id: 'open-reports',
      title: `${openReports} report${openReports === 1 ? '' : 's'} need review`,
      body: 'A store report is waiting for follow-up. Fast responses help keep the listing trustworthy.',
      tone: 'warning',
    });
  }

  if (lowRatingCount >= 2) {
    flags.push({
      id: 'low-rating-pattern',
      title: 'Recent reviews show friction',
      body: `${lowRatingCount} recent review${lowRatingCount === 1 ? '' : 's'} came in at two stars or lower. Reply fast and adjust the live offer if needed.`,
      tone: 'warning',
    });
  }

  if (options.followerCount >= 10 && !options.activePromotion) {
    flags.push({
      id: 'followers-no-promo',
      title: 'Followers are waiting for a fresh deal',
      body: `${options.followerCount} users have this storefront saved. A scheduled offer can re-engage them immediately.`,
      tone: 'info',
    });
  }

  if (options.metrics.replyRate >= 0.7 && options.reviews.length >= 3) {
    flags.push({
      id: 'strong-reply-rate',
      title: 'Replies are keeping up',
      body: 'Most recent reviews have an owner reply. Keep that pace to strengthen trust on the listing.',
      tone: 'success',
    });
  }

  return flags.slice(0, 4);
}

export async function applyOwnerWorkspaceSummaryEnhancements(
  summary: StorefrontSummaryApiDocument,
  deps: OwnerWorkspaceEnhancementDeps = defaultOwnerWorkspaceEnhancementDeps,
  viewerContext?: ViewerContext,
) {
  // When a viewer context is present the result is viewer-specific, so skip
  // the storefront-level cache (which is shared across all viewers).
  if (!viewerContext) {
    const cached = storefrontSummaryEnhancementCache.get(summary.id);
    if (cached && cached.expiresAt > Date.now()) {
      return {
        ...summary,
        ...cached.value,
      };
    }
  }

  const [rawProfileToolsResult, activePromotionResult] = await Promise.allSettled([
    deps.getProfileTools(summary.id),
    deps.getActivePromotion(summary.id, viewerContext),
  ]);
  let profileToolsResolved = false;
  let profileTools: OwnerStorefrontProfileToolsDocument | null = null;
  if (rawProfileToolsResult.status === 'fulfilled') {
    try {
      profileTools = await deps.hydrateProfileTools(rawProfileToolsResult.value);
      profileToolsResolved = true;
    } catch (error) {
      logOwnerWorkspaceEnhancementWarning('summary', summary.id, 'profileToolsMedia', error);
    }
  } else {
    logOwnerWorkspaceEnhancementWarning(
      'summary',
      summary.id,
      'profileTools',
      rawProfileToolsResult.reason,
    );
  }

  const activePromotionResolved = activePromotionResult.status === 'fulfilled';
  const activePromotion = activePromotionResolved ? activePromotionResult.value : null;
  if (!activePromotionResolved) {
    logOwnerWorkspaceEnhancementWarning(
      'summary',
      summary.id,
      'activePromotion',
      activePromotionResult.reason,
    );
  }
  const profileAttachmentUrls = collectProfileAttachmentUrls(profileTools);

  const enhancement: Partial<StorefrontSummaryApiDocument> = {
    menuUrl: profileToolsResolved ? (profileTools?.menuUrl ?? null) : (summary.menuUrl ?? null),
    verifiedOwnerBadgeLabel: profileToolsResolved
      ? (profileTools?.verifiedBadgeLabel ?? null)
      : (summary.verifiedOwnerBadgeLabel ?? null),
    ownerFeaturedBadges: profileToolsResolved
      ? (profileTools?.featuredBadges ?? [])
      : (summary.ownerFeaturedBadges ?? []),
    ownerCardSummary: profileToolsResolved
      ? (profileTools?.cardSummary ?? null)
      : (summary.ownerCardSummary ?? null),
    premiumCardVariant:
      activePromotion?.cardTone ??
      (profileToolsResolved
        ? profileTools?.featuredBadges?.length
          ? 'owner_featured'
          : 'standard'
        : (summary.premiumCardVariant ?? 'standard')),
    promotionPlacementSurfaces: activePromotionResolved
      ? (activePromotion?.placementSurfaces ?? [])
      : (summary.promotionPlacementSurfaces ?? []),
    promotionPlacementScope: activePromotionResolved
      ? (activePromotion?.placementScope ?? null)
      : (summary.promotionPlacementScope ?? null),
    thumbnailUrl: profileToolsResolved
      ? (profileAttachmentUrls[0] ?? summary.thumbnailUrl ?? null)
      : (summary.thumbnailUrl ?? null),
  };

  if (activePromotion) {
    enhancement.promotionText = activePromotion.description || activePromotion.title;
    enhancement.promotionBadges = normalizeBadges(
      activePromotion.badges.length ? activePromotion.badges : [activePromotion.title],
    );
    enhancement.promotionExpiresAt = activePromotion.endsAt;
    enhancement.activePromotionId = activePromotion.id;
    enhancement.premiumCardVariant = activePromotion.cardTone;
  }

  if (!viewerContext) {
    storefrontSummaryEnhancementCache.set(summary.id, {
      value: enhancement,
      expiresAt: Date.now() + 20_000,
    });
  }

  return {
    ...summary,
    ...enhancement,
  };
}

export async function applyOwnerWorkspaceDetailEnhancements(
  detail: StorefrontDetailApiDocument,
  deps: OwnerWorkspaceEnhancementDeps = defaultOwnerWorkspaceEnhancementDeps,
) {
  const cached = storefrontDetailEnhancementCache.get(detail.storefrontId);
  if (cached && cached.expiresAt > Date.now()) {
    return {
      ...detail,
      ...cached.value,
    };
  }

  const [rawProfileToolsResult, followerCountResult] = await Promise.allSettled([
    deps.getProfileTools(detail.storefrontId),
    deps.getFollowerCount(detail.storefrontId),
  ]);
  let profileToolsResolved = false;
  let profileTools: OwnerStorefrontProfileToolsDocument | null = null;
  if (rawProfileToolsResult.status === 'fulfilled') {
    try {
      profileTools = await deps.hydrateProfileTools(rawProfileToolsResult.value);
      profileToolsResolved = true;
    } catch (error) {
      logOwnerWorkspaceEnhancementWarning(
        'detail',
        detail.storefrontId,
        'profileToolsMedia',
        error,
      );
    }
  } else {
    logOwnerWorkspaceEnhancementWarning(
      'detail',
      detail.storefrontId,
      'profileTools',
      rawProfileToolsResult.reason,
    );
  }

  const followerCountResolved = followerCountResult.status === 'fulfilled';
  if (!followerCountResolved) {
    logOwnerWorkspaceEnhancementWarning(
      'detail',
      detail.storefrontId,
      'followerCount',
      followerCountResult.reason,
    );
  }
  const profileAttachmentUrls = collectProfileAttachmentUrls(profileTools);

  const enhancement: Partial<StorefrontDetailApiDocument> = {
    menuUrl: profileToolsResolved ? (profileTools?.menuUrl ?? null) : (detail.menuUrl ?? null),
    verifiedOwnerBadgeLabel: profileToolsResolved
      ? (profileTools?.verifiedBadgeLabel ?? null)
      : (detail.verifiedOwnerBadgeLabel ?? null),
    favoriteFollowerCount: followerCountResolved
      ? followerCountResult.value
      : (detail.favoriteFollowerCount ?? null),
    ownerFeaturedBadges: profileToolsResolved
      ? (profileTools?.featuredBadges ?? [])
      : (detail.ownerFeaturedBadges ?? []),
    photoUrls:
      profileToolsResolved && profileAttachmentUrls.length
        ? Array.from(new Set([...profileAttachmentUrls, ...detail.photoUrls])).slice(0, 12)
        : detail.photoUrls,
  };

  storefrontDetailEnhancementCache.set(detail.storefrontId, {
    value: enhancement,
    expiresAt: Date.now() + 20_000,
  });

  return {
    ...detail,
    ...enhancement,
  };
}

export type { ViewerContext };

export {
  ownerProfileStore,
  ownerClaimStore,
  ownerStorefrontProfileToolsStore,
  ownerStorefrontPromotionStore,
  ownerStorefrontProfileToolsCache,
  ownerStorefrontPromotionCache,
  storefrontSummaryEnhancementCache,
  storefrontDetailEnhancementCache,
  getOwnerProfile,
  getOwnerClaim,
  getOwnerStorefrontProfileTools,
  listOwnerStorefrontPromotions,
  listActiveOwnerStorefrontPromotions,
  getActivePromotion,
  saveOwnerStorefrontProfileToolsDocument,
  saveOwnerStorefrontPromotionDocument,
  deleteOwnerStorefrontPromotionDocument,
  sumStorefrontFollowers,
  aggregateStorefrontMetrics,
  aggregateDealMetrics,
  buildPatternFlags,
  getOwnerPortalWorkspace,
};

async function getOwnerPortalWorkspace(ownerUid: string): Promise<OwnerPortalWorkspaceDocument> {
  const runtimeStatus = await getRuntimeOpsStatus();
  const ownerProfile = await getOwnerProfile(ownerUid);
  if (!ownerProfile) {
    return {
      ownerProfile: null,
      ownerClaim: null,
      storefrontSummary: null,
      metrics: {
        followerCount: 0,
        storefrontImpressions7d: 0,
        storefrontOpenCount7d: 0,
        routeStarts7d: 0,
        websiteTapCount7d: 0,
        phoneTapCount7d: 0,
        menuTapCount7d: 0,
        reviewCount30d: 0,
        openReportCount: 0,
        averageRating: null,
        replyRate: 0,
        openToRouteRate: 0,
        openToWebsiteRate: 0,
        openToPhoneRate: 0,
        openToMenuRate: 0,
      },
      patternFlags: [],
      recentReviews: [],
      recentReports: [],
      promotions: [],
      promotionPerformance: [],
      profileTools: null,
      licenseCompliance: null,
      ownerAlertStatus: {
        pushEnabled: false,
        updatedAt: null,
      },
      runtimeStatus,
    };
  }

  const storefrontId = ownerProfile.dispensaryId;
  const [
    ownerClaimResult,
    baseSummaryResult,
    profileToolsResult,
    promotionsResult,
    ownerAlertStatusResult,
  ] = await Promise.allSettled([
    getOwnerClaim(ownerUid, storefrontId),
    storefrontId
      ? backendStorefrontSource.getSummariesByIds([storefrontId]).then((items) => items[0] ?? null)
      : Promise.resolve(null),
    storefrontId ? getOwnerStorefrontProfileTools(storefrontId) : Promise.resolve(null),
    storefrontId ? listOwnerStorefrontPromotions(storefrontId) : Promise.resolve([]),
    getOwnerPortalAlertStatus(ownerUid),
  ]);
  const ownerClaim = ownerClaimResult.status === 'fulfilled' ? ownerClaimResult.value : null;
  const baseSummary = baseSummaryResult.status === 'fulfilled' ? baseSummaryResult.value : null;
  const profileTools = profileToolsResult.status === 'fulfilled' ? profileToolsResult.value : null;
  const promotions = promotionsResult.status === 'fulfilled' ? promotionsResult.value : [];
  const ownerAlertStatus =
    ownerAlertStatusResult.status === 'fulfilled'
      ? ownerAlertStatusResult.value
      : { pushEnabled: false, updatedAt: null };
  const licenseCompliance = storefrontId
    ? await getOwnerLicenseCompliance(ownerUid, storefrontId)
    : null;

  const recentReviews = storefrontId ? await listStorefrontAppReviews(storefrontId) : [];
  const recentReports = storefrontId ? await listStorefrontReports(storefrontId) : [];
  const followerCount = storefrontId ? await sumStorefrontFollowers(storefrontId) : 0;
  const storefrontMetrics = storefrontId
    ? await aggregateStorefrontMetrics(storefrontId)
    : {
        impressions7d: 0,
        opens7d: 0,
        routes7d: 0,
        websiteTaps7d: 0,
        phoneTaps7d: 0,
        menuTaps7d: 0,
        reviews30d: 0,
      };

  const replyCount = recentReviews.filter((review) => review.ownerReply?.text?.trim()).length;
  const openBase = storefrontMetrics.opens7d || 0;
  const metrics: OwnerWorkspaceMetrics = {
    followerCount,
    storefrontImpressions7d: storefrontMetrics.impressions7d,
    storefrontOpenCount7d: storefrontMetrics.opens7d,
    routeStarts7d: storefrontMetrics.routes7d,
    websiteTapCount7d: storefrontMetrics.websiteTaps7d,
    phoneTapCount7d: storefrontMetrics.phoneTaps7d,
    menuTapCount7d: storefrontMetrics.menuTaps7d,
    reviewCount30d: storefrontMetrics.reviews30d,
    openReportCount: recentReports.filter((report) => report.moderationStatus === 'open').length,
    averageRating: recentReviews.length
      ? Math.round(
          (recentReviews.reduce((sum, review) => sum + review.rating, 0) / recentReviews.length) *
            10,
        ) / 10
      : null,
    replyRate: recentReviews.length
      ? Math.round((replyCount / recentReviews.length) * 100) / 100
      : 0,
    openToRouteRate:
      openBase > 0 ? Math.round((storefrontMetrics.routes7d / openBase) * 1000) / 10 : 0,
    openToWebsiteRate:
      openBase > 0 ? Math.round((storefrontMetrics.websiteTaps7d / openBase) * 1000) / 10 : 0,
    openToPhoneRate:
      openBase > 0 ? Math.round((storefrontMetrics.phoneTaps7d / openBase) * 1000) / 10 : 0,
    openToMenuRate:
      openBase > 0 ? Math.round((storefrontMetrics.menuTaps7d / openBase) * 1000) / 10 : 0,
  };

  const ownerWorkspaceReviews: OwnerWorkspaceReviewRecord[] = recentReviews
    .slice(0, 8)
    .map((review) => ({
      ...review,
      storefrontId: storefrontId ?? '',
      ownerReply: review.ownerReply ?? null,
      isLowRating: review.rating <= 2,
    }));
  const ownerWorkspaceReports: OwnerPortalWorkspaceDocument['recentReports'] = recentReports
    .slice(0, 8)
    .map((report) => ({
      ...report,
      moderationStatus:
        report.moderationStatus === 'reviewed' || report.moderationStatus === 'dismissed'
          ? report.moderationStatus
          : 'open',
      reviewedAt: report.reviewedAt ?? null,
      reviewNotes: report.reviewNotes ?? null,
    }));

  const settledPromotionPerformance = await Promise.allSettled(
    promotions.slice(0, 6).map(async (promotion) => ({
      promotionId: promotion.id,
      title: promotion.title,
      status: derivePromotionStatus(promotion),
      badges: promotion.badges,
      startsAt: promotion.startsAt,
      endsAt: promotion.endsAt,
      metrics: await aggregateDealMetrics(promotion.id),
    })),
  );
  const promotionPerformance = settledPromotionPerformance.flatMap((result, index) => {
    if (result.status === 'fulfilled') {
      return [result.value];
    }
    console.warn(
      `[owner-workspace] failed to aggregate metrics for promotion ${promotions[index]?.id ?? 'unknown'}:`,
      result.reason,
    );
    return [];
  });

  const activePromotion =
    promotions.find((promotion) => derivePromotionStatus(promotion) === 'active') ?? null;
  const storefrontSummary = baseSummary
    ? await applyOwnerWorkspaceSummaryEnhancements(baseSummary)
    : null;
  const patternFlags = buildPatternFlags({
    followerCount,
    reviews: ownerWorkspaceReviews,
    reports: recentReports,
    metrics,
    activePromotion,
  });

  return {
    ownerProfile: ownerProfile as OwnerPortalWorkspaceDocument['ownerProfile'],
    ownerClaim: ownerClaim as OwnerPortalWorkspaceDocument['ownerClaim'],
    storefrontSummary: storefrontSummary
      ? {
          id: storefrontSummary.id,
          displayName: storefrontSummary.displayName,
          addressLine1: storefrontSummary.addressLine1,
          city: storefrontSummary.city,
          state: storefrontSummary.state,
          zip: storefrontSummary.zip,
          promotionText: storefrontSummary.promotionText ?? null,
          promotionBadges: storefrontSummary.promotionBadges ?? [],
        }
      : null,
    metrics,
    patternFlags,
    recentReviews: ownerWorkspaceReviews,
    recentReports: ownerWorkspaceReports,
    promotions,
    promotionPerformance,
    profileTools,
    licenseCompliance,
    ownerAlertStatus,
    runtimeStatus,
  };
}

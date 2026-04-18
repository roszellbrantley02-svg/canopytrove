import { logger } from '../observability/logger';
import {
  OwnerPortalWorkspaceDocument,
  OwnerPortalLicenseComplianceInput,
  OwnerWorkspaceMetrics,
  OwnerWorkspacePatternFlag,
  OwnerWorkspaceReviewRecord,
  OwnerPortalProfileToolsInput,
  OwnerPortalPromotionInput,
  OwnerStorefrontProfileToolsDocument,
  OwnerStorefrontPromotionDocument,
} from '../../../src/types/ownerPortal';
import { getBackendFirebaseDb } from '../firebase';
import { backendStorefrontSourceStatus, backendStorefrontSource } from '../sources';
import { StorefrontDetailApiDocument, StorefrontSummaryApiDocument } from '../types';
import {
  listStorefrontAppReviews,
  listStorefrontReports,
  replyToStorefrontAppReview,
  StoredStorefrontReportRecord,
} from './storefrontCommunityService';
import { getOwnerPortalAlertStatus } from './ownerPortalAlertService';
import { assertRuntimePolicyAllowsOwnerAction, getRuntimeOpsStatus } from './runtimeOpsService';
import {
  buildPatternFlags,
  getActivePromotion,
  listActiveOwnerStorefrontPromotions,
  getOwnerStorefrontProfileTools,
  listOwnerStorefrontPromotions,
  saveOwnerStorefrontProfileToolsDocument,
  saveOwnerStorefrontPromotionDocument,
  deleteOwnerStorefrontPromotionDocument,
  sumStorefrontFollowers,
  aggregateDealMetrics,
  aggregateStorefrontMetrics,
  storefrontSummaryEnhancementCache,
  storefrontDetailEnhancementCache,
} from './ownerPortalWorkspaceData';
import type { ViewerContext } from './ownerPortalWorkspaceData';
import { isFollowingStorefront, isFrequentVisitor } from './routeStateService';
import {
  buildEmptyOwnerPortalWorkspace,
  buildOwnerWorkspaceMetrics,
  buildOwnerWorkspaceReports,
  buildOwnerWorkspaceReviews,
  buildOwnerWorkspaceSummarySnapshot,
} from './ownerPortalWorkspaceAssembly';
import {
  collectProfileAttachmentUrls,
  derivePromotionStatus,
  normalizeBadges,
  normalizeProfileTools,
  normalizePromotion,
} from './ownerPortalWorkspaceHelpers';
import {
  assertOwnerPromotionConstraints,
  maybeDispatchPromotionStartAlert,
  preparePromotionForSave,
} from './ownerPortalPromotionSchedulerService';
import {
  classifyOwnerContent,
  isPromotionAndroidVisible,
} from './ownerPortalPromotionModerationService';
import {
  assertAuthorizedOwnerStorefront,
  getOwnerAuthorizationState,
} from './ownerPortalAuthorizationService';
import {
  getOwnerLicenseCompliance,
  saveOwnerLicenseCompliance,
} from './ownerPortalLicenseComplianceService';
import { hydrateOwnerStorefrontProfileToolsMedia } from './storefrontMediaAccessService';
import { computeOpenNowFromOwnerHours, ownerHoursToDisplayStrings } from './ownerHoursService';
import { isActiveOwnerSubscriptionStatus } from './ownerPortalAuthorizationService';
import { getOwnerProfile } from './ownerPortalWorkspaceData';
import { resolveOwnerTier, getTierLimits, TierAccessError } from './ownerTierGatingService';
import type { OwnerSubscriptionTier, TierFeatureLimits } from './ownerTierGatingService';
import { resolveOwnerActiveLocation } from './ownerMultiLocationService';
import {
  getOwnerStorefrontBrands,
  saveOwnerStorefrontBrands,
} from './ownerStorefrontBrandsService';
import {
  getBrandScansNearStorefront,
  type BrandActivityNearStorefront,
} from './brandAnalyticsService';

const TARGETED_AUDIENCES = new Set(['all_followers', 'frequent_visitors', 'new_customers']);
const DISPENSARIES_COLLECTION = 'dispensaries';

type OwnerPrivateStorefrontRegistryRecord = {
  displayName?: string | null;
  storefrontName?: string | null;
  legalName?: string | null;
  legalBusinessName?: string | null;
  addressLine1?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  ownerUid?: string | null;
  claimedByOwnerUid?: string | null;
};

type OwnerWorkspaceStorefrontSnapshot = NonNullable<
  OwnerPortalWorkspaceDocument['storefrontSummary']
>;

function normalizeOptionalString(value: unknown) {
  return typeof value === 'string' && value.trim().length ? value.trim() : null;
}

export function buildOwnerPrivateStorefrontSnapshot(
  storefrontId: string,
  record: OwnerPrivateStorefrontRegistryRecord,
  promotionText?: string | null,
  promotionBadges?: string[] | null,
): OwnerWorkspaceStorefrontSnapshot | null {
  const displayName =
    normalizeOptionalString(record.displayName) ??
    normalizeOptionalString(record.storefrontName) ??
    normalizeOptionalString(record.legalName) ??
    normalizeOptionalString(record.legalBusinessName);
  if (!displayName) {
    return null;
  }

  return {
    id: storefrontId,
    displayName,
    addressLine1:
      normalizeOptionalString(record.addressLine1) ?? normalizeOptionalString(record.address) ?? '',
    city: normalizeOptionalString(record.city) ?? '',
    state: normalizeOptionalString(record.state) ?? 'NY',
    zip: normalizeOptionalString(record.zip) ?? '',
    promotionText: promotionText ?? null,
    promotionBadges: promotionBadges ?? [],
  };
}

async function getOwnerPrivateStorefrontSnapshot(
  ownerUid: string,
  storefrontId: string,
  options?: {
    promotionText?: string | null;
    promotionBadges?: string[] | null;
  },
): Promise<OwnerWorkspaceStorefrontSnapshot | null> {
  const db = getBackendFirebaseDb();
  if (!db) {
    return null;
  }

  const snapshot = await db.collection(DISPENSARIES_COLLECTION).doc(storefrontId).get();
  if (!snapshot.exists) {
    return null;
  }

  const record = snapshot.data() as OwnerPrivateStorefrontRegistryRecord | undefined;
  if (!record) {
    return null;
  }

  const linkedOwnerUid =
    normalizeOptionalString(record.ownerUid) ?? normalizeOptionalString(record.claimedByOwnerUid);
  if (linkedOwnerUid && linkedOwnerUid !== ownerUid) {
    return null;
  }

  return buildOwnerPrivateStorefrontSnapshot(
    storefrontId,
    record,
    options?.promotionText ?? null,
    options?.promotionBadges ?? [],
  );
}

function assertAudienceTargetingAccess(
  audiences: string[] | undefined | null,
  tierLimits: TierFeatureLimits,
  currentTier: OwnerSubscriptionTier,
) {
  if (audiences?.some((a) => TARGETED_AUDIENCES.has(a)) && !tierLimits.audienceTargetingEnabled) {
    throw new TierAccessError(
      'Audience targeting requires the Pro ($249/mo) plan. Upgrade to target specific customer segments.',
      'pro',
      currentTier,
    );
  }
}

async function pickVisiblePromotion(
  promotions: OwnerStorefrontPromotionDocument[],
  storefrontId: string,
  viewerContext?: ViewerContext,
): Promise<OwnerStorefrontPromotionDocument | null> {
  if (!viewerContext) {
    // Owner workspace or no viewer — return the top promotion unfiltered
    return promotions[0] ?? null;
  }

  for (const promotion of promotions) {
    const promotionAudiences = Array.isArray(promotion.audiences)
      ? promotion.audiences
      : [(promotion as any).audience].filter(Boolean);

    // If no audiences specified, show to everyone
    if (!promotionAudiences.length) {
      return promotion;
    }

    for (const aud of promotionAudiences) {
      switch (aud) {
        case 'all_followers':
          if (await isFollowingStorefront(viewerContext.profileId, storefrontId)) {
            return promotion;
          }
          break;

        case 'frequent_visitors':
          if (await isFrequentVisitor(viewerContext.profileId, storefrontId)) {
            return promotion;
          }
          break;

        case 'new_customers':
          if (!(await isFollowingStorefront(viewerContext.profileId, storefrontId))) {
            return promotion;
          }
          break;

        default:
          // Unrecognised audience — show to everyone
          return promotion;
      }
    }
  }

  return null;
}

/**
 * Check whether the owner behind a profile-tools document still has an
 * active subscription. Returns true when unknown (no ownerUid, lookup
 * fails) so that content is shown by default and only stripped when we
 * are *certain* the subscription lapsed.
 */
async function isOwnerSubscriptionActive(
  profileTools: OwnerStorefrontProfileToolsDocument | null,
): Promise<boolean> {
  if (!profileTools?.ownerUid) return true;
  try {
    const profile = await getOwnerProfile(profileTools.ownerUid);
    if (!profile) return true;
    return isActiveOwnerSubscriptionStatus(profile.subscriptionStatus);
  } catch {
    return true;
  }
}

export async function applyOwnerWorkspaceSummaryEnhancements(
  summary: StorefrontSummaryApiDocument,
  viewerContext?: ViewerContext,
) {
  // When a viewer context is present the result is viewer-specific,
  // so skip the shared storefront-level cache.
  if (!viewerContext) {
    const cached = storefrontSummaryEnhancementCache.get(summary.id);
    if (cached && cached.expiresAt > Date.now()) {
      return {
        ...summary,
        ...cached.value,
      };
    }
  }

  const [rawProfileToolsResult, activePromotionsResult] = await Promise.allSettled([
    getOwnerStorefrontProfileTools(summary.id),
    listActiveOwnerStorefrontPromotions(summary.id),
  ]);
  const rawProfileTools =
    rawProfileToolsResult.status === 'fulfilled' ? rawProfileToolsResult.value : null;
  const activePromotions =
    activePromotionsResult.status === 'fulfilled' ? activePromotionsResult.value : [];
  if (rawProfileToolsResult.status === 'rejected') {
    logger.warn(`owner-workspace-service: profileTools enhancement failed for ${summary.id}`, {
      storefrontId: summary.id,
      error: String(rawProfileToolsResult.reason),
    });
  }
  if (activePromotionsResult.status === 'rejected') {
    logger.warn(`owner-workspace-service: activePromotions enhancement failed for ${summary.id}`, {
      storefrontId: summary.id,
      error: String(activePromotionsResult.reason),
    });
  }
  const profileTools = await hydrateOwnerStorefrontProfileToolsMedia(rawProfileTools);
  const subscriptionActive = await isOwnerSubscriptionActive(rawProfileTools);

  // Owner hours persist even after subscription lapse — always apply when present.
  const ownerHoursEntries = rawProfileTools?.ownerHours?.length ? rawProfileTools.ownerHours : null;
  const ownerHoursOpenNow = ownerHoursEntries
    ? computeOpenNowFromOwnerHours(ownerHoursEntries)
    : null;

  // When subscription has lapsed, strip all owner-added content except hours.
  const activePromotion = subscriptionActive
    ? await pickVisiblePromotion(activePromotions, summary.id, viewerContext)
    : null;
  const liveProfileTools = subscriptionActive ? profileTools : null;
  const liveActivePromotions = subscriptionActive ? activePromotions : [];

  const enhancement: Partial<StorefrontSummaryApiDocument> = {
    menuUrl: liveProfileTools?.menuUrl ?? summary.menuUrl ?? null,
    verifiedOwnerBadgeLabel:
      liveProfileTools?.verifiedBadgeLabel ?? summary.verifiedOwnerBadgeLabel ?? null,
    ownerFeaturedBadges: liveProfileTools?.featuredBadges ?? summary.ownerFeaturedBadges ?? [],
    ownerCardSummary: liveProfileTools?.cardSummary ?? summary.ownerCardSummary ?? null,
    activePromotionCount: liveActivePromotions.length,
    premiumCardVariant:
      activePromotion?.cardTone ??
      (liveProfileTools?.featuredBadges?.length ? 'owner_featured' : 'standard'),
    promotionPlacementSurfaces:
      activePromotion?.placementSurfaces ?? summary.promotionPlacementSurfaces ?? [],
    promotionPlacementScope:
      activePromotion?.placementScope ?? summary.promotionPlacementScope ?? null,
    promotionAndroidEligible: activePromotion
      ? isPromotionAndroidVisible(activePromotion)
      : undefined,
    thumbnailUrl: collectProfileAttachmentUrls(liveProfileTools)[0] ?? summary.thumbnailUrl ?? null,
  };

  // Owner hours override openNow regardless of subscription status.
  if (ownerHoursEntries) {
    enhancement.hours = ownerHoursToDisplayStrings(ownerHoursEntries);
  }
  if (ownerHoursOpenNow !== null) {
    enhancement.openNow = ownerHoursOpenNow;
  }

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
  viewerContext?: ViewerContext,
) {
  if (!viewerContext) {
    const cached = storefrontDetailEnhancementCache.get(detail.storefrontId);
    if (cached && cached.expiresAt > Date.now()) {
      return {
        ...detail,
        ...cached.value,
      };
    }
  }

  const [rawProfileToolsResult, followerCountResult, activePromotionsResult] =
    await Promise.allSettled([
      getOwnerStorefrontProfileTools(detail.storefrontId),
      sumStorefrontFollowers(detail.storefrontId),
      listActiveOwnerStorefrontPromotions(detail.storefrontId),
    ]);
  const rawProfileTools =
    rawProfileToolsResult.status === 'fulfilled' ? rawProfileToolsResult.value : null;
  const followerCount =
    followerCountResult.status === 'fulfilled'
      ? followerCountResult.value
      : (detail.favoriteFollowerCount ?? 0);
  const allActivePromotions =
    activePromotionsResult.status === 'fulfilled' ? activePromotionsResult.value : [];
  if (rawProfileToolsResult.status === 'rejected') {
    logger.warn(
      `[owner-workspace-service] detail enhancement: profileTools failed for ${detail.storefrontId}:`,
      rawProfileToolsResult.reason,
    );
  }
  if (followerCountResult.status === 'rejected') {
    logger.warn(
      `[owner-workspace-service] detail enhancement: followerCount failed for ${detail.storefrontId}:`,
      followerCountResult.reason,
    );
  }
  if (activePromotionsResult.status === 'rejected') {
    logger.warn(
      `[owner-workspace-service] detail enhancement: activePromotions failed for ${detail.storefrontId}:`,
      activePromotionsResult.reason,
    );
  }
  const profileTools = await hydrateOwnerStorefrontProfileToolsMedia(rawProfileTools);
  const subscriptionActive = await isOwnerSubscriptionActive(rawProfileTools);

  // Owner hours persist even after subscription lapse.
  const ownerHoursEntries = rawProfileTools?.ownerHours?.length ? rawProfileTools.ownerHours : null;
  const ownerHoursOpenNow = ownerHoursEntries
    ? computeOpenNowFromOwnerHours(ownerHoursEntries)
    : null;

  // When subscription has lapsed, strip all owner-added content except hours.
  const liveProfileTools = subscriptionActive ? profileTools : null;

  // Filter promotions by audience when a viewer is present
  let visiblePromotions = subscriptionActive ? allActivePromotions : [];
  if (viewerContext && subscriptionActive) {
    const filtered: OwnerStorefrontPromotionDocument[] = [];
    for (const promo of allActivePromotions) {
      const visible = await pickVisiblePromotion([promo], detail.storefrontId, viewerContext);
      if (visible) filtered.push(promo);
    }
    visiblePromotions = filtered;
  }

  const enhancement: Partial<StorefrontDetailApiDocument> = {
    menuUrl: liveProfileTools?.menuUrl ?? detail.menuUrl ?? null,
    verifiedOwnerBadgeLabel:
      liveProfileTools?.verifiedBadgeLabel ?? detail.verifiedOwnerBadgeLabel ?? null,
    favoriteFollowerCount: subscriptionActive ? followerCount : (detail.favoriteFollowerCount ?? 0),
    ownerFeaturedBadges: liveProfileTools?.featuredBadges ?? detail.ownerFeaturedBadges ?? [],
    activePromotions: visiblePromotions.slice(0, 5).map((promotion) => ({
      id: promotion.id,
      title: promotion.title,
      description: promotion.description || promotion.title,
      badges: normalizeBadges(promotion.badges.length ? promotion.badges : [promotion.title]),
      startsAt: promotion.startsAt,
      endsAt: promotion.endsAt,
      cardTone: promotion.cardTone,
      androidEligible: isPromotionAndroidVisible(promotion),
    })),
    photoUrls: collectProfileAttachmentUrls(liveProfileTools).length
      ? Array.from(
          new Set([...collectProfileAttachmentUrls(liveProfileTools), ...detail.photoUrls]),
        ).slice(0, 12)
      : detail.photoUrls,
  };

  // Owner hours override the source/Google hours regardless of subscription.
  if (ownerHoursEntries) {
    enhancement.hours = ownerHoursToDisplayStrings(ownerHoursEntries);
  }
  if (ownerHoursOpenNow !== null) {
    enhancement.openNow = ownerHoursOpenNow;
  }

  if (!viewerContext) {
    storefrontDetailEnhancementCache.set(detail.storefrontId, {
      value: enhancement,
      expiresAt: Date.now() + 20_000,
    });
  }

  return {
    ...detail,
    ...enhancement,
  };
}

export async function getOwnerPortalWorkspace(
  ownerUid: string,
  requestedLocationId?: string | null,
): Promise<OwnerPortalWorkspaceDocument> {
  const runtimeStatus = await getRuntimeOpsStatus();
  const ownerState = await getOwnerAuthorizationState(ownerUid);
  const ownerProfile = ownerState.ownerProfile
    ? {
        ...ownerState.ownerProfile,
        dispensaryId: ownerState.storefrontId ?? ownerState.ownerProfile.dispensaryId,
        businessVerificationStatus:
          ownerState.businessVerificationStatus ??
          ownerState.ownerProfile.businessVerificationStatus,
        identityVerificationStatus:
          ownerState.identityVerificationStatus ??
          ownerState.ownerProfile.identityVerificationStatus,
        subscriptionStatus:
          ownerState.subscription?.status ?? ownerState.ownerProfile.subscriptionStatus,
      }
    : null;
  if (!ownerProfile) {
    return buildEmptyOwnerPortalWorkspace(runtimeStatus);
  }

  // Resolve active location: if a locationId was requested and the owner manages it, use that
  const primaryStorefrontId = ownerState.storefrontId;
  const additionalLocationIds = ownerState.ownerProfile?.additionalLocationIds ?? [];
  const allOwnerLocationIds = [
    ...(primaryStorefrontId ? [primaryStorefrontId] : []),
    ...additionalLocationIds,
  ];
  const storefrontId =
    requestedLocationId && allOwnerLocationIds.includes(requestedLocationId)
      ? requestedLocationId
      : primaryStorefrontId;
  const [
    ownerClaimResult,
    baseSummaryResult,
    rawProfileToolsResult,
    promotionsResult,
    ownerAlertStatusResult,
    licenseComplianceResult,
  ] = await Promise.allSettled([
    Promise.resolve(ownerState.ownerClaim),
    storefrontId
      ? backendStorefrontSource.getSummariesByIds([storefrontId]).then((items) => items[0] ?? null)
      : Promise.resolve(null),
    storefrontId ? getOwnerStorefrontProfileTools(storefrontId) : Promise.resolve(null),
    storefrontId ? listOwnerStorefrontPromotions(storefrontId) : Promise.resolve([]),
    getOwnerPortalAlertStatus(ownerUid),
    getOwnerLicenseCompliance(ownerUid, storefrontId),
  ]);
  const ownerClaim =
    ownerClaimResult.status === 'fulfilled' ? ownerClaimResult.value : ownerState.ownerClaim;
  const baseSummary = baseSummaryResult.status === 'fulfilled' ? baseSummaryResult.value : null;
  const rawProfileTools =
    rawProfileToolsResult.status === 'fulfilled' ? rawProfileToolsResult.value : null;
  const promotions = promotionsResult.status === 'fulfilled' ? promotionsResult.value : [];
  const ownerAlertStatus =
    ownerAlertStatusResult.status === 'fulfilled'
      ? ownerAlertStatusResult.value
      : { pushEnabled: false, updatedAt: null };
  const licenseCompliance =
    licenseComplianceResult.status === 'fulfilled' ? licenseComplianceResult.value : null;
  const profileTools = await hydrateOwnerStorefrontProfileToolsMedia(rawProfileTools);

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

  const metrics = buildOwnerWorkspaceMetrics({
    followerCount,
    storefrontMetrics,
    recentReports,
    recentReviews,
  });

  const ownerWorkspaceReviews: OwnerWorkspaceReviewRecord[] = buildOwnerWorkspaceReviews({
    recentReviews,
    storefrontId,
  });
  const ownerWorkspaceReports = buildOwnerWorkspaceReports({
    recentReports,
  });

  const promotionResults = await Promise.allSettled(
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
  const promotionPerformance = promotionResults.flatMap((r) =>
    r.status === 'fulfilled' ? [r.value] : [],
  );

  const activePromotion = storefrontId ? await getActivePromotion(storefrontId) : null;
  const enhancedPublicSummary = baseSummary
    ? await applyOwnerWorkspaceSummaryEnhancements(baseSummary)
    : null;
  const privateStorefrontSummary =
    !enhancedPublicSummary && storefrontId
      ? await getOwnerPrivateStorefrontSnapshot(ownerUid, storefrontId, {
          promotionText: activePromotion?.description || activePromotion?.title || null,
          promotionBadges: activePromotion?.badges.length
            ? normalizeBadges(activePromotion.badges)
            : activePromotion
              ? normalizeBadges([activePromotion.title])
              : [],
        })
      : null;
  const workspaceStorefrontSummary = enhancedPublicSummary
    ? buildOwnerWorkspaceSummarySnapshot(enhancedPublicSummary)
    : privateStorefrontSummary;
  const patternFlags = buildPatternFlags({
    followerCount,
    reviews: ownerWorkspaceReviews,
    reports: recentReports,
    metrics,
    activePromotion,
  });

  // Resolve tier and apply analytics gating
  const ownerTier = await resolveOwnerTier(ownerUid);
  const tierLimits = getTierLimits(ownerTier);

  // For verified-tier owners: only show headline numbers (views, taps, avg rating)
  // Full funnel analytics (conversion rates, pattern flags, promotion performance) require Growth+
  const gatedMetrics: typeof metrics = tierLimits.fullAnalyticsEnabled
    ? metrics
    : {
        ...metrics,
        // Keep headline numbers
        // followerCount, storefrontImpressions7d, storefrontOpenCount7d, averageRating — visible
        // Redact conversion funnel and deep analytics
        openToRouteRate: 0,
        openToWebsiteRate: 0,
        openToPhoneRate: 0,
        openToMenuRate: 0,
        replyRate: 0,
      };

  const gatedPatternFlags = tierLimits.fullAnalyticsEnabled ? patternFlags : [];
  const gatedPromotionPerformance = tierLimits.promotionAnalyticsEnabled
    ? promotionPerformance
    : promotionPerformance.map((pp) => ({
        ...pp,
        metrics: {
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
        },
      }));

  return {
    ownerProfile: ownerProfile as OwnerPortalWorkspaceDocument['ownerProfile'],
    ownerClaim: ownerClaim as OwnerPortalWorkspaceDocument['ownerClaim'],
    storefrontSummary: workspaceStorefrontSummary,
    metrics: gatedMetrics,
    patternFlags: gatedPatternFlags,
    recentReviews: ownerWorkspaceReviews,
    recentReports: ownerWorkspaceReports,
    promotions,
    promotionPerformance: gatedPromotionPerformance,
    profileTools,
    licenseCompliance,
    ownerAlertStatus,
    runtimeStatus,
    tier: ownerTier,
    activeLocationId: storefrontId,
    locations:
      allOwnerLocationIds.length > 1
        ? await buildLocationSummaries(ownerUid, allOwnerLocationIds, primaryStorefrontId)
        : undefined,
  };
}

async function buildLocationSummaries(
  ownerUid: string,
  locationIds: string[],
  primaryId: string | null,
): Promise<
  Array<{
    storefrontId: string;
    displayName: string;
    addressLine1: string;
    city: string;
    state: string;
    isPrimary: boolean;
  }>
> {
  if (locationIds.length === 0) return [];
  const summaries = await backendStorefrontSource.getSummariesByIds(locationIds);
  return Promise.all(
    locationIds.map(async (id) => {
      const summary = summaries.find((s) => s.id === id);
      const privateSnapshot = summary
        ? null
        : await getOwnerPrivateStorefrontSnapshot(ownerUid, id);
      return {
        storefrontId: id,
        displayName: summary?.displayName ?? privateSnapshot?.displayName ?? id,
        addressLine1: summary?.addressLine1 ?? privateSnapshot?.addressLine1 ?? '',
        city: summary?.city ?? privateSnapshot?.city ?? '',
        state: summary?.state ?? privateSnapshot?.state ?? '',
        isPrimary: id === primaryId,
      };
    }),
  );
}

export async function saveOwnerPortalLicenseCompliance(
  ownerUid: string,
  input: OwnerPortalLicenseComplianceInput,
  locationId?: string | null,
) {
  const ownerState = await assertAuthorizedOwnerStorefront(ownerUid, {
    missingStorefrontMessage:
      'Claim the correct storefront before adding a license renewal record.',
  });

  const targetStorefrontId =
    (await resolveOwnerActiveLocation(ownerUid, locationId)) ?? ownerState.storefrontId!;

  return saveOwnerLicenseCompliance({
    ownerUid,
    dispensaryId: targetStorefrontId,
    input,
    source: 'owner_input',
  });
}

export async function saveOwnerPortalProfileTools(
  ownerUid: string,
  input: OwnerPortalProfileToolsInput,
  locationId?: string | null,
) {
  await assertRuntimePolicyAllowsOwnerAction('profile_tools');
  const ownerState = await assertAuthorizedOwnerStorefront(ownerUid, {
    requireVerified: true,
    requireActiveSubscription: true,
  });

  const targetStorefrontId =
    (await resolveOwnerActiveLocation(ownerUid, locationId)) ?? ownerState.storefrontId!;

  // Enforce tier-based limits on profile tools
  const ownerTier = await resolveOwnerTier(ownerUid);
  const tierLimits = getTierLimits(ownerTier);

  // Badge customization requires Growth+
  const hasBadgeChanges =
    (input.featuredBadges && input.featuredBadges.length > 0) ||
    (input.verifiedBadgeLabel !== undefined && input.verifiedBadgeLabel !== null);
  if (hasBadgeChanges && !tierLimits.badgeCustomizationEnabled) {
    throw new TierAccessError(
      'Badge customization requires the Growth ($149/mo) plan. Upgrade to unlock this feature.',
      'growth',
      ownerTier,
    );
  }

  // Featured photos: enforce count limit per tier
  const photoCount = input.featuredPhotoUrls?.length ?? 0;
  if (photoCount > 0 && tierLimits.maxFeaturedPhotos === 0) {
    throw new TierAccessError(
      'Featured photos require the Growth ($149/mo) plan. Upgrade to unlock this feature.',
      'growth',
      ownerTier,
    );
  }
  if (tierLimits.maxFeaturedPhotos > 0 && photoCount > tierLimits.maxFeaturedPhotos) {
    throw new Error(
      `Your plan allows up to ${tierLimits.maxFeaturedPhotos} featured photos. Upgrade to Pro for unlimited.`,
    );
  }

  const nextRecord = normalizeProfileTools(targetStorefrontId, ownerUid, input);
  return hydrateOwnerStorefrontProfileToolsMedia(
    await saveOwnerStorefrontProfileToolsDocument(nextRecord),
  );
}

export async function createOwnerPortalPromotion(
  ownerUid: string,
  input: OwnerPortalPromotionInput,
  locationId?: string | null,
) {
  await assertRuntimePolicyAllowsOwnerAction('promotion');
  const ownerState = await assertAuthorizedOwnerStorefront(ownerUid, {
    requireVerified: true,
    requireActiveSubscription: true,
  });

  const targetStorefrontId =
    (await resolveOwnerActiveLocation(ownerUid, locationId)) ?? ownerState.storefrontId!;

  const [existingPromotions, ownerTier] = await Promise.all([
    listOwnerStorefrontPromotions(targetStorefrontId),
    resolveOwnerTier(ownerUid),
  ]);
  const tierLimits = getTierLimits(ownerTier);

  // Audience targeting requires Pro tier
  assertAudienceTargetingAccess(input.audiences, tierLimits, ownerTier);

  const promotion = preparePromotionForSave({
    existingPromotion: null,
    nextPromotion: normalizePromotion(ownerUid, targetStorefrontId, input),
  });

  // Android moderation: classify content and attach moderation result
  const { moderation, platformVisibility } = classifyOwnerContent({
    title: promotion.title,
    description: promotion.description,
    badges: promotion.badges,
    contentCategory: input.contentCategory,
  });
  promotion.moderation = moderation;
  promotion.platformVisibility = platformVisibility;

  assertOwnerPromotionConstraints({
    nextPromotion: promotion,
    existingPromotions,
    maxPromotions: tierLimits.maxPromotions,
  });

  const savedPromotion = await saveOwnerStorefrontPromotionDocument(promotion);
  return (await maybeDispatchPromotionStartAlert(savedPromotion)).promotion;
}

export async function updateOwnerPortalPromotion(
  ownerUid: string,
  promotionId: string,
  input: OwnerPortalPromotionInput,
  locationId?: string | null,
) {
  await assertRuntimePolicyAllowsOwnerAction('promotion');
  const ownerState = await assertAuthorizedOwnerStorefront(ownerUid, {
    requireVerified: true,
    requireActiveSubscription: true,
  });

  const targetStorefrontId =
    (await resolveOwnerActiveLocation(ownerUid, locationId)) ?? ownerState.storefrontId!;

  const [existingPromotions, ownerTier] = await Promise.all([
    listOwnerStorefrontPromotions(targetStorefrontId),
    resolveOwnerTier(ownerUid),
  ]);
  const tierLimits = getTierLimits(ownerTier);

  // Audience targeting requires Pro tier
  assertAudienceTargetingAccess(input.audiences, tierLimits, ownerTier);

  const existingPromotion = existingPromotions.find((promotion) => promotion.id === promotionId);
  if (!existingPromotion) {
    throw new Error('Promotion not found.');
  }

  const nextPromotion = preparePromotionForSave({
    existingPromotion,
    nextPromotion: normalizePromotion(ownerUid, targetStorefrontId, {
      ...existingPromotion,
      ...input,
      id: promotionId,
      createdAt: existingPromotion.createdAt,
    }),
  });

  // Android moderation: re-classify on update
  const { moderation, platformVisibility } = classifyOwnerContent({
    title: nextPromotion.title,
    description: nextPromotion.description,
    badges: nextPromotion.badges,
    contentCategory: input.contentCategory,
  });
  nextPromotion.moderation = moderation;
  nextPromotion.platformVisibility = platformVisibility;

  assertOwnerPromotionConstraints({
    nextPromotion,
    existingPromotions,
    currentPromotionId: promotionId,
    maxPromotions: tierLimits.maxPromotions,
  });

  const savedPromotion = await saveOwnerStorefrontPromotionDocument(nextPromotion);
  return (await maybeDispatchPromotionStartAlert(savedPromotion)).promotion;
}

export async function deleteOwnerPortalPromotion(
  ownerUid: string,
  promotionId: string,
  locationId?: string | null,
) {
  const ownerState = await assertAuthorizedOwnerStorefront(ownerUid, {
    requireVerified: true,
    requireActiveSubscription: true,
  });

  const targetStorefrontId =
    (await resolveOwnerActiveLocation(ownerUid, locationId)) ?? ownerState.storefrontId!;

  const existingPromotions = await listOwnerStorefrontPromotions(targetStorefrontId);
  const existingPromotion = existingPromotions.find((p) => p.id === promotionId);
  if (!existingPromotion) {
    throw new Error('Promotion not found.');
  }

  await deleteOwnerStorefrontPromotionDocument(targetStorefrontId, promotionId);
  return { deleted: true, promotionId };
}

export async function replyToOwnerPortalReview(
  ownerUid: string,
  reviewId: string,
  text: string,
  locationId?: string | null,
) {
  await assertRuntimePolicyAllowsOwnerAction('review_reply');
  const ownerState = await assertAuthorizedOwnerStorefront(ownerUid, {
    requireVerified: true,
    requireActiveSubscription: true,
  });

  const targetStorefrontId =
    (await resolveOwnerActiveLocation(ownerUid, locationId)) ?? ownerState.storefrontId!;
  const ownerProfile = ownerState.ownerProfile;

  return replyToStorefrontAppReview({
    storefrontId: targetStorefrontId,
    reviewId,
    ownerUid,
    ownerDisplayName: ownerProfile?.companyName || ownerProfile?.legalName || null,
    text,
  });
}

export async function getOwnerPortalBrands(
  ownerUid: string,
  locationId?: string | null,
): Promise<{ storefrontId: string; brandIds: string[]; updatedAt: string | null }> {
  const ownerState = await assertAuthorizedOwnerStorefront(ownerUid, {
    missingStorefrontMessage: 'Claim the correct storefront before managing your brand roster.',
  });

  const targetStorefrontId =
    (await resolveOwnerActiveLocation(ownerUid, locationId)) ?? ownerState.storefrontId!;

  const roster = await getOwnerStorefrontBrands(targetStorefrontId);
  return {
    storefrontId: targetStorefrontId,
    brandIds: roster?.brandIds ?? [],
    updatedAt: roster?.updatedAt ?? null,
  };
}

export async function saveOwnerPortalBrands(
  ownerUid: string,
  input: { brandIds: string[] },
  locationId?: string | null,
): Promise<{ storefrontId: string; brandIds: string[]; updatedAt: string }> {
  const ownerState = await assertAuthorizedOwnerStorefront(ownerUid, {
    requireVerified: true,
    missingStorefrontMessage: 'Verify your storefront before publishing a brand roster.',
  });

  const targetStorefrontId =
    (await resolveOwnerActiveLocation(ownerUid, locationId)) ?? ownerState.storefrontId!;

  const saved = await saveOwnerStorefrontBrands({
    storefrontId: targetStorefrontId,
    ownerUid,
    brandIds: input.brandIds,
  });

  return {
    storefrontId: saved.storefrontId,
    brandIds: saved.brandIds,
    updatedAt: saved.updatedAt,
  };
}

export type OwnerPortalBrandActivityResponse = {
  storefrontId: string;
  sinceDays: number;
  brands: BrandActivityNearStorefront[];
  generatedAt: string;
};

export async function getOwnerPortalBrandActivity(
  ownerUid: string,
  locationId?: string | null,
  options?: { sinceDays?: number; limit?: number },
): Promise<OwnerPortalBrandActivityResponse> {
  const ownerState = await assertAuthorizedOwnerStorefront(ownerUid, {
    missingStorefrontMessage: 'Claim the correct storefront before viewing brand activity.',
  });

  const targetStorefrontId =
    (await resolveOwnerActiveLocation(ownerUid, locationId)) ?? ownerState.storefrontId!;

  const db = getBackendFirebaseDb();
  let storefrontLat: number | null = null;
  let storefrontLng: number | null = null;
  if (db) {
    try {
      const doc = await db.collection(DISPENSARIES_COLLECTION).doc(targetStorefrontId).get();
      if (doc.exists) {
        const data = doc.data() as {
          latitude?: number | null;
          longitude?: number | null;
        };
        if (typeof data.latitude === 'number' && typeof data.longitude === 'number') {
          storefrontLat = data.latitude;
          storefrontLng = data.longitude;
        }
      }
    } catch (error) {
      logger.warn('[ownerPortalWorkspaceService] Failed to load storefront coordinates', {
        storefrontId: targetStorefrontId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const sinceDays = Math.max(1, Math.min(30, options?.sinceDays ?? 7));
  const limit = Math.max(1, Math.min(20, options?.limit ?? 5));

  if (storefrontLat === null || storefrontLng === null) {
    return {
      storefrontId: targetStorefrontId,
      sinceDays,
      brands: [],
      generatedAt: new Date().toISOString(),
    };
  }

  const activity = await getBrandScansNearStorefront({
    storefrontId: targetStorefrontId,
    storefrontLat,
    storefrontLng,
    sinceDays,
  });

  return {
    storefrontId: targetStorefrontId,
    sinceDays,
    brands: activity.slice(0, limit),
    generatedAt: new Date().toISOString(),
  };
}

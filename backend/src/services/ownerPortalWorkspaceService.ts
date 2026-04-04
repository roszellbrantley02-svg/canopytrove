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
  assertAuthorizedOwnerStorefront,
  getOwnerAuthorizationState,
} from './ownerPortalAuthorizationService';
import {
  getOwnerLicenseCompliance,
  saveOwnerLicenseCompliance,
} from './ownerPortalLicenseComplianceService';
import { hydrateOwnerStorefrontProfileToolsMedia } from './storefrontMediaAccessService';
import {
  computeOpenNowFromOwnerHours,
  ownerHoursToDisplayStrings,
} from './ownerHoursService';
import { isActiveOwnerSubscriptionStatus } from './ownerPortalAuthorizationService';
import { getOwnerProfile } from './ownerPortalWorkspaceData';

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
    switch (promotion.audience) {
      case 'all_followers':
        if (await isFollowingStorefront(viewerContext.profileId, storefrontId)) {
          return promotion;
        }
        break;

      case 'frequent_visitors':
        // Show to users who have recently viewed or routed to this storefront
        if (await isFrequentVisitor(viewerContext.profileId, storefrontId)) {
          return promotion;
        }
        break;

      case 'new_customers':
        // Show to users who have NOT saved the storefront (discovering it)
        if (!(await isFollowingStorefront(viewerContext.profileId, storefrontId))) {
          return promotion;
        }
        break;

      default:
        // Unrecognised audience — show to everyone
        return promotion;
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
    console.warn(
      `[owner-workspace-service] summary enhancement: profileTools failed for ${summary.id}:`,
      rawProfileToolsResult.reason,
    );
  }
  if (activePromotionsResult.status === 'rejected') {
    console.warn(
      `[owner-workspace-service] summary enhancement: activePromotions failed for ${summary.id}:`,
      activePromotionsResult.reason,
    );
  }
  const profileTools = await hydrateOwnerStorefrontProfileToolsMedia(rawProfileTools);
  const subscriptionActive = await isOwnerSubscriptionActive(rawProfileTools);

  // Owner hours persist even after subscription lapse — always apply when present.
  const ownerHoursOpenNow =
    rawProfileTools?.ownerHours?.length
      ? computeOpenNowFromOwnerHours(rawProfileTools.ownerHours)
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
    thumbnailUrl:
      collectProfileAttachmentUrls(liveProfileTools)[0] ?? summary.thumbnailUrl ?? null,
  };

  // Owner hours override openNow regardless of subscription status.
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
    console.warn(
      `[owner-workspace-service] detail enhancement: profileTools failed for ${detail.storefrontId}:`,
      rawProfileToolsResult.reason,
    );
  }
  if (followerCountResult.status === 'rejected') {
    console.warn(
      `[owner-workspace-service] detail enhancement: followerCount failed for ${detail.storefrontId}:`,
      followerCountResult.reason,
    );
  }
  if (activePromotionsResult.status === 'rejected') {
    console.warn(
      `[owner-workspace-service] detail enhancement: activePromotions failed for ${detail.storefrontId}:`,
      activePromotionsResult.reason,
    );
  }
  const profileTools = await hydrateOwnerStorefrontProfileToolsMedia(rawProfileTools);
  const subscriptionActive = await isOwnerSubscriptionActive(rawProfileTools);

  // Owner hours persist even after subscription lapse.
  const ownerHoursEntries = rawProfileTools?.ownerHours?.length
    ? rawProfileTools.ownerHours
    : null;
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
    ownerFeaturedBadges:
      liveProfileTools?.featuredBadges ?? detail.ownerFeaturedBadges ?? [],
    activePromotions: visiblePromotions.slice(0, 5).map((promotion) => ({
      id: promotion.id,
      title: promotion.title,
      description: promotion.description || promotion.title,
      badges: normalizeBadges(promotion.badges.length ? promotion.badges : [promotion.title]),
      startsAt: promotion.startsAt,
      endsAt: promotion.endsAt,
      cardTone: promotion.cardTone,
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

  const storefrontId = ownerState.storefrontId;
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
      ? buildOwnerWorkspaceSummarySnapshot(storefrontSummary)
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

export async function saveOwnerPortalLicenseCompliance(
  ownerUid: string,
  input: OwnerPortalLicenseComplianceInput,
) {
  const ownerState = await assertAuthorizedOwnerStorefront(ownerUid, {
    missingStorefrontMessage:
      'Claim the correct storefront before adding a license renewal record.',
  });

  return saveOwnerLicenseCompliance({
    ownerUid,
    dispensaryId: ownerState.storefrontId!,
    input,
    source: 'owner_input',
  });
}

export async function saveOwnerPortalProfileTools(
  ownerUid: string,
  input: OwnerPortalProfileToolsInput,
) {
  await assertRuntimePolicyAllowsOwnerAction('profile_tools');
  const ownerState = await assertAuthorizedOwnerStorefront(ownerUid, {
    requireVerified: true,
    requireActiveSubscription: true,
  });

  const nextRecord = normalizeProfileTools(ownerState.storefrontId!, ownerUid, input);
  return hydrateOwnerStorefrontProfileToolsMedia(
    await saveOwnerStorefrontProfileToolsDocument(nextRecord),
  );
}

export async function createOwnerPortalPromotion(
  ownerUid: string,
  input: OwnerPortalPromotionInput,
) {
  await assertRuntimePolicyAllowsOwnerAction('promotion');
  const ownerState = await assertAuthorizedOwnerStorefront(ownerUid, {
    requireVerified: true,
    requireActiveSubscription: true,
  });

  const existingPromotions = await listOwnerStorefrontPromotions(ownerState.storefrontId!);
  const promotion = preparePromotionForSave({
    existingPromotion: null,
    nextPromotion: normalizePromotion(ownerUid, ownerState.storefrontId!, input),
  });

  assertOwnerPromotionConstraints({
    nextPromotion: promotion,
    existingPromotions,
  });

  const savedPromotion = await saveOwnerStorefrontPromotionDocument(promotion);
  return (await maybeDispatchPromotionStartAlert(savedPromotion)).promotion;
}

export async function updateOwnerPortalPromotion(
  ownerUid: string,
  promotionId: string,
  input: OwnerPortalPromotionInput,
) {
  await assertRuntimePolicyAllowsOwnerAction('promotion');
  const ownerState = await assertAuthorizedOwnerStorefront(ownerUid, {
    requireVerified: true,
    requireActiveSubscription: true,
  });

  const existingPromotions = await listOwnerStorefrontPromotions(ownerState.storefrontId!);
  const existingPromotion = existingPromotions.find((promotion) => promotion.id === promotionId);
  if (!existingPromotion) {
    throw new Error('Promotion not found.');
  }

  const nextPromotion = preparePromotionForSave({
    existingPromotion,
    nextPromotion: normalizePromotion(ownerUid, ownerState.storefrontId!, {
      ...existingPromotion,
      ...input,
      id: promotionId,
      createdAt: existingPromotion.createdAt,
    }),
  });

  assertOwnerPromotionConstraints({
    nextPromotion,
    existingPromotions,
    currentPromotionId: promotionId,
  });

  const savedPromotion = await saveOwnerStorefrontPromotionDocument(nextPromotion);
  return (await maybeDispatchPromotionStartAlert(savedPromotion)).promotion;
}

export async function replyToOwnerPortalReview(ownerUid: string, reviewId: string, text: string) {
  await assertRuntimePolicyAllowsOwnerAction('review_reply');
  const ownerState = await assertAuthorizedOwnerStorefront(ownerUid, {
    requireVerified: true,
    requireActiveSubscription: true,
  });
  const ownerProfile = ownerState.ownerProfile;

  return replyToStorefrontAppReview({
    storefrontId: ownerState.storefrontId!,
    reviewId,
    ownerUid,
    ownerDisplayName: ownerProfile?.companyName || ownerProfile?.legalName || null,
    text,
  });
}

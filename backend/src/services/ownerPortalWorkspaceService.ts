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
import { assertAuthorizedOwnerStorefront, getOwnerAuthorizationState } from './ownerPortalAuthorizationService';
import {
  getOwnerLicenseCompliance,
  saveOwnerLicenseCompliance,
} from './ownerPortalLicenseComplianceService';
import { hydrateOwnerStorefrontProfileToolsMedia } from './storefrontMediaAccessService';

export async function applyOwnerWorkspaceSummaryEnhancements(
  summary: StorefrontSummaryApiDocument
) {
  const cached = storefrontSummaryEnhancementCache.get(summary.id);
  if (cached && cached.expiresAt > Date.now()) {
    return {
      ...summary,
      ...cached.value,
    };
  }

  const [rawProfileTools, activePromotions] = await Promise.all([
    getOwnerStorefrontProfileTools(summary.id),
    listActiveOwnerStorefrontPromotions(summary.id),
  ]);
  const profileTools = await hydrateOwnerStorefrontProfileToolsMedia(rawProfileTools);
  const activePromotion = activePromotions[0] ?? null;

  const enhancement: Partial<StorefrontSummaryApiDocument> = {
    menuUrl: profileTools?.menuUrl ?? null,
    verifiedOwnerBadgeLabel: profileTools?.verifiedBadgeLabel ?? null,
    ownerFeaturedBadges: profileTools?.featuredBadges ?? [],
    ownerCardSummary: profileTools?.cardSummary ?? null,
    activePromotionCount: activePromotions.length,
    premiumCardVariant:
      activePromotion?.cardTone ??
      (profileTools?.featuredBadges?.length ? 'owner_featured' : 'standard'),
    promotionPlacementSurfaces: activePromotion?.placementSurfaces ?? [],
    promotionPlacementScope: activePromotion?.placementScope ?? null,
    thumbnailUrl: collectProfileAttachmentUrls(profileTools)[0] ?? summary.thumbnailUrl ?? null,
  };

  if (activePromotion) {
    enhancement.promotionText = activePromotion.description || activePromotion.title;
    enhancement.promotionBadges = normalizeBadges(activePromotion.badges.length
      ? activePromotion.badges
      : [activePromotion.title]);
    enhancement.promotionExpiresAt = activePromotion.endsAt;
    enhancement.activePromotionId = activePromotion.id;
    enhancement.premiumCardVariant = activePromotion.cardTone;
  }

  storefrontSummaryEnhancementCache.set(summary.id, {
    value: enhancement,
    expiresAt: Date.now() + 20_000,
  });

  return {
    ...summary,
    ...enhancement,
  };
}

export async function applyOwnerWorkspaceDetailEnhancements(
  detail: StorefrontDetailApiDocument
) {
  const cached = storefrontDetailEnhancementCache.get(detail.storefrontId);
  if (cached && cached.expiresAt > Date.now()) {
    return {
      ...detail,
      ...cached.value,
    };
  }

  const [rawProfileTools, followerCount, activePromotions] = await Promise.all([
    getOwnerStorefrontProfileTools(detail.storefrontId),
    sumStorefrontFollowers(detail.storefrontId),
    listActiveOwnerStorefrontPromotions(detail.storefrontId),
  ]);
  const profileTools = await hydrateOwnerStorefrontProfileToolsMedia(rawProfileTools);

  const enhancement: Partial<StorefrontDetailApiDocument> = {
    menuUrl: profileTools?.menuUrl ?? null,
    verifiedOwnerBadgeLabel: profileTools?.verifiedBadgeLabel ?? null,
    favoriteFollowerCount: followerCount,
    ownerFeaturedBadges: profileTools?.featuredBadges ?? [],
    activePromotions: activePromotions.slice(0, 5).map((promotion) => ({
      id: promotion.id,
      title: promotion.title,
      description: promotion.description || promotion.title,
      badges: normalizeBadges(promotion.badges.length ? promotion.badges : [promotion.title]),
      startsAt: promotion.startsAt,
      endsAt: promotion.endsAt,
      cardTone: promotion.cardTone,
    })),
    photoUrls: collectProfileAttachmentUrls(profileTools).length
      ? Array.from(
          new Set([...collectProfileAttachmentUrls(profileTools), ...detail.photoUrls])
        ).slice(0, 12)
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

export async function getOwnerPortalWorkspace(ownerUid: string): Promise<OwnerPortalWorkspaceDocument> {
  const runtimeStatus = await getRuntimeOpsStatus();
  const ownerState = await getOwnerAuthorizationState(ownerUid);
  const ownerProfile = ownerState.ownerProfile
    ? {
        ...ownerState.ownerProfile,
        dispensaryId: ownerState.storefrontId ?? ownerState.ownerProfile.dispensaryId,
        businessVerificationStatus:
          ownerState.businessVerificationStatus ?? ownerState.ownerProfile.businessVerificationStatus,
        identityVerificationStatus:
          ownerState.identityVerificationStatus ?? ownerState.ownerProfile.identityVerificationStatus,
        subscriptionStatus:
          ownerState.subscription?.status ?? ownerState.ownerProfile.subscriptionStatus,
      }
    : null;
  if (!ownerProfile) {
    return buildEmptyOwnerPortalWorkspace(runtimeStatus);
  }

  const storefrontId = ownerState.storefrontId;
  const [ownerClaimResult, baseSummaryResult, rawProfileToolsResult, promotionsResult, ownerAlertStatusResult, licenseComplianceResult] =
    await Promise.allSettled([
    Promise.resolve(ownerState.ownerClaim),
    storefrontId
      ? backendStorefrontSource.getSummariesByIds([storefrontId]).then((items) => items[0] ?? null)
      : Promise.resolve(null),
    storefrontId ? getOwnerStorefrontProfileTools(storefrontId) : Promise.resolve(null),
    storefrontId ? listOwnerStorefrontPromotions(storefrontId) : Promise.resolve([]),
    getOwnerPortalAlertStatus(ownerUid),
    getOwnerLicenseCompliance(ownerUid, storefrontId),
  ]);
  const ownerClaim = ownerClaimResult.status === 'fulfilled' ? ownerClaimResult.value : ownerState.ownerClaim;
  const baseSummary = baseSummaryResult.status === 'fulfilled' ? baseSummaryResult.value : null;
  const rawProfileTools = rawProfileToolsResult.status === 'fulfilled' ? rawProfileToolsResult.value : null;
  const promotions = promotionsResult.status === 'fulfilled' ? promotionsResult.value : [];
  const ownerAlertStatus = ownerAlertStatusResult.status === 'fulfilled' ? ownerAlertStatusResult.value : { pushEnabled: false, updatedAt: null };
  const licenseCompliance = licenseComplianceResult.status === 'fulfilled' ? licenseComplianceResult.value : null;
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
    }))
  );
  const promotionPerformance = promotionResults.flatMap((r) =>
    r.status === 'fulfilled' ? [r.value] : []
  );

  const activePromotion = storefrontId ? await getActivePromotion(storefrontId) : null;
  const storefrontSummary = baseSummary ? await applyOwnerWorkspaceSummaryEnhancements(baseSummary) : null;
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
    storefrontSummary: storefrontSummary ? buildOwnerWorkspaceSummarySnapshot(storefrontSummary) : null,
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
  input: OwnerPortalLicenseComplianceInput
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
  input: OwnerPortalProfileToolsInput
) {
  await assertRuntimePolicyAllowsOwnerAction('profile_tools');
  const ownerState = await assertAuthorizedOwnerStorefront(ownerUid, {
    requireVerified: true,
    requireActiveSubscription: true,
  });

  const nextRecord = normalizeProfileTools(ownerState.storefrontId!, ownerUid, input);
  return hydrateOwnerStorefrontProfileToolsMedia(
    await saveOwnerStorefrontProfileToolsDocument(nextRecord)
  );
}

export async function createOwnerPortalPromotion(
  ownerUid: string,
  input: OwnerPortalPromotionInput
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
  input: OwnerPortalPromotionInput
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

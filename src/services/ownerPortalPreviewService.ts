import AsyncStorage from '@react-native-async-storage/async-storage';
import { brand } from '../config/brand';
import type {
  OwnerLicenseComplianceDocument,
  OwnerPortalLicenseComplianceInput,
  OwnerPortalProfileToolsInput,
  OwnerPortalPromotionInput,
  OwnerPortalWorkspaceDocument,
  OwnerStorefrontPromotionDocument,
  OwnerWorkspacePatternFlag,
  OwnerWorkspaceReportRecord,
  OwnerWorkspaceReviewRecord,
  OwnerPromotionPerformanceSnapshot,
} from '../types/ownerPortal';
import type {
  StorefrontActivePromotion,
  StorefrontDetails,
  StorefrontSummary,
} from '../types/storefront';
import {
  OWNER_PORTAL_PREVIEW_UID,
  ownerPortalPreviewClaim,
  ownerPortalPreviewLicenseCompliance,
  ownerPortalPreviewProfile,
  ownerPortalPreviewProfileTools,
  ownerPortalPreviewPromotions,
  ownerPortalPreviewSearchResults,
  ownerPortalPreviewStorefront,
  ownerPortalPreviewWorkspace,
} from '../screens/ownerPortal/ownerPortalPreviewData';

// Keep the existing storage bucket so preview data survives the naming cleanup.
const OWNER_PORTAL_PREVIEW_STORAGE_KEY = `${brand.storageNamespace}:owner-portal-sandbox:v1`;
const OWNER_PORTAL_PREVIEW_SCHEMA_VERSION = 1;
const DEFAULT_PREVIEW_HOURS = [
  'Monday: 8:00 AM - 11:00 PM',
  'Tuesday: 8:00 AM - 11:00 PM',
  'Wednesday: 8:00 AM - 11:00 PM',
  'Thursday: 8:00 AM - 11:00 PM',
  'Friday: 8:00 AM - 12:00 AM',
  'Saturday: 9:00 AM - 12:00 AM',
  'Sunday: 10:00 AM - 10:00 PM',
];

type OwnerPortalPreviewState = {
  ownerProfile: typeof ownerPortalPreviewProfile;
  ownerClaim: typeof ownerPortalPreviewClaim;
  profileTools: typeof ownerPortalPreviewProfileTools;
  licenseCompliance: typeof ownerPortalPreviewLicenseCompliance;
  promotions: OwnerStorefrontPromotionDocument[];
  promotionPerformance: OwnerPromotionPerformanceSnapshot[];
  recentReviews: OwnerWorkspaceReviewRecord[];
  recentReports: OwnerWorkspaceReportRecord[];
  ownerAlertStatus: OwnerPortalWorkspaceDocument['ownerAlertStatus'];
  supportingStorefronts: StorefrontSummary[];
};

type PersistedOwnerPortalPreviewState = {
  version: number;
  state: OwnerPortalPreviewState;
};

let memoryState: OwnerPortalPreviewState | null = null;
let initializationPromise: Promise<OwnerPortalPreviewState> | null = null;

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createRelativeIso(hoursFromNow: number) {
  return new Date(Date.now() + hoursFromNow * 60 * 60 * 1000).toISOString();
}

function createRelativeDayLabel(offsetDays: number) {
  const target = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000);
  return target.toISOString();
}

function derivePromotionStatus(
  promotion: Pick<OwnerStorefrontPromotionDocument, 'startsAt' | 'endsAt'>,
): OwnerStorefrontPromotionDocument['status'] {
  const now = Date.now();
  const startsAtMs = Date.parse(promotion.startsAt);
  const endsAtMs = Date.parse(promotion.endsAt);

  if (Number.isFinite(endsAtMs) && endsAtMs <= now) {
    return 'expired';
  }

  if (Number.isFinite(startsAtMs) && startsAtMs > now) {
    return 'scheduled';
  }

  if (
    Number.isFinite(startsAtMs) &&
    Number.isFinite(endsAtMs) &&
    startsAtMs <= now &&
    endsAtMs > now
  ) {
    return 'active';
  }

  return 'draft';
}

function createPromotionPerformanceSeed(
  promotion: OwnerStorefrontPromotionDocument,
  template?: OwnerPromotionPerformanceSnapshot,
): OwnerPromotionPerformanceSnapshot {
  return {
    promotionId: promotion.id,
    title: promotion.title,
    status: promotion.status,
    badges: [...promotion.badges],
    startsAt: promotion.startsAt,
    endsAt: promotion.endsAt,
    metrics: template?.metrics ?? {
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
  };
}

function createSeedPromotions() {
  const activePromotion = {
    ...cloneValue(ownerPortalPreviewPromotions[0]),
    startsAt: createRelativeIso(-2),
    endsAt: createRelativeIso(48),
    status: 'active' as const,
    createdAt: createRelativeIso(-12),
    updatedAt: new Date().toISOString(),
  };
  const scheduledPromotion = {
    ...cloneValue(ownerPortalPreviewPromotions[1]),
    startsAt: createRelativeIso(24),
    endsAt: createRelativeIso(96),
    status: 'scheduled' as const,
    createdAt: createRelativeIso(-8),
    updatedAt: new Date().toISOString(),
  };

  return [activePromotion, scheduledPromotion];
}

function createSeedState(): OwnerPortalPreviewState {
  const promotions = createSeedPromotions();
  const promotionPerformance = ownerPortalPreviewWorkspace.promotionPerformance.map((snapshot) => {
    const matchingPromotion = promotions.find((promotion) => promotion.id === snapshot.promotionId);
    if (!matchingPromotion) {
      return snapshot;
    }

    return {
      ...snapshot,
      title: matchingPromotion.title,
      status: matchingPromotion.status,
      badges: [...matchingPromotion.badges],
      startsAt: matchingPromotion.startsAt,
      endsAt: matchingPromotion.endsAt,
    };
  });

  return {
    ownerProfile: {
      ...cloneValue(ownerPortalPreviewProfile),
      identityVerificationStatus: 'verified',
      onboardingStep: 'completed',
      subscriptionStatus: 'trial',
      updatedAt: new Date().toISOString(),
    },
    ownerClaim: {
      ...cloneValue(ownerPortalPreviewClaim),
      reviewNotes: 'Preview claim approved for local owner testing.',
      reviewedAt: createRelativeIso(-72),
      submittedAt: createRelativeIso(-96),
    },
    profileTools: {
      ...cloneValue(ownerPortalPreviewProfileTools),
      updatedAt: new Date().toISOString(),
    },
    licenseCompliance: {
      ...cloneValue(ownerPortalPreviewLicenseCompliance),
      issuedAt: createRelativeDayLabel(-180),
      expiresAt: createRelativeDayLabel(540),
      renewalWindowStartsAt: createRelativeDayLabel(420),
      renewalUrgentAt: createRelativeDayLabel(480),
      renewalSubmittedAt: null,
      renewalStatus: 'active',
      source: 'verification_seed',
      updatedAt: new Date().toISOString(),
    },
    promotions,
    promotionPerformance,
    recentReviews: cloneValue(ownerPortalPreviewWorkspace.recentReviews),
    recentReports: cloneValue(ownerPortalPreviewWorkspace.recentReports),
    ownerAlertStatus: {
      pushEnabled: true,
      updatedAt: new Date().toISOString(),
    },
    supportingStorefronts: cloneValue(
      ownerPortalPreviewSearchResults.filter(
        (storefront) => storefront.id !== ownerPortalPreviewStorefront.id,
      ),
    ),
  };
}

function sanitizePromotionPerformance(
  promotions: OwnerStorefrontPromotionDocument[],
  snapshots: OwnerPromotionPerformanceSnapshot[],
) {
  const snapshotByPromotionId = new Map(
    snapshots.map((snapshot) => [snapshot.promotionId, cloneValue(snapshot)]),
  );

  return promotions.map((promotion) =>
    createPromotionPerformanceSeed(promotion, snapshotByPromotionId.get(promotion.id)),
  );
}

function sanitizePreviewState(state: OwnerPortalPreviewState): OwnerPortalPreviewState {
  const claimedStorefrontId =
    state.ownerProfile.dispensaryId ??
    state.ownerClaim.dispensaryId ??
    ownerPortalPreviewStorefront.id;

  const ownerProfile = {
    ...cloneValue(state.ownerProfile),
    uid: OWNER_PORTAL_PREVIEW_UID,
    dispensaryId: claimedStorefrontId,
    updatedAt: state.ownerProfile.updatedAt || new Date().toISOString(),
  };
  const ownerClaim = {
    ...cloneValue(state.ownerClaim),
    ownerUid: OWNER_PORTAL_PREVIEW_UID,
    dispensaryId: claimedStorefrontId,
  };
  const profileTools = {
    ...cloneValue(state.profileTools),
    ownerUid: OWNER_PORTAL_PREVIEW_UID,
    storefrontId: claimedStorefrontId,
  };
  const licenseCompliance = {
    ...cloneValue(state.licenseCompliance),
    ownerUid: OWNER_PORTAL_PREVIEW_UID,
    dispensaryId: claimedStorefrontId,
  };
  const promotions = cloneValue(state.promotions).map((promotion) => ({
    ...promotion,
    ownerUid: OWNER_PORTAL_PREVIEW_UID,
    storefrontId: claimedStorefrontId,
    status: derivePromotionStatus(promotion),
  }));

  return {
    ownerProfile,
    ownerClaim,
    profileTools,
    licenseCompliance,
    promotions,
    promotionPerformance: sanitizePromotionPerformance(promotions, state.promotionPerformance),
    recentReviews: cloneValue(state.recentReviews),
    recentReports: cloneValue(state.recentReports),
    ownerAlertStatus: cloneValue(state.ownerAlertStatus),
    supportingStorefronts: cloneValue(state.supportingStorefronts),
  };
}

async function persistPreviewState(state: OwnerPortalPreviewState) {
  const sanitizedState = sanitizePreviewState(state);
  memoryState = sanitizedState;

  try {
    const persistedState: PersistedOwnerPortalPreviewState = {
      version: OWNER_PORTAL_PREVIEW_SCHEMA_VERSION,
      state: sanitizedState,
    };
    await AsyncStorage.setItem(OWNER_PORTAL_PREVIEW_STORAGE_KEY, JSON.stringify(persistedState));
  } catch {
    // Preview persistence is best-effort for owner testing only.
  }

  return sanitizedState;
}

async function initializePreviewState() {
  if (memoryState) {
    return memoryState;
  }

  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    try {
      const rawValue = await AsyncStorage.getItem(OWNER_PORTAL_PREVIEW_STORAGE_KEY);
      if (!rawValue) {
        const seededState = createSeedState();
        await persistPreviewState(seededState);
        return seededState;
      }

      const parsed = JSON.parse(rawValue) as PersistedOwnerPortalPreviewState;
      if (!parsed || parsed.version !== OWNER_PORTAL_PREVIEW_SCHEMA_VERSION || !parsed.state) {
        const seededState = createSeedState();
        await persistPreviewState(seededState);
        return seededState;
      }

      const sanitized = sanitizePreviewState(parsed.state);
      memoryState = sanitized;
      return sanitized;
    } catch {
      const seededState = createSeedState();
      await persistPreviewState(seededState);
      return seededState;
    } finally {
      initializationPromise = null;
    }
  })();

  return initializationPromise;
}

function getPromotionTonePriority(tone: OwnerStorefrontPromotionDocument['cardTone']) {
  switch (tone) {
    case 'hot_deal':
      return 0;
    case 'owner_featured':
      return 1;
    default:
      return 2;
  }
}

function getActivePromotions(promotions: OwnerStorefrontPromotionDocument[], storefrontId: string) {
  return promotions
    .filter(
      (promotion) =>
        promotion.storefrontId === storefrontId && derivePromotionStatus(promotion) === 'active',
    )
    .sort((left, right) => {
      const toneDifference =
        getPromotionTonePriority(left.cardTone) - getPromotionTonePriority(right.cardTone);
      if (toneDifference !== 0) {
        return toneDifference;
      }

      return Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
    });
}

function createStorefrontActivePromotions(
  promotions: OwnerStorefrontPromotionDocument[],
): StorefrontActivePromotion[] {
  return promotions.map((promotion) => ({
    id: promotion.id,
    title: promotion.title,
    description: promotion.description,
    badges: [...promotion.badges],
    startsAt: promotion.startsAt,
    endsAt: promotion.endsAt,
    cardTone: promotion.cardTone,
  }));
}

function buildClaimedStorefrontSummary(state: OwnerPortalPreviewState): StorefrontSummary {
  const activePromotions = getActivePromotions(state.promotions, state.ownerClaim.dispensaryId);
  const leadPromotion = activePromotions[0] ?? null;
  const reviewCount = Math.max(
    state.recentReviews.length,
    ownerPortalPreviewStorefront.reviewCount,
  );
  const averageRating = state.recentReviews.length
    ? Number(
        (
          state.recentReviews.reduce((sum, review) => sum + review.rating, 0) /
          state.recentReviews.length
        ).toFixed(1),
      )
    : ownerPortalPreviewStorefront.rating;

  return {
    ...cloneValue(ownerPortalPreviewStorefront),
    rating: averageRating,
    reviewCount,
    promotionText: leadPromotion?.description ?? null,
    promotionBadges: leadPromotion?.badges ?? [],
    promotionExpiresAt: leadPromotion?.endsAt ?? null,
    activePromotionId: leadPromotion?.id ?? null,
    activePromotionCount: activePromotions.length,
    premiumCardVariant: leadPromotion?.cardTone ?? 'standard',
    promotionPlacementSurfaces: leadPromotion?.placementSurfaces ?? [],
    promotionPlacementScope: leadPromotion?.placementScope ?? null,
    menuUrl: state.profileTools.menuUrl ?? null,
    verifiedOwnerBadgeLabel: state.profileTools.verifiedBadgeLabel ?? null,
    ownerFeaturedBadges: [...state.profileTools.featuredBadges],
    ownerCardSummary: state.profileTools.cardSummary ?? null,
    favoriteFollowerCount: ownerPortalPreviewWorkspace.metrics.followerCount,
    thumbnailUrl:
      state.profileTools.cardPhotoUrl ?? state.profileTools.featuredPhotoUrls[0] ?? null,
  };
}

function buildPreviewCatalog(state: OwnerPortalPreviewState) {
  return [buildClaimedStorefrontSummary(state), ...cloneValue(state.supportingStorefronts)];
}

function createGenericPreviewReviews(summary: StorefrontSummary): OwnerWorkspaceReviewRecord[] {
  return [
    {
      id: `${summary.id}-review-1`,
      storefrontId: summary.id,
      authorName: 'Preview member',
      authorProfileId: `${summary.id}-profile-1`,
      rating: 5,
      relativeTime: 'Today',
      text: `${summary.displayName} is loaded into the preview workspace so owner deals and card states can be checked safely.`,
      tags: ['Preview', 'Owner test'],
      helpfulCount: 0,
      ownerReply: null,
      isLowRating: false,
    },
  ];
}

function buildPreviewDetails(
  state: OwnerPortalPreviewState,
  storefrontId: string,
): StorefrontDetails | null {
  const summary = buildPreviewCatalog(state).find((candidate) => candidate.id === storefrontId);
  if (!summary) {
    return null;
  }

  const isClaimedStorefront = storefrontId === state.ownerClaim.dispensaryId;
  const activePromotions = getActivePromotions(state.promotions, storefrontId);
  const reviews = isClaimedStorefront
    ? cloneValue(state.recentReviews)
    : createGenericPreviewReviews(summary);
  const photoUrls = isClaimedStorefront
    ? cloneValue(state.profileTools.featuredPhotoUrls)
    : summary.thumbnailUrl
      ? [summary.thumbnailUrl]
      : [];

  return {
    storefrontId,
    phone: isClaimedStorefront
      ? ownerPortalPreviewWorkspace.storefrontSummary?.id
        ? '(212) 555-0188'
        : null
      : '(212) 555-0199',
    website: `https://canopytrove.com/storefronts/${storefrontId}`,
    hours: [...DEFAULT_PREVIEW_HOURS],
    openNow: summary.openNow,
    hasOwnerClaim: isClaimedStorefront,
    menuUrl: isClaimedStorefront ? (state.profileTools.menuUrl ?? null) : (summary.menuUrl ?? null),
    verifiedOwnerBadgeLabel: isClaimedStorefront
      ? (state.profileTools.verifiedBadgeLabel ?? null)
      : (summary.verifiedOwnerBadgeLabel ?? null),
    favoriteFollowerCount: isClaimedStorefront
      ? ownerPortalPreviewWorkspace.metrics.followerCount
      : (summary.favoriteFollowerCount ?? null),
    ownerFeaturedBadges: isClaimedStorefront
      ? [...state.profileTools.featuredBadges]
      : [...(summary.ownerFeaturedBadges ?? [])],
    activePromotions: createStorefrontActivePromotions(activePromotions),
    photoCount: photoUrls.length,
    appReviewCount: reviews.length,
    appReviews: reviews,
    photoUrls,
    amenities: ['Licensed storefront', 'Preview owner testing', 'Preview-safe data'],
    editorialSummary:
      (isClaimedStorefront ? state.profileTools.cardSummary : summary.ownerCardSummary) ??
      `${summary.displayName} is part of the Canopy Trove preview catalog for testing owner deals and storefront presentation.`,
    routeMode: isClaimedStorefront ? 'verified' : 'preview',
  };
}

function deriveLicenseComplianceState(
  current: OwnerLicenseComplianceDocument,
  expiresAt: string | null,
  renewalSubmittedAt: string | null,
) {
  if (!expiresAt) {
    return {
      renewalStatus: 'unknown' as const,
      renewalWindowStartsAt: null,
      renewalUrgentAt: null,
    };
  }

  const expiresAtMs = Date.parse(expiresAt);
  if (!Number.isFinite(expiresAtMs)) {
    return {
      renewalStatus: current.renewalStatus,
      renewalWindowStartsAt: current.renewalWindowStartsAt,
      renewalUrgentAt: current.renewalUrgentAt,
    };
  }

  const renewalWindowStartsAt = new Date(expiresAtMs - 120 * 24 * 60 * 60 * 1000).toISOString();
  const renewalUrgentAt = new Date(expiresAtMs - 60 * 24 * 60 * 60 * 1000).toISOString();
  const now = Date.now();

  if (renewalSubmittedAt) {
    return {
      renewalStatus: 'submitted' as const,
      renewalWindowStartsAt,
      renewalUrgentAt,
    };
  }

  if (expiresAtMs <= now) {
    return {
      renewalStatus: 'expired' as const,
      renewalWindowStartsAt,
      renewalUrgentAt,
    };
  }

  if (Date.parse(renewalUrgentAt) <= now) {
    return {
      renewalStatus: 'urgent' as const,
      renewalWindowStartsAt,
      renewalUrgentAt,
    };
  }

  if (Date.parse(renewalWindowStartsAt) <= now) {
    return {
      renewalStatus: 'window_open' as const,
      renewalWindowStartsAt,
      renewalUrgentAt,
    };
  }

  return {
    renewalStatus: 'active' as const,
    renewalWindowStartsAt,
    renewalUrgentAt,
  };
}

function buildPatternFlags(state: OwnerPortalPreviewState): OwnerWorkspacePatternFlag[] {
  const activePromotions = getActivePromotions(state.promotions, state.ownerClaim.dispensaryId);
  const openReports = state.recentReports.filter((report) => report.moderationStatus === 'open');
  const lowRatingWithoutReply = state.recentReviews.find(
    (review) => review.isLowRating && !review.ownerReply,
  );

  const flags: OwnerWorkspacePatternFlag[] = [];

  if (activePromotions.length) {
    flags.push({
      id: 'preview-promo-live',
      title: 'A preview deal is live in Browse right now',
      body: 'Use this to verify hot-deal presentation, placement, and detail sync before touching a real storefront.',
      tone: 'success',
    });
  }

  if (lowRatingWithoutReply) {
    flags.push({
      id: 'preview-review-reply',
      title: 'One review still needs an owner reply',
      body: 'Reply from the preview inbox to verify the owner-response flow and the customer detail surface together.',
      tone: 'warning',
    });
  }

  if (openReports.length) {
    flags.push({
      id: 'preview-report-open',
      title: `${openReports.length} report${openReports.length === 1 ? '' : 's'} still open`,
      body: 'Use the preview report inbox to check moderation messaging without touching live data.',
      tone: 'info',
    });
  }

  if (!flags.length) {
    flags.push({
      id: 'preview-ready',
      title: 'Preview storefront is ready for owner testing',
      body: 'Create a deal, update profile tools, or reply to a review and then confirm the storefront surfaces update end to end.',
      tone: 'success',
    });
  }

  return flags;
}

function buildWorkspace(state: OwnerPortalPreviewState): OwnerPortalWorkspaceDocument {
  const claimedSummary = buildClaimedStorefrontSummary(state);
  const recentReviews = cloneValue(state.recentReviews);
  const averageRating = recentReviews.length
    ? Number(
        (
          recentReviews.reduce((sum, review) => sum + review.rating, 0) / recentReviews.length
        ).toFixed(1),
      )
    : ownerPortalPreviewWorkspace.metrics.averageRating;
  const openReports = state.recentReports.filter((report) => report.moderationStatus === 'open');
  const promotions = state.promotions.map((promotion) => ({
    ...promotion,
    status: derivePromotionStatus(promotion),
  }));

  return {
    ownerProfile: cloneValue(state.ownerProfile),
    ownerClaim: cloneValue(state.ownerClaim),
    storefrontSummary: {
      id: claimedSummary.id,
      displayName: claimedSummary.displayName,
      addressLine1: claimedSummary.addressLine1,
      city: claimedSummary.city,
      state: claimedSummary.state,
      zip: claimedSummary.zip,
      promotionText: claimedSummary.promotionText ?? null,
      promotionBadges: [...(claimedSummary.promotionBadges ?? [])],
    },
    metrics: {
      ...cloneValue(ownerPortalPreviewWorkspace.metrics),
      reviewCount30d: recentReviews.length,
      openReportCount: openReports.length,
      averageRating,
    },
    patternFlags: buildPatternFlags(state),
    recentReviews,
    recentReports: cloneValue(state.recentReports),
    promotions,
    promotionPerformance: sanitizePromotionPerformance(promotions, state.promotionPerformance),
    profileTools: cloneValue(state.profileTools),
    licenseCompliance: cloneValue(state.licenseCompliance),
    ownerAlertStatus: cloneValue(state.ownerAlertStatus),
    runtimeStatus: cloneValue(ownerPortalPreviewWorkspace.runtimeStatus),
  };
}

async function updatePreviewState<T>(mutator: (state: OwnerPortalPreviewState) => T | Promise<T>) {
  const currentState = cloneValue(await initializePreviewState());
  const result = await mutator(currentState);
  const nextState = sanitizePreviewState(currentState);
  await persistPreviewState(nextState);
  return result;
}

export async function getOwnerPortalPreviewWorkspace() {
  const state = await initializePreviewState();
  return buildWorkspace(state);
}

export async function getOwnerPortalPreviewProfile() {
  return cloneValue((await initializePreviewState()).ownerProfile);
}

export async function getOwnerPortalPreviewClaim() {
  return cloneValue((await initializePreviewState()).ownerClaim);
}

export async function getOwnerPortalPreviewStorefrontSummaries() {
  return buildPreviewCatalog(await initializePreviewState());
}

export async function getOwnerPortalPreviewStorefrontSummary(storefrontId: string) {
  return (
    (await getOwnerPortalPreviewStorefrontSummaries()).find(
      (storefront) => storefront.id === storefrontId,
    ) ?? null
  );
}

export async function getOwnerPortalPreviewClaimedStorefrontSummary() {
  return getOwnerPortalPreviewStorefrontSummary(
    (await initializePreviewState()).ownerClaim.dispensaryId,
  );
}

export async function getOwnerPortalPreviewStorefrontDetails(storefrontId: string) {
  return buildPreviewDetails(await initializePreviewState(), storefrontId);
}

export async function isOwnerPortalPreviewStorefrontId(storefrontId: string) {
  return Boolean(await getOwnerPortalPreviewStorefrontSummary(storefrontId));
}

export async function saveOwnerPortalPreviewLicenseCompliance(
  input: OwnerPortalLicenseComplianceInput,
) {
  return updatePreviewState(async (state) => {
    const nextExpiresAt =
      input.expiresAt !== undefined ? input.expiresAt : state.licenseCompliance.expiresAt;
    const nextRenewalSubmittedAt =
      input.renewalSubmittedAt !== undefined
        ? input.renewalSubmittedAt
        : state.licenseCompliance.renewalSubmittedAt;
    const derived = deriveLicenseComplianceState(
      state.licenseCompliance,
      nextExpiresAt ?? null,
      nextRenewalSubmittedAt ?? null,
    );

    state.licenseCompliance = {
      ...state.licenseCompliance,
      ...(input.licenseNumber !== undefined ? { licenseNumber: input.licenseNumber.trim() } : null),
      ...(input.licenseType !== undefined ? { licenseType: input.licenseType.trim() } : null),
      ...(input.issuedAt !== undefined ? { issuedAt: input.issuedAt } : null),
      ...(input.expiresAt !== undefined ? { expiresAt: input.expiresAt } : null),
      ...(input.renewalSubmittedAt !== undefined
        ? { renewalSubmittedAt: input.renewalSubmittedAt }
        : null),
      ...(input.notes !== undefined ? { notes: input.notes } : null),
      ...derived,
      source: 'owner_input',
      updatedAt: new Date().toISOString(),
    };

    return cloneValue(state.licenseCompliance);
  });
}

export async function saveOwnerPortalPreviewProfileTools(input: OwnerPortalProfileToolsInput) {
  return updatePreviewState(async (state) => {
    state.profileTools = {
      ...state.profileTools,
      ...(input.menuUrl !== undefined ? { menuUrl: input.menuUrl } : null),
      ...(input.featuredPhotoUrls !== undefined
        ? { featuredPhotoUrls: [...input.featuredPhotoUrls] }
        : null),
      ...(input.cardPhotoUrl !== undefined ? { cardPhotoUrl: input.cardPhotoUrl } : null),
      ...(input.featuredPhotoPaths !== undefined
        ? { featuredPhotoPaths: [...input.featuredPhotoPaths] }
        : null),
      ...(input.cardPhotoPath !== undefined ? { cardPhotoPath: input.cardPhotoPath } : null),
      ...(input.verifiedBadgeLabel !== undefined
        ? { verifiedBadgeLabel: input.verifiedBadgeLabel }
        : null),
      ...(input.featuredBadges !== undefined
        ? { featuredBadges: [...input.featuredBadges] }
        : null),
      ...(input.cardSummary !== undefined ? { cardSummary: input.cardSummary } : null),
      updatedAt: new Date().toISOString(),
    };

    return cloneValue(state.profileTools);
  });
}

function createPreviewPromotionId() {
  return `owner-preview-promo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

const MAX_PREVIEW_PROMOTIONS = 5;

export async function createOwnerPortalPreviewPromotion(input: OwnerPortalPromotionInput) {
  return updatePreviewState(async (state) => {
    const nonExpiredCount = state.promotions.filter(
      (p) => derivePromotionStatus(p) !== 'expired',
    ).length;

    if (nonExpiredCount >= MAX_PREVIEW_PROMOTIONS) {
      throw new Error(
        `You can have up to ${MAX_PREVIEW_PROMOTIONS} active or scheduled promotions at a time. Archive or let an existing deal expire first.`,
      );
    }

    const nowIso = new Date().toISOString();
    const promotion: OwnerStorefrontPromotionDocument = {
      id: createPreviewPromotionId(),
      storefrontId: state.ownerClaim.dispensaryId,
      ownerUid: OWNER_PORTAL_PREVIEW_UID,
      title: input.title.trim(),
      description: input.description.trim(),
      badges: [...input.badges],
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      status: derivePromotionStatus(input),
      audiences: input.audiences,
      alertFollowersOnStart: input.alertFollowersOnStart,
      cardTone: input.cardTone,
      placementSurfaces: [...input.placementSurfaces],
      placementScope: input.placementScope,
      followersAlertedAt: null,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    state.promotions = [promotion, ...state.promotions].map((entry) => ({
      ...entry,
      status: derivePromotionStatus(entry),
    }));
    state.promotionPerformance = sanitizePromotionPerformance(state.promotions, [
      createPromotionPerformanceSeed(promotion),
      ...state.promotionPerformance,
    ]);

    return cloneValue(promotion);
  });
}

export async function updateOwnerPortalPreviewPromotion(
  promotionId: string,
  input: OwnerPortalPromotionInput,
) {
  return updatePreviewState(async (state) => {
    const promotionIndex = state.promotions.findIndex((promotion) => promotion.id === promotionId);
    if (promotionIndex < 0) {
      throw new Error('Unable to find that preview promotion.');
    }

    const nextPromotion: OwnerStorefrontPromotionDocument = {
      ...state.promotions[promotionIndex],
      title: input.title.trim(),
      description: input.description.trim(),
      badges: [...input.badges],
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      status: derivePromotionStatus(input),
      audiences: input.audiences,
      alertFollowersOnStart: input.alertFollowersOnStart,
      cardTone: input.cardTone,
      placementSurfaces: [...input.placementSurfaces],
      placementScope: input.placementScope,
      updatedAt: new Date().toISOString(),
    };

    state.promotions[promotionIndex] = nextPromotion;
    state.promotionPerformance = sanitizePromotionPerformance(
      state.promotions.map((promotion, index) =>
        index === promotionIndex ? nextPromotion : promotion,
      ),
      state.promotionPerformance,
    );

    return cloneValue(nextPromotion);
  });
}

export async function deleteOwnerPortalPreviewPromotion(promotionId: string) {
  return updatePreviewState(async (state) => {
    const promotionIndex = state.promotions.findIndex((p) => p.id === promotionId);
    if (promotionIndex < 0) {
      throw new Error('Unable to find that preview promotion.');
    }

    state.promotions.splice(promotionIndex, 1);
    return { deleted: true, promotionId };
  });
}

export async function replyToOwnerPortalPreviewReview(reviewId: string, text: string) {
  return updatePreviewState(async (state) => {
    const reviewIndex = state.recentReviews.findIndex((review) => review.id === reviewId);
    if (reviewIndex < 0) {
      throw new Error('Unable to find that preview review.');
    }

    const currentReview = state.recentReviews[reviewIndex];
    const nextReview: OwnerWorkspaceReviewRecord = {
      ...currentReview,
      ownerReply: {
        ownerUid: OWNER_PORTAL_PREVIEW_UID,
        ownerDisplayName: state.ownerProfile.companyName,
        text: text.trim(),
        respondedAt: new Date().toISOString(),
      },
    };
    state.recentReviews[reviewIndex] = nextReview;
    return cloneValue(nextReview);
  });
}

export async function syncOwnerPortalPreviewAlerts() {
  return updatePreviewState(async (state) => {
    state.ownerAlertStatus = {
      pushEnabled: true,
      updatedAt: new Date().toISOString(),
    };
    return cloneValue(state.ownerAlertStatus);
  });
}

export async function resetOwnerPortalPreviewState() {
  const seededState = createSeedState();
  await persistPreviewState(seededState);
  return buildWorkspace(seededState);
}

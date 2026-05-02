import { CollectionReference, Query } from 'firebase-admin/firestore';
import {
  StorefrontDetailDocument,
  StorefrontSummaryDocument,
} from '../../../src/types/firestoreDocuments';
import { getBackendFirebaseDb } from '../firebase';
import { StorefrontDetailApiDocument, StorefrontSummaryApiDocument } from '../types';
import { getStorefrontAppReviewAggregates } from '../services/storefrontCommunityService';
import { ROUTE_STATE_COLLECTION } from '../constants/collections';
import {
  applyOriginMetrics,
  createNearbySummaryCacheKey,
  createSummaryScopeCacheKey,
  filterByRadius,
  isNearbySummaryQuery,
  paginateSummaries,
  selectNearestSummaryPage,
  sortSummaries,
} from './shared';
import { computeOpenNowFromHours } from '../utils/storefrontOperationalStatus';
import { StorefrontBackendSource, StorefrontSummaryQuery } from './types';

const SUMMARY_COLLECTION = 'storefront_summaries';
const DETAILS_COLLECTION = 'storefront_details';
const SCOPED_SUMMARY_TTL_MS = 20_000;
const MATERIALIZED_SUMMARY_TTL_MS = 15 * 60_000;
const NEARBY_SUMMARY_TTL_MS = 90_000;

// Live follower count is computed by querying route_state for profiles
// whose savedStorefrontIds array contains the storefront. The stored
// `favoriteFollowerCount` field on storefront_summaries is never
// incremented anywhere in the codebase, so reading it directly always
// returned null/0 even when real saves existed. Cache the live count
// for 5 min so storefront detail requests don't hammer route_state.
const FOLLOWER_COUNT_TTL_MS = 5 * 60_000;
const followerCountCache = new Map<string, { expiresAt: number; count: number }>();
const followerCountInFlight = new Map<string, Promise<number>>();

async function fetchLiveFollowerCount(storefrontId: string): Promise<number> {
  const db = getBackendFirebaseDb();
  if (!db) return 0;
  const snapshot = await db
    .collection(ROUTE_STATE_COLLECTION)
    .where('savedStorefrontIds', 'array-contains', storefrontId)
    .get();
  return snapshot.size;
}

async function getLiveFollowerCount(storefrontId: string): Promise<number> {
  const now = Date.now();
  const cached = followerCountCache.get(storefrontId);
  if (cached && cached.expiresAt > now) {
    return cached.count;
  }
  const inFlight = followerCountInFlight.get(storefrontId);
  if (inFlight) return inFlight;
  const promise = (async () => {
    try {
      const count = await fetchLiveFollowerCount(storefrontId);
      followerCountCache.set(storefrontId, {
        expiresAt: Date.now() + FOLLOWER_COUNT_TTL_MS,
        count,
      });
      return count;
    } finally {
      followerCountInFlight.delete(storefrontId);
    }
  })();
  followerCountInFlight.set(storefrontId, promise);
  return promise;
}
const scopedSummaryCache = new Map<
  string,
  { expiresAt: number; items: StorefrontSummaryApiDocument[] }
>();
const scopedSummaryInFlight = new Map<string, Promise<StorefrontSummaryApiDocument[]>>();
const nearbySummaryCache = new Map<
  string,
  { expiresAt: number; page: ReturnType<typeof selectNearestSummaryPage> }
>();
const nearbySummaryInFlight = new Map<
  string,
  Promise<ReturnType<typeof selectNearestSummaryPage>>
>();
let materializedSummaryCache: { expiresAt: number; items: StorefrontSummaryApiDocument[] } | null =
  null;
let materializedSummaryInFlight: Promise<StorefrontSummaryApiDocument[]> | null = null;

type StorefrontVisibilityScopedDocument = {
  visibilityScope?: string | null;
};

export function clearFirestoreStorefrontSourceCache() {
  followerCountCache.clear();
  followerCountInFlight.clear();
  scopedSummaryCache.clear();
  scopedSummaryInFlight.clear();
  nearbySummaryCache.clear();
  nearbySummaryInFlight.clear();
  materializedSummaryCache = null;
  materializedSummaryInFlight = null;
}

export function isOwnerPrivateStorefrontDocument(
  document?: StorefrontVisibilityScopedDocument | null,
) {
  return document?.visibilityScope === 'owner_private';
}

function applySearch(items: StorefrontSummaryApiDocument[], searchQuery?: string) {
  const query = searchQuery?.trim().toLowerCase();
  if (!query) {
    return items;
  }

  return items.filter((item) => {
    const haystack = [
      item.displayName,
      item.legalName,
      item.addressLine1,
      item.city,
      item.zip,
      item.promotionText ?? '',
    ]
      .join(' ')
      .toLowerCase();

    return haystack.includes(query);
  });
}

function toSummaryDocument(
  storefrontId: string,
  document: StorefrontSummaryDocument,
): StorefrontSummaryApiDocument {
  return {
    id: storefrontId,
    licenseId: document.licenseId,
    marketId: document.marketId,
    displayName: document.displayName,
    legalName: document.legalName,
    addressLine1: document.addressLine1,
    city: document.city,
    state: 'NY',
    zip: document.zip,
    latitude: document.latitude,
    longitude: document.longitude,
    distanceMiles: document.distanceMiles,
    travelMinutes: document.travelMinutes,
    rating: document.rating,
    reviewCount: document.reviewCount,
    openNow:
      computeOpenNowFromHours(document.hours?.length ? document.hours : null) ?? document.openNow,
    hours: document.hours?.length ? [...document.hours] : [],
    isVerified: document.isVerified,
    mapPreviewLabel: document.mapPreviewLabel,
    promotionText: document.promotionText ?? null,
    promotionBadges: document.promotionBadges ?? [],
    promotionExpiresAt: document.promotionExpiresAt ?? null,
    activePromotionId: document.activePromotionId ?? null,
    favoriteFollowerCount: document.favoriteFollowerCount ?? null,
    menuUrl: document.menuUrl ?? null,
    verifiedOwnerBadgeLabel: document.verifiedOwnerBadgeLabel ?? null,
    ownerFeaturedBadges: document.ownerFeaturedBadges ?? [],
    ownerCardSummary: document.ownerCardSummary ?? null,
    premiumCardVariant: document.premiumCardVariant ?? 'standard',
    promotionPlacementSurfaces: document.promotionPlacementSurfaces ?? [],
    promotionPlacementScope: document.promotionPlacementScope ?? null,
    placeId: document.placeId,
    thumbnailUrl: document.thumbnailUrl ?? null,
  };
}

export function applyAppReviewAggregateFallback(
  summary: StorefrontSummaryApiDocument,
  aggregate?: { reviewCount: number; averageRating: number } | null,
) {
  if (!aggregate || aggregate.reviewCount <= 0) {
    return summary;
  }

  if (summary.reviewCount > 0 && summary.rating > 0) {
    return summary;
  }

  return {
    ...summary,
    reviewCount: aggregate.reviewCount,
    rating: aggregate.averageRating,
  };
}

function hasNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function hasBooleanOrNull(value: unknown): value is boolean | null {
  return typeof value === 'boolean' || value === null;
}

export function isCompleteStorefrontSummaryDocument(
  document: Partial<StorefrontSummaryDocument> | undefined,
) {
  if (!document) {
    return false;
  }

  return (
    hasNonEmptyString(document.licenseId) &&
    hasNonEmptyString(document.marketId) &&
    hasNonEmptyString(document.displayName) &&
    hasNonEmptyString(document.legalName) &&
    hasNonEmptyString(document.addressLine1) &&
    hasNonEmptyString(document.city) &&
    hasNonEmptyString(document.state) &&
    hasNonEmptyString(document.zip) &&
    hasFiniteNumber(document.latitude) &&
    hasFiniteNumber(document.longitude) &&
    hasFiniteNumber(document.distanceMiles) &&
    hasFiniteNumber(document.travelMinutes) &&
    hasFiniteNumber(document.rating) &&
    hasFiniteNumber(document.reviewCount) &&
    hasBooleanOrNull(document.openNow) &&
    typeof document.isVerified === 'boolean' &&
    hasNonEmptyString(document.mapPreviewLabel)
  );
}

export function seedFirestoreStorefrontSourceCacheForTests() {
  if (process.env.NODE_ENV !== 'test') {
    return;
  }

  const expiresAt = Date.now() + 60_000;
  const items: StorefrontSummaryApiDocument[] = [
    {
      id: 'test-storefront',
      licenseId: 'license-1',
      marketId: 'nyc',
      displayName: 'Canopy Trove Test',
      legalName: 'Canopy Trove Test',
      addressLine1: '1 Example Ave',
      city: 'New York',
      state: 'NY',
      zip: '10001',
      latitude: 40.75,
      longitude: -73.99,
      distanceMiles: 1.2,
      travelMinutes: 6,
      rating: 4.8,
      reviewCount: 12,
      openNow: true,
      isVerified: true,
      mapPreviewLabel: '1.2 mi route preview',
      promotionText: null,
      promotionBadges: [],
      promotionExpiresAt: null,
      activePromotionId: null,
      favoriteFollowerCount: null,
      menuUrl: null,
      verifiedOwnerBadgeLabel: null,
      ownerFeaturedBadges: [],
      ownerCardSummary: null,
      premiumCardVariant: 'standard',
      promotionPlacementSurfaces: [],
      promotionPlacementScope: null,
      placeId: undefined,
      thumbnailUrl: null,
    },
  ];

  scopedSummaryCache.set('test-scope', {
    expiresAt,
    items,
  });
  scopedSummaryInFlight.set('test-scope', Promise.resolve(items));
  nearbySummaryCache.set('test-nearby', {
    expiresAt,
    page: {
      items,
      total: items.length,
      limit: items.length,
      offset: 0,
    },
  });
  nearbySummaryInFlight.set(
    'test-nearby',
    Promise.resolve({
      items,
      total: items.length,
      limit: items.length,
      offset: 0,
    }),
  );
  materializedSummaryCache = {
    expiresAt,
    items,
  };
  materializedSummaryInFlight = Promise.resolve(items);
}

export function getFirestoreStorefrontSourceCacheStateForTests() {
  return {
    scopedSummaryCacheSize: scopedSummaryCache.size,
    scopedSummaryInFlightSize: scopedSummaryInFlight.size,
    nearbySummaryCacheSize: nearbySummaryCache.size,
    nearbySummaryInFlightSize: nearbySummaryInFlight.size,
    hasMaterializedSummaryCache: Boolean(materializedSummaryCache),
    hasMaterializedSummaryInFlight: Boolean(materializedSummaryInFlight),
  };
}

function toDetailDocument(
  storefrontId: string,
  document: StorefrontDetailDocument,
): StorefrontDetailApiDocument {
  return {
    storefrontId,
    phone: document.phone,
    website: document.website,
    hours: [...document.hours],
    openNow: typeof document.openNow === 'boolean' ? document.openNow : null,
    hasOwnerClaim: document.hasOwnerClaim ?? false,
    menuUrl: document.menuUrl ?? null,
    verifiedOwnerBadgeLabel: document.verifiedOwnerBadgeLabel ?? null,
    favoriteFollowerCount: document.favoriteFollowerCount ?? null,
    ownerFeaturedBadges: document.ownerFeaturedBadges ?? [],
    appReviewCount: document.appReviewCount,
    appReviews: document.appReviews.map((review) => ({
      ...review,
      authorProfileId: review.authorProfileId ?? null,
      isOwnReview: review.isOwnReview ?? false,
      tags: [...review.tags],
      helpfulCount: review.helpfulCount ?? 0,
      ownerReply: review.ownerReply ?? null,
    })),
    photoUrls: [...document.photoUrls],
    amenities: [...document.amenities],
    editorialSummary: document.editorialSummary,
    routeMode: document.routeMode,
  };
}

async function getSummarySnapshots(
  buildQuery?: (
    collectionRef: CollectionReference<StorefrontSummaryDocument>,
  ) => Query<StorefrontSummaryDocument> | CollectionReference<StorefrontSummaryDocument>,
) {
  const db = getBackendFirebaseDb();
  if (!db) {
    return [];
  }

  const collectionRef = db.collection(
    SUMMARY_COLLECTION,
  ) as CollectionReference<StorefrontSummaryDocument>;
  const target = buildQuery ? buildQuery(collectionRef) : collectionRef;
  const snapshots = await target.get();
  return snapshots.docs
    .map((snapshot) => ({
      id: snapshot.id,
      data: snapshot.data(),
    }))
    .filter(
      ({ data }) =>
        isCompleteStorefrontSummaryDocument(data) && !isOwnerPrivateStorefrontDocument(data),
    )
    .map(({ id, data }) => toSummaryDocument(id, data as StorefrontSummaryDocument));
}

function refreshMaterializedSummaries() {
  if (materializedSummaryInFlight) {
    return materializedSummaryInFlight;
  }

  materializedSummaryInFlight = (async () => {
    const items = await getSummarySnapshots();
    materializedSummaryCache = {
      items,
      expiresAt: Date.now() + MATERIALIZED_SUMMARY_TTL_MS,
    };
    materializedSummaryInFlight = null;
    return items;
  })().catch((error) => {
    materializedSummaryInFlight = null;
    throw error;
  });

  return materializedSummaryInFlight;
}

async function getMaterializedSummaries() {
  if (materializedSummaryCache) {
    if (materializedSummaryCache.expiresAt > Date.now()) {
      return materializedSummaryCache.items;
    }

    return refreshMaterializedSummaries();
  }

  return refreshMaterializedSummaries();
}

async function buildScopedSummaries(
  sourceQuery: StorefrontSummaryQuery,
): Promise<StorefrontSummaryApiDocument[]> {
  const areaId = sourceQuery.areaId;
  const searchQuery = sourceQuery.searchQuery;
  const origin = sourceQuery.origin;
  const radiusMiles = sourceQuery.radiusMiles;
  const sortKey = sourceQuery.sortKey;
  const [baseSummaries, appReviewAggregates] = await Promise.all([
    getMaterializedSummaries(),
    getStorefrontAppReviewAggregates(),
  ]);
  const allSummaries = baseSummaries.map((summary) =>
    applyAppReviewAggregateFallback(summary, appReviewAggregates.get(summary.id)),
  );
  const scopedSummaries = areaId
    ? allSummaries.filter((summary) => summary.marketId === areaId)
    : allSummaries;

  return sortSummaries(
    filterByRadius(
      applyOriginMetrics(applySearch(scopedSummaries, searchQuery), origin),
      origin,
      radiusMiles,
    ),
    sortKey,
  );
}

async function getScopedSummaries(sourceQuery: StorefrontSummaryQuery) {
  const cacheKey = createSummaryScopeCacheKey(sourceQuery);
  const cached = scopedSummaryCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.items;
  }

  const pending = scopedSummaryInFlight.get(cacheKey);
  if (pending) {
    return pending;
  }

  const task = (async () => {
    const items = await buildScopedSummaries(sourceQuery);
    scopedSummaryCache.set(cacheKey, {
      items,
      expiresAt: Date.now() + SCOPED_SUMMARY_TTL_MS,
    });
    return items;
  })();

  scopedSummaryInFlight.set(cacheKey, task);

  try {
    return await task;
  } finally {
    scopedSummaryInFlight.delete(cacheKey);
  }
}

async function getNearbySummaryPage(sourceQuery: StorefrontSummaryQuery) {
  const cacheKey = createNearbySummaryCacheKey(sourceQuery);
  const cached = nearbySummaryCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.page;
  }

  const pending = nearbySummaryInFlight.get(cacheKey);
  if (pending) {
    return pending;
  }

  const task = (async () => {
    const [baseSummaries, appReviewAggregates] = await Promise.all([
      getMaterializedSummaries(),
      getStorefrontAppReviewAggregates(),
    ]);
    const allSummaries = baseSummaries.map((summary) =>
      applyAppReviewAggregateFallback(summary, appReviewAggregates.get(summary.id)),
    );
    const scopedSummaries = sourceQuery.areaId
      ? allSummaries.filter((summary) => summary.marketId === sourceQuery.areaId)
      : allSummaries;
    const page = selectNearestSummaryPage(
      scopedSummaries,
      sourceQuery.origin!,
      sourceQuery.radiusMiles!,
      sourceQuery.limit!,
    );

    nearbySummaryCache.set(cacheKey, {
      page,
      expiresAt: Date.now() + NEARBY_SUMMARY_TTL_MS,
    });

    return page;
  })();

  nearbySummaryInFlight.set(cacheKey, task);

  try {
    return await task;
  } finally {
    nearbySummaryInFlight.delete(cacheKey);
  }
}

export const firestoreStorefrontSource: StorefrontBackendSource = {
  async getAllSummaries() {
    const [baseSummaries, appReviewAggregates] = await Promise.all([
      getMaterializedSummaries(),
      getStorefrontAppReviewAggregates(),
    ]);
    return baseSummaries.map((summary) =>
      applyAppReviewAggregateFallback(summary, appReviewAggregates.get(summary.id)),
    );
  },

  async getSummariesByIds(ids) {
    if (!ids.length) {
      return [];
    }
    const idSet = new Set(ids);
    return (await this.getAllSummaries()).filter((summary) => idSet.has(summary.id));
  },

  async getSummaryPage(sourceQuery) {
    if (isNearbySummaryQuery(sourceQuery)) {
      return getNearbySummaryPage(sourceQuery);
    }

    return paginateSummaries(
      await getScopedSummaries(sourceQuery),
      sourceQuery.limit,
      sourceQuery.offset,
    );
  },

  async getSummaries(sourceQuery) {
    return (await this.getSummaryPage(sourceQuery)).items;
  },

  async getDetailsById(storefrontId) {
    const db = getBackendFirebaseDb();
    if (!db) {
      return null;
    }

    const collectionRef = db.collection(
      DETAILS_COLLECTION,
    ) as CollectionReference<StorefrontDetailDocument>;
    const snapshot = await collectionRef.doc(storefrontId).get();
    if (!snapshot.exists) {
      return null;
    }

    const data = snapshot.data() as StorefrontDetailDocument;
    if (isOwnerPrivateStorefrontDocument(data)) {
      return null;
    }

    // Live-compute favoriteFollowerCount via route_state (5-min cache).
    // The stored `favoriteFollowerCount` field on storefront_details is
    // never written, so without this the public storefront detail page
    // shows null forever for every shop. Fail-soft: if the count query
    // throws, fall back to the stored value (still null in practice).
    let liveFollowerCount: number | null = null;
    try {
      liveFollowerCount = await getLiveFollowerCount(snapshot.id);
    } catch {
      liveFollowerCount = null;
    }
    const enriched: StorefrontDetailDocument = {
      ...data,
      favoriteFollowerCount: liveFollowerCount ?? data.favoriteFollowerCount ?? null,
    };

    return toDetailDocument(snapshot.id, enriched);
  },
};

export async function warmFirestoreStorefrontSource() {
  await getMaterializedSummaries();
}

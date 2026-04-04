import { CollectionReference, Query } from 'firebase-admin/firestore';
import {
  StorefrontDetailDocument,
  StorefrontSummaryDocument,
} from '../../../src/types/firestoreDocuments';
import { getBackendFirebaseDb } from '../firebase';
import { StorefrontDetailApiDocument, StorefrontSummaryApiDocument } from '../types';
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
import { StorefrontBackendSource, StorefrontSummaryQuery } from './types';

const SUMMARY_COLLECTION = 'storefront_summaries';
const DETAILS_COLLECTION = 'storefront_details';
const SCOPED_SUMMARY_TTL_MS = 20_000;
const MATERIALIZED_SUMMARY_TTL_MS = 5 * 60_000;
const NEARBY_SUMMARY_TTL_MS = 90_000;
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

export function clearFirestoreStorefrontSourceCache() {
  scopedSummaryCache.clear();
  scopedSummaryInFlight.clear();
  nearbySummaryCache.clear();
  nearbySummaryInFlight.clear();
  materializedSummaryCache = null;
  materializedSummaryInFlight = null;
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
    openNow: document.openNow,
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
    .filter(({ data }) => isCompleteStorefrontSummaryDocument(data))
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
  const allSummaries = await getMaterializedSummaries();
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
    const allSummaries = await getMaterializedSummaries();
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
    return getMaterializedSummaries();
  },

  async getSummariesByIds(ids) {
    if (!ids.length) {
      return [];
    }
    const idSet = new Set(ids);
    return (await getMaterializedSummaries()).filter((summary) => idSet.has(summary.id));
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

    return toDetailDocument(snapshot.id, snapshot.data() as StorefrontDetailDocument);
  },
};

export async function warmFirestoreStorefrontSource() {
  await getMaterializedSummaries();
}

import type { QueryConstraint } from 'firebase/firestore';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import {
  fromStorefrontDetailDocument,
  fromStorefrontSummaryDocument,
} from '../adapters/firestoreDocumentAdapter';
import { getFirebaseDb } from '../config/firebase';
import type { StorefrontSummary } from '../types/storefront';
import type { StorefrontSourceSummaryQuery } from './storefrontSource';
import {
  applySearch,
  filterByRadius,
  getSearchNarrowing,
  milesToLatitudeDelta,
  milesToLongitudeDelta,
} from './firebaseStorefrontQueryUtils';

const SUMMARY_COLLECTION = 'storefront_summaries';
const DETAILS_COLLECTION = 'storefront_details';

async function getSummarySnapshots(constraints: QueryConstraint[]) {
  const db = getFirebaseDb();
  if (!db) {
    return [];
  }

  const snapshots = await getDocs(query(collection(db, SUMMARY_COLLECTION), ...constraints));
  return snapshots.docs.map((snapshot) =>
    fromStorefrontSummaryDocument(snapshot.id, snapshot.data() as Record<string, unknown>),
  );
}

export async function getAllFirebaseSummaries() {
  const db = getFirebaseDb();
  if (!db) {
    return [];
  }

  const snapshots = await getDocs(collection(db, SUMMARY_COLLECTION));
  return snapshots.docs.map((snapshot) =>
    fromStorefrontSummaryDocument(snapshot.id, snapshot.data() as Record<string, unknown>),
  );
}

export async function getFirebaseSummariesByIds(storefrontIds: string[]) {
  if (!storefrontIds.length) {
    return [];
  }

  const db = getFirebaseDb();
  if (!db) {
    return [];
  }

  const summaries = await Promise.all(
    storefrontIds.map(async (storefrontId) => {
      const snapshot = await getDoc(doc(db, SUMMARY_COLLECTION, storefrontId));
      if (!snapshot.exists()) {
        return null;
      }

      return fromStorefrontSummaryDocument(snapshot.id, snapshot.data() as Record<string, unknown>);
    }),
  );

  return summaries.filter((summary): summary is StorefrontSummary => Boolean(summary));
}

export async function getFilteredFirebaseSummaries(sourceQuery?: StorefrontSourceSummaryQuery) {
  const db = getFirebaseDb();
  if (!db) {
    return [];
  }

  const areaId = sourceQuery?.areaId;
  const searchQuery = sourceQuery?.searchQuery;
  const searchNarrowing = getSearchNarrowing(searchQuery);
  const origin = sourceQuery?.origin;
  const radiusMiles = sourceQuery?.radiusMiles;

  if (!origin || !radiusMiles) {
    const baseConstraints = areaId ? [where('marketId', '==', areaId)] : [];
    if (searchNarrowing.zip) {
      baseConstraints.push(where('zip', '==', searchNarrowing.zip));
    } else if (searchNarrowing.city) {
      baseConstraints.push(where('city', '==', searchNarrowing.city));
    }
    return applySearch(await getSummarySnapshots(baseConstraints), searchQuery);
  }

  const latitudeDelta = milesToLatitudeDelta(radiusMiles);
  const longitudeDelta = milesToLongitudeDelta(radiusMiles, origin.latitude);
  const baseConstraints: QueryConstraint[] = [
    where('latitude', '>=', origin.latitude - latitudeDelta),
    where('latitude', '<=', origin.latitude + latitudeDelta),
  ];
  if (searchNarrowing.zip) {
    baseConstraints.push(where('zip', '==', searchNarrowing.zip));
  } else if (searchNarrowing.city) {
    baseConstraints.push(where('city', '==', searchNarrowing.city));
  }
  const areaConstraints = areaId
    ? [where('marketId', '==', areaId), ...baseConstraints]
    : baseConstraints;

  const boundingFilter = (summary: StorefrontSummary) =>
    summary.coordinates.longitude >= origin.longitude - longitudeDelta &&
    summary.coordinates.longitude <= origin.longitude + longitudeDelta;

  try {
    return filterByRadius(
      applySearch((await getSummarySnapshots(areaConstraints)).filter(boundingFilter), searchQuery),
      origin,
      radiusMiles,
    );
  } catch {
    try {
      return filterByRadius(
        applySearch(
          (await getSummarySnapshots(baseConstraints)).filter(boundingFilter),
          searchQuery,
        ),
        origin,
        radiusMiles,
      );
    } catch {
      const allSummaries = await getDocs(collection(db, SUMMARY_COLLECTION));
      return filterByRadius(
        applySearch(
          allSummaries.docs.map((snapshot) =>
            fromStorefrontSummaryDocument(snapshot.id, snapshot.data() as Record<string, unknown>),
          ),
          searchQuery,
        ),
        origin,
        radiusMiles,
      );
    }
  }
}

export async function getFirebaseDetailsById(storefrontId: string) {
  const db = getFirebaseDb();
  if (!db) {
    return null;
  }

  const snapshot = await getDoc(doc(db, DETAILS_COLLECTION, storefrontId));
  if (!snapshot.exists()) {
    return null;
  }

  return fromStorefrontDetailDocument(snapshot.id, snapshot.data() as Record<string, unknown>);
}

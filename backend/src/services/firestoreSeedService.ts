import {
  mockStorefrontDetailDocuments,
  mockStorefrontSummaryDocuments,
} from '../../../src/data/mockFirestoreSeed';
import { getBackendFirebaseDb } from '../firebase';
import {
  deleteSeedOperationsInBatches,
  writeSeedOperationsInBatches,
} from './backendSeedWriterService';
import { COLLECTIONS } from '../constants/collections';

export function getBackendSeedCounts() {
  return {
    summaryCount: Object.keys(mockStorefrontSummaryDocuments).length,
    detailCount: Object.keys(mockStorefrontDetailDocuments).length,
  };
}

async function seedCollections() {
  const db = getBackendFirebaseDb();
  if (!db) {
    throw new Error('Backend Firebase config is missing.');
  }

  const expectedSummaryIds = new Set(Object.keys(mockStorefrontSummaryDocuments));
  const expectedDetailIds = new Set(Object.keys(mockStorefrontDetailDocuments));

  // Safe to fetch all docs without .limit() since seedCollections are bounded by mock data size (~627 docs)
  // and the function needs ALL docs to diff against expected mock data.
  const [existingSummarySnapshots, existingDetailSnapshots] = await Promise.all([
    db.collection(COLLECTIONS.STOREFRONT_SUMMARIES).get(),
    db.collection(COLLECTIONS.STOREFRONT_DETAILS).get(),
  ]);

  const staleOperations = [
    ...existingSummarySnapshots.docs
      .filter((documentSnapshot) => {
        const storefrontId = documentSnapshot.id;
        if (expectedSummaryIds.has(storefrontId)) {
          return false;
        }

        return documentSnapshot.data()?.ingestSource !== 'registry';
      })
      .map((documentSnapshot) => documentSnapshot.id)
      .map((storefrontId) => ({
        collectionName: COLLECTIONS.STOREFRONT_SUMMARIES,
        storefrontId,
      })),
    ...existingDetailSnapshots.docs
      .filter((documentSnapshot) => {
        const storefrontId = documentSnapshot.id;
        if (expectedDetailIds.has(storefrontId)) {
          return false;
        }

        return documentSnapshot.data()?.ingestSource !== 'registry';
      })
      .map((documentSnapshot) => documentSnapshot.id)
      .map((storefrontId) => ({
        collectionName: COLLECTIONS.STOREFRONT_DETAILS,
        storefrontId,
      })),
  ];

  if (staleOperations.length) {
    await deleteSeedOperationsInBatches(db, staleOperations);
  }

  await writeSeedOperationsInBatches(db, [
    ...Object.entries(mockStorefrontSummaryDocuments).map(([storefrontId, documentData]) => ({
      collectionName: 'storefront_summaries' as const,
      storefrontId,
      documentData,
    })),
    ...Object.entries(mockStorefrontDetailDocuments).map(([storefrontId, documentData]) => ({
      collectionName: 'storefront_details' as const,
      storefrontId,
      documentData,
    })),
  ]);

  return getBackendSeedCounts();
}

export async function seedBackendFirestoreCollections() {
  return seedCollections();
}

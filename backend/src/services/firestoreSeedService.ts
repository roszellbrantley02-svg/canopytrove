import {
  mockStorefrontDetailDocuments,
  mockStorefrontSummaryDocuments,
} from '../../../src/data/mockFirestoreSeed';
import { getBackendFirebaseDb } from '../firebase';
import {
  deleteSeedOperationsInBatches,
  writeSeedOperationsInBatches,
} from './backendSeedWriterService';

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

  const [existingSummarySnapshots, existingDetailSnapshots] = await Promise.all([
    db.collection('storefront_summaries').listDocuments(),
    db.collection('storefront_details').listDocuments(),
  ]);

  const staleOperations = [
    ...existingSummarySnapshots
      .map((docRef) => docRef.id)
      .filter((storefrontId) => !expectedSummaryIds.has(storefrontId))
      .map((storefrontId) => ({
        collectionName: 'storefront_summaries' as const,
        storefrontId,
      })),
    ...existingDetailSnapshots
      .map((docRef) => docRef.id)
      .filter((storefrontId) => !expectedDetailIds.has(storefrontId))
      .map((storefrontId) => ({
        collectionName: 'storefront_details' as const,
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

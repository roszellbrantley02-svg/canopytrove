import type { Firestore } from 'firebase/firestore';
import {
  mockStorefrontDetailDocuments,
  mockStorefrontSummaryDocuments,
} from '../data/mockFirestoreSeed';
import { seedStorefrontCollections } from './storefrontSeedService';

export function getMockFirestoreSeedCounts() {
  return {
    summaryCount: Object.keys(mockStorefrontSummaryDocuments).length,
    detailCount: Object.keys(mockStorefrontDetailDocuments).length,
  };
}

export function getMockFirestoreSeedPayload() {
  return {
    storefrontSummaries: mockStorefrontSummaryDocuments,
    storefrontDetails: mockStorefrontDetailDocuments,
  };
}

export async function seedMockStorefrontCollections(db: Firestore) {
  await seedStorefrontCollections(db, {
    storefrontSummaries: mockStorefrontSummaryDocuments,
    storefrontDetails: mockStorefrontDetailDocuments,
  });

  return getMockFirestoreSeedCounts();
}

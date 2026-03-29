import { Firestore, collection, doc, writeBatch } from 'firebase/firestore';
import { StorefrontDetailDocument, StorefrontSummaryDocument } from '../types/firestoreDocuments';

const MAX_BATCH_WRITES = 450;

type SeedPayload = {
  storefrontSummaries: Record<string, StorefrontSummaryDocument>;
  storefrontDetails: Record<string, StorefrontDetailDocument>;
};

function toSeedOperations(payload: SeedPayload) {
  return [
    ...Object.entries(payload.storefrontSummaries).map(([storefrontId, documentData]) => ({
      collectionName: 'storefront_summaries',
      storefrontId,
      documentData,
    })),
    ...Object.entries(payload.storefrontDetails).map(([storefrontId, documentData]) => ({
      collectionName: 'storefront_details',
      storefrontId,
      documentData,
    })),
  ];
}

export async function seedStorefrontCollections(
  db: Firestore,
  payload: SeedPayload
) {
  const operations = toSeedOperations(payload);

  for (let index = 0; index < operations.length; index += MAX_BATCH_WRITES) {
    const batch = writeBatch(db);
    const batchOperations = operations.slice(index, index + MAX_BATCH_WRITES);

    batchOperations.forEach((operation) => {
      batch.set(
        doc(collection(db, operation.collectionName), operation.storefrontId),
        operation.documentData
      );
    });

    await batch.commit();
  }
}

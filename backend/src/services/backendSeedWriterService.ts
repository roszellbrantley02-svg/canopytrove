const MAX_BATCH_WRITES = 450;

type SeedOperation = {
  collectionName: 'storefront_summaries' | 'storefront_details';
  storefrontId: string;
  documentData: Record<string, unknown>;
};

type DeleteOperation = {
  collectionName: 'storefront_summaries' | 'storefront_details';
  storefrontId: string;
};

export async function writeSeedOperationsInBatches(
  db: FirebaseFirestore.Firestore,
  operations: SeedOperation[]
) {
  for (let index = 0; index < operations.length; index += MAX_BATCH_WRITES) {
    const batch = db.batch();
    const batchOperations = operations.slice(index, index + MAX_BATCH_WRITES);

    batchOperations.forEach((operation) => {
      batch.set(
        db.collection(operation.collectionName).doc(operation.storefrontId),
        operation.documentData
      );
    });

    await batch.commit();
  }
}

export async function deleteSeedOperationsInBatches(
  db: FirebaseFirestore.Firestore,
  operations: DeleteOperation[]
) {
  for (let index = 0; index < operations.length; index += MAX_BATCH_WRITES) {
    const batch = db.batch();
    const batchOperations = operations.slice(index, index + MAX_BATCH_WRITES);

    batchOperations.forEach((operation) => {
      batch.delete(db.collection(operation.collectionName).doc(operation.storefrontId));
    });

    await batch.commit();
  }
}

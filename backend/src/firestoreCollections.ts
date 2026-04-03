import { CollectionReference } from 'firebase-admin/firestore';
import { getBackendFirebaseDb } from './firebase';

export function getOptionalFirestoreCollection<T>(
  collectionName: string
): CollectionReference<T> | null {
  const db = getBackendFirebaseDb();
  if (!db) {
    return null;
  }

  return db.collection(collectionName) as CollectionReference<T>;
}

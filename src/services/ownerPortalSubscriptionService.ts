import { doc, getDoc } from 'firebase/firestore';
import { getFirebaseDb } from '../config/firebase';
import type { OwnerPortalSubscriptionDocument } from '../types/ownerPortal';
import { ensureOwnerPortalSessionReady } from './ownerPortalSessionService';

const SUBSCRIPTIONS_COLLECTION = 'subscriptions';

function getOwnerSubscriptionDb() {
  const db = getFirebaseDb();
  if (!db) {
    throw new Error('Firebase is not configured.');
  }

  return db;
}

export async function activateOwnerPrelaunchTrial(ownerUid: string, dispensaryId: string) {
  void ownerUid;
  void dispensaryId;
  throw new Error(
    'Prelaunch trials must be activated by the billing backend, not from the client app.',
  );
}

export async function getOwnerSubscription(ownerUid: string) {
  await ensureOwnerPortalSessionReady();
  const db = getOwnerSubscriptionDb();
  const subscriptionRef = doc(db, SUBSCRIPTIONS_COLLECTION, ownerUid);
  const snapshot = await getDoc(subscriptionRef);
  if (!snapshot.exists()) {
    return null;
  }

  return snapshot.data() as OwnerPortalSubscriptionDocument;
}

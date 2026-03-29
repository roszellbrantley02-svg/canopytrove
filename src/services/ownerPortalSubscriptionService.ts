import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getFirebaseDb } from '../config/firebase';
import { OwnerPortalSubscriptionDocument } from '../types/ownerPortal';

const SUBSCRIPTIONS_COLLECTION = 'subscriptions';
const OWNER_PROFILES_COLLECTION = 'ownerProfiles';

function getOwnerSubscriptionDb() {
  const db = getFirebaseDb();
  if (!db) {
    throw new Error('Firebase is not configured.');
  }

  return db;
}

function createNow() {
  return new Date().toISOString();
}

function createFutureDate(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

export async function activateOwnerPrelaunchTrial(ownerUid: string, dispensaryId: string) {
  const db = getOwnerSubscriptionDb();
  const now = createNow();
  const subscriptionDocument: OwnerPortalSubscriptionDocument = {
    ownerUid,
    dispensaryId,
    provider: 'internal_prelaunch',
    externalSubscriptionId: null,
    planId: 'owner-prelaunch',
    status: 'trial',
    billingCycle: 'monthly',
    currentPeriodStart: now,
    currentPeriodEnd: createFutureDate(30),
    cancelAtPeriodEnd: false,
    createdAt: now,
    updatedAt: now,
  };

  await Promise.all([
    setDoc(doc(db, SUBSCRIPTIONS_COLLECTION, ownerUid), subscriptionDocument),
    setDoc(
      doc(db, OWNER_PROFILES_COLLECTION, ownerUid),
      {
        subscriptionStatus: 'trial',
        onboardingStep: 'completed',
        updatedAt: now,
      },
      { merge: true }
    ),
  ]);

  return subscriptionDocument;
}

export async function getOwnerSubscription(ownerUid: string) {
  const db = getOwnerSubscriptionDb();
  const subscriptionRef = doc(db, SUBSCRIPTIONS_COLLECTION, ownerUid);
  const snapshot = await getDoc(subscriptionRef);
  if (!snapshot.exists()) {
    return null;
  }

  return snapshot.data() as OwnerPortalSubscriptionDocument;
}

import { CollectionReference } from 'firebase-admin/firestore';
import { getBackendFirebaseDb } from '../firebase';

const DISPENSARY_CLAIMS_COLLECTION = 'dispensaryClaims';
const CLAIM_STATUS_CACHE_TTL_MS = 5 * 60_000;

type ClaimPresenceCacheEntry = {
  expiresAt: number;
  value: boolean;
};

type ClaimDocument = {
  dispensaryId?: string;
  claimStatus?: string | null;
};

const claimPresenceCache = new Map<string, ClaimPresenceCacheEntry>();
const claimPresenceInFlight = new Map<string, Promise<boolean>>();

function isFresh(entry?: ClaimPresenceCacheEntry) {
  return Boolean(entry && entry.expiresAt > Date.now());
}

export async function hasStorefrontOwnerClaim(storefrontId: string) {
  const cached = claimPresenceCache.get(storefrontId);
  if (isFresh(cached)) {
    return cached!.value;
  }

  const pending = claimPresenceInFlight.get(storefrontId);
  if (pending) {
    return pending;
  }

  const task = (async () => {
    const db = getBackendFirebaseDb();
    if (!db) {
      return false;
    }

    const claimsRef = db.collection(DISPENSARY_CLAIMS_COLLECTION) as CollectionReference<ClaimDocument>;
    const snapshot = await claimsRef.where('dispensaryId', '==', storefrontId).limit(5).get();
    const hasClaim = snapshot.docs.some((document) => {
      const claimStatus = document.data().claimStatus?.trim().toLowerCase();
      return claimStatus === 'approved';
    });

    claimPresenceCache.set(storefrontId, {
      value: hasClaim,
      expiresAt: Date.now() + CLAIM_STATUS_CACHE_TTL_MS,
    });

    return hasClaim;
  })();

  claimPresenceInFlight.set(storefrontId, task);

  try {
    return await task;
  } finally {
    claimPresenceInFlight.delete(storefrontId);
  }
}

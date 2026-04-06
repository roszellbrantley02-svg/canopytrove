import { getOptionalFirestoreCollection } from '../firestoreCollections';

export type UsernameChangeRequest = {
  id: string;
  profileId: string;
  accountId: string;
  currentDisplayName: string | null;
  requestedDisplayName: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  reviewedAt: string | null;
};

const COLLECTION_NAME = 'usernameChangeRequests';
const requestStore = new Map<string, UsernameChangeRequest>();

function getCollection() {
  return getOptionalFirestoreCollection<UsernameChangeRequest>(COLLECTION_NAME);
}

function createRequestId(profileId: string) {
  return `ucr-${profileId.slice(-8)}-${Date.now().toString(36)}`;
}

export async function submitUsernameChangeRequest(
  profileId: string,
  accountId: string,
  currentDisplayName: string | null,
  requestedDisplayName: string,
): Promise<UsernameChangeRequest> {
  const collectionRef = getCollection();
  const now = new Date().toISOString();

  // Check for an existing pending request from this profile.
  if (collectionRef) {
    const pendingSnapshot = await collectionRef
      .where('profileId', '==', profileId)
      .where('status', '==', 'pending')
      .limit(1)
      .get();

    if (!pendingSnapshot.empty) {
      throw new Error(
        'You already have a pending username request. Please wait for it to be reviewed.',
      );
    }
  } else {
    const existing = Array.from(requestStore.values()).find(
      (r) => r.profileId === profileId && r.status === 'pending',
    );
    if (existing) {
      throw new Error(
        'You already have a pending username request. Please wait for it to be reviewed.',
      );
    }
  }

  const request: UsernameChangeRequest = {
    id: createRequestId(profileId),
    profileId,
    accountId,
    currentDisplayName,
    requestedDisplayName: requestedDisplayName.trim(),
    status: 'pending',
    createdAt: now,
    reviewedAt: null,
  };

  if (collectionRef) {
    await collectionRef.doc(request.id).set(request);
  } else {
    requestStore.set(request.id, request);
  }

  return request;
}

export async function getPendingRequestForProfile(
  profileId: string,
): Promise<UsernameChangeRequest | null> {
  const collectionRef = getCollection();

  if (collectionRef) {
    const snapshot = await collectionRef
      .where('profileId', '==', profileId)
      .where('status', '==', 'pending')
      .limit(1)
      .get();

    return snapshot.empty ? null : (snapshot.docs[0].data() as UsernameChangeRequest);
  }

  return (
    Array.from(requestStore.values()).find(
      (r) => r.profileId === profileId && r.status === 'pending',
    ) ?? null
  );
}

export async function listPendingRequests(limit = 50): Promise<UsernameChangeRequest[]> {
  const collectionRef = getCollection();

  if (collectionRef) {
    const snapshot = await collectionRef
      .where('status', '==', 'pending')
      .orderBy('createdAt', 'asc')
      .limit(limit)
      .get();

    return snapshot.docs.map((doc) => doc.data() as UsernameChangeRequest);
  }

  return Array.from(requestStore.values())
    .filter((r) => r.status === 'pending')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .slice(0, limit);
}

export async function reviewUsernameRequest(
  requestId: string,
  decision: 'approved' | 'rejected',
): Promise<UsernameChangeRequest | null> {
  const collectionRef = getCollection();
  const now = new Date().toISOString();

  if (collectionRef) {
    const docRef = collectionRef.doc(requestId);
    const snapshot = await docRef.get();
    if (!snapshot.exists) return null;

    const request = snapshot.data() as UsernameChangeRequest;
    const updated: UsernameChangeRequest = {
      ...request,
      status: decision,
      reviewedAt: now,
    };
    await docRef.set(updated);
    return updated;
  }

  const request = requestStore.get(requestId);
  if (!request) return null;

  const updated: UsernameChangeRequest = {
    ...request,
    status: decision,
    reviewedAt: now,
  };
  requestStore.set(requestId, updated);
  return updated;
}

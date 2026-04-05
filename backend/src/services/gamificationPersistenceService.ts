import { getOptionalFirestoreCollection } from '../firestoreCollections';
import { StorefrontGamificationStateApiDocument } from '../types';
import {
  createDefaultGamificationStateDocument,
  normalizeGamificationStateDocument,
} from './gamificationStateService';

const GAMIFICATION_STATE_COLLECTION = 'gamification_state';

const gamificationStateStore = new Map<string, StorefrontGamificationStateApiDocument>();

function getGamificationStateCollection() {
  return getOptionalFirestoreCollection<StorefrontGamificationStateApiDocument>(
    GAMIFICATION_STATE_COLLECTION,
  );
}

export async function getGamificationState(profileId: string, joinedDate?: string | null) {
  const collectionRef = getGamificationStateCollection();
  if (collectionRef) {
    const snapshot = await collectionRef.doc(profileId).get();
    if (!snapshot.exists) {
      return createDefaultGamificationStateDocument(profileId, joinedDate);
    }

    return normalizeGamificationStateDocument(
      profileId,
      snapshot.data() as StorefrontGamificationStateApiDocument,
      joinedDate,
    );
  }

  return (
    gamificationStateStore.get(profileId) ??
    createDefaultGamificationStateDocument(profileId, joinedDate)
  );
}

export async function saveGamificationState(
  profileId: string,
  gamificationState: Partial<StorefrontGamificationStateApiDocument> | undefined,
  joinedDate?: string | null,
) {
  const normalizedState = normalizeGamificationStateDocument(
    profileId,
    gamificationState,
    joinedDate,
  );
  const collectionRef = getGamificationStateCollection();

  if (collectionRef) {
    await collectionRef.doc(profileId).set(normalizedState);
    return normalizedState;
  }

  gamificationStateStore.set(profileId, normalizedState);
  return normalizedState;
}

export async function deleteGamificationState(profileId: string) {
  const collectionRef = getGamificationStateCollection();
  if (collectionRef) {
    await collectionRef.doc(profileId).delete();
    return true;
  }

  return gamificationStateStore.delete(profileId);
}

export async function listGamificationStates(limit = 100, startAfter?: string) {
  const collectionRef = getGamificationStateCollection();
  if (collectionRef) {
    let query = collectionRef.orderBy('__name__').limit(limit);

    if (startAfter) {
      const startAfterDoc = await collectionRef.doc(startAfter).get();
      if (startAfterDoc.exists) {
        query = query.startAfter(startAfterDoc);
      }
    }

    const snapshot = await query.get();
    return snapshot.docs.map((documentSnapshot) =>
      normalizeGamificationStateDocument(
        documentSnapshot.id,
        documentSnapshot.data() as StorefrontGamificationStateApiDocument,
      ),
    );
  }

  const states = Array.from(gamificationStateStore.values());
  let filtered = states.sort((a, b) => a.profileId.localeCompare(b.profileId));

  if (startAfter) {
    const startIndex = filtered.findIndex((s) => s.profileId === startAfter);
    filtered = filtered.slice(startIndex + 1);
  }

  return filtered
    .slice(0, limit)
    .map((state) => normalizeGamificationStateDocument(state.profileId, state));
}

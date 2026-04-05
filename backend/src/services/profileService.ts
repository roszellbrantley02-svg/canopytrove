import { getOptionalFirestoreCollection } from '../firestoreCollections';
import { AppProfileApiDocument } from '../types';

const PROFILE_COLLECTION = 'profiles';

const profileStore = new Map<string, AppProfileApiDocument>();

function getProfileCollection() {
  return getOptionalFirestoreCollection<AppProfileApiDocument>(PROFILE_COLLECTION);
}

function createDefaultProfile(profileId: string): AppProfileApiDocument {
  const now = new Date().toISOString();
  return {
    id: profileId,
    kind: 'anonymous',
    accountId: null,
    displayName: null,
    createdAt: now,
    updatedAt: now,
  };
}

function normalizeProfile(profile: AppProfileApiDocument): AppProfileApiDocument {
  return {
    id: profile.id,
    kind: profile.kind === 'authenticated' ? 'authenticated' : 'anonymous',
    accountId: typeof profile.accountId === 'string' ? profile.accountId : null,
    displayName: typeof profile.displayName === 'string' ? profile.displayName : null,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
}

export async function getProfile(profileId: string) {
  const collectionRef = getProfileCollection();
  if (collectionRef) {
    const snapshot = await collectionRef.doc(profileId).get();
    if (!snapshot.exists) {
      return createDefaultProfile(profileId);
    }

    return normalizeProfile(snapshot.data() as AppProfileApiDocument);
  }

  return profileStore.get(profileId) ?? createDefaultProfile(profileId);
}

export async function saveProfile(profile: AppProfileApiDocument) {
  const normalizedProfile = normalizeProfile(profile);
  const collectionRef = getProfileCollection();
  if (collectionRef) {
    await collectionRef.doc(profile.id).set(normalizedProfile);
    return normalizedProfile;
  }

  profileStore.set(profile.id, normalizedProfile);
  return normalizedProfile;
}

export async function deleteProfile(profileId: string) {
  const collectionRef = getProfileCollection();
  if (collectionRef) {
    await collectionRef.doc(profileId).delete();
    return true;
  }

  return profileStore.delete(profileId);
}

export async function listProfiles(limit = 100, startAfter?: string) {
  const collectionRef = getProfileCollection();
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
      normalizeProfile(documentSnapshot.data() as AppProfileApiDocument),
    );
  }

  const profiles = Array.from(profileStore.values());
  let filtered = profiles.sort((a, b) => a.id.localeCompare(b.id));

  if (startAfter) {
    const startIndex = filtered.findIndex((p) => p.id === startAfter);
    filtered = filtered.slice(startIndex + 1);
  }

  return filtered.slice(0, limit).map(normalizeProfile);
}

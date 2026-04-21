import { getOptionalFirestoreCollection } from '../firestoreCollections';
import { AppProfileApiDocument } from '../types';
import { sanitizePublicDisplayName } from '../http/publicIdentity';
import { getGamificationState } from './gamificationPersistenceService';

const PROFILE_COLLECTION = 'profiles';

const profileStore = new Map<string, AppProfileApiDocument>();

export function clearProfileMemoryStateForTests() {
  profileStore.clear();
}

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
    displayName: sanitizePublicDisplayName(profile.displayName),
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
}

export async function getProfile(profileId: string) {
  return (await getProfileRecord(profileId)).profile;
}

export async function getProfileRecord(profileId: string): Promise<{
  profile: AppProfileApiDocument;
  exists: boolean;
}> {
  const collectionRef = getProfileCollection();
  if (collectionRef) {
    const snapshot = await collectionRef.doc(profileId).get();
    if (!snapshot.exists) {
      return {
        profile: createDefaultProfile(profileId),
        exists: false,
      };
    }

    return {
      profile: normalizeProfile(snapshot.data() as AppProfileApiDocument),
      exists: true,
    };
  }

  if (profileStore.has(profileId)) {
    return {
      profile: normalizeProfile(profileStore.get(profileId) as AppProfileApiDocument),
      exists: true,
    };
  }

  return {
    profile: createDefaultProfile(profileId),
    exists: false,
  };
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

export async function listProfilesByAccountId(accountId: string) {
  const normalizedAccountId = accountId.trim();
  if (!normalizedAccountId) {
    return [];
  }

  const collectionRef = getProfileCollection();
  if (collectionRef) {
    const snapshot = await collectionRef.where('accountId', '==', normalizedAccountId).get();
    return snapshot.docs.map((documentSnapshot) =>
      normalizeProfile(documentSnapshot.data() as AppProfileApiDocument),
    );
  }

  return Array.from(profileStore.values())
    .map(normalizeProfile)
    .filter((profile) => profile.accountId === normalizedAccountId);
}

type CanonicalProfileCandidate = {
  profile: AppProfileApiDocument;
  totalPoints: number;
  totalReviews: number;
  dispensariesVisited: number;
  badgeCount: number;
};

function compareCanonicalProfileCandidates(
  left: CanonicalProfileCandidate,
  right: CanonicalProfileCandidate,
) {
  if (right.totalPoints !== left.totalPoints) {
    return right.totalPoints - left.totalPoints;
  }

  if (right.totalReviews !== left.totalReviews) {
    return right.totalReviews - left.totalReviews;
  }

  if (right.dispensariesVisited !== left.dispensariesVisited) {
    return right.dispensariesVisited - left.dispensariesVisited;
  }

  if (right.badgeCount !== left.badgeCount) {
    return right.badgeCount - left.badgeCount;
  }

  if (left.profile.createdAt !== right.profile.createdAt) {
    return left.profile.createdAt.localeCompare(right.profile.createdAt);
  }

  return left.profile.id.localeCompare(right.profile.id);
}

export async function getCanonicalProfileForAccount(accountId: string) {
  const profiles = await listProfilesByAccountId(accountId);
  if (!profiles.length) {
    return null;
  }

  const candidates = await Promise.all(
    profiles.map(async (profile) => {
      const gamificationState = await getGamificationState(profile.id, profile.createdAt);
      return {
        profile,
        totalPoints: gamificationState.totalPoints,
        totalReviews: gamificationState.totalReviews,
        dispensariesVisited: gamificationState.dispensariesVisited,
        badgeCount: gamificationState.badges.length,
      } satisfies CanonicalProfileCandidate;
    }),
  );

  candidates.sort(compareCanonicalProfileCandidates);
  return candidates[0]?.profile ?? null;
}

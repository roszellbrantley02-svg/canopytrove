/**
 * Favorite Brand Service
 *
 * Manages user's favorite brands.
 * Firestore path: profiles/{profileId}/favoriteBrands/{brandId}
 *
 * Enforces:
 * - Uniqueness per profile/brandId pair
 * - Requires authenticated profileId
 * - Soft fail on missing brands (no validation against seed data)
 */

import { getOptionalFirestoreCollection } from '../firestoreCollections';
import { logger } from '../observability/logger';
import type { FavoriteBrandEntry } from '../types';

type FavoriteBrandDoc = {
  brandId: string;
  displayName: string;
  savedAt: string;
  note?: string;
};

/**
 * Get the subcollection reference for a profile's favorite brands.
 */
function getFavoriteBrandsCollection(profileId: string) {
  const db = getOptionalFirestoreCollection<FavoriteBrandDoc>(
    `profiles/${profileId}/favoriteBrands`,
  );
  return db;
}

/**
 * Add a brand to the user's favorites.
 * If already saved, this is a no-op (upsert behavior).
 */
export async function addFavoriteBrand(
  profileId: string,
  brandId: string,
  displayName?: string,
): Promise<FavoriteBrandEntry> {
  const collection = getFavoriteBrandsCollection(profileId);
  if (!collection) {
    logger.warn('[favoriteBrandService] Firestore not available for addFavoriteBrand', {
      profileId,
      brandId,
    });
    return {
      brandId,
      displayName: displayName || brandId,
      savedAt: new Date().toISOString(),
    };
  }

  const now = new Date().toISOString();
  const entry: FavoriteBrandDoc = {
    brandId,
    displayName: displayName || brandId,
    savedAt: now,
  };

  await collection.doc(brandId).set(entry, { merge: true });

  return {
    brandId: entry.brandId,
    displayName: entry.displayName,
    savedAt: entry.savedAt,
    note: entry.note,
  };
}

/**
 * Remove a brand from the user's favorites.
 */
export async function removeFavoriteBrand(profileId: string, brandId: string): Promise<boolean> {
  const collection = getFavoriteBrandsCollection(profileId);
  if (!collection) {
    logger.warn('[favoriteBrandService] Firestore not available for removeFavoriteBrand', {
      profileId,
      brandId,
    });
    return true;
  }

  await collection.doc(brandId).delete();
  return true;
}

/**
 * Check if a brand is in the user's favorites.
 */
export async function isFavoriteBrand(profileId: string, brandId: string): Promise<boolean> {
  const collection = getFavoriteBrandsCollection(profileId);
  if (!collection) {
    return false;
  }

  const doc = await collection.doc(brandId).get();
  return doc.exists;
}

/**
 * List all favorite brands for a user.
 * Sorted by savedAt descending (newest first).
 */
export async function listFavoriteBrands(profileId: string): Promise<FavoriteBrandEntry[]> {
  const collection = getFavoriteBrandsCollection(profileId);
  if (!collection) {
    logger.warn('[favoriteBrandService] Firestore not available for listFavoriteBrands', {
      profileId,
    });
    return [];
  }

  try {
    const snapshot = await collection.orderBy('savedAt', 'desc').get();

    const results: FavoriteBrandEntry[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data() as FavoriteBrandDoc;
      results.push({
        brandId: data.brandId,
        displayName: data.displayName,
        savedAt: data.savedAt,
        note: data.note,
      });
    });

    return results;
  } catch (err) {
    logger.error('[favoriteBrandService] Failed to list favorite brands', {
      profileId,
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

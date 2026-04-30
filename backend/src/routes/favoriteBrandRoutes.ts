import { Router } from 'express';
import { serverConfig } from '../config';
import { createRateLimitMiddleware } from '../http/rateLimit';
import { parseProfileIdParam } from '../http/validation';
import { parseAddFavoriteBrandBody, parseBrandIdParam } from '../http/validationFavoriteBrands';
import {
  ensureAuthenticatedProfileWriteAccess,
  ensureProfileReadAccess,
} from '../services/profileAccessService';
import {
  addFavoriteBrand,
  removeFavoriteBrand,
  listFavoriteBrands,
} from '../services/favoriteBrandService';
import {
  getBrandProfile,
  listBrandProfiles,
  sortBrandProfiles,
  getSmellFilterOptions,
  getTasteFilterOptions,
} from '../services/brandProfileService';
import { listStorefrontsCarryingBrand } from '../services/ownerStorefrontBrandsService';
import { logger } from '../observability/logger';

export const favoriteBrandRoutes = Router();

// Rate limiting for write operations
favoriteBrandRoutes.use(
  createRateLimitMiddleware({
    name: 'favorite-brand-write',
    windowMs: 60_000,
    max: serverConfig.writeRateLimitPerMinute,
    methods: ['POST', 'DELETE'],
  }),
);

/**
 * POST /profile/favorite-brands
 *
 * Add a brand to user's favorites (authenticated only).
 */
favoriteBrandRoutes.post('/profile/favorite-brands', async (request, response) => {
  try {
    const body = parseAddFavoriteBrandBody(request.body);
    const authHeader = request.header('authorization')?.trim();

    if (!authHeader) {
      response.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Extract profileId from auth (in real scenario this would be from auth context)
    // For now, we'll get it from a test header or session
    // This endpoint requires the client to pass their profileId somehow
    // For this implementation, we'll require it in the body or header
    const profileIdFromHeader = request.header('x-canopy-profile-id')?.trim();
    if (!profileIdFromHeader) {
      response.status(400).json({ error: 'Profile ID required (x-canopy-profile-id header)' });
      return;
    }

    const profileId = parseProfileIdParam(profileIdFromHeader);

    // Verify auth for this profile
    await ensureAuthenticatedProfileWriteAccess(request, profileId);

    // Get brand info for display name
    const brandProfile = await getBrandProfile(body.brandId);

    const entry = await addFavoriteBrand(profileId, body.brandId, brandProfile.displayName);

    response.status(201).json(entry);
  } catch (error) {
    logger.error('[favoriteBrandRoutes] POST /profile/favorite-brands error', {
      error: error instanceof Error ? error.message : String(error),
    });
    const isValidationError =
      error instanceof Error && error.message.toLowerCase().startsWith('invalid');
    response.status(isValidationError ? 400 : 500).json({
      error: isValidationError ? error.message : 'Failed to add favorite brand',
    });
  }
});

/**
 * DELETE /profile/favorite-brands/:brandId
 *
 * Remove a brand from user's favorites (authenticated only).
 */
favoriteBrandRoutes.delete('/profile/favorite-brands/:brandId', async (request, response) => {
  try {
    const brandId = parseBrandIdParam(request.params.brandId);
    const profileIdFromHeader = request.header('x-canopy-profile-id')?.trim();

    if (!profileIdFromHeader) {
      response.status(400).json({ error: 'Profile ID required (x-canopy-profile-id header)' });
      return;
    }

    const profileId = parseProfileIdParam(profileIdFromHeader);

    // Verify auth for this profile
    await ensureAuthenticatedProfileWriteAccess(request, profileId);

    await removeFavoriteBrand(profileId, brandId);

    response.status(204).send();
  } catch (error) {
    logger.error('[favoriteBrandRoutes] DELETE /profile/favorite-brands/:brandId error', {
      error: error instanceof Error ? error.message : String(error),
    });
    const isValidationError =
      error instanceof Error && error.message.toLowerCase().startsWith('invalid');
    response.status(isValidationError ? 400 : 500).json({
      error: isValidationError ? error.message : 'Failed to remove favorite brand',
    });
  }
});

/**
 * GET /profile/favorite-brands
 *
 * List user's favorite brands with merged BrandProfileSummary data (authenticated only).
 */
favoriteBrandRoutes.get('/profile/favorite-brands', async (request, response) => {
  try {
    const profileIdFromHeader = request.header('x-canopy-profile-id')?.trim();

    if (!profileIdFromHeader) {
      response.status(400).json({ error: 'Profile ID required (x-canopy-profile-id header)' });
      return;
    }

    const profileId = parseProfileIdParam(profileIdFromHeader);

    // Favorite brands are a behavioral fingerprint (which brands the user
    // saves) — gate on profile read access so anyone with knowledge of a
    // profileId can't enumerate other users' preferences. Anonymous
    // profiles are still accessible for guest UX.
    await ensureProfileReadAccess(request, profileId);

    const favoriteEntries = await listFavoriteBrands(profileId);

    // Fetch full profiles for each favorite
    const brandProfiles = await Promise.all(
      favoriteEntries.map((entry) => getBrandProfile(entry.brandId)),
    );

    response.json({ brands: brandProfiles });
  } catch (error) {
    logger.error('[favoriteBrandRoutes] GET /profile/favorite-brands error', {
      error: error instanceof Error ? error.message : String(error),
    });
    response.status(500).json({
      error: 'Failed to list favorite brands',
    });
  }
});

/**
 * GET /brands/:brandId/carriers
 *
 * Public endpoint: list storefronts that self-report carrying this brand.
 * Powers the "Where to find it" button on the scan-result + brand screens.
 * Cached response; light rate limit via shared middleware.
 */
favoriteBrandRoutes.get('/brands/:brandId/carriers', async (request, response) => {
  try {
    const brandId = parseBrandIdParam(request.params.brandId);
    const limit = Math.min(parseInt(request.query.limit as string, 10) || 25, 100);
    const carriers = await listStorefrontsCarryingBrand({ brandId, limit });
    response.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    response.json({ brandId, carriers });
  } catch (error) {
    logger.error('[favoriteBrandRoutes] GET /brands/:brandId/carriers error', {
      error: error instanceof Error ? error.message : String(error),
    });
    const isValidationError =
      error instanceof Error && error.message.toLowerCase().startsWith('invalid');
    response.status(isValidationError ? 400 : 500).json({
      error: isValidationError ? error.message : 'Failed to list brand carriers',
    });
  }
});

/**
 * GET /brands/:brandId
 *
 * Get full brand profile (public, App Check gated).
 */
favoriteBrandRoutes.get('/brands/:brandId', async (request, response) => {
  try {
    const brandId = parseBrandIdParam(request.params.brandId);
    const profile = await getBrandProfile(brandId);

    response.json(profile);
  } catch (error) {
    logger.error('[favoriteBrandRoutes] GET /brands/:brandId error', {
      error: error instanceof Error ? error.message : String(error),
    });
    const isValidationError =
      error instanceof Error && error.message.toLowerCase().startsWith('invalid');
    response.status(isValidationError ? 400 : 500).json({
      error: isValidationError ? error.message : 'Failed to get brand profile',
    });
  }
});

/**
 * GET /brands
 *
 * List all brands with optional sorting and filtering (public, App Check gated).
 * Query params:
 *   - sort: 'smell' | 'taste' | 'potency' (default: 'potency')
 *   - filter: tag name to filter by (e.g., 'citrus', 'earthy')
 *   - limit: max results (default: 50, max: 200)
 *   - cursor: pagination cursor
 */
favoriteBrandRoutes.get('/brands', async (request, response) => {
  try {
    const sort = (request.query.sort as string) || 'potency';
    const filter = (request.query.filter as string) || undefined;
    const limit = Math.min(parseInt(request.query.limit as string, 10) || 50, 200);
    const cursor = (request.query.cursor as string) || undefined;

    if (!['smell', 'taste', 'potency'].includes(sort)) {
      response.status(400).json({ error: 'Invalid sort param; must be smell, taste, or potency' });
      return;
    }

    // List all brands
    const { brands, nextCursor } = await listBrandProfiles({
      limit,
      cursor,
    });

    // Fetch full profiles for sorting
    const fullProfiles = await Promise.all(
      brands.map((summary) => getBrandProfile(summary.brandId)),
    );

    // Sort by requested dimension
    const sorted = sortBrandProfiles(fullProfiles, sort as any, filter);

    response.json({
      brands: sorted.map((p) => ({
        brandId: p.brandId,
        displayName: p.displayName,
        aggregateDominantTerpene: p.aggregateDominantTerpene,
        smellTags: p.smellTags,
        tasteTags: p.tasteTags,
        avgThcPercent: p.avgThcPercent,
        contaminantPassRate: p.contaminantPassRate,
        totalScans: p.totalScans,
      })),
      nextCursor,
      filterOptions: {
        smell: sort === 'smell' ? getSmellFilterOptions() : undefined,
        taste: sort === 'taste' ? getTasteFilterOptions() : undefined,
      },
    });
  } catch (error) {
    logger.error('[favoriteBrandRoutes] GET /brands error', {
      error: error instanceof Error ? error.message : String(error),
    });
    response.status(500).json({
      error: 'Failed to list brands',
    });
  }
});

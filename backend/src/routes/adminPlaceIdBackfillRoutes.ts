import { Router, Request, Response } from 'express';
import { getBackendFirebaseDb } from '../firebase';
import { logger } from '../observability/logger';
import { matchPlaceId } from '../services/googlePlacesMatching';
import { getDailyApiBudgetStatus } from '../services/googlePlacesShared';
import { StorefrontSummaryApiDocument } from '../types';
import { computeOpenNowFromHours } from '../utils/storefrontOperationalStatus';

const SUMMARY_COLLECTION = 'storefront_summaries';

const router = Router();

/**
 * GET /admin/place-ids/status
 *
 * Reports how many storefronts have Place IDs vs. how many are missing.
 * No API calls — reads from Firestore only.
 */
router.get('/status', async (_request: Request, response: Response) => {
  try {
    const db = getBackendFirebaseDb();
    if (!db) {
      response.status(503).json({ error: 'Firestore is not available.' });
      return;
    }

    const snapshot = await db.collection(SUMMARY_COLLECTION).get();
    let total = 0;
    let withPlaceId = 0;
    let missing = 0;
    const missingNames: string[] = [];

    snapshot.forEach((doc) => {
      total++;
      const data = doc.data();
      if (data.placeId?.trim()) {
        withPlaceId++;
      } else {
        missing++;
        if (missingNames.length < 20) {
          missingNames.push(`${data.displayName ?? doc.id} (${doc.id})`);
        }
      }
    });

    const budget = getDailyApiBudgetStatus();

    response.json({
      ok: true,
      total,
      withPlaceId,
      missing,
      coverage: total > 0 ? `${Math.round((withPlaceId / total) * 100)}%` : 'N/A',
      missingExamples: missingNames,
      dailyBudget: budget,
      estimatedBackfillCost: `~$${(missing * 3 * 0.032).toFixed(2)} worst case (${missing} storefronts × up to 3 Text Search calls × $0.032/call)`,
    });
  } catch (error) {
    logger.error('[place-id-backfill] Status check failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    response.status(500).json({ error: 'Failed to check Place ID status.' });
  }
});

/**
 * POST /admin/place-ids/backfill
 *
 * One-time backfill of Place IDs for storefronts that don't have one.
 * Runs sequentially with a delay between calls to stay within budget.
 *
 * Query params:
 *   ?dryRun=true  — report what would be done without making API calls
 *   ?limit=10     — max storefronts to process (default 10, max 50)
 *   ?delayMs=2000 — delay between API calls in ms (default 2000)
 */
router.post('/backfill', async (request: Request, response: Response) => {
  try {
    const db = getBackendFirebaseDb();
    if (!db) {
      response.status(503).json({ error: 'Firestore is not available.' });
      return;
    }

    const dryRun = request.query.dryRun === 'true';
    const limit = Math.min(Math.max(Number(request.query.limit) || 10, 1), 50);
    const delayMs = Math.max(Number(request.query.delayMs) || 2000, 500);

    const snapshot = await db.collection(SUMMARY_COLLECTION).get();
    const missingSummaries: Array<{
      id: string;
      displayName: string;
      addressLine1: string;
      city: string;
      zip: string;
      latitude: number;
      longitude: number;
    }> = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      if (!data.placeId?.trim()) {
        missingSummaries.push({
          id: doc.id,
          displayName: data.displayName ?? '',
          addressLine1: data.addressLine1 ?? '',
          city: data.city ?? '',
          zip: data.zip ?? '',
          latitude: data.latitude ?? 0,
          longitude: data.longitude ?? 0,
        });
      }
    });

    const batch = missingSummaries.slice(0, limit);

    if (dryRun) {
      response.json({
        ok: true,
        dryRun: true,
        totalMissing: missingSummaries.length,
        wouldProcess: batch.length,
        storefronts: batch.map((s) => `${s.displayName} (${s.id})`),
        estimatedCost: `~$${(batch.length * 3 * 0.032).toFixed(2)} worst case`,
      });
      return;
    }

    const results: Array<{ id: string; name: string; placeId: string | null; status: string }> = [];

    for (const summary of batch) {
      try {
        const budget = getDailyApiBudgetStatus();
        if (budget.remaining <= 0) {
          results.push({
            id: summary.id,
            name: summary.displayName,
            placeId: null,
            status: 'budget_exhausted',
          });
          break;
        }

        const summaryDoc: StorefrontSummaryApiDocument = {
          id: summary.id,
          licenseId: '',
          marketId: '',
          displayName: summary.displayName,
          legalName: summary.displayName,
          addressLine1: summary.addressLine1,
          city: summary.city,
          state: 'NY',
          zip: summary.zip,
          latitude: summary.latitude,
          longitude: summary.longitude,
          distanceMiles: 0,
          travelMinutes: 0,
          rating: 0,
          reviewCount: 0,
          openNow: null,
          isVerified: false,
          mapPreviewLabel: '',
        };

        const placeId = await matchPlaceId(summaryDoc);

        results.push({
          id: summary.id,
          name: summary.displayName,
          placeId,
          status: placeId ? 'found' : 'not_found',
        });

        logger.info('[place-id-backfill] Processed', {
          storefrontId: summary.id,
          name: summary.displayName,
          placeId,
        });

        // Delay between calls to avoid burst spending
        if (batch.indexOf(summary) < batch.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      } catch (error) {
        results.push({
          id: summary.id,
          name: summary.displayName,
          placeId: null,
          status: `error: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    }

    const found = results.filter((r) => r.status === 'found').length;
    const notFound = results.filter((r) => r.status === 'not_found').length;
    const errors = results.filter((r) => r.status.startsWith('error')).length;
    const budgetStopped = results.filter((r) => r.status === 'budget_exhausted').length;

    response.json({
      ok: true,
      totalMissing: missingSummaries.length,
      processed: results.length,
      found,
      notFound,
      errors,
      budgetStopped,
      remainingToBackfill: missingSummaries.length - found,
      results,
      dailyBudget: getDailyApiBudgetStatus(),
    });
  } catch (error) {
    logger.error('[place-id-backfill] Backfill failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    response.status(500).json({ error: 'Backfill failed.' });
  }
});

/**
 * POST /admin/place-ids/backfill-hours
 *
 * Copies `hours` from each storefront's detail document into its summary
 * document, and recomputes `openNow` from those hours at the current time.
 *
 * Run this once after deploying to fix all existing storefronts that don't
 * yet have hours in their summary doc.
 *
 * Query params:
 *   limit   - max storefronts to process (default 100, max 627)
 *   dryRun  - if "true", reports what would change without writing
 */
router.post('/backfill-hours', async (request: Request, response: Response) => {
  const limit = Math.min(parseInt(String(request.query.limit ?? '100'), 10) || 100, 627);
  const dryRun = request.query.dryRun === 'true';
  const DETAILS_COLLECTION = 'storefront_details';

  try {
    const db = getBackendFirebaseDb();
    if (!db) {
      response.status(503).json({ error: 'Firestore is not available.' });
      return;
    }

    const summarySnap = await db.collection(SUMMARY_COLLECTION).limit(limit).get();
    const results = {
      total: summarySnap.size,
      updated: 0,
      alreadyHasHours: 0,
      noDetailDoc: 0,
      noHoursInDetail: 0,
      dryRun,
    };

    const writes: Promise<unknown>[] = [];

    for (const summaryDoc of summarySnap.docs) {
      const summaryData = summaryDoc.data() as { hours?: string[]; openNow?: boolean | null };

      // Already populated — skip
      if (summaryData.hours && summaryData.hours.length > 0) {
        results.alreadyHasHours++;
        continue;
      }

      const detailSnap = await db.collection(DETAILS_COLLECTION).doc(summaryDoc.id).get();
      if (!detailSnap.exists) {
        results.noDetailDoc++;
        continue;
      }

      const detailData = detailSnap.data() as { hours?: string[] };
      const hours = detailData.hours ?? [];

      if (hours.length === 0) {
        results.noHoursInDetail++;
        continue;
      }

      const recomputedOpenNow = computeOpenNowFromHours(hours);

      if (!dryRun) {
        writes.push(
          summaryDoc.ref.update({
            hours,
            ...(recomputedOpenNow !== null ? { openNow: recomputedOpenNow } : {}),
          }),
        );
      }

      results.updated++;
    }

    await Promise.all(writes);

    logger.info('[hours-backfill] Complete', results as Record<string, unknown>);
    response.json(results);
  } catch (error) {
    logger.error('[hours-backfill] Failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    response.status(500).json({ error: 'Hours backfill failed.' });
  }
});

export { router as adminPlaceIdBackfillRoutes };

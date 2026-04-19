/**
 * Scan Ingestion Routes
 *
 * POST /scans/ingest — public endpoint (App Check gated)
 *
 * Accepts a scanned code and resolves it to:
 *   - license: OCM license info
 *   - product: COA metadata
 *   - unknown: unrecognized code
 *
 * Persists every scan for analytics (no PII).
 * Returns suggested shops (empty until owner portal brand inventory ships).
 */

import { Router } from 'express';
import { z } from 'zod';
import { createAppCheckStrictMiddleware } from '../http/appCheckGuard';
import { createRateLimitMiddleware } from '../http/rateLimit';
import { logger } from '../observability/logger';
import { ingestScan, recordCoaOpened } from '../services/scanIngestionService';
import type { ProductCOA, ScanResolution } from '../types';

export const scanIngestRoutes = Router();

// Strict App Check: scan ingestion accepts anonymous writes, so App Check
// is the only abuse gate we have (beyond the rate limiter). Cannot fall
// back to log-only mode in prod — enforce always.
const scanAppCheck = createAppCheckStrictMiddleware();

// Request validation schema
const ScanIngestRequestSchema = z
  .object({
    rawCode: z.string().min(1).max(2000),
    installId: z.string().min(1).max(200),
    profileId: z.string().min(1).max(200).optional(),
    location: z
      .object({
        lat: z.number().finite(),
        lng: z.number().finite(),
        accuracyMeters: z.number().optional(),
      })
      .optional(),
    nearStorefrontId: z.string().max(100).optional(),
    clientAnalytics: z
      .object({
        eventName: z.string().optional(),
        context: z.record(z.any()).optional(),
      })
      .optional(),
  })
  .strict();

type ScanIngestRequest = z.infer<typeof ScanIngestRequestSchema>;

/**
 * Shape a license resolution for the response.
 */
function shapeLicense(resolution: ScanResolution) {
  if (resolution.kind !== 'license') return null;
  return {
    licenseNumber: resolution.license.licenseNumber,
    licenseType: resolution.license.licenseType,
    licenseeName: resolution.license.licenseeName,
    status: resolution.license.status,
  };
}

/**
 * Shape a COA resolution for the response.
 */
function shapeCoa(resolution: ScanResolution): ProductCOA | null {
  if (resolution.kind !== 'product') return null;
  return resolution.coa;
}

/**
 * POST /scans/ingest
 *
 * Public endpoint for scanning and resolving codes.
 * Rate limited to 30 req/min per IP.
 * App Check gated.
 */
const ingestRateLimiter = createRateLimitMiddleware({
  name: 'scan-ingest',
  windowMs: 60_000,
  max: 30,
  methods: ['POST'],
});

scanIngestRoutes.post('/scans/ingest', scanAppCheck, ingestRateLimiter, async (request, response) => {
  try {
    // Validate request body
    const body = request.body as unknown;
    let validatedBody: ScanIngestRequest;
    try {
      validatedBody = ScanIngestRequestSchema.parse(body);
    } catch (validationError) {
      response.status(400).json({
        ok: false,
        error: 'Invalid request body',
        details: validationError instanceof z.ZodError ? validationError.issues : undefined,
      });
      return;
    }

    // Ingest the scan
    const result = await ingestScan({
      rawCode: validatedBody.rawCode,
      installId: validatedBody.installId,
      profileId: validatedBody.profileId,
      location: validatedBody.location,
      nearStorefrontId: validatedBody.nearStorefrontId,
    });

    // Log client analytics passthrough if present
    if (validatedBody.clientAnalytics) {
      logger.info('[scanIngest] Client analytics event', {
        installId: validatedBody.installId,
        event: validatedBody.clientAnalytics.eventName,
        context: validatedBody.clientAnalytics.context,
      });
    }

    // Shape response
    const payload = {
      ok: true,
      kind: result.resolution.kind,
      license: shapeLicense(result.resolution),
      coa: shapeCoa(result.resolution),
      verificationState:
        result.resolution.kind === 'license' ? result.resolution.verificationState : undefined,
      catalogState:
        result.resolution.kind === 'product' ? result.resolution.catalogState : undefined,
      reason: result.resolution.kind === 'unknown' ? result.resolution.reason : undefined,
      suggestedShops: [] as Array<{
        storefrontId: string;
        name: string;
        distanceMeters: number;
      }>,
      // TODO: wire operator brand inventory when owner portal brands-we-carry lands
    };

    response.setHeader('Cache-Control', 'no-store');
    response.json(payload);

    logger.info('[scanIngest] Ingest completed', {
      installId: validatedBody.installId,
      kind: result.resolution.kind,
      persisted: result.persisted,
    });
  } catch (error) {
    logger.error('[scanIngest] Unexpected error', {
      error: error instanceof Error ? error.message : String(error),
    });
    response.status(500).json({
      ok: false,
      error: 'Internal server error',
    });
  }
});

// Request validation schema for COA opened
const CoaOpenedRequestSchema = z
  .object({
    installId: z.string().min(1).max(200),
    profileId: z.string().min(1).max(200).optional(),
    brandId: z.string().min(1).max(500),
    labName: z.string().min(1).max(200),
    batchId: z.string().max(500).optional(),
  })
  .strict();

type CoaOpenedRequest = z.infer<typeof CoaOpenedRequestSchema>;

/**
 * POST /scans/coa-opened
 *
 * Record that a user opened a full COA.
 * Idempotent: deduped within 60s per batch + install.
 * Rate limited to 60 req/min per IP.
 */
const coaOpenedRateLimiter = createRateLimitMiddleware({
  name: 'coa-opened',
  windowMs: 60_000,
  max: 60,
  methods: ['POST'],
});

scanIngestRoutes.post('/scans/coa-opened', scanAppCheck, coaOpenedRateLimiter, async (request, response) => {
  try {
    // Validate request body
    const body = request.body as unknown;
    let validatedBody: CoaOpenedRequest;
    try {
      validatedBody = CoaOpenedRequestSchema.parse(body);
    } catch (validationError) {
      response.status(400).json({
        ok: false,
        error: 'Invalid request body',
        details: validationError instanceof z.ZodError ? validationError.issues : undefined,
      });
      return;
    }

    // Record the COA opened event
    await recordCoaOpened({
      installId: validatedBody.installId,
      profileId: validatedBody.profileId,
      brandId: validatedBody.brandId,
      labName: validatedBody.labName,
      batchId: validatedBody.batchId,
    });

    response.setHeader('Cache-Control', 'no-store');
    response.status(204).end();

    logger.info('[coaOpened] Event recorded', {
      installId: validatedBody.installId,
      profileId: validatedBody.profileId,
    });
  } catch (error) {
    logger.error('[coaOpened] Unexpected error', {
      error: error instanceof Error ? error.message : String(error),
    });
    response.status(500).json({
      ok: false,
      error: 'Internal server error',
    });
  }
});

/**
 * Product Resolution Routes
 *
 * GET /products/resolve?code=... — read-only endpoint for link previews, deep links
 *
 * Same resolution logic as /scans/ingest but does NOT persist a scan record.
 * Useful for:
 *   - Link preview generation
 *   - Deep links from push notifications
 *   - Manual URL entry
 *
 * Cached response (public, max-age 60s, SWR 5min).
 */

import { Router } from 'express';
import { createRateLimitMiddleware } from '../http/rateLimit';
import { logger } from '../observability/logger';
import { lookupOcmLicense } from '../services/ocmLicenseLookupService';
import {
  parseCoa,
  isCoa,
  isUpc,
  isHttpUrl,
  buildUpcOnlyCoa,
  buildUnknownLabCoa,
} from '../services/productCatalogService';
import { resolveBrandPage } from '../services/brandPageResolverService';
import type { ProductCOA, ScanResolution } from '../types';

const OCM_LICENSE_PATTERN = /^[A-Z0-9\-]{10,30}$/;

/**
 * Resolve a code to license, product, or unknown.
 *
 * Mirrors the 6-tier waterfall in scanIngestionService.resolveCode so
 * link previews and deep links classify the same way as live camera scans.
 */
async function resolveCode(rawCode: string): Promise<ScanResolution> {
  const trimmed = rawCode.trim();

  if (!trimmed) {
    return { kind: 'unknown', rawCode: trimmed, reason: 'empty' };
  }

  // (1) Retail UPC/EAN/ITF barcode → uncatalogued product.
  if (isUpc(trimmed)) {
    return {
      kind: 'product',
      coa: buildUpcOnlyCoa(trimmed),
      catalogState: 'uncatalogued',
    };
  }

  // (2) Recognized COA URL → verified product with parsed lab metadata.
  if (isCoa(trimmed)) {
    const coa = await parseCoa(trimmed);
    if (coa) {
      return {
        kind: 'product',
        coa,
        catalogState: 'verified',
      };
    }
  }

  // (3) Any other well-formed URL — brand-site QR. Try chain-through to a
  //     known lab; otherwise surface as unrecognized_lab with brandWebsiteUrl
  //     set so the shopper gets a "Visit brand site" button.
  if (isHttpUrl(trimmed)) {
    const brandPage = await resolveBrandPage(trimmed);

    if (brandPage.outcome === 'chained_to_known_lab') {
      return {
        kind: 'product',
        coa: {
          ...brandPage.coa,
          brandWebsiteUrl: trimmed,
        },
        catalogState: 'verified',
      };
    }

    return {
      kind: 'product',
      coa: {
        ...buildUnknownLabCoa(trimmed),
        brandWebsiteUrl: trimmed,
        coaUrl: undefined,
      },
      catalogState: 'unrecognized_lab',
    };
  }

  // (4,5) OCM license pattern — verified if registry hit, unverified otherwise.
  if (OCM_LICENSE_PATTERN.test(trimmed)) {
    const lookup = await lookupOcmLicense(trimmed);
    if (lookup.found && lookup.record) {
      return {
        kind: 'license',
        license: {
          licenseNumber: lookup.record.license_number,
          licenseType: lookup.record.license_type,
          licenseeName: lookup.record.licensee_name,
          status: lookup.record.license_status,
        },
        verificationState: 'verified',
      };
    }
    return {
      kind: 'license',
      license: {
        licenseNumber: trimmed,
        licenseType: 'unknown',
        licenseeName: 'Unverified',
        status: 'unverified',
      },
      verificationState: 'unverified',
    };
  }

  // (6) Last resort.
  return {
    kind: 'unknown',
    rawCode: trimmed,
    reason: 'unrecognized_format',
  };
}

export const productResolveRoutes = Router();

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
 * GET /products/resolve?code=...
 *
 * Public endpoint for resolving codes without persisting.
 * Rate limited to 60 req/min per IP.
 * Cached response for links and previews.
 */
const resolveRateLimiter = createRateLimitMiddleware({
  name: 'product-resolve',
  windowMs: 60_000,
  max: 60,
  methods: ['GET'],
});

productResolveRoutes.get('/products/resolve', resolveRateLimiter, async (request, response) => {
  try {
    const query = request.query as Record<string, unknown>;
    const code = typeof query.code === 'string' ? query.code.trim() : '';

    if (!code) {
      response.status(400).json({
        ok: false,
        error: 'code query parameter is required',
      });
      return;
    }

    // Resolve the code (same logic as scanIngestion, but no persistence)
    const resolution = await resolveCode(code);

    // Shape response
    const payload = {
      ok: true,
      kind: resolution.kind,
      license: shapeLicense(resolution),
      coa: shapeCoa(resolution),
      verificationState: resolution.kind === 'license' ? resolution.verificationState : undefined,
      catalogState: resolution.kind === 'product' ? resolution.catalogState : undefined,
      reason: resolution.kind === 'unknown' ? resolution.reason : undefined,
    };

    response.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    response.json(payload);

    logger.info('[productResolve] Resolved code', {
      kind: resolution.kind,
    });
  } catch (error) {
    logger.error('[productResolve] Unexpected error', {
      error: error instanceof Error ? error.message : String(error),
    });
    response.status(500).json({
      ok: false,
      error: 'Internal server error',
    });
  }
});

/**
 * Product Contribution Routes
 *
 * POST /products/contribute — public, App Check gated, rate limited.
 *
 * Backs the "Help us add this" soft-prompt on ScanResultScreen when a
 * scan came back as `uncatalogued` or `unrecognized_lab`. Captures the
 * shopper's best guess at brand / product / COA URL so we can fast-track
 * popular gaps in the catalog.
 */

import { Router } from 'express';
import { z } from 'zod';
import { createAppCheckStrictMiddleware } from '../http/appCheckGuard';
import { createRateLimitMiddleware } from '../http/rateLimit';
import { logger } from '../observability/logger';
import { submitProductContribution } from '../services/productContributionService';

export const productContributionRoutes = Router();

// Anonymous-shopper-friendly write surface — accepts installId only, no
// member auth. App Check is the only confirmation that the request is
// coming from our actual app rather than a script. The docstring above
// has always claimed App Check gating; this enforces it.
const contributeAppCheck = createAppCheckStrictMiddleware();

const ProductContributionRequestSchema = z
  .object({
    rawCode: z.string().min(1).max(2000),
    installId: z.string().min(1).max(200),
    brandName: z.string().max(200).optional(),
    productName: z.string().max(200).optional(),
    upc: z.string().max(32).optional(),
    coaUrl: z.string().url().max(1000).optional(),
    notes: z.string().max(500).optional(),
  })
  .strict();

type ProductContributionRequest = z.infer<typeof ProductContributionRequestSchema>;

/**
 * Tighter limit than scan ingest because contributions require typing —
 * no shopper realistically submits 10 per minute, but this caps any
 * scripted abuse.
 */
const contributeRateLimiter = createRateLimitMiddleware({
  name: 'product-contribute',
  windowMs: 60_000,
  max: 10,
  methods: ['POST'],
});

productContributionRoutes.post(
  '/products/contribute',
  contributeAppCheck,
  contributeRateLimiter,
  async (request, response) => {
    try {
      const body = request.body as unknown;
      let validatedBody: ProductContributionRequest;
      try {
        validatedBody = ProductContributionRequestSchema.parse(body);
      } catch (validationError) {
        response.status(400).json({
          accepted: false,
          error: 'Invalid request body',
          details: validationError instanceof z.ZodError ? validationError.issues : undefined,
        });
        return;
      }

      const result = await submitProductContribution(validatedBody);

      response.setHeader('Cache-Control', 'no-store');

      if (!result.accepted) {
        response.status(400).json({
          accepted: false,
          error: result.error ?? 'Contribution rejected',
        });
        return;
      }

      response.json({
        accepted: true,
        contributionId: result.contributionId,
        duplicateCount: result.duplicateCount,
      });

      logger.info('[productContribution] Contribution accepted', {
        installId: validatedBody.installId,
        contributionId: result.contributionId,
        duplicateCount: result.duplicateCount,
      });
    } catch (error) {
      logger.error('[productContribution] Unexpected error', {
        error: error instanceof Error ? error.message : String(error),
      });
      response.status(500).json({
        accepted: false,
        error: 'Internal server error',
      });
    }
  },
);

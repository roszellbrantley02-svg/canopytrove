/**
 * Payment methods community reporting routes.
 *
 * POST /payment-methods/reports
 *   Anonymous community vote: does this storefront accept this method?
 *   Rate limited hard (30 req/min per IP). Uses App Check when present.
 *
 * Aggregate reads flow through the storefront summary/detail payloads
 * (via paymentMethodsService.attachPaymentMethodsToSummaries), so there's
 * no GET endpoint here — the badge always comes from the parent payload.
 */

import { Router } from 'express';
import { z } from 'zod';
import { createRateLimitMiddleware } from '../http/rateLimit';
import { logger } from '../observability/logger';
import {
  ALL_PAYMENT_METHOD_IDS,
  recordCommunityPaymentReport,
} from '../services/paymentMethodsService';
import type { PaymentMethodApiId } from '../types';

export const paymentMethodsRoutes = Router();

const PaymentReportSchema = z
  .object({
    storefrontId: z.string().min(1).max(200),
    methodId: z.enum(
      ALL_PAYMENT_METHOD_IDS as unknown as [PaymentMethodApiId, ...PaymentMethodApiId[]],
    ),
    accepted: z.boolean(),
    installId: z.string().min(1).max(200),
  })
  .strict();

const reportRateLimiter = createRateLimitMiddleware({
  name: 'payment-methods-report',
  windowMs: 60_000,
  max: 30,
  methods: ['POST'],
});

paymentMethodsRoutes.post(
  '/payment-methods/reports',
  reportRateLimiter,
  async (request, response) => {
    try {
      const body = request.body as unknown;
      const parsed = PaymentReportSchema.safeParse(body);
      if (!parsed.success) {
        response.status(400).json({
          ok: false,
          error: 'Invalid request body',
          details: parsed.error.issues,
        });
        return;
      }

      const result = await recordCommunityPaymentReport({
        storefrontId: parsed.data.storefrontId,
        methodId: parsed.data.methodId,
        accepted: parsed.data.accepted,
        installId: parsed.data.installId,
      });

      response.setHeader('Cache-Control', 'no-store');
      response.status(204).end();

      logger.info('[paymentMethods] Community report recorded', {
        storefrontId: parsed.data.storefrontId,
        methodId: parsed.data.methodId,
        accepted: parsed.data.accepted,
        outcome: result.outcome,
      });
    } catch (error) {
      logger.error('[paymentMethods] Report failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      response.status(500).json({
        ok: false,
        error: 'Internal server error',
      });
    }
  },
);

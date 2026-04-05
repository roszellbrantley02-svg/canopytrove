import { Request, Response, Router } from 'express';
import { serverConfig } from '../config';
import { createRateLimitMiddleware } from '../http/rateLimit';
import { getSafeErrorMessage } from '../http/errors';
import {
  createOwnerBillingCheckoutSession,
  createOwnerBillingPortalSession,
  handleOwnerBillingWebhook,
  OwnerBillingError,
} from '../services/ownerBillingService';

export const ownerBillingRoutes = Router();
const ownerBillingSessionRateLimiter = createRateLimitMiddleware({
  name: 'owner-billing-session',
  windowMs: 60_000,
  max: 6,
  methods: ['POST'],
});

ownerBillingRoutes.use(
  createRateLimitMiddleware({
    name: 'write',
    windowMs: 60_000,
    max: serverConfig.writeRateLimitPerMinute,
    methods: ['POST'],
  }),
);

function getErrorStatus(error: unknown) {
  return error instanceof OwnerBillingError ? error.statusCode : 500;
}

function getErrorMessage(error: unknown, statusCode: number, requestId?: string | null) {
  return getSafeErrorMessage(error, statusCode, requestId);
}

function parseCheckoutBody(body: unknown): { billingCycle: unknown; tier: unknown } {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { billingCycle: undefined, tier: undefined };
  }

  const record = body as Record<string, unknown>;
  const billingCycle = typeof record.billingCycle === 'string' ? record.billingCycle : undefined;
  const tier = typeof record.tier === 'string' ? record.tier : undefined;

  return { billingCycle, tier };
}

ownerBillingRoutes.post(
  '/owner-billing/checkout-session',
  ownerBillingSessionRateLimiter,
  async (request, response) => {
    try {
      const { billingCycle, tier } = parseCheckoutBody(request.body);
      response.json(await createOwnerBillingCheckoutSession(request, billingCycle, tier));
    } catch (error) {
      const statusCode = getErrorStatus(error);
      const requestId = response.getHeader('X-CanopyTrove-Request-Id');
      response.status(statusCode).json({
        ok: false,
        error: getErrorMessage(error, statusCode, typeof requestId === 'string' ? requestId : null),
      });
    }
  },
);

ownerBillingRoutes.post(
  '/owner-billing/portal-session',
  ownerBillingSessionRateLimiter,
  async (request, response) => {
    try {
      response.json(await createOwnerBillingPortalSession(request));
    } catch (error) {
      const statusCode = getErrorStatus(error);
      const requestId = response.getHeader('X-CanopyTrove-Request-Id');
      response.status(statusCode).json({
        ok: false,
        error: getErrorMessage(error, statusCode, typeof requestId === 'string' ? requestId : null),
      });
    }
  },
);

export async function ownerBillingWebhookHandler(request: Request, response: Response) {
  try {
    const payloadBuffer = Buffer.isBuffer(request.body) ? request.body : Buffer.from('', 'utf8');
    response.json(
      await handleOwnerBillingWebhook(payloadBuffer, request.header('stripe-signature')),
    );
  } catch (error) {
    const statusCode = getErrorStatus(error);
    const requestId = response.getHeader('X-CanopyTrove-Request-Id');
    response.status(statusCode).json({
      ok: false,
      error: getErrorMessage(error, statusCode, typeof requestId === 'string' ? requestId : null),
    });
  }
}

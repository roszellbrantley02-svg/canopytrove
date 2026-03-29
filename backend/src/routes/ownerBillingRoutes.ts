import { Request, Response, Router } from 'express';
import { serverConfig } from '../config';
import { createRateLimitMiddleware } from '../http/rateLimit';
import {
  createOwnerBillingCheckoutSession,
  createOwnerBillingPortalSession,
  handleOwnerBillingWebhook,
  OwnerBillingError,
} from '../services/ownerBillingService';

export const ownerBillingRoutes = Router();

ownerBillingRoutes.use(
  createRateLimitMiddleware({
    name: 'write',
    windowMs: 60_000,
    max: serverConfig.writeRateLimitPerMinute,
    methods: ['POST'],
  })
);

function getErrorStatus(error: unknown) {
  return error instanceof OwnerBillingError ? error.statusCode : 500;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown owner billing failure.';
}

ownerBillingRoutes.post('/owner-billing/checkout-session', async (request, response) => {
  try {
    const body =
      typeof request.body === 'object' && request.body
        ? (request.body as Record<string, unknown>)
        : {};
    response.json(await createOwnerBillingCheckoutSession(request, body.billingCycle));
  } catch (error) {
    response.status(getErrorStatus(error)).json({
      ok: false,
      error: getErrorMessage(error),
    });
  }
});

ownerBillingRoutes.post('/owner-billing/portal-session', async (request, response) => {
  try {
    response.json(await createOwnerBillingPortalSession(request));
  } catch (error) {
    response.status(getErrorStatus(error)).json({
      ok: false,
      error: getErrorMessage(error),
    });
  }
});

export async function ownerBillingWebhookHandler(request: Request, response: Response) {
  try {
    const payloadBuffer = Buffer.isBuffer(request.body)
      ? request.body
      : Buffer.from('', 'utf8');
    response.json(
      await handleOwnerBillingWebhook(
        payloadBuffer,
        request.header('stripe-signature')
      )
    );
  } catch (error) {
    response.status(getErrorStatus(error)).json({
      ok: false,
      error: getErrorMessage(error),
    });
  }
}

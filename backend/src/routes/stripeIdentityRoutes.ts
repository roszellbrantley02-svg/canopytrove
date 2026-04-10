import { Request, Response } from 'express';
import { handleStripeIdentityWebhook } from '../services/stripeIdentityService';
import { getSafeErrorMessage } from '../http/errors';

/**
 * Stripe Identity webhook handler.
 * Mounted at POST /identity-verification/stripe/webhook in app.ts
 * with express.raw() so the body arrives as a raw Buffer for signature verification.
 */
export async function stripeIdentityWebhookHandler(request: Request, response: Response) {
  try {
    const payloadBuffer = Buffer.isBuffer(request.body) ? request.body : Buffer.from('', 'utf8');

    const result = await handleStripeIdentityWebhook(
      payloadBuffer,
      request.header('stripe-signature'),
    );

    response.json(result);
  } catch (error) {
    const statusCode = 400;
    const requestId = response.getHeader('X-CanopyTrove-Request-Id');
    response.status(statusCode).json({
      ok: false,
      error: getSafeErrorMessage(
        error,
        statusCode,
        typeof requestId === 'string' ? requestId : null,
      ),
    });
  }
}

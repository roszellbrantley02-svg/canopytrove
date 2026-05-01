/**
 * Owner Shop Ownership Verification — frontend service for the Twilio
 * Verify backend (backend/src/services/shopOwnershipVerificationService.ts).
 *
 * Optional fast-path verification: owner enters code received on the
 * SHOP'S published phone (from Google Places). On success, claim is
 * marked shopOwnershipVerified=true. Admin review still happens, but
 * with the verification signal already attached.
 *
 * Plus a separate notify-shop call (shopClaimNotificationService) that
 * sends an out-of-band voice alert to the shop's published phone — fires
 * regardless of whether the owner completes verification themselves. The
 * legitimate operator gets warned even if the claimant can't access the
 * shop phone line.
 */

import { requestJson } from './storefrontBackendHttp';

export type OwnerShopVerificationErrorCode =
  | 'twilio_not_configured'
  | 'authentication_required'
  | 'storefront_not_found'
  | 'claim_not_found'
  | 'claim_not_owned'
  | 'shop_phone_unavailable'
  | 'invalid_verification_code'
  | 'rate_limited'
  | 'verification_send_failed'
  | 'verification_check_failed'
  | 'unknown';

export class OwnerShopVerificationError extends Error {
  public readonly code: OwnerShopVerificationErrorCode;
  constructor(code: OwnerShopVerificationErrorCode, message: string) {
    super(message);
    this.name = 'OwnerShopVerificationError';
    this.code = code;
  }
}

export function isOwnerShopVerificationError(error: unknown): error is OwnerShopVerificationError {
  return error instanceof OwnerShopVerificationError;
}

type ShopVerifySendResponse = {
  ok: true;
  storefrontId: string;
  phoneSuffix: string;
  shopName: string;
};

type ShopVerifyConfirmResponse = {
  ok: true;
  storefrontId: string;
  verifiedAt: string;
};

type ShopNotificationResponse = {
  ok: true;
  alreadyNotified: boolean;
  callStatus: string;
  phoneSuffix: string | null;
};

function classifyError(error: unknown): OwnerShopVerificationError {
  if (error instanceof OwnerShopVerificationError) return error;
  const message = error instanceof Error ? error.message : 'Shop verification failed.';
  const lower = message.toLowerCase();
  if (
    lower.includes('not reachable') ||
    lower.includes('no published phone') ||
    lower.includes("isn't in a format")
  ) {
    return new OwnerShopVerificationError('shop_phone_unavailable', message);
  }
  if (
    lower.includes('verification code') &&
    (lower.includes('incorrect') || lower.includes('expired'))
  ) {
    return new OwnerShopVerificationError('invalid_verification_code', message);
  }
  if (lower.includes('too many')) {
    return new OwnerShopVerificationError('rate_limited', message);
  }
  if (lower.includes('claim') && lower.includes('not')) {
    return new OwnerShopVerificationError('claim_not_found', message);
  }
  return new OwnerShopVerificationError('unknown', message);
}

export async function sendShopVerificationCode(storefrontId: string) {
  try {
    return await requestJson<ShopVerifySendResponse>(
      '/owner-portal/shop-ownership-verification/send',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storefrontId }),
      },
    );
  } catch (error) {
    throw classifyError(error);
  }
}

export async function confirmShopVerificationCode(storefrontId: string, code: string) {
  try {
    return await requestJson<ShopVerifyConfirmResponse>(
      '/owner-portal/shop-ownership-verification/confirm',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storefrontId, code }),
      },
    );
  } catch (error) {
    throw classifyError(error);
  }
}

/**
 * Trigger the notification voice call to the shop's published phone.
 * Idempotent — repeated calls for the same claim return
 * { alreadyNotified: true } without re-dialing. Fail-soft: a failure
 * here should NOT block claim flow; log and continue.
 */
export async function notifyShopOfPendingClaim(storefrontId: string) {
  try {
    return await requestJson<ShopNotificationResponse>('/owner-portal/claims/notify-shop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storefrontId }),
    });
  } catch (error) {
    // Don't surface — notification failure is a degraded-but-OK state
    // for the owner. Admin review still catches everything.
    return null;
  }
}

/**
 * Owner Shop Ownership Verification — frontend service for the merged
 * voice OTP + alert call (backend/src/services/shopOwnershipVerificationService.ts).
 *
 * Single voice call to the shop's published phone delivers BOTH the
 * 6-digit verification code AND alerts the legitimate operator if a
 * hijacker is the claimant. Owner enters the code in-app to verify.
 *
 * Cooldown rules (server-enforced):
 *   - 30 minutes between calls per claim
 *   - 3 calls per claim per 24 hours
 *
 * On cooldown errors, `cooldownEndsAt` (ISO timestamp) is surfaced
 * through a typed BackendShopVerificationCooldownError so screens can
 * show a live countdown.
 */

import { isBackendShopVerificationCooldownError, requestJson } from './storefrontBackendHttp';

export type OwnerShopVerificationErrorCode =
  | 'twilio_not_configured'
  | 'authentication_required'
  | 'storefront_not_found'
  | 'claim_not_found'
  | 'claim_not_owned'
  | 'shop_phone_unavailable'
  | 'invalid_verification_code'
  | 'code_expired'
  | 'too_many_failed_attempts'
  | 'cooldown_active'
  | 'daily_limit_reached'
  | 'rate_limited'
  | 'verification_send_failed'
  | 'verification_check_failed'
  | 'unknown';

export class OwnerShopVerificationError extends Error {
  public readonly code: OwnerShopVerificationErrorCode;
  public readonly cooldownEndsAt: string | null;
  constructor(
    code: OwnerShopVerificationErrorCode,
    message: string,
    cooldownEndsAt: string | null = null,
  ) {
    super(message);
    this.name = 'OwnerShopVerificationError';
    this.code = code;
    this.cooldownEndsAt = cooldownEndsAt;
  }
}

export function isOwnerShopVerificationError(error: unknown): error is OwnerShopVerificationError {
  return error instanceof OwnerShopVerificationError;
}

export type ShopVerifySendResponse = {
  ok: true;
  storefrontId: string;
  phoneSuffix: string;
  shopName: string;
  callSid: string;
  cooldownEndsAt: string;
  callsRemainingToday: number;
};

export type ShopVerifyConfirmResponse = {
  ok: true;
  storefrontId: string;
  verifiedAt: string;
};

function classifyError(error: unknown): OwnerShopVerificationError {
  if (error instanceof OwnerShopVerificationError) return error;
  if (isBackendShopVerificationCooldownError(error)) {
    return new OwnerShopVerificationError(error.code, error.message, error.cooldownEndsAt);
  }
  const message = error instanceof Error ? error.message : 'Shop verification failed.';
  const lower = message.toLowerCase();
  if (
    lower.includes('not reachable') ||
    lower.includes('no published phone') ||
    lower.includes("isn't in a format")
  ) {
    return new OwnerShopVerificationError('shop_phone_unavailable', message);
  }
  if (lower.includes('expired')) {
    return new OwnerShopVerificationError('code_expired', message);
  }
  if (lower.includes('too many incorrect')) {
    return new OwnerShopVerificationError('too_many_failed_attempts', message);
  }
  if (lower.includes('incorrect')) {
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

/**
 * Place the merged voice OTP + alert call to the shop's published phone.
 * Used both for the auto-fire on claim submission and for owner-initiated
 * "Send another call" retries.
 */
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

/**
 * Validate the 6-digit code the owner heard on the call.
 */
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
 * Auto-fire the merged call on claim submission. Fail-soft: returns
 * null on any error so a Twilio hiccup never blocks the claim itself
 * (admin review still catches everything). Cooldown errors are also
 * silently swallowed here — when the user explicitly hits "Send another
 * call" later, the typed error surfaces with the countdown.
 */
export async function notifyShopOfPendingClaim(storefrontId: string) {
  try {
    return await sendShopVerificationCode(storefrontId);
  } catch {
    // Don't surface — call failure is a degraded-but-OK state for the
    // owner. Admin review still catches everything. The owner can
    // still tap "Send another call" from the verification screen and
    // see any cooldown error there.
    return null;
  }
}

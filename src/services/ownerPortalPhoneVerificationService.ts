/**
 * Owner Phone Verification — frontend service for the Twilio Verify
 * backend (backend/src/services/phoneVerificationService.ts).
 *
 * Two-step OTP flow used during owner onboarding:
 *   1. sendOwnerPhoneVerificationCode(phone) → backend sends SMS
 *   2. confirmOwnerPhoneVerificationCode(phone, code) → backend
 *      validates and persists phoneVerified=true on the owner profile
 *
 * Errors come back from the backend as { ok:false, code, error } where
 * `code` is a typed string like 'invalid_phone_number' or
 * 'rate_limited'. We unwrap into a typed JS error class so callers can
 * branch on the code without parsing strings.
 */

import { isBackendPhoneVerificationRequiredError, requestJson } from './storefrontBackendHttp';

export type OwnerPhoneVerificationErrorCode =
  | 'twilio_not_configured'
  | 'authentication_required'
  | 'invalid_phone_number'
  | 'invalid_verification_code'
  | 'rate_limited'
  | 'verification_send_failed'
  | 'verification_check_failed'
  | 'owner_record_missing'
  | 'phone_verification_required'
  | 'unknown';

export class OwnerPhoneVerificationError extends Error {
  public readonly code: OwnerPhoneVerificationErrorCode;
  constructor(code: OwnerPhoneVerificationErrorCode, message: string) {
    super(message);
    this.name = 'OwnerPhoneVerificationError';
    this.code = code;
  }
}

export function isOwnerPhoneVerificationError(
  error: unknown,
): error is OwnerPhoneVerificationError {
  return error instanceof OwnerPhoneVerificationError;
}

type SendResponse = {
  ok: true;
  phoneE164: string;
  channel: 'sms' | 'call';
};

type ConfirmResponse = {
  ok: true;
  phoneNumber: string;
  verifiedAt: string;
};

/**
 * Pull a typed code out of an error returned by requestJson. requestJson
 * throws plain Error with the backend message when the response is
 * non-ok; the original `code` field is lost in transit, so we re-extract
 * it from the message text when possible. Falls back to 'unknown'.
 */
function classifyError(error: unknown): OwnerPhoneVerificationError {
  if (error instanceof OwnerPhoneVerificationError) return error;
  if (isBackendPhoneVerificationRequiredError(error)) {
    return new OwnerPhoneVerificationError('phone_verification_required', error.message);
  }
  const message = error instanceof Error ? error.message : 'Phone verification failed.';
  // The backend's typed code is sometimes embedded in the parsed JSON
  // body that requestJson surfaces as a generic Error. Best effort
  // extraction by matching common error wording.
  const lower = message.toLowerCase();
  if (lower.includes('valid phone number') || lower.includes('not valid')) {
    return new OwnerPhoneVerificationError('invalid_phone_number', message);
  }
  if (
    lower.includes('verification code') &&
    (lower.includes('incorrect') || lower.includes('expired'))
  ) {
    return new OwnerPhoneVerificationError('invalid_verification_code', message);
  }
  if (lower.includes('too many')) {
    return new OwnerPhoneVerificationError('rate_limited', message);
  }
  if (lower.includes('sign in')) {
    return new OwnerPhoneVerificationError('authentication_required', message);
  }
  return new OwnerPhoneVerificationError('unknown', message);
}

export async function sendOwnerPhoneVerificationCode(
  phone: string,
  channel: 'sms' | 'call' = 'sms',
) {
  try {
    return await requestJson<SendResponse>('/owner-portal/phone-verification/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, channel }),
    });
  } catch (error) {
    throw classifyError(error);
  }
}

export async function confirmOwnerPhoneVerificationCode(phone: string, code: string) {
  try {
    return await requestJson<ConfirmResponse>('/owner-portal/phone-verification/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, code }),
    });
  } catch (error) {
    throw classifyError(error);
  }
}

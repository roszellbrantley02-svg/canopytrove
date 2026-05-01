/**
 * Owner Phone Verification — Twilio Verify integration
 *
 * Two-step OTP flow used as an anti-fraud signal during owner onboarding
 * and as a recovery channel for billing/security disputes:
 *
 *   1. POST /owner-portal/phone-verification/send
 *      → calls Twilio Verify Service to send a 6-digit SMS code
 *   2. POST /owner-portal/phone-verification/confirm
 *      → calls Twilio Verify Check; on success, persists
 *        { phoneVerified: true, phoneNumber: '+1...', phoneVerifiedAt }
 *        on the ownerProfiles document.
 *
 * Backend-side gate: submitOwnerDispensaryClaim throws
 *   PhoneVerificationError('phone_verification_required', 403)
 * if the owner record does not have phoneVerified=true. This is the actual
 * fraud defense — the frontend can be bypassed; the backend cannot.
 *
 * Pattern matches stripeIdentityService.ts: typed error class, narrow
 * status-code surface, never throws plain Error objects (so the route
 * handler can classify HTTP status correctly without substring sniffing).
 */

import { Request } from 'express';
import { serverConfig } from '../config';
import { getBackendFirebaseDb } from '../firebase';
import { logger } from '../observability/logger';
import { logSecurityEvent } from '../http/securityEventLogger';
import { resolveVerifiedRequestAccountId } from './profileAccessService';

const OWNER_PROFILES_COLLECTION = 'ownerProfiles';
const TWILIO_VERIFY_API_BASE = 'https://verify.twilio.com/v2';

// Owner-facing error names. The route handler maps these to HTTP statuses
// and the frontend keys off the `code` to drive UI (e.g. show "open
// settings" path, show "rate limited, try later" toast, etc.).
export type PhoneVerificationErrorCode =
  | 'twilio_not_configured'
  | 'authentication_required'
  | 'invalid_phone_number'
  | 'invalid_verification_code'
  | 'rate_limited'
  | 'verification_send_failed'
  | 'verification_check_failed'
  | 'owner_record_missing'
  | 'phone_verification_required';

export class PhoneVerificationError extends Error {
  public readonly statusCode: number;
  public readonly code: PhoneVerificationErrorCode;

  constructor(code: PhoneVerificationErrorCode, message: string, statusCode: number) {
    super(message);
    this.name = 'PhoneVerificationError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export function isPhoneVerificationError(error: unknown): error is PhoneVerificationError {
  return error instanceof PhoneVerificationError;
}

type OwnerPhoneVerificationRecord = {
  phoneVerified?: boolean;
  phoneNumber?: string | null;
  phoneVerifiedAt?: string | null;
};

/**
 * Returns true when the owner has a verified phone on file. Used as the
 * gating predicate by submitOwnerDispensaryClaim and other sensitive
 * owner-only actions. Errs on the side of "not verified" if the owner
 * record can't be read — fail-closed semantics for fraud defense.
 */
export async function hasOwnerVerifiedPhone(ownerUid: string): Promise<boolean> {
  const db = getBackendFirebaseDb();
  if (!db) return false;
  try {
    const snap = await db.collection(OWNER_PROFILES_COLLECTION).doc(ownerUid).get();
    if (!snap.exists) return false;
    const data = snap.data() as OwnerPhoneVerificationRecord | undefined;
    return data?.phoneVerified === true && Boolean(data?.phoneNumber);
  } catch {
    return false;
  }
}

/**
 * Convenience guard for callers that want to throw if the owner is not
 * phone-verified. Throws PhoneVerificationError('phone_verification_required',
 * 403). The frontend can detect the typed code and route the user to the
 * verification screen instead of showing a generic error.
 */
export async function assertOwnerPhoneVerified(ownerUid: string): Promise<void> {
  if (!(await hasOwnerVerifiedPhone(ownerUid))) {
    throw new PhoneVerificationError(
      'phone_verification_required',
      'Phone verification is required before this action.',
      403,
    );
  }
}

function getTwilioConfig() {
  const accountSid = serverConfig.twilioAccountSid;
  const authToken = serverConfig.twilioAuthToken;
  const verifyServiceSid = serverConfig.twilioVerifyServiceSid;
  if (!accountSid || !authToken || !verifyServiceSid) {
    throw new PhoneVerificationError(
      'twilio_not_configured',
      'Phone verification is not configured on the backend.',
      503,
    );
  }
  return { accountSid, authToken, verifyServiceSid };
}

/**
 * Normalize a phone number to E.164 (the only format Twilio Verify accepts).
 * Permissive: accepts "+1 555 555 1234", "(555) 555-1234", "555-555-1234",
 * "5555551234". Rejects anything that doesn't yield 10–15 digits.
 *
 * No country-code inference for non-US numbers — assumes US (+1) when no
 * leading "+" is present. Owners outside the US would need to enter the
 * full E.164 form themselves; we don't have product requirements for
 * international owners yet.
 */
export function normalizePhoneToE164(input: string): string | null {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  // If the user typed a leading "+", preserve it. Strip everything else
  // that isn't a digit.
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D+/g, '');
  if (!digits) return null;

  if (hasPlus) {
    // Caller provided an explicit country code — trust it as long as the
    // total length is sane (E.164 max 15 digits).
    if (digits.length < 8 || digits.length > 15) return null;
    return `+${digits}`;
  }

  // No country code. Assume US (+1). Accept either 10 digits or 11 digits
  // when the leading 1 is already present.
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return null;
}

async function twilioRequest<T>(
  path: string,
  body: URLSearchParams,
  config: ReturnType<typeof getTwilioConfig>,
): Promise<T> {
  const url = `${TWILIO_VERIFY_API_BASE}${path}`;
  const auth = Buffer.from(`${config.accountSid}:${config.authToken}`).toString('base64');
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });
  const text = await response.text();
  let payload: unknown;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { raw: text };
  }
  if (!response.ok) {
    const errorRecord = payload as {
      code?: number;
      message?: string;
      more_info?: string;
    };
    // Twilio returns numeric error codes — common ones we care about:
    //   60200 — invalid parameter (e.g. bad phone number)
    //   60202 — max check attempts reached
    //   60203 — max send attempts reached
    //   60410 — Verify service has been deleted
    const twilioCode = errorRecord?.code;
    if (twilioCode === 60200) {
      throw new PhoneVerificationError(
        'invalid_phone_number',
        'That phone number is not valid.',
        400,
      );
    }
    if (twilioCode === 60202 || twilioCode === 60203) {
      throw new PhoneVerificationError(
        'rate_limited',
        'Too many verification attempts. Wait an hour, or email askmehere@canopytrove.com if you keep getting blocked.',
        429,
      );
    }
    logger.error('[phoneVerification] Twilio request failed', {
      url,
      status: response.status,
      twilioCode,
      twilioMessage: errorRecord?.message,
    });
    throw new PhoneVerificationError(
      'verification_send_failed',
      'Unable to send the verification code. Try again shortly, or email askmehere@canopytrove.com if it keeps failing.',
      response.status >= 500 ? 502 : 400,
    );
  }
  return payload as T;
}

/**
 * Initiate a phone verification — sends an SMS (or voice fallback) with a
 * 6-digit code to the supplied phone number via Twilio Verify.
 *
 * Does NOT mark the owner as verified. That happens only after
 * confirmPhoneVerificationCode succeeds with a matching code.
 *
 * Channel defaults to 'sms'. Caller can pass 'call' to use voice (for
 * landlines). Twilio Verify auto-falls-back to voice if SMS fails on
 * landline detection (we enabled "skip SMS verification on landlines"
 * in the service settings).
 */
export async function sendPhoneVerificationCode(
  request: Request,
  input: { phone: unknown; channel?: 'sms' | 'call' },
): Promise<{ ok: true; phoneE164: string; channel: 'sms' | 'call' }> {
  const ownerUid = await resolveVerifiedRequestAccountId(request);
  if (!ownerUid) {
    throw new PhoneVerificationError(
      'authentication_required',
      'Sign in to verify your phone number.',
      401,
    );
  }

  const phoneE164 = normalizePhoneToE164(typeof input.phone === 'string' ? input.phone : '');
  if (!phoneE164) {
    throw new PhoneVerificationError(
      'invalid_phone_number',
      'Enter a valid phone number (e.g. +1 555 555 1234).',
      400,
    );
  }

  const channel = input.channel === 'call' ? 'call' : 'sms';
  const config = getTwilioConfig();
  const body = new URLSearchParams({
    To: phoneE164,
    Channel: channel,
  });

  await twilioRequest(`/Services/${config.verifyServiceSid}/Verifications`, body, config);

  logger.info('[phoneVerification] Verification code sent', {
    ownerUid,
    phoneSuffix: phoneE164.slice(-4),
    channel,
  });

  return { ok: true, phoneE164, channel };
}

/**
 * Verify the user-entered code against Twilio Verify Check. On success,
 * persists phoneVerified=true on the ownerProfiles document (with the
 * verified E.164 phone number and a timestamp). On failure, throws a
 * typed error.
 *
 * Twilio Verify auto-expires codes after the service's code_lifetime
 * (10 min default), so we don't need our own TTL — we just trust Twilio's
 * verdict on whether the code is still valid.
 */
export async function confirmPhoneVerificationCode(
  request: Request,
  input: { phone: unknown; code: unknown },
): Promise<{ ok: true; phoneNumber: string; verifiedAt: string }> {
  const ownerUid = await resolveVerifiedRequestAccountId(request);
  if (!ownerUid) {
    throw new PhoneVerificationError(
      'authentication_required',
      'Sign in to verify your phone number.',
      401,
    );
  }

  const phoneE164 = normalizePhoneToE164(typeof input.phone === 'string' ? input.phone : '');
  if (!phoneE164) {
    throw new PhoneVerificationError(
      'invalid_phone_number',
      'Enter a valid phone number (e.g. +1 555 555 1234).',
      400,
    );
  }

  const code = typeof input.code === 'string' ? input.code.trim() : '';
  if (!code || !/^\d{4,10}$/.test(code)) {
    throw new PhoneVerificationError(
      'invalid_verification_code',
      'Enter the verification code we sent to your phone.',
      400,
    );
  }

  const config = getTwilioConfig();
  const body = new URLSearchParams({
    To: phoneE164,
    Code: code,
  });

  type CheckResponse = { status?: string; valid?: boolean };
  let result: CheckResponse;
  try {
    result = await twilioRequest<CheckResponse>(
      `/Services/${config.verifyServiceSid}/VerificationCheck`,
      body,
      config,
    );
  } catch (error) {
    // Re-throw typed errors as-is, but convert untyped Twilio API errors
    // here into verification_check_failed so the frontend doesn't see
    // verification_send_failed for what is actually a check-attempt error.
    if (error instanceof PhoneVerificationError && error.code === 'verification_send_failed') {
      throw new PhoneVerificationError(
        'verification_check_failed',
        'Unable to verify the code. Please request a new one and try again.',
        error.statusCode,
      );
    }
    throw error;
  }

  if (result.status !== 'approved') {
    // Twilio returned 200 but said the code didn't match. Common scenarios:
    //   - User typed the wrong digits
    //   - Code expired (>10 min)
    //   - User requested a new code that invalidated the old one
    logSecurityEvent({
      event: 'auth_failure',
      ip: request.ip || 'unknown',
      path: request.originalUrl,
      method: request.method,
      userId: ownerUid,
      detail: 'Phone verification code rejected by Twilio',
    });
    throw new PhoneVerificationError(
      'invalid_verification_code',
      'That code is incorrect or expired. Request a new one and try again.',
      400,
    );
  }

  // Code matched. Persist on the owner's profile document.
  const verifiedAt = new Date().toISOString();
  const db = getBackendFirebaseDb();
  if (!db) {
    throw new PhoneVerificationError(
      'owner_record_missing',
      'Backend Firestore is unavailable. Please try again shortly.',
      503,
    );
  }

  await db.collection(OWNER_PROFILES_COLLECTION).doc(ownerUid).set(
    {
      phoneVerified: true,
      phoneNumber: phoneE164,
      phoneVerifiedAt: verifiedAt,
      updatedAt: verifiedAt,
    },
    { merge: true },
  );

  logger.info('[phoneVerification] Phone verified', {
    ownerUid,
    phoneSuffix: phoneE164.slice(-4),
  });

  return { ok: true, phoneNumber: phoneE164, verifiedAt };
}

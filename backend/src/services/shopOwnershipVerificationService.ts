/**
 * Shop Ownership Verification — second layer of anti-hijack defense.
 *
 * Where personal phone verification (phoneVerificationService) confirms
 * "this person controls a real phone," shop ownership verification confirms
 * "this person controls THIS specific dispensary's published phone line."
 *
 * The shop's phone number comes from Google Places (already integrated;
 * stored on storefront_details.phone). At claim time, we send a 6-digit
 * code via Twilio Verify to the SHOP'S phone. The owner enters the code
 * in-app within the verification window. Code matches → claim is marked
 * shopOwnershipVerified, which the admin review gate requires before
 * approving.
 *
 * Why this is the strongest single fraud signal:
 * A bad actor can steal someone's identity (defeats Stripe Identity).
 * A bad actor can verify with their own phone (defeats personal phone
 * verification). But they cannot easily intercept SMS to the published
 * business number on the shop's wall, on Google Maps, on the OCM
 * registry. Defeating this layer requires physical access to the shop
 * (or hijacking the published phone line itself — a separate felony).
 *
 * Pattern matches phoneVerificationService.ts: typed errors, narrow
 * status codes, never throws plain Error objects.
 */

import { Request } from 'express';
import { serverConfig } from '../config';
import { getBackendFirebaseDb } from '../firebase';
import { logger } from '../observability/logger';
import { logSecurityEvent } from '../http/securityEventLogger';
import { resolveVerifiedRequestAccountId } from './profileAccessService';

const STOREFRONT_DETAILS_COLLECTION = 'storefront_details';
const DISPENSARY_CLAIMS_COLLECTION = 'dispensaryClaims';
const TWILIO_VERIFY_API_BASE = 'https://verify.twilio.com/v2';

export type ShopOwnershipVerificationErrorCode =
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
  | 'shop_ownership_required';

export class ShopOwnershipVerificationError extends Error {
  public readonly statusCode: number;
  public readonly code: ShopOwnershipVerificationErrorCode;

  constructor(code: ShopOwnershipVerificationErrorCode, message: string, statusCode: number) {
    super(message);
    this.name = 'ShopOwnershipVerificationError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export function isShopOwnershipVerificationError(
  error: unknown,
): error is ShopOwnershipVerificationError {
  return error instanceof ShopOwnershipVerificationError;
}

type StorefrontDetailRecord = {
  phone?: string | null;
  displayName?: string | null;
};

type DispensaryClaimRecord = {
  ownerUid?: string;
  dispensaryId?: string;
  claimStatus?: string;
  shopOwnershipVerified?: boolean;
  shopOwnershipVerifiedAt?: string | null;
  shopOwnershipVerifiedPhoneSuffix?: string | null;
};

function getTwilioConfig() {
  const accountSid = serverConfig.twilioAccountSid;
  const authToken = serverConfig.twilioAuthToken;
  const verifyServiceSid = serverConfig.twilioVerifyServiceSid;
  if (!accountSid || !authToken || !verifyServiceSid) {
    throw new ShopOwnershipVerificationError(
      'twilio_not_configured',
      'Phone verification is not configured on the backend.',
      503,
    );
  }
  return { accountSid, authToken, verifyServiceSid };
}

/**
 * Build the dispensary-claim document id used everywhere else in the
 * system. Mirrors the frontend convention (createOwnerDispensaryClaimId)
 * so we can read/write the same docs from either side.
 */
function buildClaimId(ownerUid: string, dispensaryId: string): string {
  return `${ownerUid}__${dispensaryId}`;
}

/**
 * Read the shop's published phone from the storefront_details document.
 * Returns null if not set or storefront doesn't exist.
 */
async function getShopPublishedPhone(
  storefrontId: string,
): Promise<{ phone: string; displayName: string } | null> {
  const db = getBackendFirebaseDb();
  if (!db) return null;
  const snap = await db.collection(STOREFRONT_DETAILS_COLLECTION).doc(storefrontId).get();
  if (!snap.exists) return null;
  const data = snap.data() as StorefrontDetailRecord | undefined;
  const phone = typeof data?.phone === 'string' ? data.phone.trim() : '';
  if (!phone) return null;
  const displayName =
    (typeof data?.displayName === 'string' && data.displayName.trim()) || 'this storefront';
  return { phone, displayName };
}

/**
 * Normalize a phone string Google Places returns ("(518) 555-1234",
 * "518-555-1234", "+1 518 555 1234") into E.164 for Twilio. Mirrors
 * normalizePhoneToE164 in phoneVerificationService but kept local so
 * the two services don't accidentally diverge if requirements change.
 */
function shopPhoneToE164(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D+/g, '');
  if (!digits) return null;
  if (hasPlus) {
    if (digits.length < 8 || digits.length > 15) return null;
    return `+${digits}`;
  }
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
    const errorRecord = payload as { code?: number; message?: string };
    const twilioCode = errorRecord?.code;
    if (twilioCode === 60200) {
      // The shop's published phone failed Twilio's validity check —
      // typically means the number on Google Places isn't a real
      // SMS-deliverable number (could be a published vanity number
      // routed through a non-SMS service).
      throw new ShopOwnershipVerificationError(
        'shop_phone_unavailable',
        'The shop’s published phone number isn’t reachable for verification. Contact support to verify ownership manually.',
        400,
      );
    }
    if (twilioCode === 60202 || twilioCode === 60203) {
      throw new ShopOwnershipVerificationError(
        'rate_limited',
        'Too many verification attempts on this shop. Please wait and try again later.',
        429,
      );
    }
    logger.error('[shopOwnershipVerification] Twilio request failed', {
      url,
      status: response.status,
      twilioCode,
      twilioMessage: errorRecord?.message,
    });
    throw new ShopOwnershipVerificationError(
      'verification_send_failed',
      'Unable to send the verification code. Please try again shortly.',
      response.status >= 500 ? 502 : 400,
    );
  }
  return payload as T;
}

/**
 * Send a 6-digit code via SMS to the shop's PUBLISHED phone number
 * (from Google Places). The owner must have access to that phone line
 * to receive the code.
 *
 * Returns the last 4 digits of the shop phone so the frontend can show
 * "We just sent a code to +1 *** *** 1234" — the owner needs to know
 * which phone to expect the SMS on (it's the SHOP's number, not theirs).
 */
export async function sendShopOwnershipVerificationCode(
  request: Request,
  input: { storefrontId: unknown },
): Promise<{
  ok: true;
  storefrontId: string;
  phoneSuffix: string;
  shopName: string;
}> {
  const ownerUid = await resolveVerifiedRequestAccountId(request);
  if (!ownerUid) {
    throw new ShopOwnershipVerificationError(
      'authentication_required',
      'Sign in to verify shop ownership.',
      401,
    );
  }

  const storefrontId = typeof input.storefrontId === 'string' ? input.storefrontId.trim() : '';
  if (!storefrontId) {
    throw new ShopOwnershipVerificationError(
      'storefront_not_found',
      'Pick a storefront before verifying shop ownership.',
      400,
    );
  }

  // Confirm the owner actually filed a claim for this storefront. Without
  // this check, a signed-in owner could spam SMS to any shop's published
  // phone — turning Canopy Trove into an SMS abuse vector. Claim must
  // exist + belong to this owner.
  const db = getBackendFirebaseDb();
  if (!db) {
    throw new ShopOwnershipVerificationError(
      'verification_send_failed',
      'Backend database is unavailable.',
      503,
    );
  }
  const claimId = buildClaimId(ownerUid, storefrontId);
  const claimSnap = await db.collection(DISPENSARY_CLAIMS_COLLECTION).doc(claimId).get();
  if (!claimSnap.exists) {
    throw new ShopOwnershipVerificationError(
      'claim_not_found',
      'No claim was found for this storefront. Submit a claim first.',
      404,
    );
  }
  const claim = claimSnap.data() as DispensaryClaimRecord | undefined;
  if (claim?.ownerUid !== ownerUid) {
    logSecurityEvent({
      event: 'suspicious_payload',
      ip: request.ip || 'unknown',
      path: request.originalUrl,
      method: request.method,
      userId: ownerUid,
      detail: `BOLA: shop ownership verify attempt on claim ${claimId} by ${ownerUid}`,
    });
    throw new ShopOwnershipVerificationError(
      'claim_not_owned',
      'This claim does not belong to your account.',
      403,
    );
  }

  const shopPhone = await getShopPublishedPhone(storefrontId);
  if (!shopPhone) {
    throw new ShopOwnershipVerificationError(
      'shop_phone_unavailable',
      'No published phone number is on file for this storefront. Contact support to verify ownership manually.',
      400,
    );
  }
  const phoneE164 = shopPhoneToE164(shopPhone.phone);
  if (!phoneE164) {
    throw new ShopOwnershipVerificationError(
      'shop_phone_unavailable',
      'The shop’s published phone number isn’t in a format we can send SMS to. Contact support to verify ownership manually.',
      400,
    );
  }

  const config = getTwilioConfig();
  const body = new URLSearchParams({
    To: phoneE164,
    Channel: 'sms',
  });

  await twilioRequest(`/Services/${config.verifyServiceSid}/Verifications`, body, config);

  const phoneSuffix = phoneE164.slice(-4);
  logger.info('[shopOwnershipVerification] Verification code sent to shop phone', {
    ownerUid,
    storefrontId,
    phoneSuffix,
  });

  return {
    ok: true,
    storefrontId,
    phoneSuffix,
    shopName: shopPhone.displayName,
  };
}

/**
 * Verify the OTP code the owner received on the shop's phone. On success,
 * marks the claim as shopOwnershipVerified — this is the field the admin
 * review gate checks before approving.
 */
export async function confirmShopOwnershipVerificationCode(
  request: Request,
  input: { storefrontId: unknown; code: unknown },
): Promise<{ ok: true; storefrontId: string; verifiedAt: string }> {
  const ownerUid = await resolveVerifiedRequestAccountId(request);
  if (!ownerUid) {
    throw new ShopOwnershipVerificationError(
      'authentication_required',
      'Sign in to verify shop ownership.',
      401,
    );
  }

  const storefrontId = typeof input.storefrontId === 'string' ? input.storefrontId.trim() : '';
  if (!storefrontId) {
    throw new ShopOwnershipVerificationError(
      'storefront_not_found',
      'Pick a storefront before verifying shop ownership.',
      400,
    );
  }

  const code = typeof input.code === 'string' ? input.code.trim() : '';
  if (!code || !/^\d{4,10}$/.test(code)) {
    throw new ShopOwnershipVerificationError(
      'invalid_verification_code',
      'Enter the verification code we sent to the shop phone.',
      400,
    );
  }

  const db = getBackendFirebaseDb();
  if (!db) {
    throw new ShopOwnershipVerificationError(
      'verification_check_failed',
      'Backend database is unavailable.',
      503,
    );
  }

  const claimId = buildClaimId(ownerUid, storefrontId);
  const claimSnap = await db.collection(DISPENSARY_CLAIMS_COLLECTION).doc(claimId).get();
  if (!claimSnap.exists) {
    throw new ShopOwnershipVerificationError(
      'claim_not_found',
      'No claim was found for this storefront. Submit a claim first.',
      404,
    );
  }
  const claim = claimSnap.data() as DispensaryClaimRecord | undefined;
  if (claim?.ownerUid !== ownerUid) {
    throw new ShopOwnershipVerificationError(
      'claim_not_owned',
      'This claim does not belong to your account.',
      403,
    );
  }

  const shopPhone = await getShopPublishedPhone(storefrontId);
  if (!shopPhone) {
    throw new ShopOwnershipVerificationError(
      'shop_phone_unavailable',
      'No published phone number is on file for this storefront.',
      400,
    );
  }
  const phoneE164 = shopPhoneToE164(shopPhone.phone);
  if (!phoneE164) {
    throw new ShopOwnershipVerificationError(
      'shop_phone_unavailable',
      'The shop’s published phone number isn’t in a format we can send SMS to.',
      400,
    );
  }

  const config = getTwilioConfig();
  const body = new URLSearchParams({
    To: phoneE164,
    Code: code,
  });

  type CheckResponse = { status?: string; valid?: boolean };
  const result = await twilioRequest<CheckResponse>(
    `/Services/${config.verifyServiceSid}/VerificationCheck`,
    body,
    config,
  );

  if (result.status !== 'approved') {
    logSecurityEvent({
      event: 'auth_failure',
      ip: request.ip || 'unknown',
      path: request.originalUrl,
      method: request.method,
      userId: ownerUid,
      detail: `Shop ownership code rejected by Twilio for storefront ${storefrontId}`,
    });
    throw new ShopOwnershipVerificationError(
      'invalid_verification_code',
      'That code is incorrect or expired. Request a new one and try again.',
      400,
    );
  }

  const verifiedAt = new Date().toISOString();
  const phoneSuffix = phoneE164.slice(-4);
  await db.collection(DISPENSARY_CLAIMS_COLLECTION).doc(claimId).set(
    {
      shopOwnershipVerified: true,
      shopOwnershipVerifiedAt: verifiedAt,
      shopOwnershipVerifiedPhoneSuffix: phoneSuffix,
      updatedAt: verifiedAt,
    },
    { merge: true },
  );

  logger.info('[shopOwnershipVerification] Shop ownership verified', {
    ownerUid,
    storefrontId,
    phoneSuffix,
  });

  return { ok: true, storefrontId, verifiedAt };
}

/**
 * Predicate: has the owner verified shop ownership for this specific
 * storefront? Used by admin review service before approving a claim.
 * Errs on the side of "not verified" if the claim doc is missing or
 * unreadable — fail-closed semantics for fraud defense.
 */
export async function hasShopOwnershipVerification(
  ownerUid: string,
  dispensaryId: string,
): Promise<boolean> {
  const db = getBackendFirebaseDb();
  if (!db) return false;
  try {
    const claimId = buildClaimId(ownerUid, dispensaryId);
    const snap = await db.collection(DISPENSARY_CLAIMS_COLLECTION).doc(claimId).get();
    if (!snap.exists) return false;
    const data = snap.data() as DispensaryClaimRecord | undefined;
    return data?.shopOwnershipVerified === true;
  } catch {
    return false;
  }
}

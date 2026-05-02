/**
 * Shop Ownership Verification — single voice call that delivers the
 * verification code AND warns the legitimate operator if a hijacker is
 * the claimant.
 *
 * Replaces the old two-call design (notification call + separate Twilio
 * Verify SMS OTP) with a single Polly TTS call to the shop's published
 * phone that:
 *
 *   1. Identifies as Canopy Trove
 *   2. Says "someone is trying to claim ownership of [Shop Name]"
 *   3. Reads a 6-digit code three times (slow, digit-by-digit, with
 *      pauses) so the recipient can hear it, write it down, and type
 *      it into the app while still on the call
 *   4. Tells the recipient to email askmehere@canopytrove.com if they
 *      did not authorize the claim
 *
 * Why one call instead of two:
 * The legit owner who's the claimant gets verified instantly. The legit
 * owner who is NOT the claimant hears the alert and emails support.
 * The bad actor claimant has the call ring at a shop they don't control
 * and hears nothing — same physical-presence moat as before, half the
 * phone calls to the shop.
 *
 * Cooldown rules (server-enforced so the app can't bypass by reloading):
 *   - 30 minutes between calls per claim
 *   - 3 calls per claim per 24 hours
 *
 * The cooldown protects the shop's published phone from being weaponized
 * as a harassment tool by bad actors mashing "Send another call."
 *
 * Why we generate the code ourselves instead of using Twilio Verify:
 * Twilio Verify's voice channel uses a fixed TTS template ("Your X
 * verification code is ...") that doesn't include the alert wording for
 * the not-the-claimant case. Custom TwiML lets us own the script.
 *
 * Pattern matches phoneVerificationService.ts: typed errors, narrow
 * status codes, never throws plain Error objects.
 */

import crypto from 'crypto';
import { Request } from 'express';
import { serverConfig } from '../config';
import { getBackendFirebaseDb } from '../firebase';
import { logger } from '../observability/logger';
import { logSecurityEvent } from '../http/securityEventLogger';
import { resolveVerifiedRequestAccountId } from './profileAccessService';

const STOREFRONT_DETAILS_COLLECTION = 'storefront_details';
const DISPENSARY_CLAIMS_COLLECTION = 'dispensaryClaims';
const SHOP_VERIFICATION_CODES_COLLECTION = 'shopVerificationCodes';
const TWILIO_API_BASE = 'https://api.twilio.com/2010-04-01';

const CODE_TTL_MS = 15 * 60 * 1000; // 15 min — code expires this long after the call fires
const COOLDOWN_BETWEEN_CALLS_MS = 30 * 60 * 1000; // 30 min between calls
const MAX_CALLS_PER_24H = 3;
const MAX_FAILED_ATTEMPTS = 5; // After 5 wrong code entries, force re-call

export type ShopOwnershipVerificationErrorCode =
  | 'twilio_not_configured'
  | 'authentication_required'
  | 'storefront_not_found'
  | 'claim_not_found'
  | 'claim_not_owned'
  | 'shop_phone_unavailable'
  | 'invalid_verification_code'
  | 'code_expired'
  | 'cooldown_active'
  | 'daily_limit_reached'
  | 'too_many_failed_attempts'
  | 'verification_send_failed'
  | 'verification_check_failed'
  | 'shop_ownership_required';

export class ShopOwnershipVerificationError extends Error {
  public readonly statusCode: number;
  public readonly code: ShopOwnershipVerificationErrorCode;
  public readonly cooldownEndsAt: string | null;

  constructor(
    code: ShopOwnershipVerificationErrorCode,
    message: string,
    statusCode: number,
    cooldownEndsAt: string | null = null,
  ) {
    super(message);
    this.name = 'ShopOwnershipVerificationError';
    this.code = code;
    this.statusCode = statusCode;
    this.cooldownEndsAt = cooldownEndsAt;
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

type CallHistoryEntry = {
  at: string;
  sid: string;
  status: string;
};

type ShopVerificationCodeRecord = {
  ownerUid: string;
  storefrontId: string;
  codeHash: string;
  codeIssuedAt: string;
  codeExpiresAt: string;
  failedAttempts: number;
  lastCallAt: string;
  callHistory: CallHistoryEntry[];
};

function getTwilioConfig() {
  const accountSid = serverConfig.twilioAccountSid;
  const authToken = serverConfig.twilioAuthToken;
  if (!accountSid || !authToken) {
    throw new ShopOwnershipVerificationError(
      'twilio_not_configured',
      'Phone verification is not configured on the backend.',
      503,
    );
  }
  return { accountSid, authToken };
}

function buildClaimId(ownerUid: string, dispensaryId: string): string {
  return `${ownerUid}__${dispensaryId}`;
}

/**
 * Generate a random 6-digit numeric code. Uses crypto.randomInt for
 * cryptographic randomness — not Math.random, which is predictable.
 */
function generateCode(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
}

/**
 * Hash the code before storing in Firestore so even a Firestore breach
 * doesn't expose live verification codes. SHA-256 is overkill for a
 * 6-digit code but trivial to compute.
 */
function hashCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

/**
 * Constant-time comparison for code validation. Prevents timing attacks
 * (which won't work over HTTP latency anyway, but defense-in-depth).
 */
function codesMatch(submittedCode: string, storedHash: string): boolean {
  const submittedHash = hashCode(submittedCode);
  const a = Buffer.from(submittedHash, 'hex');
  const b = Buffer.from(storedHash, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

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
 * Normalize a phone string Google Places returns into E.164 for Twilio.
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

/**
 * Escape a shop name so it can't break the TwiML XML. Strips angle
 * brackets, quotes, ampersands, and caps length so a malicious storefront
 * name (extremely unlikely — this comes from our own Firestore — but
 * defense in depth) can't inject SSML or oversized payloads.
 */
function safeShopName(input: string): string {
  return (
    input
      .replace(/[<>&"']/g, ' ')
      .slice(0, 100)
      .trim() || 'this storefront'
  );
}

/**
 * Build the merged TwiML: identifies Canopy Trove, names the shop, reads
 * the code three times slowly (digit-by-digit) with pauses between
 * repetitions for typing, and ends with the alert + support email.
 *
 * Wording approved by the user — do not change without re-running a test
 * call to confirm it still sounds clear (60-65 second total runtime).
 */
function buildShopVerificationTwiml(shopName: string, code: string): string {
  const safeName = safeShopName(shopName);
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Response>',
    '  <Pause length="1"/>',
    '  <Say voice="Polly.Joanna">Hello. This is Canopy Trove.</Say>',
    '  <Pause length="1"/>',
    `  <Say voice="Polly.Joanna">Someone is trying to claim ownership of ${safeName} on the Canopy Trove app.</Say>`,
    '  <Pause length="1"/>',
    '  <Say voice="Polly.Joanna">If this is you, your six-digit verification code is:</Say>',
    '  <Pause length="1"/>',
    `  <Say voice="Polly.Joanna"><prosody rate="slow"><say-as interpret-as="digits">${code}</say-as></prosody></Say>`,
    '  <Pause length="4"/>',
    '  <Say voice="Polly.Joanna">I will say that again.</Say>',
    '  <Pause length="1"/>',
    `  <Say voice="Polly.Joanna"><prosody rate="slow"><say-as interpret-as="digits">${code}</say-as></prosody></Say>`,
    '  <Pause length="6"/>',
    '  <Say voice="Polly.Joanna">One more time:</Say>',
    '  <Pause length="1"/>',
    `  <Say voice="Polly.Joanna"><prosody rate="slow"><say-as interpret-as="digits">${code}</say-as></prosody></Say>`,
    '  <Pause length="6"/>',
    '  <Say voice="Polly.Joanna">Take your time entering the code in the Canopy Trove app.</Say>',
    '  <Pause length="3"/>',
    '  <Say voice="Polly.Joanna">If you did not authorize this claim, please email us right away at <break time="500ms"/> ask me here at canopy trove dot com so we can stop it.</Say>',
    '  <Pause length="1"/>',
    '  <Say voice="Polly.Joanna">Thank you. Goodbye.</Say>',
    '</Response>',
  ].join('\n');
}

async function placeTwilioVoiceCall(
  to: string,
  from: string,
  twiml: string,
  config: { accountSid: string; authToken: string },
): Promise<{ sid: string; status: string }> {
  const auth = Buffer.from(`${config.accountSid}:${config.authToken}`).toString('base64');
  const url = `${TWILIO_API_BASE}/Accounts/${config.accountSid}/Calls.json`;
  const body = new URLSearchParams({
    To: to,
    From: from,
    Twiml: twiml,
  });
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
    logger.error('[shopOwnershipVerification] Twilio voice call failed', {
      to,
      status: response.status,
      twilioCode,
      twilioMessage: errorRecord?.message,
    });
    if (twilioCode === 21211 || twilioCode === 21214) {
      throw new ShopOwnershipVerificationError(
        'shop_phone_unavailable',
        'The shop’s published phone number isn’t reachable for verification. Email askmehere@canopytrove.com and we will verify your ownership by phone — usually within 24 hours.',
        400,
      );
    }
    throw new ShopOwnershipVerificationError(
      'verification_send_failed',
      'Unable to place the verification call. Try again shortly, or email askmehere@canopytrove.com if it keeps failing.',
      response.status >= 500 ? 502 : 400,
    );
  }
  const result = payload as { sid?: string; status?: string };
  return {
    sid: result.sid ?? '',
    status: result.status ?? 'unknown',
  };
}

/**
 * Cooldown enforcement. Reads the existing verification record (if any)
 * and decides whether the caller is allowed to trigger another call.
 *
 * Returns null if a new call is allowed; throws a typed error otherwise.
 */
function enforceCallCooldown(record: ShopVerificationCodeRecord | null, now: number): void {
  if (!record) return;
  // 30-min between-calls cooldown
  const lastCallMs = new Date(record.lastCallAt).getTime();
  if (Number.isFinite(lastCallMs)) {
    const cooldownEndsMs = lastCallMs + COOLDOWN_BETWEEN_CALLS_MS;
    if (now < cooldownEndsMs) {
      throw new ShopOwnershipVerificationError(
        'cooldown_active',
        'Please wait before requesting another verification call. The shop’s phone shouldn’t be called too often.',
        429,
        new Date(cooldownEndsMs).toISOString(),
      );
    }
  }
  // 3 calls per 24h hard cap
  const last24hMs = now - 24 * 60 * 60 * 1000;
  const recentCalls = record.callHistory.filter((entry) => {
    const t = new Date(entry.at).getTime();
    return Number.isFinite(t) && t >= last24hMs;
  });
  if (recentCalls.length >= MAX_CALLS_PER_24H) {
    // Oldest of the 3 recent calls + 24h = when one drops off
    const oldestRecent = recentCalls
      .map((entry) => new Date(entry.at).getTime())
      .sort((a, b) => a - b)[0];
    const cooldownEndsMs = (oldestRecent ?? now) + 24 * 60 * 60 * 1000;
    throw new ShopOwnershipVerificationError(
      'daily_limit_reached',
      'This claim has reached the maximum verification calls for today. Email askmehere@canopytrove.com so we can verify your ownership by phone.',
      429,
      new Date(cooldownEndsMs).toISOString(),
    );
  }
}

/**
 * Send the merged shop-verification voice call. This is BOTH the OTP
 * delivery AND the alert call to the legitimate operator. One call,
 * two purposes.
 *
 * Auto-fires on claim submission (called server-side by
 * submitOwnerDispensaryClaim) and can be re-triggered by the owner via
 * the "Send another call" button, subject to cooldown enforcement.
 */
export async function sendShopOwnershipVerificationCall(
  request: Request,
  input: { storefrontId: unknown },
): Promise<{
  ok: true;
  storefrontId: string;
  phoneSuffix: string;
  shopName: string;
  callSid: string;
  cooldownEndsAt: string;
  callsRemainingToday: number;
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

  return sendShopOwnershipVerificationCallInternal({
    ownerUid,
    storefrontId,
    requestIp: request.ip || 'unknown',
    requestPath: request.originalUrl,
    requestMethod: request.method,
  });
}

/**
 * Internal entry point used by submitOwnerDispensaryClaim to auto-fire
 * the call on claim submission, bypassing the request-auth wrapper
 * (the caller has already established ownerUid via session middleware).
 */
export async function sendShopOwnershipVerificationCallInternal(params: {
  ownerUid: string;
  storefrontId: string;
  requestIp?: string;
  requestPath?: string;
  requestMethod?: string;
}): Promise<{
  ok: true;
  storefrontId: string;
  phoneSuffix: string;
  shopName: string;
  callSid: string;
  cooldownEndsAt: string;
  callsRemainingToday: number;
}> {
  const { ownerUid, storefrontId } = params;
  const db = getBackendFirebaseDb();
  if (!db) {
    throw new ShopOwnershipVerificationError(
      'verification_send_failed',
      'Backend database is unavailable.',
      503,
    );
  }

  const claimId = buildClaimId(ownerUid, storefrontId);
  const claimRef = db.collection(DISPENSARY_CLAIMS_COLLECTION).doc(claimId);
  const claimSnap = await claimRef.get();
  if (!claimSnap.exists) {
    throw new ShopOwnershipVerificationError(
      'claim_not_found',
      'No claim was found for this storefront. Submit a claim first.',
      404,
    );
  }
  const claim = claimSnap.data() as DispensaryClaimRecord | undefined;
  if (claim?.ownerUid !== ownerUid) {
    if (params.requestIp) {
      logSecurityEvent({
        event: 'suspicious_payload',
        ip: params.requestIp,
        path: params.requestPath || '',
        method: params.requestMethod || '',
        userId: ownerUid,
        detail: `BOLA: shop ownership verify attempt on claim ${claimId} by ${ownerUid}`,
      });
    }
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
      'No published phone number is on file for this storefront. Email askmehere@canopytrove.com and we will verify your ownership by phone — usually within 24 hours.',
      400,
    );
  }
  const phoneE164 = shopPhoneToE164(shopPhone.phone);
  if (!phoneE164) {
    throw new ShopOwnershipVerificationError(
      'shop_phone_unavailable',
      'The shop’s published phone number isn’t in a format we can call. Email askmehere@canopytrove.com and we will verify your ownership by phone.',
      400,
    );
  }

  const codeRef = db.collection(SHOP_VERIFICATION_CODES_COLLECTION).doc(claimId);
  const codeSnap = await codeRef.get();
  const existing = codeSnap.exists
    ? (codeSnap.data() as ShopVerificationCodeRecord | undefined)
    : null;
  const now = Date.now();

  // Enforce cooldown rules before placing the call. Throws if the caller
  // is rate-limited; the typed error carries cooldownEndsAt for the
  // frontend to display the countdown.
  enforceCallCooldown(existing ?? null, now);

  const twilioFromNumber = process.env.TWILIO_VOICE_FROM_NUMBER?.trim();
  if (!twilioFromNumber) {
    logger.warn(
      '[shopOwnershipVerification] TWILIO_VOICE_FROM_NUMBER not set — cannot place shop verification call',
      { ownerUid, storefrontId },
    );
    throw new ShopOwnershipVerificationError(
      'twilio_not_configured',
      'The verification system is not yet configured. Email askmehere@canopytrove.com and we will verify your ownership manually.',
      503,
    );
  }

  const code = generateCode();
  const codeHash = hashCode(code);
  const issuedAt = new Date(now).toISOString();
  const expiresAt = new Date(now + CODE_TTL_MS).toISOString();
  const twiml = buildShopVerificationTwiml(shopPhone.displayName, code);

  const config = getTwilioConfig();
  const callResult = await placeTwilioVoiceCall(phoneE164, twilioFromNumber, twiml, config);

  const newCallEntry: CallHistoryEntry = {
    at: issuedAt,
    sid: callResult.sid,
    status: callResult.status,
  };
  const updatedHistory = [...(existing?.callHistory ?? []), newCallEntry].slice(-10);
  const updatedRecord: ShopVerificationCodeRecord = {
    ownerUid,
    storefrontId,
    codeHash,
    codeIssuedAt: issuedAt,
    codeExpiresAt: expiresAt,
    failedAttempts: 0, // reset failed-attempt counter on every fresh call
    lastCallAt: issuedAt,
    callHistory: updatedHistory,
  };
  await codeRef.set(updatedRecord, { merge: false });

  // Mirror notification status onto the claim so admin review can see
  // that the merged call fired (replaces the old shopClaimNotificationSentAt).
  await claimRef.set(
    {
      shopClaimNotificationSentAt: issuedAt,
      shopClaimNotificationStatus: callResult.status,
      updatedAt: issuedAt,
    },
    { merge: true },
  );

  const last24hMs = now - 24 * 60 * 60 * 1000;
  const callsInLast24h = updatedHistory.filter((entry) => {
    const t = new Date(entry.at).getTime();
    return Number.isFinite(t) && t >= last24hMs;
  }).length;
  const callsRemainingToday = Math.max(0, MAX_CALLS_PER_24H - callsInLast24h);
  const cooldownEndsAt = new Date(now + COOLDOWN_BETWEEN_CALLS_MS).toISOString();

  logger.info('[shopOwnershipVerification] Verification call placed', {
    ownerUid,
    storefrontId,
    phoneSuffix: phoneE164.slice(-4),
    callSid: callResult.sid,
    callsRemainingToday,
  });

  return {
    ok: true,
    storefrontId,
    phoneSuffix: phoneE164.slice(-4),
    shopName: shopPhone.displayName,
    callSid: callResult.sid,
    cooldownEndsAt,
    callsRemainingToday,
  };
}

/**
 * Validate the OTP code the owner heard on the call. On success, marks
 * the claim as shopOwnershipVerified — this is the field the admin
 * review gate checks.
 *
 * Failed-attempt tracking: after MAX_FAILED_ATTEMPTS wrong codes, the
 * stored code is invalidated and the owner must trigger a new call. This
 * stops bad-actor brute-forcing of the 6-digit code space (1M attempts).
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
  if (!code || !/^\d{6}$/.test(code)) {
    throw new ShopOwnershipVerificationError(
      'invalid_verification_code',
      'Enter the six-digit verification code we read out on the call.',
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

  const codeRef = db.collection(SHOP_VERIFICATION_CODES_COLLECTION).doc(claimId);
  const codeSnap = await codeRef.get();
  if (!codeSnap.exists) {
    throw new ShopOwnershipVerificationError(
      'invalid_verification_code',
      'No active verification code. Tap "Send another call" to receive a new one.',
      400,
    );
  }
  const record = codeSnap.data() as ShopVerificationCodeRecord;

  const now = Date.now();
  const expiresAtMs = new Date(record.codeExpiresAt).getTime();
  if (!Number.isFinite(expiresAtMs) || now > expiresAtMs) {
    throw new ShopOwnershipVerificationError(
      'code_expired',
      'That code has expired. Tap "Send another call" to receive a new one.',
      400,
    );
  }

  if ((record.failedAttempts ?? 0) >= MAX_FAILED_ATTEMPTS) {
    throw new ShopOwnershipVerificationError(
      'too_many_failed_attempts',
      'Too many incorrect attempts on this code. Tap "Send another call" to receive a new one.',
      400,
    );
  }

  if (!codesMatch(code, record.codeHash)) {
    await codeRef.set(
      {
        failedAttempts: (record.failedAttempts ?? 0) + 1,
      },
      { merge: true },
    );
    logSecurityEvent({
      event: 'auth_failure',
      ip: request.ip || 'unknown',
      path: request.originalUrl,
      method: request.method,
      userId: ownerUid,
      detail: `Shop ownership code rejected for storefront ${storefrontId} (attempt ${(record.failedAttempts ?? 0) + 1})`,
    });
    throw new ShopOwnershipVerificationError(
      'invalid_verification_code',
      'That code is incorrect. Double-check and try again, or tap "Send another call".',
      400,
    );
  }

  // Code matched. Persist the verified state and clean up the code doc
  // so it can't be reused.
  const verifiedAt = new Date(now).toISOString();
  const shopPhone = await getShopPublishedPhone(storefrontId);
  const phoneE164 = shopPhone ? shopPhoneToE164(shopPhone.phone) : null;
  const phoneSuffix = phoneE164 ? phoneE164.slice(-4) : null;

  await db.collection(DISPENSARY_CLAIMS_COLLECTION).doc(claimId).set(
    {
      shopOwnershipVerified: true,
      shopOwnershipVerifiedAt: verifiedAt,
      shopOwnershipVerifiedPhoneSuffix: phoneSuffix,
      updatedAt: verifiedAt,
    },
    { merge: true },
  );
  // Delete the live code so a stale code can't be replayed.
  await codeRef.delete().catch(() => undefined);

  logger.info('[shopOwnershipVerification] Shop ownership verified', {
    ownerUid,
    storefrontId,
    phoneSuffix,
  });

  // Fire-and-forget auto-approval attempt. The legit-owner case where
  // shop-phone OTP succeeds + OCM cross-reference matches is the bulk of
  // claims and shouldn't sit in the admin queue waiting for a human
  // rubber-stamp. Lazy import keeps the cold-start surface narrow and
  // avoids a circular dep with adminReviewService.
  //
  // For bulk-cluster members (the verified claim has a bulkClaimBatchId),
  // we ALSO try the cluster auto-approval path. The chain may approve
  // sibling locations that haven't been individually OTP-verified yet
  // (2-shop cluster: one OTP unlocks both; 3+ shop cluster: two OTPs
  // unlock all). Both calls are idempotent and fail-soft.
  void (async () => {
    try {
      const { tryAutoApproveClaim, tryAutoApproveClaimsBatch } =
        await import('./claimAutoApprovalService');
      await tryAutoApproveClaim({ ownerUid, dispensaryId: storefrontId });

      // Cluster trigger — load this claim doc to see if it's part of a batch.
      const claimSnap = await db.collection(DISPENSARY_CLAIMS_COLLECTION).doc(claimId).get();
      const bulkClaimBatchId = claimSnap.exists
        ? ((claimSnap.data() as { bulkClaimBatchId?: string })?.bulkClaimBatchId ?? null)
        : null;
      if (bulkClaimBatchId) {
        const { BULK_VERIFICATION_BATCHES_COLLECTION } = await import('../constants/collections');
        const batchSnap = await db
          .collection(BULK_VERIFICATION_BATCHES_COLLECTION)
          .doc(bulkClaimBatchId)
          .get();
        const batchClaimIds = batchSnap.exists
          ? ((batchSnap.data() as { claimIds?: string[] })?.claimIds ?? [])
          : [];
        if (batchClaimIds.length > 1) {
          await tryAutoApproveClaimsBatch({
            ownerUid,
            // Put the just-verified claim first so it's the primary anchor
            // in the chain evaluation (its OCM record drives the
            // entity_name match for siblings).
            claimIds: [claimId, ...batchClaimIds.filter((id: string) => id !== claimId)],
          });
        }
      }
    } catch (error) {
      // Auto-approval is opportunistic — never let its failures bubble
      // up to the OTP-confirm response. The claim stays pending for
      // manual review either way.
      logger.warn('[shopOwnershipVerification] Auto-approval attempt threw', {
        ownerUid,
        storefrontId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  })();

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

// Keep the old export name as an alias so existing routes don't break
// during the merge. Routes can update to the new name on their next pass.
export const sendShopOwnershipVerificationCode = sendShopOwnershipVerificationCall;

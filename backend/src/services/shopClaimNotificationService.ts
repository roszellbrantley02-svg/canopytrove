/**
 * Shop Claim Notification — out-of-band alert to the legitimate operator.
 *
 * When ANY claim is filed for a storefront, this service places a voice
 * call to the shop's published phone number (from Google Places) with a
 * text-to-speech message:
 *
 *   "This is Canopy Trove. We just received an ownership claim for
 *    [Shop Name]. If this was not authorized by your business, please
 *    email ask me here at canopy trove dot com to dispute. Thank you."
 *
 * Why a NOTIFICATION not a verification:
 * - Verification (shopOwnershipVerificationService) requires the OWNER
 *   to enter a code received on the shop phone. That blocks legitimate
 *   owners who can't access the shop phone (landlines, off-site
 *   management, etc.).
 * - Notification just leaves a message. ANYONE who answers the shop
 *   phone — owner, manager, staff, even an answering service — hears
 *   the alert and can flag it. The legitimate operator gets warned no
 *   matter who's claiming.
 *
 * This is the part of the original "send SMS to the shop" idea that
 * survives the landline-doesn't-work problem: an alert that ALWAYS goes
 * out, regardless of which verification path the claimant takes.
 *
 * Idempotent: a unique claim → exactly one notification call. Persists
 * shopClaimNotificationSentAt on the dispensary claim doc so we never
 * double-call the same shop for the same claim.
 *
 * Fail-soft: if Twilio rejects (landline doesn't accept calls, no
 * published phone, etc.) we log and move on. The notification is a
 * defense-in-depth signal, not a hard requirement.
 */

import { Request } from 'express';
import { serverConfig } from '../config';
import { getBackendFirebaseDb } from '../firebase';
import { logger } from '../observability/logger';
import { resolveVerifiedRequestAccountId } from './profileAccessService';

const STOREFRONT_DETAILS_COLLECTION = 'storefront_details';
const DISPENSARY_CLAIMS_COLLECTION = 'dispensaryClaims';
const TWILIO_API_BASE = 'https://api.twilio.com/2010-04-01';

export type ShopClaimNotificationErrorCode =
  | 'twilio_not_configured'
  | 'authentication_required'
  | 'storefront_not_found'
  | 'claim_not_found'
  | 'claim_not_owned'
  | 'shop_phone_unavailable'
  | 'already_notified'
  | 'notification_failed';

export class ShopClaimNotificationError extends Error {
  public readonly statusCode: number;
  public readonly code: ShopClaimNotificationErrorCode;

  constructor(code: ShopClaimNotificationErrorCode, message: string, statusCode: number) {
    super(message);
    this.name = 'ShopClaimNotificationError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

type StorefrontDetailRecord = {
  phone?: string | null;
  displayName?: string | null;
};

type DispensaryClaimRecord = {
  ownerUid?: string;
  dispensaryId?: string;
  shopClaimNotificationSentAt?: string | null;
  shopClaimNotificationStatus?: string | null;
};

function buildClaimId(ownerUid: string, dispensaryId: string): string {
  return `${ownerUid}__${dispensaryId}`;
}

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

function getTwilioConfig() {
  const accountSid = serverConfig.twilioAccountSid;
  const authToken = serverConfig.twilioAuthToken;
  if (!accountSid || !authToken) {
    throw new ShopClaimNotificationError(
      'twilio_not_configured',
      'Twilio is not configured on the backend.',
      503,
    );
  }
  return { accountSid, authToken };
}

/**
 * Build the TwiML payload Twilio Voice plays back when the shop phone
 * is answered. The slow + spaced spelling of the support email is
 * deliberate — call recipients hear it once, no chance to scroll back.
 *
 * Polly.Joanna voice = US English neural female, the most clearly-
 * articulated standard option Twilio offers for English TTS.
 */
function buildNotificationTwiml(shopName: string): string {
  const safeName = shopName.replace(/[<>&"']/g, ' ').slice(0, 100);
  // Pause between sentences so listeners can process; spell out the
  // support email letter-by-letter so it lands clearly on a phone call.
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Response>',
    '  <Pause length="1"/>',
    '  <Say voice="Polly.Joanna">',
    `    This is Canopy Trove with an important notice for ${safeName}.`,
    '  </Say>',
    '  <Pause length="1"/>',
    '  <Say voice="Polly.Joanna">',
    '    We just received an ownership claim for your business listing on Canopy Trove.',
    '    If you authorized this, no action is needed.',
    '  </Say>',
    '  <Pause length="1"/>',
    '  <Say voice="Polly.Joanna">',
    '    If this was not authorized by your business, please email us right away at',
    '    <break time="500ms"/>',
    '    a s k m e h e r e at canopy trove dot com.',
    '  </Say>',
    '  <Pause length="1"/>',
    '  <Say voice="Polly.Joanna">',
    '    Once again, that is a s k m e h e r e at canopy trove dot com.',
    '    Thank you.',
    '  </Say>',
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
    logger.error('[shopClaimNotification] Twilio voice call failed', {
      to,
      status: response.status,
      twilioCode: errorRecord?.code,
      twilioMessage: errorRecord?.message,
    });
    throw new ShopClaimNotificationError(
      'notification_failed',
      `Unable to notify the shop's published phone (Twilio code ${errorRecord?.code ?? response.status}).`,
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
 * Send a notification call to the shop's published phone alerting the
 * legitimate operator that an ownership claim was just filed. Idempotent:
 * if a notification was already sent for this claim, returns
 * { ok: true, alreadyNotified: true } without dialing again.
 *
 * This is intentionally fail-soft. We persist the result regardless of
 * whether the call succeeded — a failed notification doesn't block claim
 * processing because admin will manually verify ownership in the slow path
 * when needed.
 */
export async function notifyShopOfPendingClaim(
  request: Request,
  input: { storefrontId: unknown },
): Promise<{
  ok: true;
  alreadyNotified: boolean;
  callStatus: string;
  phoneSuffix: string | null;
}> {
  const ownerUid = await resolveVerifiedRequestAccountId(request);
  if (!ownerUid) {
    throw new ShopClaimNotificationError(
      'authentication_required',
      'Sign in to notify the shop.',
      401,
    );
  }

  const storefrontId = typeof input.storefrontId === 'string' ? input.storefrontId.trim() : '';
  if (!storefrontId) {
    throw new ShopClaimNotificationError('storefront_not_found', 'No storefront specified.', 400);
  }

  const db = getBackendFirebaseDb();
  if (!db) {
    throw new ShopClaimNotificationError(
      'notification_failed',
      'Backend database is unavailable.',
      503,
    );
  }

  const claimId = buildClaimId(ownerUid, storefrontId);
  const claimRef = db.collection(DISPENSARY_CLAIMS_COLLECTION).doc(claimId);
  const claimSnap = await claimRef.get();
  if (!claimSnap.exists) {
    throw new ShopClaimNotificationError(
      'claim_not_found',
      'No claim was found for this storefront. Submit a claim first.',
      404,
    );
  }
  const claim = claimSnap.data() as DispensaryClaimRecord | undefined;
  if (claim?.ownerUid !== ownerUid) {
    throw new ShopClaimNotificationError(
      'claim_not_owned',
      'This claim does not belong to your account.',
      403,
    );
  }

  // Idempotency: don't double-call the same shop for the same claim.
  if (claim.shopClaimNotificationSentAt) {
    return {
      ok: true,
      alreadyNotified: true,
      callStatus: claim.shopClaimNotificationStatus ?? 'previously_sent',
      phoneSuffix: null,
    };
  }

  const detailSnap = await db.collection(STOREFRONT_DETAILS_COLLECTION).doc(storefrontId).get();
  if (!detailSnap.exists) {
    throw new ShopClaimNotificationError(
      'storefront_not_found',
      'This storefront is not in the directory.',
      404,
    );
  }
  const detail = detailSnap.data() as StorefrontDetailRecord | undefined;
  const phoneRaw = typeof detail?.phone === 'string' ? detail.phone.trim() : '';
  const phoneE164 = phoneRaw ? shopPhoneToE164(phoneRaw) : null;
  if (!phoneE164) {
    // No phone on file — record the gap and bail. Admin review path
    // handles ownership verification manually.
    await claimRef.set(
      {
        shopClaimNotificationSentAt: new Date().toISOString(),
        shopClaimNotificationStatus: 'no_phone_on_file',
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );
    throw new ShopClaimNotificationError(
      'shop_phone_unavailable',
      'No published phone number is on file for this storefront — we cannot send the alert call. Email askmehere@canopytrove.com so we can verify ownership manually.',
      400,
    );
  }

  const twilioFromNumber = process.env.TWILIO_VOICE_FROM_NUMBER?.trim();
  if (!twilioFromNumber) {
    // Twilio Voice requires a verified caller-ID phone number on the
    // account. Without one set in env, fall back to logging-only —
    // admin still gets the claim in the review queue, just no proactive
    // call to the shop. This lets the system run pre-launch without
    // requiring a Twilio number purchase.
    logger.warn(
      '[shopClaimNotification] TWILIO_VOICE_FROM_NUMBER not set — skipping shop alert call',
      { ownerUid, storefrontId },
    );
    await claimRef.set(
      {
        shopClaimNotificationSentAt: new Date().toISOString(),
        shopClaimNotificationStatus: 'skipped_no_caller_id',
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );
    return {
      ok: true,
      alreadyNotified: false,
      callStatus: 'skipped_no_caller_id',
      phoneSuffix: phoneE164.slice(-4),
    };
  }

  const config = getTwilioConfig();
  const shopName =
    (typeof detail?.displayName === 'string' && detail.displayName.trim()) || 'this storefront';
  const twiml = buildNotificationTwiml(shopName);

  let callResult: { sid: string; status: string };
  try {
    callResult = await placeTwilioVoiceCall(phoneE164, twilioFromNumber, twiml, config);
  } catch (error) {
    // Persist the failure so we don't keep retrying, then re-throw
    // typed so the route handler can map to a clean status code.
    await claimRef.set(
      {
        shopClaimNotificationSentAt: new Date().toISOString(),
        shopClaimNotificationStatus: 'twilio_failed',
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );
    throw error;
  }

  const sentAt = new Date().toISOString();
  await claimRef.set(
    {
      shopClaimNotificationSentAt: sentAt,
      shopClaimNotificationStatus: callResult.status,
      shopClaimNotificationCallSid: callResult.sid,
      shopClaimNotificationPhoneSuffix: phoneE164.slice(-4),
      updatedAt: sentAt,
    },
    { merge: true },
  );

  logger.info('[shopClaimNotification] Notification call placed', {
    ownerUid,
    storefrontId,
    phoneSuffix: phoneE164.slice(-4),
    callSid: callResult.sid,
    callStatus: callResult.status,
  });

  return {
    ok: true,
    alreadyNotified: false,
    callStatus: callResult.status,
    phoneSuffix: phoneE164.slice(-4),
  };
}

/**
 * Branded email-verification send pipeline.
 *
 * Architecture:
 *   1. Caller (POST /auth/send-verification-email) verifies the
 *      requesting user's ID token and resolves their accountId.
 *   2. We pull the Firebase Auth user record for that accountId to
 *      get the email + displayName + emailVerified state.
 *   3. If already verified, return { ok: true, alreadyVerified: true }
 *      — idempotent no-op, no email sent.
 *   4. Otherwise, generate a verification link via Firebase Admin's
 *      generateEmailVerificationLink (which encodes a one-hour-valid
 *      oobCode). The link routes through Firebase's hosted action
 *      handler at canopy-trove.firebaseapp.com/__/auth/action and
 *      redirects to continueUrl (canopytrove.com/email-verified) on
 *      success.
 *   5. Render a branded HTML+text email via buildVerificationEmail.
 *   6. Send via Resend using the existing sendTransactionalEmail
 *      wrapper. Use an idempotency key per accountId per minute so
 *      double-submits don't blast multiple emails.
 *
 * Rate limit: enforced at the route layer (1 send per accountId per
 * minute is a sane default; users who don't get the email can wait
 * one minute and tap "resend").
 */

import { getBackendFirebaseAuth } from '../firebase';
import { sendTransactionalEmail } from './emailDeliveryService';
import { buildVerificationEmail } from './emailVerificationTemplate';
import { logger } from '../observability/logger';
import { serverConfig } from '../config';

export type VerificationSendResult =
  | { ok: true; alreadyVerified: true; sent: false }
  | { ok: true; alreadyVerified: false; sent: true; providerMessageId: string | null }
  | {
      ok: false;
      reason: 'no_email' | 'auth_unavailable' | 'send_failed' | 'link_failed';
      message: string;
    };

const VERIFICATION_CONTINUE_URL = 'https://canopytrove.com/email-verified';

export async function sendBrandedVerificationEmail(input: {
  accountId: string;
}): Promise<VerificationSendResult> {
  const auth = getBackendFirebaseAuth();
  if (!auth) {
    return {
      ok: false,
      reason: 'auth_unavailable',
      message: 'Backend Firebase Auth is not configured.',
    };
  }

  let userRecord;
  try {
    userRecord = await auth.getUser(input.accountId);
  } catch (error) {
    logger.warn('[emailVerificationService] auth.getUser failed', {
      accountId: input.accountId,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      ok: false,
      reason: 'auth_unavailable',
      message: 'Could not look up your account.',
    };
  }

  if (!userRecord.email) {
    return {
      ok: false,
      reason: 'no_email',
      message: 'Your account does not have an email on file.',
    };
  }

  if (userRecord.emailVerified) {
    return { ok: true, alreadyVerified: true, sent: false };
  }

  // Generate the Firebase verification link. The link Firebase
  // produces routes through their action handler, which marks the
  // email verified server-side and redirects to continueUrl.
  let verifyUrl: string;
  try {
    verifyUrl = await auth.generateEmailVerificationLink(userRecord.email, {
      url: VERIFICATION_CONTINUE_URL,
      handleCodeInApp: false,
    });
  } catch (error) {
    logger.warn('[emailVerificationService] generateEmailVerificationLink failed', {
      accountId: input.accountId,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      ok: false,
      reason: 'link_failed',
      message: 'Could not generate a verification link. Try again in a minute.',
    };
  }

  const footerAddress =
    serverConfig.emailFooterAddress?.trim() ||
    'Canopy Trove, 5942 New Hartford St, Wolcott NY 14590';

  const email = buildVerificationEmail({
    recipientName: userRecord.displayName ?? null,
    verifyUrl,
    footerAddress,
  });

  // Idempotency per account per minute: lets the route layer accept
  // double-taps from the same user without firing two emails. Resend
  // honors Idempotency-Key for ~24h.
  const idempotencyKey = `verify_email:${input.accountId}:${Math.floor(Date.now() / 60_000)}`;

  const sendResult = await sendTransactionalEmail({
    to: userRecord.email,
    subject: email.subject,
    html: email.html,
    text: email.text,
    idempotencyKey,
    tags: [{ name: 'kind', value: 'email_verification' }],
  });

  if (!sendResult.ok) {
    logger.warn('[emailVerificationService] send failed', {
      accountId: input.accountId,
      provider: sendResult.provider,
      code: sendResult.code,
      message: sendResult.message,
    });
    return {
      ok: false,
      reason: 'send_failed',
      message: sendResult.message,
    };
  }

  logger.info('[emailVerificationService] verification email sent', {
    accountId: input.accountId,
    providerMessageId: sendResult.id,
  });

  return {
    ok: true,
    alreadyVerified: false,
    sent: true,
    providerMessageId: sendResult.id,
  };
}

import { randomBytes } from 'node:crypto';
import {
  getBackendFirebaseAuth,
  getBackendFirebaseDb,
  hasBackendFirebaseConfig,
} from '../firebase';
import { sendTransactionalEmail } from './emailDeliveryService';
import { sendSecurityNotification } from './securityNotificationService';
import { revokeAllUserSessions } from './sessionRevocationService';
import { logger } from '../observability/logger';
import { logSecurityEvent } from '../http/securityEventLogger';

/**
 * Email Change Service — Dual-Channel Confirmation
 *
 * OWASP recommends:
 * 1. Notify the OLD email that a change was requested
 * 2. Send a confirmation link to the NEW email
 * 3. Only complete the change when the new email is confirmed
 * 4. Require re-authentication before initiating the change
 * 5. Invalidate all sessions after the change completes
 *
 * Flow:
 * 1. User re-authenticates (handled by recentAuthGuard middleware)
 * 2. User submits new email address
 * 3. System creates a pending email change record in Firestore
 * 4. System sends notification to OLD email ("your email is being changed")
 * 5. System sends confirmation link to NEW email
 * 6. User clicks confirmation link
 * 7. System updates Firebase Auth email
 * 8. System revokes all sessions
 * 9. System sends confirmation to NEW email ("email changed successfully")
 */

const EMAIL_CHANGE_COLLECTION = 'pending_email_changes';
const EMAIL_CHANGE_TOKEN_BYTES = 32;
const EMAIL_CHANGE_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

type PendingEmailChange = {
  uid: string;
  oldEmail: string;
  newEmail: string;
  token: string;
  createdAt: string;
  expiresAt: string;
  status: 'pending' | 'confirmed' | 'expired' | 'cancelled';
};

type EmailChangeInitResult =
  | { ok: true; message: string }
  | { ok: false; code: string; message: string };

type EmailChangeConfirmResult =
  | { ok: true; message: string }
  | { ok: false; code: string; message: string };

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function generateSecureToken(): string {
  return randomBytes(EMAIL_CHANGE_TOKEN_BYTES).toString('hex');
}

/**
 * Step 1: Initiate an email change request.
 * - Creates a pending record with a secure token
 * - Notifies the old email
 * - Sends confirmation link to new email
 */
export async function initiateEmailChange(
  uid: string,
  newEmail: string,
  meta?: { ip?: string; displayName?: string | null; confirmUrl?: string },
): Promise<EmailChangeInitResult> {
  if (!hasBackendFirebaseConfig) {
    return { ok: false, code: 'not_configured', message: 'Auth service not configured.' };
  }

  const auth = getBackendFirebaseAuth();
  const db = getBackendFirebaseDb();
  if (!auth || !db) {
    return { ok: false, code: 'not_available', message: 'Auth service not available.' };
  }

  // Get current user data
  let currentUser;
  try {
    currentUser = await auth.getUser(uid);
  } catch {
    return { ok: false, code: 'user_not_found', message: 'User account not found.' };
  }

  const oldEmail = currentUser.email;
  if (!oldEmail) {
    return { ok: false, code: 'no_current_email', message: 'No email on current account.' };
  }

  if (oldEmail.toLowerCase() === newEmail.toLowerCase()) {
    return { ok: false, code: 'same_email', message: 'New email is the same as current email.' };
  }

  // Check if new email is already in use
  try {
    await auth.getUserByEmail(newEmail);
    // If we get here, the email is taken — but we return a generic message
    // to prevent enumeration
    return {
      ok: false,
      code: 'email_unavailable',
      message: 'This email address cannot be used.',
    };
  } catch {
    // Email not found — this is the expected path
  }

  // Cancel any existing pending changes for this user
  const existingChanges = await db
    .collection(EMAIL_CHANGE_COLLECTION)
    .where('uid', '==', uid)
    .where('status', '==', 'pending')
    .get();

  const batch = db.batch();
  for (const doc of existingChanges.docs) {
    batch.update(doc.ref, { status: 'cancelled' });
  }

  // Create new pending change
  const token = generateSecureToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + EMAIL_CHANGE_EXPIRY_MS);

  const pendingChange: PendingEmailChange = {
    uid,
    oldEmail,
    newEmail,
    token,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    status: 'pending',
  };

  const docRef = db.collection(EMAIL_CHANGE_COLLECTION).doc();
  batch.set(docRef, pendingChange);
  await batch.commit();

  logSecurityEvent({
    event: 'suspicious_payload', // Using closest available type
    ip: meta?.ip ?? 'unknown',
    path: '/account/email-change',
    method: 'POST',
    userId: uid,
    detail: `Email change initiated: ${oldEmail} → ${newEmail}`,
  });

  // Notify OLD email
  await sendSecurityNotification({
    type: 'email_changed',
    recipientEmail: oldEmail,
    recipientName: meta?.displayName,
    details: {
      'New email': newEmail,
      'IP address': meta?.ip ?? 'Unknown',
    },
  });

  // Send confirmation to NEW email
  const confirmUrl = meta?.confirmUrl
    ? `${meta.confirmUrl}?token=${encodeURIComponent(token)}`
    : undefined;

  await sendTransactionalEmail({
    to: newEmail,
    subject: 'Confirm your new Canopy Trove email address',
    html: buildConfirmationHtml(meta?.displayName ?? null, confirmUrl ?? null, token),
    text: buildConfirmationText(meta?.displayName ?? null, confirmUrl ?? null, token),
    tags: [
      { name: 'category', value: 'security' },
      { name: 'event', value: 'email_change_confirmation' },
    ],
  });

  logger.info('[emailChange] Initiated', { uid, oldEmail, newEmail });
  return { ok: true, message: 'Confirmation email sent to your new address.' };
}

/**
 * Step 2: Confirm the email change with the token from the confirmation email.
 */
export async function confirmEmailChange(
  token: string,
  meta?: { ip?: string },
): Promise<EmailChangeConfirmResult> {
  if (!hasBackendFirebaseConfig) {
    return { ok: false, code: 'not_configured', message: 'Auth service not configured.' };
  }

  const auth = getBackendFirebaseAuth();
  const db = getBackendFirebaseDb();
  if (!auth || !db) {
    return { ok: false, code: 'not_available', message: 'Auth service not available.' };
  }

  // Find the pending change by token
  const snapshot = await db
    .collection(EMAIL_CHANGE_COLLECTION)
    .where('token', '==', token)
    .where('status', '==', 'pending')
    .limit(1)
    .get();

  if (snapshot.empty) {
    return {
      ok: false,
      code: 'invalid_token',
      message: 'This confirmation link is invalid or has expired.',
    };
  }

  const doc = snapshot.docs[0];
  const pendingChange = doc.data() as PendingEmailChange;

  // Check expiry
  if (new Date(pendingChange.expiresAt) < new Date()) {
    await doc.ref.update({ status: 'expired' });
    return {
      ok: false,
      code: 'token_expired',
      message: 'This confirmation link has expired. Please request a new email change.',
    };
  }

  // Update Firebase Auth email
  try {
    await auth.updateUser(pendingChange.uid, { email: pendingChange.newEmail });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('[emailChange] Failed to update Firebase Auth email', {
      uid: pendingChange.uid,
      error: message,
    });
    return {
      ok: false,
      code: 'update_failed',
      message: 'Failed to update email address. Please try again.',
    };
  }

  // Mark as confirmed
  await doc.ref.update({ status: 'confirmed', confirmedAt: new Date().toISOString() });

  // Revoke all sessions (OWASP recommended)
  await revokeAllUserSessions(pendingChange.uid, 'email_change', {
    ip: meta?.ip,
    path: '/account/email-change/confirm',
  });

  // Send confirmation to the new email
  await sendSecurityNotification({
    type: 'email_changed',
    recipientEmail: pendingChange.newEmail,
    details: {
      'Previous email': pendingChange.oldEmail,
      Status: 'Email address updated successfully',
    },
  });

  logger.info('[emailChange] Confirmed', {
    uid: pendingChange.uid,
    oldEmail: pendingChange.oldEmail,
    newEmail: pendingChange.newEmail,
  });

  return { ok: true, message: 'Email address updated successfully. Please sign in again.' };
}

function buildConfirmationHtml(
  displayName: string | null,
  confirmUrl: string | null,
  token: string,
) {
  const name = displayName?.trim() || 'there';
  const actionHtml = confirmUrl
    ? `
      <div style="margin:28px 0 24px;">
        <a href="${escapeHtml(confirmUrl)}" style="display:inline-block;padding:14px 20px;border-radius:999px;background:#8fffd1;color:#081017;font-size:14px;font-weight:700;letter-spacing:0.02em;text-decoration:none;">
          Confirm email address
        </a>
      </div>
    `
    : `
      <div style="margin:20px 0;padding:16px;border-radius:12px;background:rgba(143,255,209,0.06);border:1px solid rgba(143,255,209,0.15);">
        <p style="margin:0 0 8px;font-size:13px;color:#738680;">Your confirmation code:</p>
        <p style="margin:0;font-size:18px;font-weight:700;color:#8fffd1;letter-spacing:0.05em;word-break:break-all;">${escapeHtml(token)}</p>
      </div>
    `;

  return `
    <div style="background:#081017;padding:32px 16px;font-family:Arial,sans-serif;color:#f2f8f6;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
        <tr><td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;border-collapse:collapse;">
            <tr>
              <td style="border-radius:28px;background:linear-gradient(180deg,#111a22 0%,#0d151c 100%);border:1px solid rgba(143,255,209,0.12);padding:32px;">
                <div style="width:72px;height:4px;border-radius:999px;background:linear-gradient(90deg,#8fffd1 0%,#f5c86a 100%);margin-bottom:24px;"></div>
                <h1 style="margin:0 0 12px;font-size:26px;line-height:1.2;color:#f2f8f6;">Confirm your new email</h1>
                <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#a9b9b4;">
                  Hi ${escapeHtml(name)}, we received a request to change the email address on your Canopy Trove account to this address.
                </p>
                <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#a9b9b4;">
                  Click the button below to confirm. This link expires in 30 minutes.
                </p>
                ${actionHtml}
                <p style="margin:0;font-size:14px;line-height:1.6;color:#738680;">
                  If you did not request this change, you can safely ignore this email.
                </p>
                <div style="margin-top:24px;padding-top:20px;border-top:1px solid rgba(143,255,209,0.10);font-size:13px;line-height:1.7;color:#738680;">
                  This is an automated email from Canopy Trove.
                </div>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    </div>
  `;
}

function buildConfirmationText(
  displayName: string | null,
  confirmUrl: string | null,
  token: string,
) {
  const name = displayName?.trim() || 'there';
  const lines = [
    'Confirm your new email address',
    '',
    `Hi ${name}, we received a request to change the email address on your Canopy Trove account to this address.`,
    '',
  ];

  if (confirmUrl) {
    lines.push(`Confirm here: ${confirmUrl}`, '');
  } else {
    lines.push(`Your confirmation code: ${token}`, '');
  }

  lines.push(
    'This link expires in 30 minutes.',
    '',
    'If you did not request this change, you can safely ignore this email.',
    '',
    'This is an automated email from Canopy Trove.',
  );

  return lines.join('\n');
}

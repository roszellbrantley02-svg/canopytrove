import { sendTransactionalEmail } from './emailDeliveryService';
import { logger } from '../observability/logger';

/**
 * Security Notification Service
 *
 * Sends security-relevant alerts to users when sensitive account events occur.
 * OWASP and NIST recommend notifying users on:
 * - Password reset
 * - Email change (old and new addresses)
 * - New device or IP login
 * - MFA enrollment or removal
 * - Payout or billing info changes
 *
 * These notifications serve as a detection layer: even if an attacker
 * compromises an account, the legitimate user gets alerted immediately.
 */

type SecurityNotificationType =
  | 'password_reset'
  | 'email_changed'
  | 'new_device_login'
  | 'mfa_changed'
  | 'billing_changed'
  | 'account_deleted';

type SecurityNotificationInput = {
  type: SecurityNotificationType;
  recipientEmail: string;
  recipientName?: string | null;
  /** Additional context displayed in the notification. */
  details?: Record<string, string>;
  /** ISO timestamp of the event. Defaults to now. */
  occurredAt?: string;
};

const NOTIFICATION_SUBJECTS: Record<SecurityNotificationType, string> = {
  password_reset: 'Your Canopy Trove password was reset',
  email_changed: 'Your Canopy Trove email address was changed',
  new_device_login: 'New sign-in to your Canopy Trove account',
  mfa_changed: 'Your Canopy Trove security settings were updated',
  billing_changed: 'Your Canopy Trove billing information was updated',
  account_deleted: 'Your Canopy Trove account has been deleted',
};

const NOTIFICATION_HEADLINES: Record<SecurityNotificationType, string> = {
  password_reset: 'Your password was reset',
  email_changed: 'Your email address was changed',
  new_device_login: 'New sign-in detected',
  mfa_changed: 'Security settings updated',
  billing_changed: 'Billing information updated',
  account_deleted: 'Account deleted',
};

const NOTIFICATION_DESCRIPTIONS: Record<SecurityNotificationType, string> = {
  password_reset:
    'The password for your Canopy Trove account was recently reset. If you made this change, no further action is needed.',
  email_changed:
    'The email address on your Canopy Trove account was recently changed. If you made this change, no further action is needed.',
  new_device_login:
    'A new sign-in to your Canopy Trove account was detected from an unrecognized device or location.',
  mfa_changed:
    'The multi-factor authentication settings on your Canopy Trove account were recently updated. If you made this change, no further action is needed.',
  billing_changed:
    'The billing or payment information on your Canopy Trove account was recently updated. If you made this change, no further action is needed.',
  account_deleted:
    'Your Canopy Trove account has been deleted. All associated data will be removed in accordance with our privacy policy.',
};

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function buildDetailsHtml(details: Record<string, string>) {
  const rows = Object.entries(details)
    .filter(([, value]) => value.trim())
    .map(
      ([key, value]) =>
        `<tr>
          <td style="padding:6px 12px 6px 0;font-size:14px;color:#738680;white-space:nowrap;vertical-align:top;">${escapeHtml(key)}</td>
          <td style="padding:6px 0;font-size:14px;color:#d8e5e0;word-break:break-all;">${escapeHtml(value)}</td>
        </tr>`,
    )
    .join('');

  if (!rows) {
    return '';
  }

  return `
    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:16px 0 20px;border-collapse:collapse;width:100%;">
      ${rows}
    </table>
  `;
}

function buildDetailsText(details: Record<string, string>) {
  return Object.entries(details)
    .filter(([, value]) => value.trim())
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n');
}

function buildNotificationHtml(input: SecurityNotificationInput) {
  const headline = NOTIFICATION_HEADLINES[input.type];
  const description = NOTIFICATION_DESCRIPTIONS[input.type];
  const name = input.recipientName?.trim() || 'there';
  const detailsHtml = input.details ? buildDetailsHtml(input.details) : '';
  const timestamp = input.occurredAt ?? new Date().toISOString();

  return `
    <div style="background:#081017;padding:32px 16px;font-family:Arial,sans-serif;color:#f2f8f6;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;border-collapse:collapse;">
              <tr>
                <td style="padding:0 0 16px;text-align:center;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#738680;">
                  Security Alert
                </td>
              </tr>
              <tr>
                <td style="border-radius:28px;background:linear-gradient(180deg,#111a22 0%,#0d151c 100%);border:1px solid rgba(255,180,100,0.18);padding:32px;">
                  <div style="width:72px;height:4px;border-radius:999px;background:linear-gradient(90deg,#ffb464 0%,#ff6b6b 100%);margin-bottom:24px;"></div>
                  <h1 style="margin:0 0 12px;font-size:26px;line-height:1.2;color:#f2f8f6;">${escapeHtml(headline)}</h1>
                  <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#a9b9b4;">
                    Hi ${escapeHtml(name)}, ${escapeHtml(description.charAt(0).toLowerCase() + description.slice(1))}
                  </p>
                  ${detailsHtml}
                  <p style="margin:0 0 8px;font-size:13px;color:#738680;">
                    Time: ${escapeHtml(timestamp)}
                  </p>
                  <div style="margin-top:24px;padding:16px;border-radius:12px;background:rgba(255,107,107,0.08);border:1px solid rgba(255,107,107,0.15);">
                    <p style="margin:0;font-size:14px;line-height:1.6;color:#ffb4b4;">
                      If you did not make this change, please secure your account immediately by resetting your password and contacting support.
                    </p>
                  </div>
                  <div style="margin-top:24px;padding-top:20px;border-top:1px solid rgba(143,255,209,0.10);font-size:13px;line-height:1.7;color:#738680;">
                    This is an automated security notification from Canopy Trove. Do not reply to this email.
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
  `;
}

function buildNotificationText(input: SecurityNotificationInput) {
  const headline = NOTIFICATION_HEADLINES[input.type];
  const description = NOTIFICATION_DESCRIPTIONS[input.type];
  const name = input.recipientName?.trim() || 'there';
  const timestamp = input.occurredAt ?? new Date().toISOString();

  const lines = [
    `SECURITY ALERT: ${headline}`,
    '',
    `Hi ${name}, ${description.charAt(0).toLowerCase() + description.slice(1)}`,
    '',
  ];

  if (input.details) {
    lines.push(buildDetailsText(input.details), '');
  }

  lines.push(
    `Time: ${timestamp}`,
    '',
    'If you did not make this change, please secure your account immediately by resetting your password and contacting support.',
    '',
    'This is an automated security notification from Canopy Trove.',
  );

  return lines.join('\n');
}

export async function sendSecurityNotification(input: SecurityNotificationInput) {
  const subject = NOTIFICATION_SUBJECTS[input.type];
  if (!subject) {
    logger.warn(`[securityNotification] Unknown notification type: ${input.type}`);
    return { ok: false as const, reason: 'unknown_type' };
  }

  try {
    const result = await sendTransactionalEmail({
      to: input.recipientEmail,
      subject,
      html: buildNotificationHtml(input),
      text: buildNotificationText(input),
      tags: [
        { name: 'category', value: 'security' },
        { name: 'event', value: input.type },
      ],
    });

    if (!result.ok) {
      logger.warn(
        `[securityNotification] Failed to send ${input.type} to ${input.recipientEmail}`,
        {
          code: result.code,
          message: result.message,
        },
      );
    }

    return result;
  } catch (error) {
    logger.error(`[securityNotification] Error sending ${input.type}`, {
      error: error instanceof Error ? error.message : String(error),
    });
    return { ok: false as const, reason: 'send_error' };
  }
}

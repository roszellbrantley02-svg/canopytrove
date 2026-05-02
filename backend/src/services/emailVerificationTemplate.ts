/**
 * HTML + plain-text builder for the email-verification email.
 *
 * Pure function. Pass everything in, get { subject, html, text } back.
 * Same email-client-compat shape as dealDigestEmailTemplate.ts (table
 * layout, inline styles, system fonts, brand color tokens).
 *
 * The verifyUrl is a Firebase Auth-generated link of the form:
 *   https://canopy-trove.firebaseapp.com/__/auth/action?mode=verifyEmail&oobCode=...&continueUrl=https://canopytrove.com/email-verified
 *
 * Firebase handles the verification at its action handler, then
 * redirects to continueUrl on success.
 */

export type VerificationEmailInput = {
  recipientName: string | null;
  verifyUrl: string;
  footerAddress: string;
};

export type VerificationEmail = {
  subject: string;
  html: string;
  text: string;
};

const COLOR_BG = '#121614';
const COLOR_CARD = '#1d2421';
const COLOR_TEXT_PRIMARY = '#FFFBF7';
const COLOR_TEXT_SECONDARY = '#C4B8B0';
const COLOR_ACCENT_GREEN = '#2ECC71';
const COLOR_ACCENT_GOLD = '#E8A000';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildVerificationEmail(input: VerificationEmailInput): VerificationEmail {
  const greeting = input.recipientName
    ? `Hey ${escapeHtml(input.recipientName.split(' ')[0])},`
    : 'Hey,';
  const greetingText = input.recipientName ? `Hey ${input.recipientName.split(' ')[0]},` : 'Hey,';

  const subject = 'Verify your Canopy Trove email';

  const safeUrl = escapeHtml(input.verifyUrl);
  const safeFooterAddress = input.footerAddress
    .split('\n')
    .map((line) => escapeHtml(line.trim()))
    .filter(Boolean)
    .join('<br />');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: ${COLOR_BG}; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: ${COLOR_BG};">
    <tr>
      <td align="center" style="padding: 32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 520px;">
          <tr>
            <td style="padding: 0 0 24px 0;">
              <p style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; letter-spacing: 0.04em; text-transform: uppercase; color: ${COLOR_ACCENT_GOLD}; font-weight: 600;">Canopy Trove · Verify your email</p>
              <h1 style="margin: 8px 0 0 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 26px; line-height: 1.25; color: ${COLOR_TEXT_PRIMARY}; font-weight: 700;">${greeting}</h1>
              <p style="margin: 16px 0 0 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 16px; line-height: 1.5; color: ${COLOR_TEXT_SECONDARY};">Welcome to Canopy Trove — the licensed New York dispensary discovery app. To confirm this email belongs to you, tap the button below.</p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding: 8px 0 24px 0;">
              <a href="${safeUrl}" style="display: inline-block; background-color: ${COLOR_ACCENT_GREEN}; color: ${COLOR_BG}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 16px; font-weight: 700; text-decoration: none; padding: 14px 32px; border-radius: 10px;">Verify my email</a>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 0 24px 0;">
              <p style="margin: 0 0 8px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; line-height: 1.5; color: ${COLOR_TEXT_SECONDARY};">Or paste this link into your browser:</p>
              <p style="margin: 0; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 12px; line-height: 1.5; color: ${COLOR_TEXT_PRIMARY}; word-break: break-all;"><a href="${safeUrl}" style="color: ${COLOR_ACCENT_GREEN}; text-decoration: underline;">${safeUrl}</a></p>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 0 24px 0;">
              <p style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; line-height: 1.5; color: ${COLOR_TEXT_SECONDARY};">Verification links work for one hour. If you didn't sign up for Canopy Trove, you can ignore this email — your address won't be added to anything until you click the button.</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 0 0 0; border-top: 1px solid rgba(196, 184, 176, 0.18);">
              <p style="margin: 16px 0 0 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; line-height: 1.5; color: ${COLOR_TEXT_SECONDARY};">${safeFooterAddress}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    'Canopy Trove · Verify your email',
    '',
    greetingText,
    '',
    'Welcome to Canopy Trove — the licensed New York dispensary discovery app. To confirm this email belongs to you, open the link below.',
    '',
    `Verify: ${input.verifyUrl}`,
    '',
    "Verification links work for one hour. If you didn't sign up for Canopy Trove, you can ignore this email.",
    '',
    input.footerAddress,
  ].join('\n');

  return { subject, html, text };
}

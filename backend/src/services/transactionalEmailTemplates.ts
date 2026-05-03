type TransactionalEmailTemplate = {
  subject: string;
  html: string;
  text: string;
};

type EmailAction = {
  label: string;
  url: string;
};

type EmailShellInput = {
  preheader: string;
  title: string;
  eyebrow: string;
  subtitle: string;
  paragraphs: string[];
  highlightsTitle?: string;
  highlights?: string[];
  action?: EmailAction;
  signoff: string;
  footer: string;
};

const CANOPY_TROVE_HOME_URL = 'https://canopytrove.com';

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderEmailShell(input: EmailShellInput) {
  const paragraphHtml = input.paragraphs
    .map(
      (paragraph) =>
        `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#a9b9b4;">${escapeHtml(paragraph)}</p>`,
    )
    .join('');
  const highlightsHtml =
    input.highlights && input.highlights.length > 0
      ? `
        <div style="margin:28px 0;padding:20px 20px 4px;border-radius:20px;background:rgba(143,255,209,0.05);border:1px solid rgba(143,255,209,0.12);">
          <div style="margin:0 0 14px;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#8fffd1;">
            ${escapeHtml(input.highlightsTitle ?? 'What to do next')}
          </div>
          ${input.highlights
            .map(
              (highlight) =>
                `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#d8e5e0;">&bull; ${escapeHtml(highlight)}</p>`,
            )
            .join('')}
        </div>
      `
      : '';
  const actionHtml = input.action
    ? `
      <div style="margin:28px 0 24px;">
        <a
          href="${escapeHtml(input.action.url)}"
          style="display:inline-block;padding:14px 20px;border-radius:999px;background:#8fffd1;color:#081017;font-size:14px;font-weight:700;letter-spacing:0.02em;text-decoration:none;"
        >
          ${escapeHtml(input.action.label)}
        </a>
      </div>
    `
    : '';

  return `
    <div style="background:#081017;padding:32px 16px;font-family:Arial,sans-serif;color:#f2f8f6;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;border-collapse:collapse;">
              <tr>
                <td style="padding:0 0 16px;text-align:center;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#738680;">
                  ${escapeHtml(input.preheader)}
                </td>
              </tr>
              <tr>
                <td style="border-radius:28px;background:linear-gradient(180deg,#111a22 0%,#0d151c 100%);border:1px solid rgba(143,255,209,0.12);padding:32px;">
                  <div style="width:72px;height:4px;border-radius:999px;background:linear-gradient(90deg,#8fffd1 0%,#f5c86a 100%);margin-bottom:24px;"></div>
                  <div style="display:inline-block;border-radius:999px;padding:6px 12px;border:1px solid rgba(245,200,106,0.22);background:rgba(245,200,106,0.08);color:#ffe0a6;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">
                    ${input.eyebrow}
                  </div>
                  <h1 style="margin:20px 0 12px;font-size:30px;line-height:1.12;color:#f2f8f6;">${escapeHtml(input.title)}</h1>
                  <p style="margin:0 0 20px;font-size:17px;line-height:1.65;color:#d8e5e0;">
                    ${escapeHtml(input.subtitle)}
                  </p>
                  ${paragraphHtml}
                  ${highlightsHtml}
                  ${actionHtml}
                  <p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#d8e5e0;">${escapeHtml(input.signoff)}</p>
                  <div style="margin-top:24px;padding-top:20px;border-top:1px solid rgba(143,255,209,0.10);font-size:13px;line-height:1.7;color:#738680;">
                    ${escapeHtml(input.footer)}
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

function renderTextVersion(input: EmailShellInput) {
  const lines = [input.title, '', input.subtitle, ''];

  for (const paragraph of input.paragraphs) {
    lines.push(paragraph, '');
  }

  if (input.highlights && input.highlights.length > 0) {
    lines.push(input.highlightsTitle ?? 'What to do next', '');
    for (const highlight of input.highlights) {
      lines.push(`- ${highlight}`);
    }
    lines.push('');
  }

  if (input.action) {
    lines.push(`${input.action.label}: ${input.action.url}`, '');
  }

  lines.push(input.signoff, '', input.footer);
  return lines.join('\n');
}

export function buildMemberWelcomeEmail(input: {
  displayName: string | null;
}): TransactionalEmailTemplate {
  const recipientName = input.displayName?.trim() || 'there';
  const emailInput: EmailShellInput = {
    preheader:
      'Your account is ready. Save dispensaries, keep favorites close, and check what is live nearby.',
    eyebrow: 'Canopy Trove&trade;',
    title: 'Your Canopy Trove account is ready.',
    subtitle:
      'This is your account confirmation. Canopy Trove is ready whenever you want to check licensed dispensaries in New York.',
    paragraphs: [
      `Hi ${recipientName}, thanks for creating your Canopy Trove account.`,
      'You can now save dispensaries, keep your favorite storefronts close, and check live offers from participating stores when you want a faster read on what is active nearby.',
      'This email is your account confirmation and quick starting point. When you are ready, open Canopy Trove and start with the stores you already know or browse nearby.',
    ],
    highlightsTitle: 'What you can do next',
    highlights: [
      'Save favorite storefronts so trusted dispensaries are always easy to find again.',
      'Check live deals when you want a quick answer on what is active nearby.',
      'Share honest reviews that help other members make better decisions.',
    ],
    action: {
      label: 'Open Canopy Trove',
      url: CANOPY_TROVE_HOME_URL,
    },
    signoff:
      'If anything looks off with a storefront or you need help with your account, reply to this email and we will help.',
    // Transactional account-confirmation footer. The opt-in language was
    // moved out so this email can ship to every new signup (the previous
    // wording implied marketing opt-in, which gated the send behind a
    // checkbox that defaulted off — most real signups never received it).
    // Marketing preferences (deal digests etc.) are managed separately
    // from the profile screen.
    footer:
      'You are receiving this account confirmation because you created a Canopy Trove account. You can manage email preferences for deal digests and product updates from your profile at any time.',
  };

  return {
    subject: 'Your Canopy Trove account is ready',
    html: renderEmailShell(emailInput),
    text: renderTextVersion(emailInput),
  };
}

export function buildOwnerWelcomeEmail(input: {
  displayName: string | null;
  companyName: string | null;
}): TransactionalEmailTemplate {
  const displayName = input.displayName?.trim() || 'there';
  const companyName = input.companyName?.trim() || 'your storefront';
  const emailInput: EmailShellInput = {
    preheader:
      'Thanks for joining early. Finish verification, review your listing, and get your storefront ready for members.',
    eyebrow: 'Canopy Trove&trade;',
    title: 'Your owner account is ready.',
    subtitle:
      'Thanks for joining Canopy Trove early. This is your confirmation and the quickest path to getting your storefront ready for members.',
    paragraphs: [
      `Hi ${displayName}, thanks for creating an owner account for ${companyName}.`,
      'You are part of the first wave of storefront partners shaping how Canopy Trove feels for members across New York.',
      'The next step is simple: complete verification, review your storefront details, and publish anything you want members to see right away.',
    ],
    highlightsTitle: 'Owner checklist',
    highlights: [
      'Complete verification and claim your storefront.',
      'Review hours, listing details, and profile updates for accuracy.',
      'Publish live deals and storefront photos when you are ready.',
    ],
    action: {
      label: 'Open owner access',
      url: CANOPY_TROVE_HOME_URL,
    },
    signoff:
      'If you want help with verification, deal setup, photos, or getting your storefront ready, reply directly and we will help.',
    footer: 'This email was sent because you created or accessed a Canopy Trove owner account.',
  };

  return {
    subject: 'Your Canopy Trove owner account is ready',
    html: renderEmailShell(emailInput),
    text: renderTextVersion(emailInput),
  };
}

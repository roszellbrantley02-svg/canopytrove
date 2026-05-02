/**
 * HTML + plain-text builder for the daily deal-digest email.
 *
 * Pure function. No Firestore reads, no fetches, no env access — that's
 * all the orchestrator's job. Pass everything in, get { subject, html,
 * text } back. Easy to unit-test, easy to render in a preview tool.
 *
 * Email-client compatibility notes (why the HTML looks the way it does):
 * - Table-based layout (modern flexbox/grid is unsupported in Outlook)
 * - Inline styles only (most clients strip <style> blocks)
 * - System font stack (no @font-face — most clients ignore it)
 * - Single hard-coded color palette matching Canopy Trove tokens
 * - All <a> tags get explicit color: properties (Outlook recolors links)
 */

export type DealDigestShop = {
  storefrontId: string;
  displayName: string;
  city: string | null;
  promotionText: string;
  storefrontUrl: string;
};

export type DealDigestEmailInput = {
  recipientName: string | null;
  shops: DealDigestShop[];
  unsubscribeUrl: string;
  footerAddress: string;
  todayLabel: string; // e.g. "Saturday, May 2"
};

export type DealDigestEmail = {
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

function buildShopBlockHtml(shop: DealDigestShop): string {
  const safeName = escapeHtml(shop.displayName);
  const safeCity = shop.city ? escapeHtml(shop.city) : null;
  const safePromo = escapeHtml(shop.promotionText);
  const safeUrl = escapeHtml(shop.storefrontUrl);

  return `
    <tr>
      <td style="padding: 0 0 16px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: ${COLOR_CARD}; border-radius: 12px; border: 1px solid rgba(196, 184, 176, 0.18);">
          <tr>
            <td style="padding: 20px 22px;">
              <p style="margin: 0 0 4px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 18px; line-height: 1.3; font-weight: 600; color: ${COLOR_TEXT_PRIMARY};">${safeName}</p>
              ${safeCity ? `<p style="margin: 0 0 12px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; line-height: 1.3; color: ${COLOR_TEXT_SECONDARY};">${safeCity}</p>` : ''}
              <p style="margin: 0 0 16px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 15px; line-height: 1.5; color: ${COLOR_TEXT_PRIMARY};">${safePromo}</p>
              <a href="${safeUrl}" style="display: inline-block; background-color: ${COLOR_ACCENT_GREEN}; color: ${COLOR_BG}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; font-weight: 600; text-decoration: none; padding: 10px 18px; border-radius: 8px;">View shop</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `.trim();
}

function buildShopBlockText(shop: DealDigestShop): string {
  const cityLine = shop.city ? `\n   ${shop.city}` : '';
  return `${shop.displayName}${cityLine}
   ${shop.promotionText}
   View shop: ${shop.storefrontUrl}`;
}

export function buildDealDigestEmail(input: DealDigestEmailInput): DealDigestEmail {
  const greeting = input.recipientName
    ? `Hey ${escapeHtml(input.recipientName.split(' ')[0])},`
    : 'Hey,';
  const greetingText = input.recipientName ? `Hey ${input.recipientName.split(' ')[0]},` : 'Hey,';

  const shopCount = input.shops.length;
  const shopWord = shopCount === 1 ? 'shop' : 'shops';
  const subject =
    shopCount === 1
      ? `New deal at ${input.shops[0].displayName} on Canopy Trove`
      : `Today's deals from ${shopCount} of your saved ${shopWord} on Canopy Trove`;

  const shopBlocksHtml = input.shops.map(buildShopBlockHtml).join('\n');
  const shopBlocksText = input.shops.map(buildShopBlockText).join('\n\n');

  const safeFooterAddress = input.footerAddress
    .split('\n')
    .map((line) => escapeHtml(line.trim()))
    .filter(Boolean)
    .join('<br />');

  const safeUnsubscribeUrl = escapeHtml(input.unsubscribeUrl);

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
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 560px;">
          <tr>
            <td style="padding: 0 0 24px 0;">
              <p style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; letter-spacing: 0.04em; text-transform: uppercase; color: ${COLOR_ACCENT_GOLD}; font-weight: 600;">Canopy Trove · ${escapeHtml(input.todayLabel)}</p>
              <h1 style="margin: 8px 0 0 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 26px; line-height: 1.25; color: ${COLOR_TEXT_PRIMARY}; font-weight: 700;">${greeting}</h1>
              <p style="margin: 12px 0 0 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 16px; line-height: 1.5; color: ${COLOR_TEXT_SECONDARY};">Here ${shopCount === 1 ? 'is the latest deal' : `are today's deals`} at the ${shopCount === 1 ? 'shop' : `${shopCount} shops`} you saved on Canopy Trove.</p>
            </td>
          </tr>
          ${shopBlocksHtml}
          <tr>
            <td style="padding: 16px 0 0 0;">
              <p style="margin: 0 0 12px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; line-height: 1.5; color: ${COLOR_TEXT_SECONDARY};">You're getting this email because you saved ${shopCount === 1 ? 'this shop' : 'these shops'} on Canopy Trove. We send one digest per day, in the morning, only when there are active deals.</p>
              <p style="margin: 0 0 12px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; line-height: 1.5; color: ${COLOR_TEXT_SECONDARY};"><a href="${safeUnsubscribeUrl}" style="color: ${COLOR_ACCENT_GREEN}; text-decoration: underline;">Unsubscribe from deal digests</a> · One click, no login required.</p>
              <p style="margin: 24px 0 0 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; line-height: 1.5; color: ${COLOR_TEXT_SECONDARY};">${safeFooterAddress}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    `Canopy Trove · ${input.todayLabel}`,
    '',
    greetingText,
    '',
    `Here ${shopCount === 1 ? 'is the latest deal' : `are today's deals`} at the ${shopCount === 1 ? 'shop' : `${shopCount} shops`} you saved on Canopy Trove.`,
    '',
    shopBlocksText,
    '',
    `You're getting this because you saved ${shopCount === 1 ? 'this shop' : 'these shops'} on Canopy Trove. One digest per day, only when there are active deals.`,
    '',
    `Unsubscribe (one click): ${input.unsubscribeUrl}`,
    '',
    input.footerAddress,
  ].join('\n');

  return { subject, html, text };
}

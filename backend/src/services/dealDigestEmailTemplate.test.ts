import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildDealDigestEmail } from './dealDigestEmailTemplate';

const baseInput = {
  recipientName: 'Renee Smith',
  unsubscribeUrl: 'https://api.canopytrove.com/email/unsubscribe?token=abc',
  footerAddress: 'Canopy Trove\n5942 New Hartford St\nWolcott, NY 14590',
  todayLabel: 'Saturday, May 2',
};

test('subject is shop-specific when only one shop has a deal', () => {
  const email = buildDealDigestEmail({
    ...baseInput,
    shops: [
      {
        storefrontId: 'ocm-1',
        displayName: 'The Coughie Shop',
        city: 'Wolcott, NY',
        promotionText: '15% off all pre-rolls today only',
        storefrontUrl: 'https://app.canopytrove.com/storefronts/ocm-1',
      },
    ],
  });
  assert.match(email.subject, /The Coughie Shop/);
  assert.match(email.subject, /Canopy Trove/);
});

test('subject says "X of your saved shops" when multiple shops have deals', () => {
  const email = buildDealDigestEmail({
    ...baseInput,
    shops: [
      {
        storefrontId: 'ocm-1',
        displayName: 'A',
        city: null,
        promotionText: 'Deal A',
        storefrontUrl: 'https://app.canopytrove.com/storefronts/ocm-1',
      },
      {
        storefrontId: 'ocm-2',
        displayName: 'B',
        city: null,
        promotionText: 'Deal B',
        storefrontUrl: 'https://app.canopytrove.com/storefronts/ocm-2',
      },
      {
        storefrontId: 'ocm-3',
        displayName: 'C',
        city: null,
        promotionText: 'Deal C',
        storefrontUrl: 'https://app.canopytrove.com/storefronts/ocm-3',
      },
    ],
  });
  assert.match(email.subject, /3 of your saved shops/);
});

test('greeting uses recipient first name', () => {
  const email = buildDealDigestEmail({
    ...baseInput,
    shops: [
      {
        storefrontId: 'ocm-1',
        displayName: 'X',
        city: null,
        promotionText: 'P',
        storefrontUrl: 'https://app.canopytrove.com/storefronts/ocm-1',
      },
    ],
  });
  assert.match(email.html, /Hey Renee,/);
  assert.match(email.text, /Hey Renee,/);
});

test('falls back to generic greeting when name is null', () => {
  const email = buildDealDigestEmail({
    ...baseInput,
    recipientName: null,
    shops: [
      {
        storefrontId: 'ocm-1',
        displayName: 'X',
        city: null,
        promotionText: 'P',
        storefrontUrl: 'https://app.canopytrove.com/storefronts/ocm-1',
      },
    ],
  });
  assert.match(email.html, /Hey,/);
  assert.match(email.text, /Hey,/);
});

test('includes the unsubscribe URL in both html and text', () => {
  const email = buildDealDigestEmail({
    ...baseInput,
    shops: [
      {
        storefrontId: 'ocm-1',
        displayName: 'X',
        city: null,
        promotionText: 'P',
        storefrontUrl: 'https://app.canopytrove.com/storefronts/ocm-1',
      },
    ],
  });
  assert.ok(email.html.includes(baseInput.unsubscribeUrl));
  assert.ok(email.text.includes(baseInput.unsubscribeUrl));
});

test('renders footer address with line breaks in HTML', () => {
  const email = buildDealDigestEmail({
    ...baseInput,
    shops: [
      {
        storefrontId: 'ocm-1',
        displayName: 'X',
        city: null,
        promotionText: 'P',
        storefrontUrl: 'https://app.canopytrove.com/storefronts/ocm-1',
      },
    ],
  });
  assert.match(email.html, /Canopy Trove<br \/>5942 New Hartford St<br \/>Wolcott, NY 14590/);
  assert.ok(email.text.includes('5942 New Hartford St'));
});

test('escapes HTML in shop name and promotion text', () => {
  const email = buildDealDigestEmail({
    ...baseInput,
    shops: [
      {
        storefrontId: 'ocm-1',
        displayName: '<script>alert(1)</script>Bad Co',
        city: null,
        promotionText: 'Save "30%" today & all weekend',
        storefrontUrl: 'https://app.canopytrove.com/storefronts/ocm-1',
      },
    ],
  });
  assert.ok(!email.html.includes('<script>'));
  assert.match(email.html, /&lt;script&gt;/);
  assert.match(email.html, /&quot;30%&quot;/);
  assert.match(email.html, /today &amp; all weekend/);
});

test('text version contains shop name and promotion', () => {
  const email = buildDealDigestEmail({
    ...baseInput,
    shops: [
      {
        storefrontId: 'ocm-1',
        displayName: 'Shop One',
        city: 'Wolcott, NY',
        promotionText: 'Deal one',
        storefrontUrl: 'https://app.canopytrove.com/storefronts/ocm-1',
      },
      {
        storefrontId: 'ocm-2',
        displayName: 'Shop Two',
        city: null,
        promotionText: 'Deal two',
        storefrontUrl: 'https://app.canopytrove.com/storefronts/ocm-2',
      },
    ],
  });
  assert.ok(email.text.includes('Shop One'));
  assert.ok(email.text.includes('Wolcott, NY'));
  assert.ok(email.text.includes('Deal one'));
  assert.ok(email.text.includes('Shop Two'));
  assert.ok(email.text.includes('Deal two'));
});

import assert from 'node:assert/strict';
import path from 'node:path';
import { afterEach, beforeEach, test } from 'node:test';

const originalFetch = global.fetch;

function clearBackendModuleCache() {
  const backendSourceRoot = `${path.resolve(__dirname, '..')}${path.sep}`;
  for (const modulePath of Object.keys(require.cache)) {
    if (modulePath.includes(backendSourceRoot)) {
      delete require.cache[modulePath];
    }
  }
}

beforeEach(() => {
  delete process.env.EMAIL_DELIVERY_PROVIDER;
  delete process.env.RESEND_API_KEY;
  delete process.env.EMAIL_FROM_ADDRESS;
  delete process.env.EMAIL_REPLY_TO_ADDRESS;
  delete process.env.WELCOME_EMAILS_ENABLED;
  process.env.STOREFRONT_BACKEND_SOURCE = 'mock';
  clearBackendModuleCache();
});

afterEach(async () => {
  global.fetch = originalFetch;
  clearBackendModuleCache();
  const { clearOwnerWelcomeEmailMemoryStateForTests } = await import('./ownerWelcomeEmailService');
  clearOwnerWelcomeEmailMemoryStateForTests();
});

test('marks the owner welcome email as pending when delivery is not configured', async () => {
  const { sendOwnerWelcomeEmailIfNeeded } = await import('./ownerWelcomeEmailService');

  const result = await sendOwnerWelcomeEmailIfNeeded({
    ownerUid: 'owner-1',
    email: 'owner@example.com',
    displayName: 'Canopy Owner',
    companyName: 'Canopy Shop',
  });

  assert.equal(result.welcomeEmailState, 'pending_provider');
  assert.equal(result.welcomeEmailSentAt, null);
});

test('sends the owner welcome email only once when resend is configured', async () => {
  process.env.EMAIL_DELIVERY_PROVIDER = 'resend';
  process.env.RESEND_API_KEY = 're_test';
  process.env.EMAIL_FROM_ADDRESS = 'askmehere@canopytrove.com';
  process.env.EMAIL_REPLY_TO_ADDRESS = 'askmehere@canopytrove.com';
  clearBackendModuleCache();

  const fetchCalls: Array<{ url: string; init?: RequestInit }> = [];
  global.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    fetchCalls.push({
      url: typeof url === 'string' ? url : url.toString(),
      init,
    });
    return new Response(JSON.stringify({ id: 'email_owner_123' }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }) as typeof fetch;

  const { sendOwnerWelcomeEmailIfNeeded } = await import('./ownerWelcomeEmailService');

  const firstResult = await sendOwnerWelcomeEmailIfNeeded({
    ownerUid: 'owner-2',
    email: 'owner2@example.com',
    displayName: 'Owner Two',
    companyName: 'Owner Two Dispensary',
  });
  const secondResult = await sendOwnerWelcomeEmailIfNeeded({
    ownerUid: 'owner-2',
    email: 'owner2@example.com',
    displayName: 'Owner Two',
    companyName: 'Owner Two Dispensary',
  });

  assert.equal(firstResult.welcomeEmailState, 'sent');
  assert.ok(firstResult.welcomeEmailSentAt);
  assert.equal(secondResult.welcomeEmailState, 'sent');
  assert.equal(fetchCalls.length, 1);
  assert.equal(fetchCalls[0]?.url, 'https://api.resend.com/emails');
  assert.equal((fetchCalls[0]?.init?.method ?? 'GET').toUpperCase(), 'POST');
  assert.deepEqual(fetchCalls[0]?.init?.headers, {
    Authorization: 'Bearer re_test',
    'Content-Type': 'application/json',
    'Idempotency-Key': 'owner-welcome:owner-2',
  });
  const payload = JSON.parse(String(fetchCalls[0]?.init?.body)) as Record<string, unknown>;
  assert.equal(payload.from, 'askmehere@canopytrove.com');
  assert.deepEqual(payload.to, ['owner2@example.com']);
  assert.equal(payload.reply_to, 'askmehere@canopytrove.com');
  assert.equal(payload.subject, 'Your Canopy Trove owner account is ready');
  assert.deepEqual(payload.tags, [
    {
      name: 'email_type',
      value: 'owner_welcome',
    },
    {
      name: 'audience',
      value: 'owner',
    },
  ]);
  assert.equal(typeof payload.html, 'string');
  assert.equal(typeof payload.text, 'string');
});

test('applies complaint webhook events to the stored owner welcome email state', async () => {
  process.env.EMAIL_DELIVERY_PROVIDER = 'resend';
  process.env.RESEND_API_KEY = 're_test';
  process.env.EMAIL_FROM_ADDRESS = 'askmehere@canopytrove.com';
  clearBackendModuleCache();

  global.fetch = (async () =>
    new Response(JSON.stringify({ id: 'email_owner_delivery_1' }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    })) as typeof fetch;

  const {
    recordOwnerWelcomeEmailDeliveryEvent,
    sendOwnerWelcomeEmailIfNeeded,
  } = await import('./ownerWelcomeEmailService');

  const sendStatus = await sendOwnerWelcomeEmailIfNeeded({
    ownerUid: 'owner-delivery-1',
    email: 'owner-delivery-1@example.com',
    displayName: 'Owner Delivery',
    companyName: 'Delivery Dispensary',
  });

  assert.equal(sendStatus.welcomeEmailState, 'sent');

  const complainedStatus = await recordOwnerWelcomeEmailDeliveryEvent({
    providerMessageId: 'email_owner_delivery_1',
    providerEventId: 'wh_owner_123',
    eventType: 'email.complained',
    occurredAt: '2026-04-01T13:10:00.000Z',
    summary: 'Recipient marked this message as spam.',
  });

  assert.ok(complainedStatus);
  assert.equal(complainedStatus?.welcomeEmailState, 'complained');
  assert.equal(complainedStatus?.welcomeEmailLastEventType, 'email.complained');
  assert.equal(
    complainedStatus?.welcomeEmailLastEventSummary,
    'Recipient marked this message as spam.'
  );
});

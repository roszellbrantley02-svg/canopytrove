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
  const { clearMemberEmailSubscriptionMemoryStateForTests } =
    await import('./memberEmailSubscriptionService');
  clearMemberEmailSubscriptionMemoryStateForTests();
});

test('stores a subscription even when email delivery is not configured', async () => {
  const { syncMemberEmailSubscription } = await import('./memberEmailSubscriptionService');

  const result = await syncMemberEmailSubscription({
    accountId: 'member-1',
    email: 'hello@example.com',
    displayName: 'Canopy Member',
    subscribed: true,
    source: 'member_signup',
  });

  assert.equal(result.subscribed, true);
  assert.equal(result.email, 'hello@example.com');
  assert.equal(result.source, 'member_signup');
  assert.equal(result.welcomeEmailState, 'pending_provider');
  assert.equal(result.welcomeEmailSentAt, null);
});

test('sends the welcome email only once when resend is configured', async () => {
  process.env.EMAIL_DELIVERY_PROVIDER = 'resend';
  process.env.RESEND_API_KEY = 're_test';
  process.env.EMAIL_FROM_ADDRESS = 'hello@canopytrove.com';
  process.env.EMAIL_REPLY_TO_ADDRESS = 'support@canopytrove.com';
  clearBackendModuleCache();

  const fetchCalls: Array<{ url: string; init?: RequestInit }> = [];
  global.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    fetchCalls.push({
      url: typeof url === 'string' ? url : url.toString(),
      init,
    });
    return new Response(JSON.stringify({ id: 'email_123' }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }) as typeof fetch;

  const { getMemberEmailSubscriptionStatus, syncMemberEmailSubscription } =
    await import('./memberEmailSubscriptionService');

  const firstResult = await syncMemberEmailSubscription({
    accountId: 'member-2',
    email: 'member2@example.com',
    displayName: 'Canopy Two',
    subscribed: true,
    source: 'member_signup',
  });
  const secondResult = await syncMemberEmailSubscription({
    accountId: 'member-2',
    email: 'member2@example.com',
    displayName: 'Canopy Two',
    subscribed: true,
    source: 'profile',
  });
  const status = await getMemberEmailSubscriptionStatus({
    accountId: 'member-2',
    email: 'member2@example.com',
    displayName: 'Canopy Two',
  });

  assert.equal(firstResult.welcomeEmailState, 'sent');
  assert.ok(firstResult.welcomeEmailSentAt);
  assert.equal(secondResult.welcomeEmailState, 'sent');
  assert.equal(status.welcomeEmailState, 'sent');
  assert.equal(fetchCalls.length, 1);
  assert.equal(fetchCalls[0]?.url, 'https://api.resend.com/emails');
  assert.equal((fetchCalls[0]?.init?.method ?? 'GET').toUpperCase(), 'POST');
  assert.deepEqual(fetchCalls[0]?.init?.headers, {
    Authorization: 'Bearer re_test',
    'Content-Type': 'application/json',
    'Idempotency-Key': 'member-welcome:member-2',
  });
  const payload = JSON.parse(String(fetchCalls[0]?.init?.body)) as Record<string, unknown>;
  assert.equal(payload.from, 'hello@canopytrove.com');
  assert.deepEqual(payload.to, ['member2@example.com']);
  assert.equal(payload.subject, 'Your Canopy Trove account is ready');
  assert.equal(payload.reply_to, 'support@canopytrove.com');
  assert.deepEqual(payload.tags, [
    {
      name: 'email_type',
      value: 'member_welcome',
    },
    {
      name: 'audience',
      value: 'member',
    },
  ]);
  assert.equal(typeof payload.html, 'string');
  assert.equal(typeof payload.text, 'string');
});

test('does not send the welcome email as a side effect of a status read', async () => {
  const { getMemberEmailSubscriptionStatus, syncMemberEmailSubscription } =
    await import('./memberEmailSubscriptionService');

  const pendingResult = await syncMemberEmailSubscription({
    accountId: 'member-4',
    email: 'member4@example.com',
    displayName: 'Canopy Four',
    subscribed: true,
    source: 'member_signup',
  });

  assert.equal(pendingResult.welcomeEmailState, 'pending_provider');

  process.env.EMAIL_DELIVERY_PROVIDER = 'resend';
  process.env.RESEND_API_KEY = 're_test';
  process.env.EMAIL_FROM_ADDRESS = 'hello@canopytrove.com';
  process.env.EMAIL_REPLY_TO_ADDRESS = 'support@canopytrove.com';

  const fetchCalls: Array<{ url: string; init?: RequestInit }> = [];
  global.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    fetchCalls.push({
      url: typeof url === 'string' ? url : url.toString(),
      init,
    });
    return new Response(JSON.stringify({ id: 'email_456' }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }) as typeof fetch;

  const status = await getMemberEmailSubscriptionStatus({
    accountId: 'member-4',
    email: 'member4@example.com',
    displayName: 'Canopy Four',
  });

  assert.equal(status.welcomeEmailState, 'pending_provider');
  assert.equal(fetchCalls.length, 0);
});

test('refreshes consentedAt when a member unsubscribes and later opts back in', async () => {
  const { syncMemberEmailSubscription } = await import('./memberEmailSubscriptionService');

  const initialOptIn = await syncMemberEmailSubscription({
    accountId: 'member-5',
    email: 'member5@example.com',
    displayName: 'Canopy Five',
    subscribed: true,
    source: 'member_signup',
  });

  await new Promise((resolve) => setTimeout(resolve, 5));

  const optOut = await syncMemberEmailSubscription({
    accountId: 'member-5',
    email: 'member5@example.com',
    displayName: 'Canopy Five',
    subscribed: false,
    source: 'profile',
  });

  await new Promise((resolve) => setTimeout(resolve, 5));

  const reOptIn = await syncMemberEmailSubscription({
    accountId: 'member-5',
    email: 'member5@example.com',
    displayName: 'Canopy Five',
    subscribed: true,
    source: 'profile',
  });

  assert.equal(optOut.subscribed, false);
  assert.ok(initialOptIn.consentedAt);
  assert.ok(reOptIn.consentedAt);
  assert.notEqual(reOptIn.consentedAt, initialOptIn.consentedAt);
});

test('applies delivered webhook events to the stored member welcome email state', async () => {
  process.env.EMAIL_DELIVERY_PROVIDER = 'resend';
  process.env.RESEND_API_KEY = 're_test';
  process.env.EMAIL_FROM_ADDRESS = 'hello@canopytrove.com';
  clearBackendModuleCache();

  global.fetch = (async () =>
    new Response(JSON.stringify({ id: 'email_member_delivery_1' }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    })) as typeof fetch;

  const {
    getMemberEmailSubscriptionStatus,
    recordMemberWelcomeEmailDeliveryEvent,
    syncMemberEmailSubscription,
  } = await import('./memberEmailSubscriptionService');

  const sendStatus = await syncMemberEmailSubscription({
    accountId: 'member-delivery-1',
    email: 'member-delivery-1@example.com',
    displayName: 'Member Delivery',
    subscribed: true,
    source: 'member_signup',
  });

  assert.equal(sendStatus.welcomeEmailState, 'sent');

  const deliveredStatus = await recordMemberWelcomeEmailDeliveryEvent({
    providerMessageId: 'email_member_delivery_1',
    providerEventId: 'wh_123',
    eventType: 'email.delivered',
    occurredAt: '2026-04-01T13:00:00.000Z',
  });

  assert.ok(deliveredStatus);
  assert.equal(deliveredStatus?.welcomeEmailState, 'delivered');
  assert.equal(deliveredStatus?.welcomeEmailLastEventType, 'email.delivered');
  assert.equal(deliveredStatus?.welcomeEmailLastEventAt, '2026-04-01T13:00:00.000Z');

  const readStatus = await getMemberEmailSubscriptionStatus({
    accountId: 'member-delivery-1',
    email: 'member-delivery-1@example.com',
    displayName: 'Member Delivery',
  });

  assert.equal(readStatus.welcomeEmailState, 'delivered');
  assert.equal(readStatus.welcomeEmailLastEventType, 'email.delivered');
});

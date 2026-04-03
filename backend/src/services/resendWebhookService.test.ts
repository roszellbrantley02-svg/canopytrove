import assert from 'node:assert/strict';
import path from 'node:path';
import { afterEach, beforeEach, test } from 'node:test';
import { Webhook } from 'svix';

const originalFetch = global.fetch;
const testWebhookSecret = 'whsec_dGVzdF9zZWNyZXRfdmFsdWU=';

function clearBackendModuleCache() {
  const backendSourceRoot = `${path.resolve(__dirname, '..')}${path.sep}`;
  for (const modulePath of Object.keys(require.cache)) {
    if (modulePath.includes(backendSourceRoot)) {
      delete require.cache[modulePath];
    }
  }
}

function createSignedHeaders(secret: string, messageId: string, timestamp: Date, payload: string) {
  const webhook = new Webhook(secret);
  return {
    'svix-id': messageId,
    'svix-timestamp': Math.floor(timestamp.getTime() / 1000).toString(),
    'svix-signature': webhook.sign(messageId, timestamp, payload),
  };
}

beforeEach(() => {
  delete process.env.EMAIL_DELIVERY_PROVIDER;
  delete process.env.RESEND_API_KEY;
  delete process.env.EMAIL_FROM_ADDRESS;
  delete process.env.EMAIL_REPLY_TO_ADDRESS;
  delete process.env.RESEND_WEBHOOK_SECRET;
  process.env.STOREFRONT_BACKEND_SOURCE = 'mock';
  clearBackendModuleCache();
});

afterEach(async () => {
  global.fetch = originalFetch;
  clearBackendModuleCache();
  const { clearMemberEmailSubscriptionMemoryStateForTests } = await import(
    './memberEmailSubscriptionService'
  );
  clearMemberEmailSubscriptionMemoryStateForTests();
  const { clearResendWebhookMemoryStateForTests } = await import('./resendWebhookService');
  clearResendWebhookMemoryStateForTests();
});

test('stores resend webhook events once and applies them to member welcome emails', async () => {
  process.env.EMAIL_DELIVERY_PROVIDER = 'resend';
  process.env.RESEND_API_KEY = 're_test';
  process.env.EMAIL_FROM_ADDRESS = 'hello@canopytrove.com';
  process.env.RESEND_WEBHOOK_SECRET = testWebhookSecret;
  clearBackendModuleCache();

  global.fetch = (async () =>
    new Response(JSON.stringify({ id: 'email_delivery_member_1' }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    })) as typeof fetch;

  const { syncMemberEmailSubscription, getMemberEmailSubscriptionStatus } = await import(
    './memberEmailSubscriptionService'
  );
  const { listResendWebhookEvents, processResendWebhook } = await import('./resendWebhookService');
  const now = new Date();

  const sendStatus = await syncMemberEmailSubscription({
    accountId: 'member-webhook-1',
    email: 'member-webhook-1@example.com',
    displayName: 'Webhook Member',
    subscribed: true,
    source: 'member_signup',
  });

  assert.equal(sendStatus.welcomeEmailState, 'sent');

  const payload = JSON.stringify({
    type: 'email.delivered',
    created_at: now.toISOString(),
    data: {
      email_id: 'email_delivery_member_1',
      to: ['member-webhook-1@example.com'],
      subject: 'Your Canopy Trove account is ready',
    },
  });
  const headers = createSignedHeaders(
    testWebhookSecret,
    'msg_member_webhook_1',
    now,
    payload
  );

  const firstResult = await processResendWebhook({
    rawBody: payload,
    headers,
  });
  const duplicateResult = await processResendWebhook({
    rawBody: payload,
    headers,
  });
  const updatedStatus = await getMemberEmailSubscriptionStatus({
    accountId: 'member-webhook-1',
    email: 'member-webhook-1@example.com',
    displayName: 'Webhook Member',
  });
  const events = await listResendWebhookEvents();

  assert.equal(firstResult.duplicate, false);
  assert.equal(firstResult.matchedTarget, 'member');
  assert.equal(duplicateResult.duplicate, true);
  assert.equal(updatedStatus.welcomeEmailState, 'delivered');
  assert.equal(events.count, 1);
  assert.equal(events.items[0]?.eventType, 'email.delivered');
});

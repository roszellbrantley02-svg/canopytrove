import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { AddressInfo } from 'node:net';
import path from 'node:path';
import type { Server } from 'node:http';
import type { OwnerStorefrontPromotionDocument } from '../../src/types/ownerPortal';
import { Webhook } from 'svix';

let activeServer: Server | null = null;
const testStorefrontId = 'ocm-10923-garnerville-202-cannabis-co';
const testWebhookSecret = 'whsec_dGVzdF9zZWNyZXRfdmFsdWU=';

beforeEach(() => {
  delete process.env.ADMIN_API_KEY;
  delete process.env.CORS_ORIGIN;
  process.env.NODE_ENV = 'test';
  delete process.env.EMAIL_DELIVERY_PROVIDER;
  delete process.env.RESEND_API_KEY;
  delete process.env.RESEND_WEBHOOK_SECRET;
  delete process.env.EMAIL_FROM_ADDRESS;
  process.env.STOREFRONT_BACKEND_SOURCE = 'mock';
  process.env.ALLOW_DEV_SEED = 'false';
  process.env.READ_RATE_LIMIT_PER_MINUTE = '240';
  process.env.WRITE_RATE_LIMIT_PER_MINUTE = '60';
  process.env.ADMIN_RATE_LIMIT_PER_TEN_MINUTES = '10';
});

afterEach(async () => {
  if (activeServer) {
    await new Promise<void>((resolve, reject) => {
      activeServer?.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
    activeServer = null;
  }

  const { clearRateLimitState } = await import('./http/rateLimit');
  clearRateLimitState();
  const { clearAbuseState } = await import('./http/abuseScoring');
  clearAbuseState();
  const { clearBolaTrackingState } = await import('./http/ownershipGuard');
  clearBolaTrackingState();
  const { clearStorefrontBackendCache } = await import('./services/storefrontCacheService');
  clearStorefrontBackendCache();
  const { clearAnalyticsEventState } = await import('./services/analyticsEventService');
  clearAnalyticsEventState();
  const { clearStorefrontCommunityMemoryStateForTests } =
    await import('./services/storefrontCommunityService');
  clearStorefrontCommunityMemoryStateForTests();
  const { clearCommunitySafetyMemoryStateForTests } =
    await import('./services/communitySafetyStateService');
  clearCommunitySafetyMemoryStateForTests();
  const { clearMemberEmailSubscriptionMemoryStateForTests } =
    await import('./services/memberEmailSubscriptionService');
  clearMemberEmailSubscriptionMemoryStateForTests();
  const { clearOwnerWelcomeEmailMemoryStateForTests } =
    await import('./services/ownerWelcomeEmailService');
  clearOwnerWelcomeEmailMemoryStateForTests();
  const { clearResendWebhookMemoryStateForTests } = await import('./services/resendWebhookService');
  clearResendWebhookMemoryStateForTests();
  const { clearRouteStateMemoryStateForTests } = await import('./services/routeStateService');
  clearRouteStateMemoryStateForTests();
  const { clearProfileMemoryStateForTests } = await import('./services/profileService');
  clearProfileMemoryStateForTests();
  const { clearGamificationPersistenceStateForTests } =
    await import('./services/gamificationPersistenceService');
  clearGamificationPersistenceStateForTests();
  const { clearReviewPhotoModerationMemoryStateForTests } =
    await import('./services/reviewPhotoModerationService');
  clearReviewPhotoModerationMemoryStateForTests();
  const { clearRuntimeOpsMemoryStateForTests } = await import('./services/runtimeOpsService');
  clearRuntimeOpsMemoryStateForTests();
  const { clearBackendFirebaseTestStateForTests } = await import('./firebase');
  clearBackendFirebaseTestStateForTests();
  const { clearLaunchProgramMemoryStateForTests } = await import('./services/launchProgramService');
  clearLaunchProgramMemoryStateForTests();
  const { clearStorefrontDiscoveryRepositoryState, stopStorefrontDiscoveryScheduler } =
    await import('./services/storefrontDiscoveryOrchestrationService');
  clearStorefrontDiscoveryRepositoryState();
  stopStorefrontDiscoveryScheduler();
  const {
    ownerStorefrontPromotionStore,
    ownerStorefrontPromotionCache,
    storefrontSummaryEnhancementCache,
    storefrontDetailEnhancementCache,
  } = await import('./services/ownerPortalWorkspaceData');
  ownerStorefrontPromotionStore.clear();
  ownerStorefrontPromotionCache.clear();
  storefrontSummaryEnhancementCache.clear();
  storefrontDetailEnhancementCache.clear();
});

async function startTestServer() {
  const backendSourceRoot = `${path.resolve(__dirname)}${path.sep}`;
  for (const modulePath of Object.keys(require.cache)) {
    if (modulePath.includes(backendSourceRoot)) {
      delete require.cache[modulePath];
    }
  }

  const { createApp } = await import('./app');
  const app = createApp();

  const server = app.listen(0);
  activeServer = server;

  await new Promise<void>((resolve, reject) => {
    server.once('listening', () => resolve());
    server.once('error', (error) => reject(error));
  });

  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  return {
    baseUrl,
  };
}

async function request(baseUrl: string, path: string, init?: RequestInit) {
  const response = await fetch(`${baseUrl}${path}`, init);
  const text = await response.text();

  return {
    status: response.status,
    json: text ? (JSON.parse(text) as Record<string, unknown>) : null,
    headers: response.headers,
  };
}

function createSignedWebhookHeaders(
  secret: string,
  webhookId: string,
  occurredAt: Date,
  payload: string,
) {
  const webhook = new Webhook(secret);
  return {
    'svix-id': webhookId,
    'svix-timestamp': Math.floor(occurredAt.getTime() / 1000).toString(),
    'svix-signature': webhook.sign(webhookId, occurredAt, payload),
  };
}

function createReviewPayload(profileId: string, overrides?: Record<string, unknown>) {
  return {
    profileId,
    authorName: 'Canopy Trove user',
    rating: 5,
    text: 'This storefront was fast, easy to navigate, and worth the stop.',
    tags: ['Helpful staff'],
    ...overrides,
  };
}

function createReportPayload(profileId: string, overrides?: Record<string, unknown>) {
  return {
    profileId,
    authorName: 'Canopy Trove user',
    reason: 'Listing issue',
    description: 'The storefront details appear to be inaccurate and need review.',
    ...overrides,
  };
}

function createPromotionRecord(
  overrides?: Partial<OwnerStorefrontPromotionDocument>,
): OwnerStorefrontPromotionDocument {
  const now = Date.now();
  const startsAt = new Date(now - 60 * 60 * 1000).toISOString();
  const endsAt = new Date(now + 24 * 60 * 60 * 1000).toISOString();

  return {
    id: `promotion-${Math.random().toString(36).slice(2, 10)}`,
    storefrontId: testStorefrontId,
    ownerUid: 'owner-1',
    title: 'Live storefront deal',
    description: 'Fresh live deal copy for the customer cards.',
    badges: ['Live Deal'],
    startsAt,
    endsAt,
    status: 'active',
    audiences: ['new_customers'],
    alertFollowersOnStart: true,
    cardTone: 'hot_deal',
    placementSurfaces: ['browse', 'nearby', 'hot_deals'],
    placementScope: 'storefront_area',
    followersAlertedAt: null,
    createdAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
    ...overrides,
  };
}

test('rejects invalid storefront summary pagination', async () => {
  const { baseUrl } = await startTestServer();
  const response = await request(baseUrl, '/storefront-summaries?limit=999');

  assert.equal(response.status, 400);
  assert.equal(response.json?.error, 'limit must be at most 24.');
});

test('rejects malformed community review payloads', async () => {
  const { baseUrl } = await startTestServer();
  const response = await request(baseUrl, `/storefront-details/${testStorefrontId}/reviews`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      profileId: 'profile-1',
      rating: 6,
      text: 'test',
    }),
  });

  assert.equal(response.status, 400);
  assert.equal(response.json?.error, 'body.rating must be at most 5.');
});

test('returns the canonical authenticated profile for the current account', async () => {
  const { baseUrl } = await startTestServer();
  // Import after startTestServer(), which clears backend modules from the cache.
  // The test needs to write through the same in-memory service instance the app uses.
  const { saveGamificationState } = await import('./services/gamificationPersistenceService');
  await fetch(`${baseUrl}/profile-state/profile-empty`, {
    method: 'PUT',
    headers: {
      Authorization: 'Bearer test-authenticated:member-1',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      profile: {
        accountId: 'member-1',
        kind: 'authenticated',
        displayName: 'Daniellett',
        createdAt: '2026-04-07T15:17:54.720Z',
        updatedAt: '2026-04-10T10:26:26.796Z',
      },
    }),
  });
  await fetch(`${baseUrl}/profile-state/profile-rich`, {
    method: 'PUT',
    headers: {
      Authorization: 'Bearer test-authenticated:member-1',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      profile: {
        accountId: 'member-1',
        kind: 'authenticated',
        displayName: 'Daniellett',
        createdAt: '2026-04-06T14:28:51.387Z',
        updatedAt: '2026-04-09T01:18:18.995Z',
      },
    }),
  });
  // Gamification state is server-authoritative (stripped by the PUT endpoint),

  // so set it directly via the persistence service.
  await saveGamificationState('profile-empty', {
    totalPoints: 0,
    totalReviews: 0,
    dispensariesVisited: 0,
    badges: ['early_adopter'],
  });
  await saveGamificationState('profile-rich', {
    totalPoints: 1195,
    totalReviews: 3,
    dispensariesVisited: 0,
    badges: ['reviewer_1', 'early_adopter'],
  });
  const response = await request(baseUrl, '/profiles/me/canonical', {
    headers: {
      Authorization: 'Bearer test-authenticated:member-1',
    },
  });

  assert.equal(response.status, 200);
  assert.equal(response.json?.id, 'profile-rich');
  assert.equal(response.json?.accountId, 'member-1');
});

test('strips client-supplied gamification state from profile writes', async () => {
  const { baseUrl } = await startTestServer();
  const response = await request(baseUrl, '/profile-state/profile-forged', {
    method: 'PUT',
    headers: {
      Authorization: 'Bearer test-authenticated:member-9',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      profile: {
        accountId: 'member-9',
        kind: 'authenticated',
        displayName: 'Forged Player',
      },
      gamificationState: {
        totalPoints: 9999,
        totalReviews: 50,
        dispensariesVisited: 25,
        badges: ['admin_badge'],
      },
    }),
  });

  const gamificationState = response.json?.gamificationState as
    | {
        totalPoints?: unknown;
        totalReviews?: unknown;
        dispensariesVisited?: unknown;
      }
    | undefined;

  assert.equal(response.status, 200);
  assert.equal(gamificationState?.totalPoints, 0);
  assert.equal(gamificationState?.totalReviews, 0);
  assert.equal(gamificationState?.dispensariesVisited, 0);
});

test('exports subscribed member emails through the admin route', async () => {
  process.env.ADMIN_API_KEY = 'admin-test-key';
  const { syncMemberEmailSubscription } = await import('./services/memberEmailSubscriptionService');
  await syncMemberEmailSubscription({
    accountId: 'member-1',
    email: 'member-1@example.com',
    displayName: 'Canopy One',
    subscribed: true,
    source: 'member_signup',
  });
  await syncMemberEmailSubscription({
    accountId: 'member-2',
    email: 'member-2@example.com',
    displayName: 'Canopy Two',
    subscribed: false,
    source: 'profile',
  });

  const { baseUrl } = await startTestServer();
  const response = await request(baseUrl, '/admin/email-subscriptions', {
    headers: {
      'x-admin-api-key': 'admin-test-key',
    },
  });
  const csvResponse = await fetch(`${baseUrl}/admin/email-subscriptions?format=csv`, {
    headers: {
      'x-admin-api-key': 'admin-test-key',
    },
  });
  const csvBody = await csvResponse.text();

  assert.equal(response.status, 200);
  assert.equal(response.json?.count, 1);
  assert.equal(
    (response.json?.items as Array<{ email?: string }>)?.[0]?.email,
    'member-1@example.com',
  );
  assert.equal(csvResponse.status, 200);
  assert.match(csvBody, /member-1@example\.com/);
  assert.doesNotMatch(csvBody, /member-2@example\.com/);
});

test('accepts signed resend webhook events and exposes them through the admin route', async () => {
  process.env.ADMIN_API_KEY = 'admin-test-key';
  process.env.EMAIL_DELIVERY_PROVIDER = 'resend';
  process.env.RESEND_API_KEY = 're_test';
  process.env.EMAIL_FROM_ADDRESS = 'hello@canopytrove.com';
  process.env.RESEND_WEBHOOK_SECRET = testWebhookSecret;

  const originalFetch = global.fetch;
  global.fetch = (async () =>
    new Response(JSON.stringify({ id: 'email_admin_webhook_1' }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    })) as typeof fetch;

  try {
    const { syncMemberEmailSubscription } =
      await import('./services/memberEmailSubscriptionService');
    await syncMemberEmailSubscription({
      accountId: 'member-admin-webhook',
      email: 'member-admin-webhook@example.com',
      displayName: 'Admin Webhook',
      subscribed: true,
      source: 'member_signup',
    });
    global.fetch = originalFetch;

    const { baseUrl } = await startTestServer();
    const now = new Date();
    const payload = JSON.stringify({
      type: 'email.bounced',
      created_at: now.toISOString(),
      data: {
        email_id: 'email_admin_webhook_1',
        to: ['member-admin-webhook@example.com'],
        subject: 'Your Canopy Trove account is ready',
        bounce: {
          message: 'Unknown recipient',
          type: 'Permanent',
        },
      },
    });
    const response = await request(baseUrl, '/email/webhooks/resend', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...createSignedWebhookHeaders(testWebhookSecret, 'msg_admin_webhook_1', now, payload),
      },
      body: payload,
    });
    const adminResponse = await request(baseUrl, '/admin/email-delivery-events?limit=10', {
      headers: {
        'x-admin-api-key': 'admin-test-key',
      },
    });

    assert.equal(response.status, 200, JSON.stringify(response.json));
    assert.equal(response.json?.matchedTarget, 'member');
    assert.equal(adminResponse.status, 200);
    assert.equal(adminResponse.json?.count, 1);
    assert.equal(
      (adminResponse.json?.items as Array<{ eventType?: string }>)?.[0]?.eventType,
      'email.bounced',
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test('rejects resend webhook events with an invalid signature', async () => {
  process.env.RESEND_WEBHOOK_SECRET = testWebhookSecret;

  const { baseUrl } = await startTestServer();
  const payload = JSON.stringify({
    type: 'email.delivered',
    created_at: '2026-04-01T14:10:00.000Z',
    data: {
      email_id: 'email_invalid_signature',
      to: ['invalid@example.com'],
      subject: 'Your Canopy Trove account is ready',
    },
  });
  const response = await request(baseUrl, '/email/webhooks/resend', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'svix-id': 'msg_invalid_signature',
      'svix-timestamp': '1711980600',
      'svix-signature': 'v1,invalid',
    },
    body: payload,
  });

  assert.equal(response.status, 400);
  assert.match(String(response.json?.error), /signature/i);
});

test('blocks duplicate reviews from the same profile on one storefront', async () => {
  const { baseUrl } = await startTestServer();
  const firstResponse = await request(baseUrl, `/storefront-details/${testStorefrontId}/reviews`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer test-authenticated:account-1',
    },
    body: JSON.stringify(createReviewPayload('profile-1')),
  });
  const duplicateResponse = await request(
    baseUrl,
    `/storefront-details/${testStorefrontId}/reviews`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-authenticated:account-1',
      },
      body: JSON.stringify(
        createReviewPayload('profile-1', {
          text: 'Trying to leave another review on the same storefront.',
        }),
      ),
    },
  );

  assert.equal(firstResponse.status, 200);
  assert.equal(duplicateResponse.status, 409);
  assert.equal(
    duplicateResponse.json?.error,
    'You already reviewed this storefront recently. Edit your existing review or wait before submitting a new one.',
  );
});

test('allows a review author to edit their existing review', async () => {
  const { baseUrl } = await startTestServer();
  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: 'Bearer test-authenticated:account-1',
  };
  const createResponse = await request(baseUrl, `/storefront-details/${testStorefrontId}/reviews`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify(createReviewPayload('profile-1')),
  });

  const createdDetail = createResponse.json?.detail as
    | {
        appReviews?: Array<{ id?: string; isOwnReview?: boolean }>;
      }
    | undefined;
  const reviewId = createdDetail?.appReviews?.[0]?.id;
  assert.ok(reviewId);
  assert.equal(createdDetail?.appReviews?.[0]?.isOwnReview, true);

  const updateResponse = await request(
    baseUrl,
    `/storefront-details/${testStorefrontId}/reviews/${reviewId}`,
    {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify(
        createReviewPayload('profile-1', {
          rating: 4,
          text: 'Updated review copy after another visit to the same storefront.',
        }),
      ),
    },
  );

  assert.equal(updateResponse.status, 200);
  const updatedDetail = updateResponse.json?.detail as
    | {
        appReviews?: Array<{ id?: string; isOwnReview?: boolean; rating?: number; text?: string }>;
      }
    | undefined;
  assert.equal(updatedDetail?.appReviews?.[0]?.id, reviewId);
  assert.equal(updatedDetail?.appReviews?.[0]?.isOwnReview, true);
  assert.equal(updatedDetail?.appReviews?.[0]?.rating, 4);
  assert.equal(
    updatedDetail?.appReviews?.[0]?.text,
    'Updated review copy after another visit to the same storefront.',
  );
});

test('rejects review edits from a different profile', async () => {
  const { baseUrl } = await startTestServer();
  const createResponse = await request(baseUrl, `/storefront-details/${testStorefrontId}/reviews`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer test-authenticated:account-1',
    },
    body: JSON.stringify(createReviewPayload('profile-1')),
  });

  const createdDetail = createResponse.json?.detail as
    | {
        appReviews?: Array<{ id?: string }>;
      }
    | undefined;
  const reviewId = createdDetail?.appReviews?.[0]?.id;
  assert.ok(reviewId);

  const updateResponse = await request(
    baseUrl,
    `/storefront-details/${testStorefrontId}/reviews/${reviewId}`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-authenticated:account-2',
      },
      body: JSON.stringify(
        createReviewPayload('profile-2', {
          text: 'Trying to overwrite someone else review.',
        }),
      ),
    },
  );

  assert.equal(updateResponse.status, 403);
  assert.equal(updateResponse.json?.error, 'Only the author can edit this review.');
});

test('requires signed-in access to update a review', async () => {
  const { baseUrl } = await startTestServer();
  const createResponse = await request(baseUrl, `/storefront-details/${testStorefrontId}/reviews`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer test-authenticated:account-1',
    },
    body: JSON.stringify(createReviewPayload('profile-1')),
  });

  const createdDetail = createResponse.json?.detail as
    | {
        appReviews?: Array<{ id?: string }>;
      }
    | undefined;
  const reviewId = createdDetail?.appReviews?.[0]?.id;
  assert.ok(reviewId);

  const updateResponse = await request(
    baseUrl,
    `/storefront-details/${testStorefrontId}/reviews/${reviewId}`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(
        createReviewPayload('profile-1', {
          text: 'Unsigned users should not be able to update an existing review.',
        }),
      ),
    },
  );

  assert.equal(updateResponse.status, 403);
  assert.equal(updateResponse.json?.error, 'You must be signed in to update a review.');
});

test('requires signed-in access for review photo uploads', async () => {
  const { baseUrl } = await startTestServer();
  const response = await request(
    baseUrl,
    `/storefront-details/${testStorefrontId}/reviews/photo-uploads`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        profileId: 'profile-1',
        fileName: 'photo.jpg',
        contentType: 'image/jpeg',
        sizeBytes: 1024,
      }),
    },
  );

  assert.equal(response.status, 403);
  assert.equal(
    response.json?.error,
    'Sign-in required: a signed-in account is needed to upload review photos.',
  );
});

test('requires signed-in access for storefront reports', async () => {
  const { baseUrl } = await startTestServer();
  const response = await request(baseUrl, `/storefront-details/${testStorefrontId}/reports`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(createReportPayload('profile-1')),
  });

  assert.equal(response.status, 403);
  assert.equal(response.json?.error, 'You must be signed in to report a storefront or review.');
});

test('requires signed-in access for helpful votes', async () => {
  const { baseUrl } = await startTestServer();
  const createResponse = await request(baseUrl, `/storefront-details/${testStorefrontId}/reviews`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer test-authenticated:account-1',
    },
    body: JSON.stringify(createReviewPayload('profile-1')),
  });

  const createdDetail = createResponse.json?.detail as
    | {
        appReviews?: Array<{ id?: string }>;
      }
    | undefined;
  const reviewId = createdDetail?.appReviews?.[0]?.id;
  assert.ok(reviewId);

  const helpfulResponse = await request(
    baseUrl,
    `/storefront-details/${testStorefrontId}/reviews/${reviewId}/helpful`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        profileId: 'profile-2',
      }),
    },
  );

  assert.equal(helpfulResponse.status, 403);
  assert.equal(helpfulResponse.json?.error, 'You must be signed in to mark a review as helpful.');
});

test('stores community safety state for an authenticated profile', async () => {
  const { baseUrl } = await startTestServer();
  const saveResponse = await request(baseUrl, '/profiles/profile-1/community-safety', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer test-authenticated:account-1',
    },
    body: JSON.stringify({
      acceptedGuidelinesVersion: '2026-03-28',
      blockedReviewAuthors: [
        {
          storefrontId: 'storefront-1',
          storefrontName: 'Storefront One',
          authorId: 'author-1',
        },
      ],
    }),
  });
  const loadResponse = await request(baseUrl, '/profiles/profile-1/community-safety', {
    headers: {
      Authorization: 'Bearer test-authenticated:account-1',
    },
  });

  assert.equal(saveResponse.status, 200);
  assert.equal(saveResponse.json?.acceptedGuidelinesVersion, '2026-03-28');
  assert.deepEqual(saveResponse.json?.blockedReviewAuthors, [
    {
      storefrontId: 'storefront-1',
      storefrontName: 'Storefront One',
      authorId: 'author-1',
    },
  ]);
  assert.equal(loadResponse.status, 200);
  assert.deepEqual(loadResponse.json?.blockedReviewAuthors, [
    {
      storefrontId: 'storefront-1',
      storefrontName: 'Storefront One',
      authorId: 'author-1',
    },
  ]);
});

test('applies stricter rate limits to admin routes', async () => {
  process.env.ADMIN_API_KEY = 'admin-secret';
  const { baseUrl } = await startTestServer();

  let lastResponse = null as Awaited<ReturnType<typeof request>> | null;
  for (let index = 0; index < 11; index += 1) {
    lastResponse = await request(baseUrl, '/admin/seed-status', {
      headers: {
        'x-admin-api-key': 'admin-secret',
      },
    });
  }

  assert.ok(lastResponse);
  assert.equal(lastResponse.status, 429);
  assert.equal(lastResponse.json?.error, 'Too many requests. Please retry shortly.');
  // Retry-After includes intentional jitter (0-4s), so use a range check
  const retryAfter = Number(lastResponse.headers.get('retry-after'));
  assert.ok(retryAfter >= 598 && retryAfter <= 605, `Expected retry-after ~600, got ${retryAfter}`);
});

test('keeps public storefront reads on the shared read limiter instead of the admin limiter', async () => {
  const { baseUrl } = await startTestServer();
  const response = await request(baseUrl, '/storefront-summaries?limit=3');

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-ratelimit-limit'), '240');
  assert.notEqual(response.headers.get('x-ratelimit-reset'), '600');
});

test('keeps one featured live deal visible while hiding signed-out storefront card thumbnails', async () => {
  const { baseUrl } = await startTestServer();
  const {
    ownerStorefrontPromotionStore,
    ownerStorefrontPromotionCache,
    storefrontSummaryEnhancementCache,
  } = await import('./services/ownerPortalWorkspaceData');
  const now = Date.now();
  ownerStorefrontPromotionStore.set(testStorefrontId, [
    createPromotionRecord({
      id: 'promotion-earlier',
      title: 'Morning special',
      description: '20% off pre-rolls',
      badges: ['20% off'],
      startsAt: new Date(now - 4 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(now - 30 * 60 * 1000).toISOString(),
    }),
    createPromotionRecord({
      id: 'promotion-latest',
      title: 'Lunch drop',
      description: 'Buy one get one gummies',
      badges: ['BOGO'],
      startsAt: new Date(now - 15 * 60 * 1000).toISOString(),
      updatedAt: new Date(now - 3 * 60 * 60 * 1000).toISOString(),
    }),
  ]);
  ownerStorefrontPromotionCache.clear();
  storefrontSummaryEnhancementCache.clear();
  const response = await request(
    baseUrl,
    `/storefront-summaries/by-ids?ids=${encodeURIComponent(testStorefrontId)}`,
  );

  assert.equal(response.status, 200);
  const payload = response.json as { items?: Array<Record<string, unknown>> } | null;
  const item = payload?.items?.[0];
  assert.ok(item);
  assert.equal(item?.activePromotionId, 'promotion-latest');
  assert.equal(item?.promotionText, 'Buy one get one gummies');
  assert.equal(item?.activePromotionCount, 2);
  assert.equal(item?.thumbnailUrl, null);
});

test('publishes live owner promotions onto member storefront card payloads', async () => {
  process.env.NODE_ENV = 'test';
  const { baseUrl } = await startTestServer();
  const {
    ownerStorefrontPromotionStore,
    ownerStorefrontPromotionCache,
    storefrontSummaryEnhancementCache,
  } = await import('./services/ownerPortalWorkspaceData');
  const now = Date.now();
  ownerStorefrontPromotionStore.set(testStorefrontId, [
    createPromotionRecord({
      id: 'promotion-earlier',
      title: 'Morning special',
      description: '20% off pre-rolls',
      badges: ['20% off'],
      startsAt: new Date(now - 4 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(now - 30 * 60 * 1000).toISOString(),
    }),
    createPromotionRecord({
      id: 'promotion-latest',
      title: 'Lunch drop',
      description: 'Buy one get one gummies',
      badges: ['BOGO'],
      startsAt: new Date(now - 15 * 60 * 1000).toISOString(),
      updatedAt: new Date(now - 3 * 60 * 60 * 1000).toISOString(),
    }),
  ]);
  ownerStorefrontPromotionCache.clear();
  storefrontSummaryEnhancementCache.clear();
  const response = await request(
    baseUrl,
    `/storefront-summaries/by-ids?ids=${encodeURIComponent(testStorefrontId)}`,
    {
      headers: {
        'x-canopy-test-account-id': 'member-1',
      },
    },
  );

  assert.equal(response.status, 200);
  const payload = response.json as { items?: Array<Record<string, unknown>> } | null;
  const item = payload?.items?.[0];
  assert.ok(item);
  assert.equal(item?.activePromotionId, 'promotion-latest');
  assert.equal(item?.promotionText, 'Buy one get one gummies');
  assert.equal(item?.activePromotionCount, 2);
});

test('keeps one featured live deal visible while hiding signed-out paginated storefront browse thumbnails', async () => {
  const { baseUrl } = await startTestServer();
  const {
    ownerStorefrontPromotionStore,
    ownerStorefrontPromotionCache,
    storefrontSummaryEnhancementCache,
  } = await import('./services/ownerPortalWorkspaceData');
  ownerStorefrontPromotionStore.set(testStorefrontId, [
    createPromotionRecord({
      id: 'promotion-browse-guest',
      description: 'Members-only gummies deal',
      badges: ['Members only'],
    }),
  ]);
  ownerStorefrontPromotionCache.clear();
  storefrontSummaryEnhancementCache.clear();
  const response = await request(baseUrl, '/storefront-summaries?limit=4&offset=0');

  assert.equal(response.status, 200);
  const payload = response.json as { items?: Array<Record<string, unknown>> } | null;
  const item = payload?.items?.find((candidate) => candidate.id === testStorefrontId);
  assert.ok(item);
  assert.equal(item?.activePromotionId, 'promotion-browse-guest');
  assert.equal(item?.promotionText, 'Members-only gummies deal');
  assert.equal(item?.activePromotionCount, 1);
  assert.equal(item?.thumbnailUrl, null);
});

test('publishes live owner promotions onto member paginated storefront browse payloads', async () => {
  process.env.NODE_ENV = 'test';
  const { baseUrl } = await startTestServer();
  const {
    ownerStorefrontPromotionStore,
    ownerStorefrontPromotionCache,
    storefrontSummaryEnhancementCache,
  } = await import('./services/ownerPortalWorkspaceData');
  ownerStorefrontPromotionStore.set(testStorefrontId, [
    createPromotionRecord({
      id: 'promotion-browse-member',
      description: 'Members-only gummies deal',
      badges: ['Members only'],
    }),
  ]);
  ownerStorefrontPromotionCache.clear();
  storefrontSummaryEnhancementCache.clear();
  const response = await request(baseUrl, '/storefront-summaries?limit=4&offset=0', {
    headers: {
      Authorization: 'Bearer test-authenticated:member-1',
    },
  });

  assert.equal(response.status, 200);
  const payload = response.json as { items?: Array<Record<string, unknown>> } | null;
  const item = payload?.items?.find((candidate) => candidate.id === testStorefrontId);
  assert.ok(item);
  assert.equal(item?.activePromotionId, 'promotion-browse-member');
  assert.equal(item?.promotionText, 'Members-only gummies deal');
  assert.equal(item?.activePromotionCount, 1);
});

test('treats invalid bearer auth on public storefront browse routes as guest access', async () => {
  process.env.NODE_ENV = 'test';
  const { baseUrl } = await startTestServer();
  const {
    ownerStorefrontPromotionStore,
    ownerStorefrontPromotionCache,
    storefrontSummaryEnhancementCache,
  } = await import('./services/ownerPortalWorkspaceData');
  ownerStorefrontPromotionStore.set(testStorefrontId, [
    createPromotionRecord({
      id: 'promotion-invalid-bearer',
      description: 'Guest users should not see this',
      badges: ['Hidden'],
    }),
  ]);
  ownerStorefrontPromotionCache.clear();
  storefrontSummaryEnhancementCache.clear();
  const response = await request(baseUrl, '/storefront-summaries?limit=4&offset=0', {
    headers: {
      Authorization: 'Bearer test-invalid-token',
    },
  });

  assert.equal(response.status, 200);
  const payload = response.json as { items?: Array<Record<string, unknown>> } | null;
  const item = payload?.items?.find((candidate) => candidate.id === testStorefrontId);
  assert.ok(item);
  assert.equal(item?.activePromotionId, 'promotion-invalid-bearer');
  assert.equal(item?.promotionText, 'Guest users should not see this');
  assert.equal(item?.activePromotionCount, 1);
  assert.equal(item?.thumbnailUrl, null);
});

test('treats owner bearer auth on public storefront browse routes as guest access', async () => {
  process.env.NODE_ENV = 'test';
  const { baseUrl } = await startTestServer();
  const {
    ownerStorefrontPromotionStore,
    ownerStorefrontPromotionCache,
    storefrontSummaryEnhancementCache,
  } = await import('./services/ownerPortalWorkspaceData');
  ownerStorefrontPromotionStore.set(testStorefrontId, [
    createPromotionRecord({
      id: 'promotion-owner-bearer',
      description: 'Owner sessions should browse as guests',
      badges: ['Owner isolated'],
    }),
  ]);
  ownerStorefrontPromotionCache.clear();
  storefrontSummaryEnhancementCache.clear();
  const response = await request(baseUrl, '/storefront-summaries?limit=4&offset=0', {
    headers: {
      Authorization: 'Bearer test-owner:owner-1',
    },
  });

  assert.equal(response.status, 200);
  assert.match(response.headers.get('cache-control') ?? '', /^public,/);
  const payload = response.json as { items?: Array<Record<string, unknown>> } | null;
  const item = payload?.items?.find((candidate) => candidate.id === testStorefrontId);
  assert.ok(item);
  assert.equal(item?.activePromotionId, 'promotion-owner-bearer');
  assert.equal(item?.promotionText, 'Owner sessions should browse as guests');
  assert.equal(item?.activePromotionCount, 1);
  assert.equal(item?.thumbnailUrl, null);
});

test('ignores owner bearer auth plus X-Canopy-Profile-Id on public storefront browse routes', async () => {
  process.env.NODE_ENV = 'test';
  const { baseUrl } = await startTestServer();
  const {
    ownerStorefrontPromotionStore,
    ownerStorefrontPromotionCache,
    storefrontSummaryEnhancementCache,
  } = await import('./services/ownerPortalWorkspaceData');

  ownerStorefrontPromotionStore.set(testStorefrontId, [
    createPromotionRecord({
      id: 'promotion-owner-header-guest',
      description: 'Owner sessions with a profile header should still browse as guests',
    }),
  ]);
  ownerStorefrontPromotionCache.clear();
  storefrontSummaryEnhancementCache.clear();
  await fetch(`${baseUrl}/profile-state/profile-owner-header`, {
    method: 'PUT',
    headers: {
      Authorization: 'Bearer test-owner:owner-1',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      profile: {
        accountId: 'owner-1',
        kind: 'authenticated',
        displayName: 'Owner Session',
        createdAt: '2026-04-10T12:00:00.000Z',
        updatedAt: '2026-04-11T12:00:00.000Z',
      },
    }),
  });

  const response = await request(baseUrl, '/storefront-summaries?limit=4&offset=0', {
    headers: {
      Authorization: 'Bearer test-owner:owner-1',
      'X-Canopy-Profile-Id': 'profile-owner-header',
    },
  });

  assert.equal(response.status, 200);
  assert.match(response.headers.get('cache-control') ?? '', /^public,/);
  const payload = response.json as { items?: Array<Record<string, unknown>> } | null;
  const item = payload?.items?.find((candidate) => candidate.id === testStorefrontId);
  assert.ok(item);
  assert.equal(item?.activePromotionId, 'promotion-owner-header-guest');
  assert.equal(
    item?.promotionText,
    'Owner sessions with a profile header should still browse as guests',
  );
  assert.equal(item?.activePromotionCount, 1);
  assert.equal(item?.thumbnailUrl, null);
});

test('hides the full active promotion stack from signed-out storefront detail payloads', async () => {
  // Start the server FIRST so that the module instances (and their in-memory
  // Maps) created during import are the same ones we populate below.
  const { baseUrl } = await startTestServer();

  const {
    ownerStorefrontPromotionStore,
    ownerStorefrontPromotionCache,
    storefrontDetailEnhancementCache,
  } = await import('./services/ownerPortalWorkspaceData');
  const now = Date.now();
  ownerStorefrontPromotionStore.set(testStorefrontId, [
    createPromotionRecord({
      id: 'promotion-earlier',
      title: 'Morning special',
      description: '20% off pre-rolls',
      badges: ['20% off'],
      startsAt: new Date(now - 4 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(now - 30 * 60 * 1000).toISOString(),
    }),
    createPromotionRecord({
      id: 'promotion-latest',
      title: 'Lunch drop',
      description: 'Buy one get one gummies',
      badges: ['BOGO'],
      startsAt: new Date(now - 15 * 60 * 1000).toISOString(),
      updatedAt: new Date(now - 3 * 60 * 60 * 1000).toISOString(),
    }),
  ]);
  ownerStorefrontPromotionCache.clear();
  storefrontDetailEnhancementCache.clear();

  const response = await request(baseUrl, `/storefront-details/${testStorefrontId}`);

  assert.equal(response.status, 200);
  const detail = response.json as {
    activePromotions?: Array<{ id?: string; description?: string; badges?: string[] }>;
    photoUrls?: string[];
    photoCount?: number;
    appReviews?: Array<{ photoUrls?: string[] }>;
  } | null;
  assert.deepEqual(detail?.activePromotions ?? [], []);
  assert.ok((detail?.photoUrls?.length ?? 0) <= 2);
  assert.ok((detail?.photoCount ?? 0) >= (detail?.photoUrls?.length ?? 0));
  assert.ok((detail?.appReviews ?? []).every((review) => (review.photoUrls?.length ?? 0) === 0));
});

test('publishes the full active promotion stack onto member storefront detail payloads', async () => {
  process.env.NODE_ENV = 'test';

  // Start the server FIRST so that the module instances (and their in-memory
  // Maps) created during import are the same ones we populate below.
  const { baseUrl } = await startTestServer();

  const {
    ownerStorefrontPromotionStore,
    ownerStorefrontPromotionCache,
    storefrontDetailEnhancementCache,
  } = await import('./services/ownerPortalWorkspaceData');
  const now = Date.now();
  ownerStorefrontPromotionStore.set(testStorefrontId, [
    createPromotionRecord({
      id: 'promotion-earlier',
      title: 'Morning special',
      description: '20% off pre-rolls',
      badges: ['20% off'],
      startsAt: new Date(now - 4 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(now - 30 * 60 * 1000).toISOString(),
    }),
    createPromotionRecord({
      id: 'promotion-latest',
      title: 'Lunch drop',
      description: 'Buy one get one gummies',
      badges: ['BOGO'],
      startsAt: new Date(now - 15 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(now - 3 * 60 * 60 * 1000).toISOString(),
    }),
  ]);
  ownerStorefrontPromotionCache.clear();
  storefrontDetailEnhancementCache.clear();

  const response = await request(baseUrl, `/storefront-details/${testStorefrontId}`, {
    headers: {
      'x-canopy-test-account-id': 'member-1',
    },
  });

  assert.equal(response.status, 200);
  const detail = response.json as {
    activePromotions?: Array<{ id?: string; description?: string; badges?: string[] }>;
  } | null;
  assert.equal(detail?.activePromotions?.length, 2);
  assert.ok(
    detail?.activePromotions?.some(
      (promotion) =>
        promotion.id === 'promotion-latest' && promotion.description === 'Buy one get one gummies',
    ),
  );
  assert.ok(
    detail?.activePromotions?.some(
      (promotion) =>
        promotion.id === 'promotion-earlier' &&
        JSON.stringify(promotion.badges) === JSON.stringify(['20% off']),
    ),
  );
});

test('serves a published storefront detail fallback when the base detail read times out', async () => {
  const { baseUrl } = await startTestServer();
  const { backendStorefrontSource } = await import('./sources');
  const originalGetDetailsById = backendStorefrontSource.getDetailsById;
  backendStorefrontSource.getDetailsById = async (storefrontId: string) => {
    if (storefrontId !== testStorefrontId) {
      return originalGetDetailsById(storefrontId);
    }

    return new Promise(() => {
      // Intentionally unresolved to force the detail timeout path.
    });
  };

  try {
    const response = await request(baseUrl, `/storefront-details/${testStorefrontId}`);

    assert.equal(response.status, 200);
    const detail = response.json as {
      storefrontId?: string;
      routeMode?: string;
      appReviewCount?: number;
      photoUrls?: string[];
    } | null;
    assert.equal(detail?.storefrontId, testStorefrontId);
    assert.equal(detail?.routeMode, 'verified');
    assert.equal(typeof detail?.appReviewCount, 'number');
    assert.ok(Array.isArray(detail?.photoUrls));
  } finally {
    backendStorefrontSource.getDetailsById = originalGetDetailsById;
  }
});

test('requires member auth for email subscription status reads', async () => {
  const { baseUrl } = await startTestServer();
  const response = await request(baseUrl, '/member-email-subscription');

  assert.equal(response.status, 401);
  assert.equal(response.json?.error, 'Member authentication is required.');
});

test('validates member email subscription writes after auth succeeds', async () => {
  process.env.NODE_ENV = 'test';
  const { baseUrl } = await startTestServer();
  const response = await request(baseUrl, '/member-email-subscription', {
    method: 'PUT',
    headers: {
      'x-canopy-test-account-id': 'member-2',
      'x-canopy-test-email': 'member2@example.com',
      'x-canopy-test-display-name': 'Member Two',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      subscribed: 'yes',
    }),
  });

  assert.equal(response.status, 400);
  assert.equal(response.json?.error, 'body.subscribed must be a boolean.');
});

test('stores authenticated member email subscriptions without exposing guest writes', async () => {
  process.env.NODE_ENV = 'test';
  const { baseUrl } = await startTestServer();
  const response = await request(baseUrl, '/member-email-subscription', {
    method: 'PUT',
    headers: {
      'x-canopy-test-account-id': 'member-3',
      'x-canopy-test-email': 'member3@example.com',
      'x-canopy-test-display-name': 'Member Three',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      subscribed: true,
      source: 'member_signup',
    }),
  });

  assert.equal(response.status, 200);
  assert.equal(response.json?.accountId, 'member-3');
  assert.equal(response.json?.email, 'member3@example.com');
  assert.equal(response.json?.subscribed, true);
  assert.equal(response.json?.welcomeEmailState, 'pending_provider');
});

test('requires owner auth for owner welcome emails', async () => {
  const { baseUrl } = await startTestServer();
  const response = await request(baseUrl, '/owner-welcome-email', {
    method: 'POST',
  });

  assert.equal(response.status, 401);
  assert.equal(response.json?.error, 'Owner authentication is required.');
});

test('rejects non-owner accounts from triggering owner welcome emails', async () => {
  process.env.NODE_ENV = 'test';
  const { baseUrl } = await startTestServer();
  const response = await request(baseUrl, '/owner-welcome-email', {
    method: 'POST',
    headers: {
      'x-canopy-test-account-id': 'member-4',
      'x-canopy-test-email': 'member4@example.com',
      'x-canopy-test-display-name': 'Member Four',
      'x-canopy-test-claim-role': 'member',
    },
  });

  assert.equal(response.status, 403);
  assert.equal(response.json?.error, 'Owner welcome email is only available for owner accounts.');
});

test('allows owner accounts to trigger the owner welcome email path', async () => {
  process.env.NODE_ENV = 'test';
  const { baseUrl } = await startTestServer();
  const response = await request(baseUrl, '/owner-welcome-email', {
    method: 'POST',
    headers: {
      'x-canopy-test-account-id': 'owner-4',
      'x-canopy-test-email': 'owner4@example.com',
      'x-canopy-test-display-name': 'Owner Four',
      'x-canopy-test-claim-role': 'owner',
    },
  });

  assert.equal(response.status, 200);
  assert.equal(response.json?.welcomeEmailState, 'pending_provider');
  assert.equal(response.json?.welcomeEmailSentAt, null);
});

test('exempts /health from the shared public read limiter', async () => {
  const { baseUrl } = await startTestServer();

  const firstHealth = await request(baseUrl, '/health');
  const secondHealth = await request(baseUrl, '/health');
  let lastPublicRead = null as Awaited<ReturnType<typeof request>> | null;
  for (let index = 0; index < 241; index += 1) {
    lastPublicRead = await request(baseUrl, '/market-areas');
  }

  assert.equal(firstHealth.status, 200);
  assert.equal(secondHealth.status, 200);
  assert.equal(firstHealth.json?.ok, true);
  const firstSource = firstHealth.json?.source as { activeMode?: unknown } | undefined;
  assert.deepEqual(Object.keys(firstHealth.json ?? {}).sort(), ['ok']);
  assert.equal(typeof firstHealth.json?.source, 'undefined');
  assert.equal(typeof firstSource?.activeMode, 'undefined');
  assert.equal('monitored' in (firstHealth.json ?? {}), false);
  assert.equal('checkedAt' in (firstHealth.json ?? {}), false);
  assert.equal('runtimeMonitoring' in (firstHealth.json ?? {}), false);
  assert.equal('runtimeStatus' in (firstHealth.json ?? {}), false);
  assert.ok(lastPublicRead);
  assert.equal(lastPublicRead.status, 429);
  assert.equal(lastPublicRead.json?.error, 'Too many requests. Please retry shortly.');
});

test('keeps public GET routes available when an IP is abuse-flagged', async () => {
  const { isIpFlagged, recordAbuseSignal } = await import('./http/abuseScoring');
  const flaggedIp = '198.51.100.24';
  const { baseUrl } = await startTestServer();

  for (let index = 0; index < 10; index += 1) {
    recordAbuseSignal(flaggedIp, 2, '/load-test');
  }

  assert.equal(isIpFlagged(flaggedIp), true);

  const healthResponse = await request(baseUrl, '/health', {
    headers: {
      'x-forwarded-for': flaggedIp,
    },
  });
  const marketAreasResponse = await request(baseUrl, '/market-areas', {
    headers: {
      'x-forwarded-for': flaggedIp,
    },
  });
  const analyticsWriteResponse = await request(baseUrl, '/analytics/events', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': flaggedIp,
    },
    body: JSON.stringify({}),
  });

  assert.equal(healthResponse.status, 200);
  assert.equal(healthResponse.json?.ok, true);
  assert.equal(marketAreasResponse.status, 200);
  assert.equal(analyticsWriteResponse.status, 429);
  assert.equal(
    analyticsWriteResponse.json?.error,
    'Request rate exceeded. Please slow down and try again later.',
  );
});

test('rejects invalid admin api keys without exposing admin routes', async () => {
  process.env.ADMIN_API_KEY = 'admin-test-key';
  const { baseUrl } = await startTestServer();

  const invalidResponse = await request(baseUrl, '/admin/email-subscriptions', {
    headers: {
      'x-admin-api-key': 'nope',
    },
  });
  const validResponse = await request(baseUrl, '/admin/email-subscriptions', {
    headers: {
      'x-admin-api-key': 'admin-test-key',
    },
  });

  assert.equal(invalidResponse.status, 401);
  assert.equal(invalidResponse.json?.error, 'Invalid admin API key.');
  assert.equal(validResponse.status, 200);
});

test('assertSecureServerConfig rejects wildcard cors origins', async () => {
  const { assertSecureServerConfig, serverConfig } = await import('./config');
  const originalCorsOrigin = serverConfig.corsOrigin;

  try {
    (serverConfig as { corsOrigin: string | string[] }).corsOrigin = '*';
    assert.throws(
      () => assertSecureServerConfig(),
      /CORS_ORIGIN must be an explicit origin list\./,
    );
  } finally {
    (serverConfig as { corsOrigin: string | string[] }).corsOrigin = originalCorsOrigin;
  }
});

test('rate limits repeated storefront report submissions before they can be spammed', async () => {
  const { baseUrl } = await startTestServer();
  let lastResponse = null as Awaited<ReturnType<typeof request>> | null;

  for (let index = 0; index < 11; index += 1) {
    lastResponse = await request(baseUrl, `/storefront-details/${testStorefrontId}/reports`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });
  }

  assert.ok(lastResponse);
  assert.equal(lastResponse.status, 429);
  assert.equal(lastResponse.json?.error, 'Too many requests. Please retry shortly.');
});

test('blocks unauthenticated owner billing session attempts', async () => {
  const { baseUrl } = await startTestServer();
  const response = await request(baseUrl, '/owner-billing/checkout-session', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });

  assert.equal(response.status, 401);
  assert.equal(response.json?.code, 'auth_required');
});

test('rate limits repeated owner workspace mutation attempts', async () => {
  const { baseUrl } = await startTestServer();
  let lastResponse = null as Awaited<ReturnType<typeof request>> | null;

  for (let index = 0; index < 11; index += 1) {
    lastResponse = await request(baseUrl, '/owner-portal/license-compliance', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });
  }

  assert.ok(lastResponse);
  assert.equal(lastResponse.status, 429);
  assert.equal(lastResponse.json?.error, 'Too many requests. Please retry shortly.');
});

test('blocks admin routes when the admin api key is not configured', async () => {
  const { baseUrl } = await startTestServer();
  const response = await request(baseUrl, '/admin/seed-status');

  assert.equal(response.status, 503);
  assert.equal(response.json?.error, 'Admin routes are not configured. Missing: ADMIN_API_KEY.');
});

test('blocks admin runtime routes when neither admin auth path is configured', async () => {
  const { baseUrl } = await startTestServer();
  const response = await request(baseUrl, '/admin/runtime/status');

  assert.equal(response.status, 503);
  assert.equal(
    response.json?.error,
    'Admin runtime routes are not configured. Missing Firebase admin auth or ADMIN_API_KEY.',
  );
});

test('allows admin runtime routes to use the private admin api key fallback', async () => {
  process.env.ADMIN_API_KEY = 'admin-secret';
  const { baseUrl } = await startTestServer();
  const response = await request(baseUrl, '/admin/runtime/status', {
    headers: {
      'x-admin-api-key': 'admin-secret',
    },
  });

  assert.equal(response.status, 200);
  const runtimePolicy = response.json?.policy as { safeModeEnabled?: boolean } | undefined;
  assert.ok(runtimePolicy);
  assert.equal(runtimePolicy.safeModeEnabled, false);
});

test('clears stale automatic safe mode when recent critical incidents have already dropped away', async () => {
  const { baseUrl } = await startTestServer();
  const runtimeOpsService = await import('./services/runtimeOpsService');

  await runtimeOpsService.saveRuntimePolicy({
    safeModeEnabled: true,
    ownerPortalWritesEnabled: false,
    promotionWritesEnabled: false,
    reviewRepliesEnabled: false,
    profileToolsWritesEnabled: false,
    trigger: 'automatic',
    reason: 'Automatic safe mode engaged after 3 critical incidents in the last 15 minutes.',
  });

  await assert.doesNotReject(() =>
    runtimeOpsService.assertRuntimePolicyAllowsOwnerAction('profile_tools'),
  );

  const response = await request(baseUrl, '/runtime/status');

  assert.equal(response.status, 200);
  const runtimePolicy = response.json?.policy as
    | {
        safeModeEnabled?: boolean;
        trigger?: string;
        ownerPortalWritesEnabled?: boolean;
        reason?: string | null;
      }
    | undefined;
  assert.ok(runtimePolicy);
  assert.equal(runtimePolicy.safeModeEnabled, false);
  assert.equal(runtimePolicy.trigger, 'normal');
  assert.equal(runtimePolicy.ownerPortalWritesEnabled, true);
  assert.match(runtimePolicy.reason ?? '', /cleared/i);
});

test('reports storefront readiness failures through the admin runtime readiness route', async () => {
  process.env.ADMIN_API_KEY = 'admin-secret';
  const { baseUrl } = await startTestServer();
  const response = await request(baseUrl, '/admin/runtime/readiness?probe=false', {
    headers: {
      'x-admin-api-key': 'admin-secret',
    },
  });

  assert.equal(response.status, 503);
  assert.equal(response.json?.ok, false);
  assert.equal(response.json?.state, 'not_ready');
  const checks = response.json?.checks as
    | Array<{ name?: string; ok?: boolean; severity?: string }>
    | undefined;
  assert.ok(checks);
  assert.ok(
    checks?.some(
      (check) =>
        check.name === 'Storefront source mode' &&
        check.ok === false &&
        check.severity === 'required',
    ),
  );
  assert.ok(
    checks?.some(
      (check) =>
        check.name === 'Published storefront summary availability' &&
        check.ok === false &&
        check.severity === 'required',
    ),
  );
});

test('accepts newer analytics event types emitted by the mobile client', async () => {
  const { baseUrl } = await startTestServer();
  const response = await request(baseUrl, '/analytics/events', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      platform: 'android',
      events: [
        {
          eventType: 'post_visit_prompt_shown',
          installId: 'install-1',
          sessionId: 'session-1',
          occurredAt: new Date().toISOString(),
          screen: 'PostVisitPrompt',
          metadata: {
            source: 'visit_follow_up',
          },
        },
        {
          eventType: 'report_started',
          installId: 'install-1',
          sessionId: 'session-1',
          occurredAt: new Date().toISOString(),
          screen: 'ReportStorefront',
          storefrontId: 'storefront-1',
          metadata: {
            reason: 'Listing issue',
          },
        },
      ],
    }),
  });

  assert.equal(response.status, 202);
  assert.equal(response.json?.ok, true);
  assert.equal(response.json?.accepted, 2);
});

test('reports missing admin firebase config after admin auth succeeds', async () => {
  process.env.ADMIN_API_KEY = 'admin-secret';
  const { baseUrl } = await startTestServer();
  const response = await request(baseUrl, '/admin/reviews/queue', {
    headers: {
      'x-admin-api-key': 'admin-secret',
    },
  });

  assert.equal(response.status, 503);
  assert.equal(
    response.json?.error,
    'Admin review is not fully configured. Missing: FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS.',
  );
});

test('assertSecureServerConfig accepts explicit cors origin lists', async () => {
  const { assertSecureServerConfig, serverConfig } = await import('./config');
  const originalCorsOrigin = serverConfig.corsOrigin;

  try {
    (serverConfig as { corsOrigin: string | string[] }).corsOrigin = [
      'https://canopytrove.com',
      'https://www.canopytrove.com',
    ];
    assert.doesNotThrow(() => assertSecureServerConfig());
  } finally {
    (serverConfig as { corsOrigin: string | string[] }).corsOrigin = originalCorsOrigin;
  }
});

test('accepts client runtime error reports', async () => {
  const { baseUrl } = await startTestServer();
  const response = await request(baseUrl, '/client-errors', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer test-authenticated:account-1',
    },
    body: JSON.stringify({
      message: 'Detail fetch failed',
      source: 'storefront-detail-fetch',
      screen: 'StorefrontDetail',
      isFatal: false,
      platform: 'android',
      reportedAt: new Date().toISOString(),
    }),
  });

  assert.equal(response.status, 202);
  assert.equal(response.json?.ok, true);
});

test('rejects unauthenticated client runtime error reports', async () => {
  const { baseUrl } = await startTestServer();
  const response = await request(baseUrl, '/client-errors', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: 'Detail fetch failed',
      source: 'storefront-detail-fetch',
      screen: 'StorefrontDetail',
      isFatal: false,
      platform: 'android',
      reportedAt: new Date().toISOString(),
    }),
  });

  assert.equal(response.status, 401);
});

test('rejects authenticated client runtime error reports from disallowed origins', async () => {
  const { baseUrl } = await startTestServer();
  const response = await request(baseUrl, '/client-errors', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer test-authenticated:account-1',
      Origin: 'https://evil.example',
    },
    body: JSON.stringify({
      message: 'Detail fetch failed',
      source: 'storefront-detail-fetch',
      screen: 'StorefrontDetail',
      isFatal: false,
      platform: 'android',
      reportedAt: new Date().toISOString(),
    }),
  });

  assert.equal(response.status, 403);
  assert.equal(response.json?.error, 'Origin not allowed.');
});

test('requires auth for push subscription writes and deletes', async () => {
  const { baseUrl } = await startTestServer();
  const subscribeResponse = await request(baseUrl, '/push/subscribe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      subscription: {
        endpoint: 'https://push.example/subscriptions/abc123',
        keys: {
          p256dh: 'test-p256dh-key',
          auth: 'test-auth-key',
        },
      },
      platform: 'web',
    }),
  });
  const unsubscribeResponse = await request(baseUrl, '/push/subscribe', {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      endpoint: 'https://push.example/subscriptions/abc123',
    }),
  });

  assert.equal(subscribeResponse.status, 401);
  assert.equal(
    subscribeResponse.json?.error,
    'Authentication required for push subscriptions.',
  );
  assert.equal(unsubscribeResponse.status, 401);
  assert.equal(
    unsubscribeResponse.json?.error,
    'Authentication required for push subscription management.',
  );
});

test('accepts analytics event batches', async () => {
  const { baseUrl } = await startTestServer();
  const response = await request(baseUrl, '/analytics/events', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      platform: 'android',
      events: [
        {
          eventType: 'app_open',
          installId: 'install-1',
          sessionId: 'session-1',
          occurredAt: new Date().toISOString(),
          screen: 'Nearby',
          metadata: {
            reason: 'cold_start',
          },
        },
      ],
    }),
  });

  assert.equal(response.status, 202);
  assert.equal(response.json?.ok, true);
  assert.equal(response.json?.accepted, 1);
});

test('runs a discovery sweep through the admin discovery route', async () => {
  process.env.ADMIN_API_KEY = 'admin-secret';
  const { baseUrl } = await startTestServer();
  const response = await request(baseUrl, '/admin/discovery/sweep?limit=3&mode=sync', {
    method: 'POST',
    headers: {
      'x-admin-api-key': 'admin-secret',
    },
  });

  assert.equal(response.status, 200);
  assert.equal(response.json?.ok, true);
  assert.equal(response.json?.sourceCount, 3);
  assert.equal(response.json?.candidateCount, 3);
  assert.equal(
    (response.json?.hiddenCount as number) +
      (response.json?.readyForPublishCount as number) +
      (response.json?.publishedCount as number) +
      (response.json?.suppressedCount as number),
    3,
  );
});

test('deduplicates analytics event retries by eventId', async () => {
  const { baseUrl } = await startTestServer();
  const event = {
    eventId: 'event-retry-1',
    eventType: 'app_open',
    installId: 'install-1',
    sessionId: 'session-1',
    occurredAt: new Date().toISOString(),
    screen: 'Nearby',
  };

  const firstResponse = await request(baseUrl, '/analytics/events', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      platform: 'android',
      events: [event],
    }),
  });

  const secondResponse = await request(baseUrl, '/analytics/events', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      platform: 'android',
      events: [event],
    }),
  });

  assert.equal(firstResponse.status, 202);
  assert.equal(firstResponse.json?.accepted, 1);
  assert.equal(firstResponse.json?.duplicates, 0);
  assert.equal(secondResponse.status, 202);
  assert.equal(secondResponse.json?.accepted, 0);
  assert.equal(secondResponse.json?.duplicates, 1);
});

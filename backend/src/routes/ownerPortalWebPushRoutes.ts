import { Router } from 'express';
import { z } from 'zod';
import { createRateLimitMiddleware } from '../http/rateLimit';
import { createOwnerPortalJsonRoute } from './ownerPortalRouteUtils';
import {
  deleteAllOwnerWebPushSubscriptions,
  deleteOwnerWebPushSubscription,
  listOwnerWebPushSubscriptions,
  upsertOwnerWebPushSubscription,
} from '../services/webPushSubscriptionService';
import { isWebPushConfigured } from '../services/webPushService';

export const ownerPortalWebPushRoutes = Router();

const writeRateLimiter = createRateLimitMiddleware({
  name: 'owner-web-push-write',
  windowMs: 60_000,
  max: 30,
  methods: ['POST', 'DELETE'],
});

ownerPortalWebPushRoutes.use(writeRateLimiter);

const subscriptionBodySchema = z.object({
  endpoint: z
    .string()
    .min(1)
    .refine((value) => value.startsWith('http'), {
      message: 'endpoint must be an absolute http(s) URL',
    }),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
  userAgent: z.string().max(500).optional(),
});

const deleteBodySchema = z
  .object({
    endpoint: z.string().min(1).optional(),
    endpointHash: z
      .string()
      .min(1)
      .max(64)
      .regex(/^[a-f0-9]+$/, { message: 'endpointHash must be lowercase hex' })
      .optional(),
    all: z.boolean().optional(),
  })
  .refine((value) => value.endpoint || value.endpointHash || value.all, {
    message: 'must provide endpoint, endpointHash, or all=true',
  });

ownerPortalWebPushRoutes.get(
  '/owner-portal/web-push/subscriptions',
  createOwnerPortalJsonRoute('Unknown web push subscription failure', async ({ ownerUid }) => {
    const subscriptions = await listOwnerWebPushSubscriptions(ownerUid);
    return {
      ok: true as const,
      configured: isWebPushConfigured(),
      // Return only the metadata the client needs — never echo p256dh / auth
      // back to the browser; those are bearer-equivalent secrets that should
      // stay server-side once registered.
      subscriptions: subscriptions.map((sub) => ({
        endpointHash: sub.endpointHash,
        endpointHost: safeEndpointHost(sub.endpoint),
        userAgent: sub.userAgent,
        createdAt: sub.createdAt,
        lastSeenAt: sub.lastSeenAt,
      })),
    };
  }),
);

ownerPortalWebPushRoutes.post(
  '/owner-portal/web-push/subscriptions',
  createOwnerPortalJsonRoute(
    'Unknown web push subscription failure',
    async ({ ownerUid, request }) => {
      if (!isWebPushConfigured()) {
        return {
          ok: false as const,
          code: 'WEB_PUSH_NOT_CONFIGURED' as const,
          error: 'Web Push is not configured on this server.',
        };
      }

      const parsed = subscriptionBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return {
          ok: false as const,
          code: 'INVALID_BODY' as const,
          error: parsed.error.errors[0]?.message ?? 'Invalid subscription body.',
        };
      }

      const stored = await upsertOwnerWebPushSubscription({
        ownerUid,
        endpoint: parsed.data.endpoint,
        p256dh: parsed.data.keys.p256dh,
        auth: parsed.data.keys.auth,
        userAgent: parsed.data.userAgent ?? null,
      });

      return {
        ok: true as const,
        endpointHash: stored.endpointHash,
        lastSeenAt: stored.lastSeenAt,
      };
    },
  ),
);

ownerPortalWebPushRoutes.delete(
  '/owner-portal/web-push/subscriptions',
  createOwnerPortalJsonRoute(
    'Unknown web push subscription failure',
    async ({ ownerUid, request }) => {
      const parsed = deleteBodySchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return {
          ok: false as const,
          code: 'INVALID_BODY' as const,
          error: parsed.error.errors[0]?.message ?? 'Invalid delete body.',
        };
      }

      if (parsed.data.all) {
        const result = await deleteAllOwnerWebPushSubscriptions(ownerUid);
        return { ok: true as const, deletedCount: result.deletedCount };
      }

      const result = await deleteOwnerWebPushSubscription({
        ownerUid,
        endpoint: parsed.data.endpoint,
        endpointHash: parsed.data.endpointHash,
      });

      if (!result.deleted) {
        return {
          ok: false as const,
          code: result.reason === 'not_found' ? ('NOT_FOUND' as const) : ('INVALID_BODY' as const),
          error: result.reason === 'not_found' ? 'Subscription not found.' : 'Missing endpoint.',
        };
      }
      return { ok: true as const, endpointHash: result.endpointHash };
    },
  ),
);

function safeEndpointHost(endpoint: string): string | null {
  try {
    return new URL(endpoint).host;
  } catch {
    return null;
  }
}

import { Router } from 'express';
import { serverConfig } from '../config';
import { createRateLimitMiddleware } from '../http/rateLimit';
import { parseAnalyticsEventBatchBody } from '../http/validation';
import { recordAnalyticsEvents } from '../services/analyticsEventService';
import { resolveVerifiedRequestIdentity } from '../services/profileAccessService';

export const analyticsRoutes = Router();

analyticsRoutes.use(
  createRateLimitMiddleware({
    name: 'analytics-write',
    windowMs: 60_000,
    max: serverConfig.writeRateLimitPerMinute,
    methods: ['POST'],
    // Telemetry is high-volume by design (every keystroke, every screen
    // render, every interaction can fire an event). The per-route 180/min
    // cap stops genuine spam, but a heavy real user shouldn't accumulate
    // abuse points that promote them to the 30-min global IP flag — a
    // search-as-you-type session for "ontario" easily fires 7+ events
    // per second and would otherwise cascade into 429s on every other
    // write endpoint they touch.
    abuseSignalPoints: 0,
  }),
);

analyticsRoutes.post('/analytics/events', async (request, response, next) => {
  try {
    // Identity must come from the verified id token, not the request body.
    // Otherwise any client can post events attributed to another account
    // or synthesize authenticated metrics for themselves. Resolve with
    // invalidTokenBehavior: 'ignore' so a malformed token degrades to
    // anonymous instead of 401-ing the whole batch.
    const identity = await resolveVerifiedRequestIdentity(request, {
      invalidTokenBehavior: 'ignore',
    });
    const verifiedAccountId = identity.accountId ?? null;
    const verifiedProfileKind: 'anonymous' | 'authenticated' = verifiedAccountId
      ? 'authenticated'
      : 'anonymous';

    const body = parseAnalyticsEventBatchBody(request.body);
    const sanitizedBody = {
      ...body,
      events: body.events.map((event) => ({
        ...event,
        accountId: verifiedAccountId,
        profileKind: verifiedProfileKind,
      })),
    };

    const result = await recordAnalyticsEvents(sanitizedBody, {
      ipAddress: request.ip ?? null,
      receivedAt: new Date().toISOString(),
      userAgent: request.headers['user-agent'] ?? null,
    });

    response.status(202).json(result);
  } catch (error) {
    next(error);
  }
});

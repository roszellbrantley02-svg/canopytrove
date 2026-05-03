import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { createRateLimitMiddleware } from '../http/rateLimit';
import { logger } from '../observability/logger';
import { getEventById, listEvents } from '../services/eventsService';

// Public read-only routes for the Travel & Events tab.
// No auth — events are public discovery content. Rate-limited per-IP.

export const eventRoutes = Router();

const readRateLimiter = createRateLimitMiddleware({
  name: 'events-read',
  windowMs: 60_000,
  max: 120,
  methods: ['GET'],
});

// Note: rate limiter applied per-route, not via `eventRoutes.use(...)`.
// Router-level `.use()` middleware runs for every request that traverses
// the router (even those that don't match an event path), which would
// stomp on `x-ratelimit-limit` headers set by other route groups. Inline
// here so the events limiter only fires for events traffic.

const listQuerySchema = z.object({
  filter: z.enum(['upcoming', 'past', 'all']).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

eventRoutes.get('/events', readRateLimiter, async (request: Request, response: Response) => {
  const parsed = listQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    response.status(400).json({
      ok: false,
      code: 'INVALID_QUERY',
      error: parsed.error.errors[0]?.message ?? 'Invalid query parameters.',
    });
    return;
  }

  try {
    const result = await listEvents({
      filter: parsed.data.filter,
      limit: parsed.data.limit,
    });
    // CDN cache 60s + SWR 5min — events change infrequently and we want
    // browse to feel snappy.
    response.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    response.json({ ok: true, items: result.items, total: result.total });
  } catch (err) {
    logger.warn('[eventRoutes] GET /events failed', {
      message: err instanceof Error ? err.message : String(err),
    });
    response
      .status(500)
      .json({ ok: false, code: 'EVENTS_LIST_FAILED', error: 'Could not load events.' });
  }
});

eventRoutes.get(
  '/events/:eventId',
  readRateLimiter,
  async (request: Request, response: Response) => {
    const rawId = request.params.eventId;
    const eventId = typeof rawId === 'string' ? rawId.trim() : '';
    if (!eventId) {
      response.status(400).json({ ok: false, code: 'MISSING_ID', error: 'eventId is required.' });
      return;
    }

    try {
      const event = await getEventById(eventId);
      if (!event || event.hidden) {
        response.status(404).json({ ok: false, code: 'NOT_FOUND', error: 'Event not found.' });
        return;
      }
      response.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
      response.json({ ok: true, event });
    } catch (err) {
      logger.warn('[eventRoutes] GET /events/:eventId failed', {
        eventId,
        message: err instanceof Error ? err.message : String(err),
      });
      response
        .status(500)
        .json({ ok: false, code: 'EVENT_DETAIL_FAILED', error: 'Could not load event.' });
    }
  },
);

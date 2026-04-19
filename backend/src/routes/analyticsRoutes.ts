import { Router } from 'express';
import { serverConfig } from '../config';
import { createRateLimitMiddleware } from '../http/rateLimit';
import { parseAnalyticsEventBatchBody } from '../http/validation';
import { recordAnalyticsEvents } from '../services/analyticsEventService';

export const analyticsRoutes = Router();

analyticsRoutes.use(
  createRateLimitMiddleware({
    name: 'analytics-write',
    windowMs: 60_000,
    max: serverConfig.writeRateLimitPerMinute,
    methods: ['POST'],
  }),
);

analyticsRoutes.post('/analytics/events', async (request, response, next) => {
  try {
    const body = parseAnalyticsEventBatchBody(request.body);
    const result = await recordAnalyticsEvents(body, {
      ipAddress: request.ip ?? null,
      receivedAt: new Date().toISOString(),
      userAgent: request.headers['user-agent'] ?? null,
    });

    response.status(202).json(result);
 
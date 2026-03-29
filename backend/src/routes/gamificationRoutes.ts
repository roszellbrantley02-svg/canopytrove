import { Router } from 'express';
import { serverConfig } from '../config';
import { createRateLimitMiddleware } from '../http/rateLimit';
import { parseGamificationEventBody, parseProfileIdParam } from '../http/validation';
import { applyGamificationEvent } from '../services/gamificationEventService';
import { ensureProfileWriteAccess } from '../services/profileAccessService';

export const gamificationRoutes = Router();
gamificationRoutes.use(
  createRateLimitMiddleware({
    name: 'write',
    windowMs: 60_000,
    max: serverConfig.writeRateLimitPerMinute,
    methods: ['POST'],
  })
);

gamificationRoutes.post('/gamification/:profileId/events', async (request, response) => {
  const profileId = parseProfileIdParam(request.params.profileId);
  const body = parseGamificationEventBody(request.body);

  await ensureProfileWriteAccess(request, profileId);
  response.json(await applyGamificationEvent(profileId, body));
});

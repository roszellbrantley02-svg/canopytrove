import { Router } from 'express';
import { serverConfig } from '../config';
import { createRateLimitMiddleware } from '../http/rateLimit';
import { parseProfileIdParam, parseRouteStateBody } from '../http/validation';
import { getRouteState, saveRouteState } from '../services/routeStateService';
import {
  ensureProfileReadAccess,
  ensureProfileWriteAccess,
} from '../services/profileAccessService';

export const routeStateRoutes = Router();
routeStateRoutes.use(
  createRateLimitMiddleware({
    name: 'write',
    windowMs: 60_000,
    max: serverConfig.writeRateLimitPerMinute,
    methods: ['PUT'],
  })
);

routeStateRoutes.get('/route-state/:profileId', async (request, response) => {
  const profileId = parseProfileIdParam(request.params.profileId);
  await ensureProfileReadAccess(request, profileId);
  response.json(await getRouteState(profileId));
});

routeStateRoutes.put('/route-state/:profileId', async (request, response) => {
  const profileId = parseProfileIdParam(request.params.profileId);
  const nextState = parseRouteStateBody(request.body, profileId);

  await ensureProfileWriteAccess(request, profileId);
  response.json(await saveRouteState(nextState));
});

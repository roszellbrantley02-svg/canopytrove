import { Router } from 'express';
import { serverConfig } from '../config';
import { createRateLimitMiddleware } from '../http/rateLimit';
import { parseCommunitySafetyStateBody, parseProfileIdParam } from '../http/validation';
import {
  getCommunitySafetyState,
  saveCommunitySafetyState,
} from '../services/communitySafetyStateService';
import {
  ensureProfileReadAccess,
  ensureProfileWriteAccess,
} from '../services/profileAccessService';

export const communitySafetyStateRoutes = Router();
communitySafetyStateRoutes.use(
  createRateLimitMiddleware({
    name: 'community-safety-write',
    windowMs: 60_000,
    max: serverConfig.writeRateLimitPerMinute,
    methods: ['PUT'],
  }),
);

communitySafetyStateRoutes.get(
  '/profiles/:profileId/community-safety',
  async (request, response) => {
    const profileId = parseProfileIdParam(request.params.profileId);
    await ensureProfileReadAccess(request, profileId);
    response.json(await getCommunitySafetyState(profileId));
  },
);

communitySafetyStateRoutes.put(
  '/profiles/:profileId/community-safety',
  async (request, response) => {
    const profileId = parseProfileIdParam(request.params.profileId);
    const body = parseCommunitySafetyStateBody(request.body, profileId);
    await ensureProfileWriteAccess(request, profileId);
    response.json(await saveCommunitySafetyState(profileId, body));
  },
);

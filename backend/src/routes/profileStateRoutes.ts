import { Router } from 'express';
import { serverConfig } from '../config';
import { createRateLimitMiddleware } from '../http/rateLimit';
import { parseProfileIdParam, parseProfileStateBody } from '../http/validation';
import { getProfileState, saveProfileState } from '../services/profileStateService';
import {
  ensureProfileReadAccess,
  ensureProfileWriteAccess,
} from '../services/profileAccessService';

export const profileStateRoutes = Router();
profileStateRoutes.use(
  createRateLimitMiddleware({
    name: 'profile-state-write',
    windowMs: 60_000,
    max: serverConfig.writeRateLimitPerMinute,
    methods: ['PUT'],
  }),
);

profileStateRoutes.get('/profile-state/:profileId', async (request, response) => {
  const profileId = parseProfileIdParam(request.params.profileId);
  await ensureProfileReadAccess(request, profileId);
  response.json(await getProfileState(profileId));
});

profileStateRoutes.put('/profile-state/:profileId', async (request, response) => {
  const profileId = parseProfileIdParam(request.params.profileId);
  const body = parseProfileStateBody(request.body, profileId);
  const { accountId, profile } = await ensureProfileWriteAccess(request, profileId);
  const now = new Date().toISOString();
  response.json(
    await saveProfileState(profileId, {
      ...body,
      profile: {
        id: profileId,
        kind: accountId ? 'authenticated' : 'anonymous',
        accountId: accountId ?? null,
        displayName:
          body.profile?.displayName !== undefined
            ? body.profile.displayName
            : (profile.displayName ?? null),
        createdAt: profile.createdAt ?? body.profile?.createdAt ?? now,
        updatedAt: now,
      },
    }),
  );
});

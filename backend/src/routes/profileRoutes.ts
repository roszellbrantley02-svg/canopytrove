import { Router } from 'express';
import { serverConfig } from '../config';
import { createRateLimitMiddleware } from '../http/rateLimit';
import { parseProfileIdParam, parseProfileUpdateBody } from '../http/validation';
import { deleteProfileAccountData } from '../services/accountCleanupService';
import { saveProfile } from '../services/profileService';
import {
  ensureProfileReadAccess,
  ensureProfileWriteAccess,
} from '../services/profileAccessService';
import { AppProfileApiDocument } from '../types';

export const profileRoutes = Router();
profileRoutes.use(
  createRateLimitMiddleware({
    name: 'write',
    windowMs: 60_000,
    max: serverConfig.writeRateLimitPerMinute,
    methods: ['PUT'],
  })
);

profileRoutes.get('/profiles/:profileId', async (request, response) => {
  const profileId = parseProfileIdParam(request.params.profileId);
  const { profile } = await ensureProfileReadAccess(request, profileId);
  response.json(profile);
});

profileRoutes.put('/profiles/:profileId', async (request, response) => {
  const profileId = parseProfileIdParam(request.params.profileId);
  const body = parseProfileUpdateBody(request.body, profileId);
  const { accountId, profile } = await ensureProfileWriteAccess(request, profileId);
  const now = new Date().toISOString();
  const nextProfile: AppProfileApiDocument = {
    id: profileId,
    kind: accountId ? 'authenticated' : 'anonymous',
    accountId: accountId ?? null,
    displayName:
      body.displayName !== undefined ? body.displayName : profile.displayName ?? null,
    createdAt: profile.createdAt ?? body.createdAt ?? now,
    updatedAt: now,
  };
  response.json(await saveProfile(nextProfile));
});

profileRoutes.delete('/profiles/:profileId', async (request, response) => {
  const profileId = parseProfileIdParam(request.params.profileId);
  await ensureProfileWriteAccess(request, profileId);
  response.json(await deleteProfileAccountData(profileId));
});

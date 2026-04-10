import { Router } from 'express';
import { serverConfig } from '../config';
import { createRateLimitMiddleware } from '../http/rateLimit';
import { createRecentAuthGuard } from '../http/recentAuthGuard';
import { createUserRateLimitMiddleware } from '../http/userRateLimit';
import { parseProfileIdParam, parseProfileUpdateBody } from '../http/validation';
import { logger } from '../observability/logger';
import { deleteProfileAccountData } from '../services/accountCleanupService';
import { sendSecurityNotification } from '../services/securityNotificationService';
import { revokeAllUserSessions } from '../services/sessionRevocationService';
import { getCanonicalProfileForAccount, saveProfile } from '../services/profileService';
import {
  ensureProfileReadAccess,
  ensureProfileWriteAccess,
  resolveVerifiedRequestAccountId,
} from '../services/profileAccessService';
import { getBackendFirebaseAuth } from '../firebase';
import { AppProfileApiDocument } from '../types';

export const profileRoutes = Router();
profileRoutes.use(
  createRateLimitMiddleware({
    name: 'profile-ip-write',
    windowMs: 60_000,
    max: serverConfig.writeRateLimitPerMinute,
    methods: ['PUT', 'DELETE'],
  }),
);
const profileWriteUserRateLimiter = createUserRateLimitMiddleware({
  name: 'profile-write',
  windowMs: 60_000,
  max: 20,
});
const profileDeleteRecentAuth = createRecentAuthGuard({
  operationLabel: 'account deletion',
  maxAuthAgeSeconds: 300,
});
const profileDeleteUserRateLimiter = createUserRateLimitMiddleware({
  name: 'profile-delete',
  windowMs: 600_000, // 10 minutes
  max: 3,
  persistent: true,
});

profileRoutes.get('/profiles/me/canonical', async (request, response) => {
  const accountId = await resolveVerifiedRequestAccountId(request);
  if (!accountId) {
    response.status(401).json({
      error: 'Member authentication is required.',
    });
    return;
  }

  const profile = await getCanonicalProfileForAccount(accountId);
  if (!profile) {
    response.status(404).json({
      error: 'No profile exists for this account yet.',
    });
    return;
  }

  response.json(profile);
});

profileRoutes.get('/profiles/:profileId', async (request, response) => {
  const profileId = parseProfileIdParam(request.params.profileId);
  const { profile } = await ensureProfileReadAccess(request, profileId);
  response.json(profile);
});

profileRoutes.put(
  '/profiles/:profileId',
  profileWriteUserRateLimiter,
  async (request, response) => {
    const profileId = parseProfileIdParam(request.params.profileId);
    const body = parseProfileUpdateBody(request.body, profileId);
    const { accountId, profile } = await ensureProfileWriteAccess(request, profileId);
    const now = new Date().toISOString();
    const nextProfile: AppProfileApiDocument = {
      id: profileId,
      kind: accountId ? 'authenticated' : 'anonymous',
      accountId: accountId ?? null,
      displayName:
        body.displayName !== undefined ? body.displayName : (profile.displayName ?? null),
      createdAt: profile.createdAt ?? body.createdAt ?? now,
      updatedAt: now,
    };
    response.json(await saveProfile(nextProfile));
  },
);

profileRoutes.delete(
  '/profiles/:profileId',
  profileDeleteRecentAuth,
  profileDeleteUserRateLimiter,
  async (request, response) => {
    const profileId = parseProfileIdParam(request.params.profileId);
    const { accountId } = await ensureProfileWriteAccess(request, profileId);
    const result = await deleteProfileAccountData(profileId);

    // Send security notification and revoke sessions for account deletion
    if (accountId) {
      const auth = getBackendFirebaseAuth();
      const email = auth ? (await auth.getUser(accountId).catch(() => null))?.email : null;
      if (email) {
        void sendSecurityNotification({
          type: 'account_deleted',
          recipientEmail: email,
          details: { 'Profile ID': profileId },
        }).catch((e) =>
          logger.error('[profileRoutes] sendSecurityNotification failed', {
            error: e instanceof Error ? e.message : String(e),
          }),
        );
      }
      void revokeAllUserSessions(accountId, 'account_deletion', {
        ip: request.ip || 'unknown',
        path: request.originalUrl,
      }).catch((e) =>
        logger.error('[profileRoutes] revokeAllUserSessions failed', {
          error: e instanceof Error ? e.message : String(e),
        }),
      );
    }

    response.json(result);
  },
);

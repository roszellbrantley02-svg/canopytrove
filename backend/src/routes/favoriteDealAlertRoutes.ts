import { Router } from 'express';
import { serverConfig } from '../config';
import { createRateLimitMiddleware } from '../http/rateLimit';
import { parseProfileIdParam } from '../http/validation';
import { parseFavoriteDealAlertSyncBody } from '../http/validationFavoriteDealAlerts';
import { ensureProfileWriteAccess } from '../services/profileAccessService';
import { getRouteState } from '../services/routeStateService';
import { syncFavoriteDealAlerts } from '../services/favoriteDealAlertService';

export const favoriteDealAlertRoutes = Router();
favoriteDealAlertRoutes.use(
  createRateLimitMiddleware({
    name: 'favorite-alert-write',
    windowMs: 60_000,
    max: serverConfig.writeRateLimitPerMinute,
    methods: ['POST'],
    // Auto-sync is fired on every saved-storefront change; bursty by
    // design when a user toggles several favorites in quick succession.
    // The per-route cap is plenty; don't escalate to global IP flag.
    abuseSignalPoints: 0,
  }),
);

favoriteDealAlertRoutes.post(
  '/profiles/:profileId/favorite-deal-alerts/sync',
  async (request, response) => {
    const profileId = parseProfileIdParam(request.params.profileId);
    const body = parseFavoriteDealAlertSyncBody(request.body);

    await ensureProfileWriteAccess(request, profileId);
    const routeState = await getRouteState(profileId);

    response.json(
      await syncFavoriteDealAlerts({
        profileId,
        savedStorefrontIds: body.savedStorefrontIds ?? routeState.savedStorefrontIds,
        allowNotifications: body.allowNotifications,
        devicePushToken: body.devicePushToken,
      }),
    );
  },
);

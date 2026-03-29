import React from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { storefrontSourceMode } from '../config/storefrontSourceConfig';
import {
  useStorefrontProfileController,
  useStorefrontRouteController,
} from '../context/StorefrontController';
import { storefrontSource } from '../sources';
import {
  getRegisteredFavoriteDealPushToken,
  initializeFavoriteDealNotifications,
  scheduleFavoriteDealNotification,
  syncFavoriteDealNotifications,
} from '../services/favoriteDealNotificationService';
import { syncStorefrontBackendFavoriteDealAlerts } from '../services/storefrontBackendService';
import { FAVORITE_DEAL_ALERT_POLL_INTERVAL_MS } from '../utils/favoriteDealAlerts';

export function FavoriteDealNotificationBridge() {
  const { authSession, profileId } = useStorefrontProfileController();
  const { savedStorefrontIds } = useStorefrontRouteController();
  const appStateRef = React.useRef<AppStateStatus>(AppState.currentState);
  const syncInFlightRef = React.useRef<Promise<void> | null>(null);

  const syncAlerts = React.useCallback(
    async (allowNotifications: boolean) => {
      if (syncInFlightRef.current) {
        await syncInFlightRef.current;
      }

      const nextSync = (async () => {
        await initializeFavoriteDealNotifications();
        const shouldUseBackend =
          storefrontSourceMode === 'api' &&
          authSession.status === 'authenticated' &&
          Boolean(profileId);

        if (shouldUseBackend) {
          const devicePushToken = allowNotifications
            ? await getRegisteredFavoriteDealPushToken({ prompt: true })
            : await getRegisteredFavoriteDealPushToken({ prompt: false });
          const response = await syncStorefrontBackendFavoriteDealAlerts({
            profileId,
            savedStorefrontIds,
            allowNotifications,
            devicePushToken,
          });

          if (allowNotifications && response.deliveryMode !== 'backend_push') {
            for (const notification of response.notifications) {
              await scheduleFavoriteDealNotification({
                storefrontId: notification.storefrontId,
                storefrontName: notification.storefrontName,
                promotionText: notification.promotionText,
              });
            }
          }

          return;
        }

        const savedSummaries = savedStorefrontIds.length
          ? await storefrontSource.getSummariesByIds(savedStorefrontIds)
          : [];

        await syncFavoriteDealNotifications({
          savedSummaries,
          allowNotifications,
        });
      })();

      syncInFlightRef.current = nextSync;

      try {
        await nextSync;
      } finally {
        if (syncInFlightRef.current === nextSync) {
          syncInFlightRef.current = null;
        }
      }
    },
    [authSession.status, profileId, savedStorefrontIds]
  );

  React.useEffect(() => {
    void syncAlerts(false);
  }, [syncAlerts]);

  React.useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      const previousAppState = appStateRef.current;
      appStateRef.current = nextAppState;

      if (
        (previousAppState === 'background' || previousAppState === 'inactive') &&
        nextAppState === 'active'
      ) {
        void syncAlerts(true);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [syncAlerts]);

  React.useEffect(() => {
    const interval = setInterval(() => {
      if (appStateRef.current === 'active') {
        void syncAlerts(true);
      }
    }, FAVORITE_DEAL_ALERT_POLL_INTERVAL_MS);

    return () => {
      clearInterval(interval);
    };
  }, [syncAlerts]);

  return null;
}

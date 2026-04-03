import React from 'react';
import type { AppStateStatus } from 'react-native';
import { AppState } from 'react-native';
import { storefrontSourceMode } from '../config/storefrontSourceConfig';
import {
  useStorefrontProfileController,
  useStorefrontRouteController,
} from '../context/StorefrontController';
import { storefrontSource } from '../sources';
import {
  getRegisteredCustomerDealPushToken,
  initializeCustomerDealNotifications,
  scheduleFavoriteDealNotification,
  syncFavoriteDealNotifications,
} from '../services/favoriteDealNotificationService';
import { getRuntimeOpsStatus, hasRuntimeSafeMode } from '../services/runtimeOpsService';
import { reportRuntimeError } from '../services/runtimeReportingService';
import { syncStorefrontBackendFavoriteDealAlerts } from '../services/storefrontBackendService';
import { FAVORITE_DEAL_ALERT_POLL_INTERVAL_MS } from '../utils/favoriteDealAlerts';

export function FavoriteDealNotificationBridge() {
  const { authSession, profileId } = useStorefrontProfileController();
  const { savedStorefrontIds } = useStorefrontRouteController();
  const appStateRef = React.useRef<AppStateStatus>(AppState.currentState);
  const syncInFlightRef = React.useRef<Promise<void> | null>(null);

  const syncAlerts = React.useCallback(
    async (allowNotifications: boolean) => {
      try {
        if (syncInFlightRef.current) {
          await syncInFlightRef.current;
        }

        const nextSync = (async () => {
          await initializeCustomerDealNotifications();
          const runtimeStatus = await getRuntimeOpsStatus();
          const notificationsEnabled = allowNotifications && !hasRuntimeSafeMode(runtimeStatus);
          const shouldUseBackend =
            storefrontSourceMode === 'api' &&
            authSession.status === 'authenticated' &&
            Boolean(profileId);

          if (shouldUseBackend) {
            const devicePushToken = notificationsEnabled
              ? await getRegisteredCustomerDealPushToken({ prompt: true })
              : await getRegisteredCustomerDealPushToken({ prompt: false });
            const response = await syncStorefrontBackendFavoriteDealAlerts({
              profileId,
              savedStorefrontIds,
              allowNotifications: notificationsEnabled,
              devicePushToken,
            });

            if (notificationsEnabled && response.deliveryMode !== 'backend_push') {
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
            allowNotifications: notificationsEnabled,
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
      } catch (error) {
        reportRuntimeError(error, {
          source: 'favorite-deal-notification-sync',
        });
      }
    },
    [authSession.status, profileId, savedStorefrontIds],
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

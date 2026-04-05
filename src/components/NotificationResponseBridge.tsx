import React from 'react';
import type { NavigationContainerRef } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import type { RootStackParamList } from '../navigation/rootNavigatorConfig';
import { handleNotificationNavigationResponse } from '../services/notificationRoutingService';
import { reportRuntimeError } from '../services/runtimeReportingService';

const HANDLED_NOTIFICATION_ID_LIMIT = 96;
const HANDLED_NOTIFICATION_RETENTION_MS = 12 * 60 * 60 * 1000;

function pruneHandledNotificationIds(handledIdentifiers: Map<string, number>, now = Date.now()) {
  handledIdentifiers.forEach((handledAt, identifier) => {
    if (now - handledAt > HANDLED_NOTIFICATION_RETENTION_MS) {
      handledIdentifiers.delete(identifier);
    }
  });

  while (handledIdentifiers.size > HANDLED_NOTIFICATION_ID_LIMIT) {
    const oldestIdentifier = handledIdentifiers.keys().next().value;
    if (!oldestIdentifier) {
      break;
    }

    handledIdentifiers.delete(oldestIdentifier);
  }
}

function hasHandledNotificationId(handledIdentifiers: Map<string, number>, identifier: string) {
  pruneHandledNotificationIds(handledIdentifiers);
  return handledIdentifiers.has(identifier);
}

function rememberHandledNotificationId(
  handledIdentifiers: Map<string, number>,
  identifier: string,
) {
  const now = Date.now();
  handledIdentifiers.delete(identifier);
  handledIdentifiers.set(identifier, now);
  pruneHandledNotificationIds(handledIdentifiers, now);
}

type NotificationResponseBridgeProps = {
  navigationRef: React.RefObject<NavigationContainerRef<RootStackParamList> | null>;
  navigationReady: boolean;
};

export function NotificationResponseBridge({
  navigationRef,
  navigationReady,
}: NotificationResponseBridgeProps) {
  const pendingResponseRef = React.useRef<Notifications.NotificationResponse | null>(null);
  const handledIdentifiersRef = React.useRef<Map<string, number>>(new Map());

  const processResponse = React.useCallback(
    async (response: Notifications.NotificationResponse | null) => {
      try {
        if (!response) {
          return;
        }

        if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) {
          return;
        }

        const notificationId = response.notification.request.identifier;
        if (hasHandledNotificationId(handledIdentifiersRef.current, notificationId)) {
          return;
        }

        const navigation = navigationRef.current;
        if (!navigationReady || !navigation?.isReady()) {
          pendingResponseRef.current = response;
          return;
        }

        const handled = await handleNotificationNavigationResponse(response, navigation);
        if (!handled) {
          return;
        }

        rememberHandledNotificationId(handledIdentifiersRef.current, notificationId);
        pendingResponseRef.current = null;
        await Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
      } catch (error) {
        reportRuntimeError(error, {
          source: 'notification-response-bridge',
        });
      }
    },
    [navigationReady, navigationRef],
  );

  React.useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      void processResponse(response);
    });

    const initializeLastResponse = async () => {
      try {
        const response = await Notifications.getLastNotificationResponseAsync();
        await processResponse(response);
      } catch {
        // Ignore errors
      }
    };

    void initializeLastResponse();

    return () => {
      subscription.remove();
    };
  }, [processResponse]);

  React.useEffect(() => {
    if (!navigationReady || !pendingResponseRef.current) {
      return;
    }

    void processResponse(pendingResponseRef.current);
  }, [navigationReady, processResponse]);

  return null;
}

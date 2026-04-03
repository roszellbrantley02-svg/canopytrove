import { DEFAULT_ACTION_IDENTIFIER, type NotificationResponse } from 'expo-notifications';
import type { NavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from '../navigation/rootNavigatorConfig';
import type { StorefrontSummary } from '../types/storefront';
import { parseNotificationPayload } from './notificationPayloadService';

type NotificationNavigationRequest =
  | {
      routeName: 'StorefrontDetail';
      params: RootStackParamList['StorefrontDetail'];
    }
  | {
      routeName: 'HotDeals';
      params: RootStackParamList['HotDeals'];
    }
  | {
      routeName: 'OwnerPortalAccess';
      params: RootStackParamList['OwnerPortalAccess'];
    }
  | {
      routeName: 'OwnerPortalHome';
      params: RootStackParamList['OwnerPortalHome'];
    }
  | {
      routeName: 'OwnerPortalReviewInbox';
      params: RootStackParamList['OwnerPortalReviewInbox'];
    }
  | {
      routeName: 'AdminRuntimePanel';
      params: RootStackParamList['AdminRuntimePanel'];
    };

async function loadStorefrontSummaryForNotification(storefrontId: string) {
  const { storefrontSource } = await import('../sources');
  const summaries = await storefrontSource.getSummariesByIds([storefrontId]);
  return summaries[0] ?? null;
}

async function resolveOwnerPortalNotificationTarget(
  preferredRouteName: 'OwnerPortalHome' | 'OwnerPortalReviewInbox',
): Promise<
  | {
      routeName: 'OwnerPortalAccess';
      params: RootStackParamList['OwnerPortalAccess'];
    }
  | {
      routeName: 'OwnerPortalHome';
      params: RootStackParamList['OwnerPortalHome'];
    }
  | {
      routeName: 'OwnerPortalReviewInbox';
      params: RootStackParamList['OwnerPortalReviewInbox'];
    }
> {
  try {
    const { ensureOwnerPortalSessionReady } = await import('./ownerPortalSessionService');
    await ensureOwnerPortalSessionReady();
    return {
      routeName: preferredRouteName,
      params: undefined,
    };
  } catch {
    return {
      routeName: 'OwnerPortalAccess',
      params: undefined,
    };
  }
}

export async function resolveNotificationNavigationRequest(
  data: Record<string, unknown> | null | undefined,
  options?: {
    loadStorefrontSummary?: (storefrontId: string) => Promise<StorefrontSummary | null>;
  },
): Promise<NotificationNavigationRequest | null> {
  const payload = parseNotificationPayload(data);
  if (!payload) {
    return null;
  }

  if (payload.kind === 'favorite_store_deal') {
    const storefrontId = payload.storefrontId;
    if (!storefrontId) {
      return {
        routeName: 'HotDeals',
        params: undefined,
      };
    }

    const loadStorefrontSummary =
      options?.loadStorefrontSummary ?? loadStorefrontSummaryForNotification;

    try {
      const storefront = await loadStorefrontSummary(storefrontId);
      if (storefront) {
        return {
          routeName: 'StorefrontDetail',
          params: {
            storefront,
          },
        };
      }
    } catch {
      // Fall through to the safer browse surface.
    }

    return {
      routeName: 'HotDeals',
      params: undefined,
    };
  }

  if (payload.kind === 'owner_review') {
    return resolveOwnerPortalNotificationTarget('OwnerPortalReviewInbox');
  }

  if (payload.kind === 'owner_report') {
    return resolveOwnerPortalNotificationTarget('OwnerPortalReviewInbox');
  }

  if (payload.kind === 'owner_license_compliance' || payload.kind === 'owner_portal_alert') {
    return resolveOwnerPortalNotificationTarget('OwnerPortalHome');
  }

  if (payload.kind === 'runtime_incident_alert') {
    if (payload.source === 'admin_runtime') {
      return {
        routeName: 'AdminRuntimePanel',
        params: undefined,
      };
    }

    return resolveOwnerPortalNotificationTarget('OwnerPortalHome');
  }

  return null;
}

export async function handleNotificationNavigationResponse(
  response: NotificationResponse,
  navigation: NavigationContainerRef<RootStackParamList>,
  options?: {
    loadStorefrontSummary?: (storefrontId: string) => Promise<StorefrontSummary | null>;
  },
) {
  if (response.actionIdentifier !== DEFAULT_ACTION_IDENTIFIER) {
    return false;
  }

  const target = await resolveNotificationNavigationRequest(
    response.notification.request.content.data,
    options,
  );
  if (!target) {
    return false;
  }

  switch (target.routeName) {
    case 'StorefrontDetail':
      navigation.navigate('StorefrontDetail', target.params);
      return true;
    case 'HotDeals':
      navigation.navigate('HotDeals');
      return true;
    case 'OwnerPortalAccess':
      navigation.navigate('OwnerPortalAccess', target.params);
      return true;
    case 'OwnerPortalHome':
      navigation.navigate('OwnerPortalHome', target.params);
      return true;
    case 'OwnerPortalReviewInbox':
      navigation.navigate('OwnerPortalReviewInbox', target.params);
      return true;
    case 'AdminRuntimePanel':
      navigation.navigate('AdminRuntimePanel');
      return true;
    default:
      return false;
  }
}

import { Platform } from 'react-native';
import { requestJson } from './storefrontBackendHttp';

// Browser Web Push opt-in for the owner portal. Lives entirely on web —
// every public function returns a `not_supported` outcome on native so the
// owner portal can call into this from a single shared screen and the
// native app falls back to its existing expo-notifications path.
//
// Flow:
//   1. checkWebPushAvailability()   — quick preflight (browser support, sw, vapid)
//   2. enableOwnerPortalWebPush()   — request permission, subscribe, POST to backend
//   3. disableOwnerPortalWebPush()  — unsubscribe locally, DELETE on backend
//
// Backend storage layout and endpoint surface lives in
// `backend/src/services/webPushSubscriptionService.ts` and
// `backend/src/routes/ownerPortalWebPushRoutes.ts`.

export type WebPushAvailability =
  | { supported: true; vapidPublicKey: string }
  | { supported: false; reason: WebPushUnsupportedReason };

export type WebPushUnsupportedReason =
  | 'not_web'
  | 'no_service_worker'
  | 'no_push_manager'
  | 'no_notification_api'
  | 'insecure_context'
  | 'vapid_public_key_missing';

export type WebPushEnableResult =
  | { status: 'enabled'; endpoint: string; endpointHash: string }
  | { status: 'permission_denied' }
  | { status: 'not_supported'; reason: WebPushUnsupportedReason }
  | { status: 'error'; message: string };

export type WebPushDisableResult =
  | { status: 'disabled' }
  | { status: 'not_supported'; reason: WebPushUnsupportedReason }
  | { status: 'error'; message: string };

export type WebPushPermissionStatus = 'granted' | 'denied' | 'default' | 'unsupported';

const VAPID_PUBLIC_KEY = (process.env.EXPO_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY ?? '').trim();
const SERVICE_WORKER_PATH = '/service-worker.js';

// Narrow shims so this file compiles without lib.dom in the Expo base
// tsconfig — only the surface we actually call is typed, every value is
// validated at runtime before use.
type WebPushSubscriptionShim = {
  endpoint: string;
  getKey: (name: 'p256dh' | 'auth') => ArrayBuffer | null;
  unsubscribe: () => Promise<boolean>;
};
type WebPushManagerShim = {
  getSubscription: () => Promise<WebPushSubscriptionShim | null>;
  subscribe: (options: {
    userVisibleOnly: boolean;
    applicationServerKey: Uint8Array;
  }) => Promise<WebPushSubscriptionShim>;
};
type WebServiceWorkerRegistrationShim = {
  active: unknown;
  pushManager: WebPushManagerShim;
};
type WebServiceWorkerContainerShim = {
  ready: Promise<WebServiceWorkerRegistrationShim>;
  getRegistration: (scope?: string) => Promise<WebServiceWorkerRegistrationShim | undefined>;
  register: (path: string) => Promise<WebServiceWorkerRegistrationShim>;
};
type WebNavigatorShim = {
  serviceWorker?: WebServiceWorkerContainerShim;
  userAgent?: string;
};
type WebNotificationShim = {
  permission: WebPushPermissionStatus;
  requestPermission: () => Promise<WebPushPermissionStatus>;
};
type WebWindowShim = {
  PushManager?: unknown;
  Notification?: WebNotificationShim;
  isSecureContext?: boolean;
};

function getWebGlobals(): {
  navigator: WebNavigatorShim;
  window: WebWindowShim;
} | null {
  if (Platform.OS !== 'web') return null;
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return null;
  return {
    navigator: navigator as unknown as WebNavigatorShim,
    window: window as unknown as WebWindowShim,
  };
}

export function checkWebPushAvailability(): WebPushAvailability {
  const globals = getWebGlobals();
  if (!globals) return { supported: false, reason: 'not_web' };

  const { navigator: nav, window: win } = globals;
  if (!nav.serviceWorker) {
    return { supported: false, reason: 'no_service_worker' };
  }
  if (typeof win.PushManager === 'undefined') {
    return { supported: false, reason: 'no_push_manager' };
  }
  if (typeof win.Notification === 'undefined') {
    return { supported: false, reason: 'no_notification_api' };
  }
  // Push subscription requires a secure context — http://localhost is treated
  // as secure by browsers, but plain http on a public host will refuse.
  if (typeof win.isSecureContext === 'boolean' && !win.isSecureContext) {
    return { supported: false, reason: 'insecure_context' };
  }
  if (!VAPID_PUBLIC_KEY) {
    return { supported: false, reason: 'vapid_public_key_missing' };
  }
  return { supported: true, vapidPublicKey: VAPID_PUBLIC_KEY };
}

export function getWebPushPermissionStatus(): WebPushPermissionStatus {
  const globals = getWebGlobals();
  if (!globals || !globals.window.Notification) return 'unsupported';
  return globals.window.Notification.permission;
}

// VAPID public keys are url-safe base64. PushManager.subscribe requires the
// key as a Uint8Array, so we convert here.
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

function arrayBufferToBase64Url(buffer: ArrayBuffer | null): string {
  if (!buffer) return '';
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function ensureServiceWorkerRegistration(): Promise<WebServiceWorkerRegistrationShim | null> {
  const globals = getWebGlobals();
  if (!globals?.navigator.serviceWorker) return null;
  const sw = globals.navigator.serviceWorker;
  // Prefer an already-registered SW so we don't double-register on top of the
  // one `web/scripts/sw-register.js` set up at page load.
  const existing = await sw.getRegistration(SERVICE_WORKER_PATH);
  if (existing) return existing;
  return sw.register(SERVICE_WORKER_PATH);
}

export async function enableOwnerPortalWebPush(): Promise<WebPushEnableResult> {
  const availability = checkWebPushAvailability();
  if (!availability.supported) {
    return { status: 'not_supported', reason: availability.reason };
  }

  try {
    const globals = getWebGlobals();
    if (!globals?.window.Notification || !globals.navigator.serviceWorker) {
      return { status: 'not_supported', reason: 'no_notification_api' };
    }
    const permission = await globals.window.Notification.requestPermission();
    if (permission !== 'granted') {
      return { status: 'permission_denied' };
    }

    const registration = await ensureServiceWorkerRegistration();
    if (!registration) {
      return { status: 'error', message: 'Failed to register service worker.' };
    }
    // Wait until the SW is active before asking for a subscription —
    // pushManager.subscribe rejects on a "redundant" worker.
    if (!registration.active) {
      await globals.navigator.serviceWorker.ready;
    }

    const applicationServerKey = urlBase64ToUint8Array(availability.vapidPublicKey);

    // Reuse an existing subscription if one is present — browsers persist
    // the subscription across sessions and we want the backend to keep
    // pointing at the same endpoint rather than churning a fresh one.
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });
    }

    const p256dh = arrayBufferToBase64Url(subscription.getKey('p256dh'));
    const auth = arrayBufferToBase64Url(subscription.getKey('auth'));
    if (!p256dh || !auth) {
      return { status: 'error', message: 'Subscription is missing encryption keys.' };
    }

    const userAgent =
      typeof globals.navigator.userAgent === 'string' ? globals.navigator.userAgent : null;
    const response = await requestJson<{
      ok: boolean;
      endpointHash?: string;
      error?: string;
      code?: string;
    }>('/owner-portal/web-push/subscriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: subscription.endpoint,
        keys: { p256dh, auth },
        userAgent,
      }),
    });

    if (!response?.ok) {
      const message =
        response?.code === 'WEB_PUSH_NOT_CONFIGURED'
          ? 'Web push is not configured on the server yet.'
          : (response?.error ?? 'Failed to register subscription with the server.');
      return { status: 'error', message };
    }

    return {
      status: 'enabled',
      endpoint: subscription.endpoint,
      endpointHash: response.endpointHash ?? '',
    };
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to enable web push.',
    };
  }
}

export async function disableOwnerPortalWebPush(): Promise<WebPushDisableResult> {
  const availability = checkWebPushAvailability();
  if (!availability.supported) {
    return { status: 'not_supported', reason: availability.reason };
  }

  try {
    const registration = await ensureServiceWorkerRegistration();
    let endpoint: string | null = null;
    if (registration) {
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        endpoint = subscription.endpoint;
        try {
          await subscription.unsubscribe();
        } catch {
          // Best-effort — even if local unsubscribe fails we still want to
          // tell the backend to drop the row so it stops sending pushes.
        }
      }
    }

    await requestJson<{ ok: boolean }>('/owner-portal/web-push/subscriptions', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(endpoint ? { endpoint } : { all: true }),
    });

    return { status: 'disabled' };
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to disable web push.',
    };
  }
}

export async function isOwnerPortalWebPushActive(): Promise<boolean> {
  const availability = checkWebPushAvailability();
  if (!availability.supported) return false;
  try {
    const registration = await ensureServiceWorkerRegistration();
    if (!registration) return false;
    const subscription = await registration.pushManager.getSubscription();
    return Boolean(subscription);
  } catch {
    return false;
  }
}

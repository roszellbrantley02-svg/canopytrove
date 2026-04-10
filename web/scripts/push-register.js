/**
 * Canopy Trove — Web Push Registration
 *
 * Requests notification permission, subscribes to web push via the
 * browser's Push API, and sends the subscription to the backend for storage.
 *
 * VAPID public key must be set in the meta tag:
 *   <meta name="vapid-public-key" content="BxxxYyyy..." />
 *
 * Or via window.__CT_VAPID_PUBLIC_KEY (set by the app bundle).
 *
 * The backend stores the subscription in Firestore and uses it to send
 * push messages via the Web Push protocol (no FCM SDK needed).
 */
(function () {
  'use strict';

  // Only run in browsers that support Push
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

  // Don't auto-prompt — wait for user to opt in via the app UI.
  // Expose a global function the React app can call.
  window.__ctRequestPushPermission = requestPushPermission;

  // Also expose a check for current status
  window.__ctGetPushStatus = getPushStatus;

  function getVapidKey() {
    // Check meta tag first
    var meta = document.querySelector('meta[name="vapid-public-key"]');
    if (meta && meta.content) return meta.content;

    // Fallback to global
    return window.__CT_VAPID_PUBLIC_KEY || null;
  }

  function urlBase64ToUint8Array(base64String) {
    var padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    var base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    var rawData = atob(base64);
    var outputArray = new Uint8Array(rawData.length);
    for (var i = 0; i < rawData.length; i++) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  async function getPushStatus() {
    if (Notification.permission === 'denied') return 'denied';
    if (Notification.permission === 'default') return 'prompt';

    try {
      var registration = await navigator.serviceWorker.ready;
      var subscription = await registration.pushManager.getSubscription();
      return subscription ? 'subscribed' : 'granted';
    } catch {
      return 'error';
    }
  }

  async function requestPushPermission() {
    var vapidKey = getVapidKey();
    if (!vapidKey) {
      console.warn(
        '[CT Push] No VAPID public key found. Set meta[name="vapid-public-key"] or window.__CT_VAPID_PUBLIC_KEY.',
      );
      return { ok: false, reason: 'no_vapid_key' };
    }

    // Request permission
    var permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { ok: false, reason: 'permission_' + permission };
    }

    try {
      var registration = await navigator.serviceWorker.ready;

      // Check for existing subscription
      var existing = await registration.pushManager.getSubscription();
      if (existing) {
        await sendSubscriptionToBackend(existing);
        return { ok: true, subscription: existing };
      }

      // Create new subscription
      var subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      await sendSubscriptionToBackend(subscription);
      return { ok: true, subscription: subscription };
    } catch (err) {
      console.error('[CT Push] Subscription failed:', err);
      return { ok: false, reason: 'subscribe_error', error: err.message };
    }
  }

  async function sendSubscriptionToBackend(subscription) {
    try {
      // __CT_API_BASE_URL__ is replaced at build time by post-export.js
      var response = await fetch('__CT_API_BASE_URL__/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          platform: 'web',
        }),
      });

      if (!response.ok) {
        console.error('[CT Push] Backend subscription failed:', response.status);
      }
    } catch (err) {
      console.error('[CT Push] Failed to send subscription to backend:', err);
    }
  }
})();

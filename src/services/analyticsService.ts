import { AppState } from 'react-native';
import type { AnalyticsEventType, AnalyticsMetadata } from '../types/analytics';
import type { StorefrontSummary } from '../types/storefront';
import type { AnalyticsIdentity } from './analyticsConfig';
import {
  FLUSH_DELAY_MS,
  MAX_BATCH_SIZE,
  MAX_QUEUE_SIZE,
  RETRY_BACKOFF_MS,
  createAnalyticsUrl,
} from './analyticsConfig';
import {
  buildAnalyticsEvent,
  classifyLocationInput as classifyAnalyticsLocationInput,
} from './analyticsEventBuilder';
import {
  ensureAnalyticsInstallId,
  loadPersistedAnalyticsQueue,
  persistAnalyticsQueue,
} from './analyticsStorage';
import {
  handleAnalyticsAppStateChange,
  startAnalyticsSession,
  endAnalyticsSession,
} from './analyticsSessionLifecycle';
import { analyticsRuntimeState as state } from './analyticsRuntimeState';
import { postAnalyticsBatch } from './analyticsTransport';

function scheduleFlush(delayMs = FLUSH_DELAY_MS) {
  if (state.flushTimeout) {
    return;
  }

  const backoffDelayMs = Math.max(0, state.flushBackoffUntil - Date.now());
  const effectiveDelayMs = Math.max(delayMs, backoffDelayMs);

  state.flushTimeout = setTimeout(() => {
    state.flushTimeout = null;
    void flushAnalyticsEvents();
  }, effectiveDelayMs);
}

function enqueueEvent(
  eventType: AnalyticsEventType,
  metadata?: AnalyticsMetadata,
  options?: {
    screen?: string;
    storefrontId?: string;
    dealId?: string;
  },
) {
  const event = buildAnalyticsEvent(
    eventType,
    state.installId,
    state.currentSessionId,
    state.currentIdentity,
    state.currentScreen,
    metadata,
    options,
  );
  if (!event) {
    return;
  }

  state.pendingEvents = [...state.pendingEvents, event].slice(-MAX_QUEUE_SIZE);
  void persistAnalyticsQueue(state.pendingEvents);
  if (state.pendingEvents.length >= MAX_BATCH_SIZE) {
    void flushAnalyticsEvents();
    return;
  }

  scheduleFlush();
}

export async function flushAnalyticsEvents() {
  if (state.isFlushing || !state.pendingEvents.length) {
    return;
  }

  state.isFlushing = true;
  try {
    while (state.pendingEvents.length) {
      const batch = state.pendingEvents.slice(0, MAX_BATCH_SIZE);
      const result = await postAnalyticsBatch(createAnalyticsUrl(), batch);
      if (result.kind === 'retryable_failure') {
        state.flushBackoffUntil = Date.now() + RETRY_BACKOFF_MS;
        scheduleFlush(RETRY_BACKOFF_MS);
        break;
      }

      state.flushBackoffUntil = 0;
      state.pendingEvents = state.pendingEvents.slice(batch.length);
      await persistAnalyticsQueue(state.pendingEvents);

      if (result.kind === 'terminal_failure') {
        continue;
      }
    }
  } finally {
    state.isFlushing = false;
  }
}

export async function initializeAnalytics() {
  if (state.analyticsInitialized) {
    return;
  }

  if (state.analyticsInitPromise) {
    await state.analyticsInitPromise;
    return;
  }

  state.analyticsInitPromise = (async () => {
    state.installId = await ensureAnalyticsInstallId(state.installId);
    state.pendingEvents = await loadPersistedAnalyticsQueue();
    state.analyticsInitialized = true;
    startAnalyticsSession(
      state,
      (eventType, metadata) => enqueueEvent(eventType, metadata),
      'cold_start',
    );

    if (!state.appStateSubscription) {
      state.appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
        handleAnalyticsAppStateChange(state, nextAppState, {
          startSession: (reason) =>
            startAnalyticsSession(
              state,
              (eventType, metadata) => enqueueEvent(eventType, metadata),
              reason,
            ),
          endSession: (reason) =>
            endAnalyticsSession(
              state,
              (eventType, metadata) => enqueueEvent(eventType, metadata),
              reason,
            ),
          flushAnalyticsEvents: () => {
            void flushAnalyticsEvents();
          },
        });
      });
    }

    if (state.pendingEvents.length) {
      scheduleFlush(250);
    }
  })();

  await state.analyticsInitPromise;
}

export async function shutdownAnalytics() {
  endAnalyticsSession(
    state,
    (eventType, metadata) => enqueueEvent(eventType, metadata),
    'inactive',
  );
  await flushAnalyticsEvents();
}

export function setAnalyticsIdentity(identity: AnalyticsIdentity) {
  state.currentIdentity = identity;
}

export function trackAnalyticsEvent(
  eventType: AnalyticsEventType,
  metadata?: AnalyticsMetadata,
  options?: {
    screen?: string;
    storefrontId?: string;
    dealId?: string;
  },
) {
  if (!state.analyticsInitialized) {
    void initializeAnalytics().then(() => {
      enqueueEvent(eventType, metadata, options);
    });
    return;
  }

  enqueueEvent(eventType, metadata, options);
}

export function trackScreenView(screen: string) {
  if (state.currentScreen === screen) {
    return;
  }

  state.currentScreen = screen;
  trackAnalyticsEvent('screen_view', undefined, { screen });
}

/**
 * Track per-session, per-screen storefront card impressions.
 *
 * Accepts either a list of storefront IDs (lightweight callers without
 * the full summary object) or a list of summary objects (when payment-
 * methods + promotion metadata is available). The richer overload folds
 * `paymentMethodsAcceptedCount` and `paymentMethodsHasOwnerDeclaration`
 * into the impression event metadata. Before May 3 2026 the badge
 * fired as a separate `payment_methods_badge_shown` event in lockstep
 * with each impression — that's now consolidated into one event since
 * the badge is just visibility metadata about an impression we already
 * recorded.
 */
export function trackStorefrontImpressions(
  storefronts: ReadonlyArray<string | Pick<StorefrontSummary, 'id' | 'paymentMethods'>>,
  screen: string,
) {
  if (!state.currentSessionId) {
    return;
  }

  storefronts.forEach((entry) => {
    const storefrontId = typeof entry === 'string' ? entry : entry.id;
    const key = `${state.currentSessionId}:${screen}:${storefrontId}`;
    if (state.storefrontImpressionKeys.has(key)) {
      return;
    }

    state.storefrontImpressionKeys.add(key);

    let paymentMethodsAcceptedCount: number | undefined;
    let paymentMethodsHasOwnerDeclaration: boolean | undefined;
    if (typeof entry !== 'string' && entry.paymentMethods) {
      const accepted = entry.paymentMethods.methods.filter((record) => record.accepted).length;
      if (accepted > 0) {
        paymentMethodsAcceptedCount = accepted;
        paymentMethodsHasOwnerDeclaration = entry.paymentMethods.hasOwnerDeclaration;
      }
    }

    trackAnalyticsEvent(
      'storefront_impression',
      {
        sourceScreen: screen,
        ...(paymentMethodsAcceptedCount !== undefined
          ? { paymentMethodsAcceptedCount, paymentMethodsHasOwnerDeclaration }
          : {}),
      },
      {
        screen,
        storefrontId,
      },
    );
  });
}

export function trackStorefrontPromotionImpressions(
  storefronts: Pick<StorefrontSummary, 'activePromotionId' | 'id'>[],
  screen: string,
) {
  if (!state.currentSessionId) {
    return;
  }

  storefronts.forEach((storefront) => {
    if (!storefront.activePromotionId) {
      return;
    }

    const key = `${state.currentSessionId}:${screen}:${storefront.activePromotionId}`;
    if (state.dealImpressionKeys.has(key)) {
      return;
    }

    state.dealImpressionKeys.add(key);
    trackAnalyticsEvent(
      'deal_impression',
      {
        sourceScreen: screen,
      },
      {
        screen,
        storefrontId: storefront.id,
        dealId: storefront.activePromotionId,
      },
    );
  });
}

/**
 * @deprecated The badge metadata is now folded into `storefront_impression`
 * via `trackStorefrontImpressions(storefronts, screen)` when callers pass
 * the full summary object. Removed May 3 2026 — the previous separate
 * event fired in lockstep with `storefront_impression` (1:1 ratio) and
 * carried no signal that wasn't already implicit in the impression. The
 * cleanup cut ~30% of analytics event volume on browse / nearby surfaces.
 *
 * Callers updated. This stub stays as a no-op for two minor versions in
 * case any out-of-tree caller still imports it; safe to delete after the
 * next two EAS update windows.
 */
export function trackPaymentMethodsBadgeImpressions(
  _storefronts: ReadonlyArray<Pick<StorefrontSummary, 'id' | 'paymentMethods'>>,
  _screen: string,
) {
  // Intentionally a no-op. See JSDoc above.
}

export function classifyLocationInput(query: string) {
  return classifyAnalyticsLocationInput(query);
}

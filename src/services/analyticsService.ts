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

export function trackStorefrontImpressions(storefrontIds: string[], screen: string) {
  if (!state.currentSessionId) {
    return;
  }

  storefrontIds.forEach((storefrontId) => {
    const key = `${state.currentSessionId}:${screen}:${storefrontId}`;
    if (state.storefrontImpressionKeys.has(key)) {
      return;
    }

    state.storefrontImpressionKeys.add(key);
    trackAnalyticsEvent(
      'storefront_impression',
      {
        sourceScreen: screen,
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

export function classifyLocationInput(query: string) {
  return classifyAnalyticsLocationInput(query);
}

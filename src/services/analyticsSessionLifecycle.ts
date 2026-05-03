import type { AppStateStatus } from 'react-native';
import type { AnalyticsMetadata } from '../types/analytics';
import { createAnalyticsId } from './analyticsConfig';
import type { AnalyticsRuntimeState } from './analyticsRuntimeState';
import { getAcquisitionAttributionMetadata } from './acquisitionAttribution';

export function startAnalyticsSession(
  state: AnalyticsRuntimeState,
  enqueueEvent: (eventType: 'session_start' | 'app_open', metadata?: AnalyticsMetadata) => void,
  reason: 'cold_start' | 'foreground',
) {
  state.currentSessionId = createAnalyticsId('session');
  state.currentSessionStartedAt = Date.now();
  state.storefrontImpressionKeys.clear();
  state.dealImpressionKeys.clear();

  // Web-only attribution: pull UTM params + document.referrer from the
  // current page load, plus first-touch source from localStorage. Empty
  // object on native, where attribution would come from store install
  // referrers (Apple/Google) instead. Stamping these onto session_start
  // means every session is tagged with its acquisition source.
  const attribution = getAcquisitionAttributionMetadata();

  enqueueEvent('session_start', { reason, ...attribution });
  if (!state.coldOpenTracked) {
    state.coldOpenTracked = true;
    enqueueEvent('app_open', { reason: 'cold_start', ...attribution });
  }
}

export function endAnalyticsSession(
  state: AnalyticsRuntimeState,
  enqueueEvent: (eventType: 'session_end', metadata?: AnalyticsMetadata) => void,
  reason: 'background' | 'inactive',
) {
  if (!state.currentSessionId || !state.currentSessionStartedAt) {
    return;
  }

  const durationSeconds = Math.max(
    1,
    Math.round((Date.now() - state.currentSessionStartedAt) / 1000),
  );
  enqueueEvent('session_end', {
    reason,
    durationSeconds,
  });
  state.currentSessionId = null;
  state.currentSessionStartedAt = 0;
}

export function handleAnalyticsAppStateChange(
  state: AnalyticsRuntimeState,
  nextAppState: AppStateStatus,
  callbacks: {
    startSession: (reason: 'cold_start' | 'foreground') => void;
    endSession: (reason: 'background' | 'inactive') => void;
    flushAnalyticsEvents: () => void;
  },
) {
  const previousAppState = state.lastAppState;
  state.lastAppState = nextAppState;

  if (previousAppState === nextAppState) {
    return;
  }

  if (
    (previousAppState === 'active' || previousAppState === 'unknown') &&
    (nextAppState === 'background' || nextAppState === 'inactive')
  ) {
    callbacks.endSession(nextAppState);
    callbacks.flushAnalyticsEvents();
    return;
  }

  if (
    (previousAppState === 'background' || previousAppState === 'inactive') &&
    nextAppState === 'active'
  ) {
    callbacks.startSession('foreground');
  }
}

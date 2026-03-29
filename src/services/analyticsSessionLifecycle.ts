import { AppStateStatus } from 'react-native';
import { AnalyticsMetadata } from '../types/analytics';
import { createAnalyticsId } from './analyticsConfig';
import { AnalyticsRuntimeState } from './analyticsRuntimeState';

export function startAnalyticsSession(
  state: AnalyticsRuntimeState,
  enqueueEvent: (eventType: 'session_start' | 'app_open', metadata?: AnalyticsMetadata) => void,
  reason: 'cold_start' | 'foreground'
) {
  state.currentSessionId = createAnalyticsId('session');
  state.currentSessionStartedAt = Date.now();
  state.storefrontImpressionKeys.clear();
  enqueueEvent('session_start', { reason });
  if (!state.coldOpenTracked) {
    state.coldOpenTracked = true;
    enqueueEvent('app_open', { reason: 'cold_start' });
  }
}

export function endAnalyticsSession(
  state: AnalyticsRuntimeState,
  enqueueEvent: (
    eventType: 'session_end',
    metadata?: AnalyticsMetadata
  ) => void,
  reason: 'background' | 'inactive'
) {
  if (!state.currentSessionId || !state.currentSessionStartedAt) {
    return;
  }

  const durationSeconds = Math.max(
    1,
    Math.round((Date.now() - state.currentSessionStartedAt) / 1000)
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
  }
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

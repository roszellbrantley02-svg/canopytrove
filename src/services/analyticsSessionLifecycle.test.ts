import { describe, expect, it, vi } from 'vitest';
import type { AnalyticsRuntimeState } from './analyticsRuntimeState';
import { startAnalyticsSession } from './analyticsSessionLifecycle';

function createRuntimeState(): AnalyticsRuntimeState {
  return {
    analyticsInitialized: true,
    analyticsInitPromise: null,
    installId: 'install-1',
    pendingEvents: [],
    currentScreen: 'Nearby',
    currentSessionId: null,
    currentSessionStartedAt: 0,
    currentIdentity: {
      profileId: null,
      accountId: null,
      profileKind: null,
    },
    flushTimeout: null,
    flushBackoffUntil: 0,
    isFlushing: false,
    appStateSubscription: null,
    lastAppState: 'active',
    coldOpenTracked: false,
    storefrontImpressionKeys: new Set(['old-storefront']),
    dealImpressionKeys: new Set(['old-deal']),
  };
}

describe('startAnalyticsSession', () => {
  it('clears storefront and deal impression dedupe for a new session', () => {
    const state = createRuntimeState();
    const enqueueEvent = vi.fn();

    startAnalyticsSession(state, enqueueEvent, 'foreground');

    expect(state.currentSessionId).toBeTruthy();
    expect(state.storefrontImpressionKeys.size).toBe(0);
    expect(state.dealImpressionKeys.size).toBe(0);
    expect(enqueueEvent).toHaveBeenCalledWith('session_start', { reason: 'foreground' });
  });
});

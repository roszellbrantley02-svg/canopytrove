import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AnalyticsEventInput } from '../types/analytics';

const transportMocks = vi.hoisted(() => ({
  postAnalyticsBatch: vi.fn(),
}));

const storageMocks = vi.hoisted(() => ({
  ensureAnalyticsInstallId: vi.fn(),
  loadPersistedAnalyticsQueue: vi.fn(),
  persistAnalyticsQueue: vi.fn(),
}));

vi.mock('react-native', () => ({
  AppState: {
    currentState: 'active',
    addEventListener: vi.fn(() => ({
      remove: vi.fn(),
    })),
  },
}));

vi.mock('./analyticsConfig', async () => {
  const actual = (await vi.importActual('./analyticsConfig')) as Record<string, unknown>;
  return {
    ...actual,
    MAX_BATCH_SIZE: 1,
    createAnalyticsUrl: () => 'https://api.canopytrove.com/analytics/events',
  };
});

vi.mock('./analyticsTransport', () => ({
  postAnalyticsBatch: transportMocks.postAnalyticsBatch,
}));

vi.mock('./analyticsStorage', () => ({
  ensureAnalyticsInstallId: storageMocks.ensureAnalyticsInstallId,
  loadPersistedAnalyticsQueue: storageMocks.loadPersistedAnalyticsQueue,
  persistAnalyticsQueue: storageMocks.persistAnalyticsQueue,
}));

import { analyticsRuntimeState as state } from './analyticsRuntimeState';
import { flushAnalyticsEvents } from './analyticsService';

function createEvent(eventType: AnalyticsEventInput['eventType']): AnalyticsEventInput {
  return {
    eventType,
    installId: 'install-1',
    sessionId: 'session-1',
    occurredAt: '2026-03-30T00:00:00.000Z',
  };
}

describe('flushAnalyticsEvents', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    transportMocks.postAnalyticsBatch.mockReset();
    storageMocks.persistAnalyticsQueue.mockReset();
    state.analyticsInitialized = true;
    state.pendingEvents = [];
    state.currentScreen = null;
    state.currentSessionId = null;
    state.currentSessionStartedAt = 0;
    state.flushBackoffUntil = 0;
    state.isFlushing = false;
    state.currentIdentity = {
      profileId: null,
      accountId: null,
      profileKind: null,
    };
    if (state.flushTimeout) {
      clearTimeout(state.flushTimeout);
      state.flushTimeout = null;
    }
  });

  afterEach(() => {
    if (state.flushTimeout) {
      clearTimeout(state.flushTimeout);
      state.flushTimeout = null;
    }
    vi.useRealTimers();
  });

  it('drops a terminally invalid head batch and keeps draining later events', async () => {
    const firstEvent = createEvent('screen_view');
    const secondEvent = createEvent('signin');
    state.pendingEvents = [firstEvent, secondEvent];

    transportMocks.postAnalyticsBatch
      .mockResolvedValueOnce({
        kind: 'terminal_failure',
        status: 400,
      })
      .mockResolvedValueOnce({
        kind: 'success',
        status: 202,
      });

    await flushAnalyticsEvents();

    expect(transportMocks.postAnalyticsBatch).toHaveBeenNthCalledWith(
      1,
      'https://api.canopytrove.com/analytics/events',
      [firstEvent],
    );
    expect(transportMocks.postAnalyticsBatch).toHaveBeenNthCalledWith(
      2,
      'https://api.canopytrove.com/analytics/events',
      [secondEvent],
    );
    expect(storageMocks.persistAnalyticsQueue.mock.calls).toEqual([[[secondEvent]], [[]]]);
    expect(state.pendingEvents).toEqual([]);
    expect(state.flushBackoffUntil).toBe(0);
  });

  it('keeps the queue intact and schedules backoff for retryable failures', async () => {
    const firstEvent = createEvent('screen_view');
    const secondEvent = createEvent('signin');
    state.pendingEvents = [firstEvent, secondEvent];

    transportMocks.postAnalyticsBatch.mockResolvedValue({
      kind: 'retryable_failure',
      status: 429,
    });

    await flushAnalyticsEvents();

    expect(storageMocks.persistAnalyticsQueue).not.toHaveBeenCalled();
    expect(state.pendingEvents).toEqual([firstEvent, secondEvent]);
    expect(state.flushBackoffUntil).toBeGreaterThan(Date.now());
    expect(state.flushTimeout).not.toBeNull();
  });
});

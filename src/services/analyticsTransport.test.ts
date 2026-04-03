import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
  },
}));

import { postAnalyticsBatch } from './analyticsTransport';

const sampleBatch = [
  {
    eventType: 'screen_view' as const,
    installId: 'install-1',
    sessionId: 'session-1',
    occurredAt: '2026-03-30T00:00:00.000Z',
  },
];

describe('postAnalyticsBatch', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('treats 400 validation failures as terminal', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 400 })));

    await expect(
      postAnalyticsBatch('https://api.canopytrove.com/analytics/events', sampleBatch),
    ).resolves.toEqual({
      kind: 'terminal_failure',
      status: 400,
    });
  });

  it('treats 429 throttling as retryable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 429 })));

    await expect(
      postAnalyticsBatch('https://api.canopytrove.com/analytics/events', sampleBatch),
    ).resolves.toEqual({
      kind: 'retryable_failure',
      status: 429,
    });
  });

  it('treats transport errors as retryable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network failed')));

    await expect(
      postAnalyticsBatch('https://api.canopytrove.com/analytics/events', sampleBatch),
    ).resolves.toEqual({
      kind: 'retryable_failure',
      status: null,
    });
  });
});

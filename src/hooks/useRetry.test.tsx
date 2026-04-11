import React from 'react';
import type { ReactTestRenderer } from 'react-test-renderer';
import { act, create } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRetry } from './useRetry';

describe('useRetry', () => {
  let renderer: ReactTestRenderer | null = null;
  let latestValue: ReturnType<typeof useRetry> | null = null;

  beforeEach(() => {
    renderer?.unmount();
    renderer = null;
    latestValue = null;
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    renderer?.unmount();
  });

  function HookHarness({ asyncFn }: { asyncFn: () => Promise<void> }) {
    latestValue = useRetry({ asyncFn });
    return null;
  }

  it('does not start a second retry while one is already in flight', async () => {
    const asyncFn = vi.fn(async () => undefined);

    act(() => {
      renderer = create(<HookHarness asyncFn={asyncFn} />);
    });

    await act(async () => {
      const firstRetry = latestValue?.retry();
      const secondRetry = latestValue?.retry();
      vi.advanceTimersByTime(1000);
      await Promise.all([firstRetry, secondRetry]);
    });

    expect(asyncFn).toHaveBeenCalledTimes(1);
    expect(latestValue?.retryCount).toBe(0);
    expect(latestValue?.isRetrying).toBe(false);
  });
});

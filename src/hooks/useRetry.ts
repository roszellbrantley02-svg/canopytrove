import { useState, useCallback } from 'react';

export type UseRetryState = {
  isRetrying: boolean;
  retryCount: number;
  retry: () => void;
  reset: () => void;
};

type UseRetryOptions = {
  maxRetries?: number;
  asyncFn: () => Promise<void>;
};

const EXPONENTIAL_BACKOFF_DELAYS = [1000, 2000, 4000]; // 1s, 2s, 4s

export function useRetry({ asyncFn, maxRetries = 3 }: UseRetryOptions): UseRetryState {
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const retry = useCallback(async () => {
    if (isRetrying || retryCount >= maxRetries) {
      return;
    }

    setIsRetrying(true);

    try {
      // Calculate delay based on retry count (exponential backoff)
      const delayIndex = Math.min(retryCount, EXPONENTIAL_BACKOFF_DELAYS.length - 1);
      const delay = EXPONENTIAL_BACKOFF_DELAYS[delayIndex];

      // Wait for the delay before retrying
      await new Promise((resolve) => setTimeout(resolve, delay));

      // Execute the async function
      await asyncFn();

      // Reset on success
      setRetryCount(0);
    } catch {
      // Increment retry count on failure
      setRetryCount((prev) => prev + 1);
    } finally {
      setIsRetrying(false);
    }
  }, [asyncFn, isRetrying, retryCount, maxRetries]);

  const reset = useCallback(() => {
    setRetryCount(0);
    setIsRetrying(false);
  }, []);

  return {
    isRetrying,
    retryCount,
    retry,
    reset,
  };
}

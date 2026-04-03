import { Platform } from 'react-native';
import type { AnalyticsEventBatchRequest, AnalyticsEventInput } from '../types/analytics';
import { REPORT_TIMEOUT_MS } from './analyticsConfig';

export type AnalyticsBatchPostResult =
  | { kind: 'success'; status: number }
  | { kind: 'retryable_failure'; status: number | null }
  | { kind: 'terminal_failure'; status: number };

export async function postAnalyticsBatch(
  url: string | null,
  batch: AnalyticsEventInput[],
): Promise<AnalyticsBatchPostResult> {
  if (!url || !batch.length) {
    return {
      kind: 'retryable_failure',
      status: null,
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, REPORT_TIMEOUT_MS);

  const payload: AnalyticsEventBatchRequest = {
    platform: Platform.OS,
    events: batch,
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (response.ok) {
      return {
        kind: 'success',
        status: response.status,
      };
    }

    if (response.status === 400 || response.status === 413) {
      return {
        kind: 'terminal_failure',
        status: response.status,
      };
    }

    return {
      kind: 'retryable_failure',
      status: response.status,
    };
  } catch {
    return {
      kind: 'retryable_failure',
      status: null,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

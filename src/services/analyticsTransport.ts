import { Platform } from 'react-native';
import { AnalyticsEventBatchRequest, AnalyticsEventInput } from '../types/analytics';
import { REPORT_TIMEOUT_MS } from './analyticsConfig';

export async function postAnalyticsBatch(
  url: string | null,
  batch: AnalyticsEventInput[]
) {
  if (!url || !batch.length) {
    return false;
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

    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

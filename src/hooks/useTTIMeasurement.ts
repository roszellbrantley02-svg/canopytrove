import { useEffect, useRef } from 'react';
import { captureMonitoringException } from '../services/sentryMonitoringService';

/**
 * Measures the time from when a screen mounts to when it's interactive (first render complete).
 * Reports to Sentry if the measurement exceeds the warning threshold.
 */
export function useTTIMeasurement(screenName: string, warningThresholdMs = 2000) {
  const mountedAtRef = useRef(Date.now());

  useEffect(() => {
    const tti = Date.now() - mountedAtRef.current;

    if (__DEV__) {
      // eslint-disable-next-line no-console -- dev-only performance trace
      console.log(`[TTI] ${screenName}: ${tti}ms`);
    }

    // Only report slow screens to Sentry to avoid noise
    if (tti > warningThresholdMs) {
      captureMonitoringException(
        new Error(`Slow TTI: ${screenName} (${tti}ms, threshold: ${warningThresholdMs}ms)`),
        {
          source: 'tti-measurement',
          tags: { screen: screenName },
          extras: { ttiMs: tti, threshold: warningThresholdMs },
        },
      );
    }
  }, [screenName, warningThresholdMs]);
}

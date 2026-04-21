import React from 'react';
import {
  getAdaptiveMotionDistance,
  getAdaptiveMotionDuration,
  getDisplayPerformanceSnapshot,
  startDisplayPerformanceSampling,
  subscribeDisplayPerformance,
} from '../services/displayPerformanceService';

export function useAdaptiveMotion() {
  const [snapshot, setSnapshot] = React.useState(getDisplayPerformanceSnapshot);

  React.useEffect(() => {
    const unsubscribe = subscribeDisplayPerformance(setSnapshot);
    startDisplayPerformanceSampling();
    return unsubscribe;
  }, []);

  return React.useMemo(
    () => ({
      snapshot,
      duration: (durationMs: number) => getAdaptiveMotionDuration(durationMs, snapshot),
      distance: (distance: number) => getAdaptiveMotionDistance(distance, snapshot),
    }),
    [snapshot],
  );
}

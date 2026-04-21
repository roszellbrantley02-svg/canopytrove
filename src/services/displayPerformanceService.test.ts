import { afterEach, describe, expect, it } from 'vitest';
import {
  __resetDisplayPerformanceForTests,
  createDisplayPerformanceSnapshot,
  getAdaptiveMotionDistance,
  getAdaptiveMotionDuration,
} from './displayPerformanceService';

describe('displayPerformanceService', () => {
  afterEach(() => {
    __resetDisplayPerformanceForTests();
  });

  it('keeps 60Hz devices on the baseline motion scale', () => {
    const snapshot = createDisplayPerformanceSnapshot([16.7, 16.6, 16.8, 16.7, 16.6, 16.7]);

    expect(snapshot.refreshRateHz).toBe(60);
    expect(snapshot.durationScale).toBe(1);
    expect(snapshot.distanceScale).toBe(1);
  });

  it('slightly tightens motion for high-refresh displays', () => {
    const snapshot = createDisplayPerformanceSnapshot([8.3, 8.4, 8.3, 8.4, 8.3, 8.4]);

    expect(snapshot.refreshRateHz).toBeGreaterThanOrEqual(119);
    expect(getAdaptiveMotionDuration(260, snapshot)).toBe(239);
    expect(getAdaptiveMotionDistance(14, snapshot)).toBe(12.88);
  });

  it('reduces animation work for low-refresh or struggling displays', () => {
    const snapshot = createDisplayPerformanceSnapshot([21, 21.2, 20.9, 21, 21.1, 21]);

    expect(snapshot.refreshRateHz).toBeLessThanOrEqual(48);
    expect(getAdaptiveMotionDuration(260, snapshot)).toBe(229);
    expect(getAdaptiveMotionDistance(14, snapshot)).toBe(11.48);
  });

  it('falls back to baseline when sampling data is unusable', () => {
    const snapshot = createDisplayPerformanceSnapshot([0, 1, 1000]);

    expect(snapshot.source).toBe('default');
    expect(snapshot.refreshRateHz).toBe(60);
  });
});

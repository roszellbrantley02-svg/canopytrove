export type DisplayPerformanceSnapshot = {
  refreshRateHz: number;
  frameDurationMs: number;
  durationScale: number;
  distanceScale: number;
  source: 'default' | 'estimated';
};

const DEFAULT_REFRESH_RATE_HZ = 60;
const SAMPLE_FRAME_COUNT = 16;

const DEFAULT_SNAPSHOT: DisplayPerformanceSnapshot = {
  refreshRateHz: DEFAULT_REFRESH_RATE_HZ,
  frameDurationMs: 1000 / DEFAULT_REFRESH_RATE_HZ,
  durationScale: 1,
  distanceScale: 1,
  source: 'default',
};

let currentSnapshot = DEFAULT_SNAPSHOT;
let isSampling = false;
let hasSampled = false;
const listeners = new Set<(snapshot: DisplayPerformanceSnapshot) => void>();

function getMedian(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const midpoint = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return ((sorted[midpoint - 1] ?? 0) + (sorted[midpoint] ?? 0)) / 2;
  }
  return sorted[midpoint] ?? 0;
}

export function createDisplayPerformanceSnapshot(
  frameDurationsMs: readonly number[],
): DisplayPerformanceSnapshot {
  const usableDurations = frameDurationsMs.filter(
    (duration) => Number.isFinite(duration) && duration > 4 && duration < 45,
  );

  if (usableDurations.length < 4) {
    return DEFAULT_SNAPSHOT;
  }

  const frameDurationMs = getMedian(usableDurations);
  const refreshRateHz = Math.round(1000 / frameDurationMs);

  if (refreshRateHz >= 110) {
    return {
      refreshRateHz,
      frameDurationMs,
      durationScale: 0.92,
      distanceScale: 0.92,
      source: 'estimated',
    };
  }

  if (refreshRateHz >= 85) {
    return {
      refreshRateHz,
      frameDurationMs,
      durationScale: 0.96,
      distanceScale: 0.96,
      source: 'estimated',
    };
  }

  if (refreshRateHz <= 50) {
    return {
      refreshRateHz,
      frameDurationMs,
      durationScale: 0.88,
      distanceScale: 0.82,
      source: 'estimated',
    };
  }

  return {
    refreshRateHz,
    frameDurationMs,
    durationScale: 1,
    distanceScale: 1,
    source: 'estimated',
  };
}

function notifyListeners() {
  for (const listener of listeners) {
    listener(currentSnapshot);
  }
}

export function getDisplayPerformanceSnapshot(): DisplayPerformanceSnapshot {
  return currentSnapshot;
}

export function subscribeDisplayPerformance(
  listener: (snapshot: DisplayPerformanceSnapshot) => void,
) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function startDisplayPerformanceSampling() {
  if (
    isSampling ||
    hasSampled ||
    typeof requestAnimationFrame !== 'function' ||
    process.env.NODE_ENV === 'test'
  ) {
    return;
  }

  isSampling = true;
  const timestamps: number[] = [];
  const durations: number[] = [];

  const sample = (timestamp: number) => {
    const previous = timestamps[timestamps.length - 1];
    timestamps.push(timestamp);
    if (typeof previous === 'number') {
      durations.push(timestamp - previous);
    }

    if (durations.length >= SAMPLE_FRAME_COUNT) {
      currentSnapshot = createDisplayPerformanceSnapshot(durations);
      isSampling = false;
      hasSampled = true;
      notifyListeners();
      return;
    }

    requestAnimationFrame(sample);
  };

  requestAnimationFrame(sample);
}

export function getAdaptiveMotionDuration(durationMs: number, snapshot = currentSnapshot): number {
  return Math.max(80, Math.round(durationMs * snapshot.durationScale));
}

export function getAdaptiveMotionDistance(distance: number, snapshot = currentSnapshot): number {
  return Math.round(distance * snapshot.distanceScale * 100) / 100;
}

export function __resetDisplayPerformanceForTests() {
  currentSnapshot = DEFAULT_SNAPSHOT;
  isSampling = false;
  hasSampled = false;
  listeners.clear();
}

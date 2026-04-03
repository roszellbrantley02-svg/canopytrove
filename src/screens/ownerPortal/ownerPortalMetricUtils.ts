export function formatCount(value: number) {
  return Math.round(value).toLocaleString();
}

function formatPercentValue(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return '0%';
  }

  const rounded = Math.round(value * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}%`;
}

export function formatPercent(value: number) {
  return formatPercentValue(value);
}

export function formatRate(value: number) {
  return formatPercentValue(value);
}

export function clampProgress(value: number | undefined) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(1, value ?? 0));
}

export function getRelativeProgress(value: number, max: number) {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) {
    return 0;
  }

  return clampProgress(value / max);
}

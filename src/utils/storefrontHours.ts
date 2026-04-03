const HOURS_PLACEHOLDER_PATTERNS = [
  /^hours not published yet$/i,
  /^hours unavailable$/i,
  /^not published$/i,
];

function isPlaceholderHoursLine(value: string) {
  return HOURS_PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(value));
}

export function normalizeStorefrontHours(hours: string[] | null | undefined) {
  if (!Array.isArray(hours)) {
    return [];
  }

  return hours
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter((entry) => entry.length > 0 && !isPlaceholderHoursLine(entry));
}

export function hasPublishedStorefrontHours(hours: string[] | null | undefined) {
  return normalizeStorefrontHours(hours).length > 0;
}

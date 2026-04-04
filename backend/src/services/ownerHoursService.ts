import type { OwnerHoursEntry } from '../../../src/types/ownerPortal';

const VALID_DAYS: readonly OwnerHoursEntry['day'][] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

const JS_DAY_TO_NAME: Record<number, OwnerHoursEntry['day']> = {
  0: 'Sunday',
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
};

const TIME_PATTERN = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i;

function parseTimeToMinutes(timeStr: string): number | null {
  const match = timeStr.trim().match(TIME_PATTERN);
  if (!match) return null;

  let hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  const ampm = match[3].toUpperCase();

  if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) return null;

  if (ampm === 'AM' && hours === 12) hours = 0;
  if (ampm === 'PM' && hours !== 12) hours += 12;

  return hours * 60 + minutes;
}

/**
 * Normalize and validate owner hours entries.
 * Returns null if invalid or empty. Fills in missing days as closed.
 */
export function normalizeOwnerHours(
  input: OwnerHoursEntry[] | null | undefined,
): OwnerHoursEntry[] | null {
  if (!Array.isArray(input) || input.length === 0) return null;

  const dayMap = new Map<OwnerHoursEntry['day'], OwnerHoursEntry>();

  for (const entry of input) {
    if (!VALID_DAYS.includes(entry.day)) continue;
    if (dayMap.has(entry.day)) continue;

    if (entry.closed) {
      dayMap.set(entry.day, { day: entry.day, open: null, close: null, closed: true });
      continue;
    }

    if (!entry.open || !entry.close) continue;
    if (!TIME_PATTERN.test(entry.open.trim()) || !TIME_PATTERN.test(entry.close.trim())) continue;

    dayMap.set(entry.day, {
      day: entry.day,
      open: entry.open.trim(),
      close: entry.close.trim(),
      closed: false,
    });
  }

  if (dayMap.size === 0) return null;

  const result: OwnerHoursEntry[] = [];
  for (const day of VALID_DAYS) {
    result.push(dayMap.get(day) ?? { day, open: null, close: null, closed: true });
  }

  return result;
}

/**
 * Convert owner hours entries to the display format used by StorefrontDetail:
 * e.g. ["Monday: 9:00 AM – 10:00 PM", "Tuesday: Closed"]
 */
export function ownerHoursToDisplayStrings(entries: OwnerHoursEntry[]): string[] {
  return entries.map((entry) => {
    if (entry.closed || !entry.open || !entry.close) {
      return `${entry.day}: Closed`;
    }
    return `${entry.day}: ${entry.open} \u2013 ${entry.close}`;
  });
}

/**
 * Compute openNow based on owner hours and the current time.
 * Returns null if unable to determine (no entry for today, or missing times).
 */
export function computeOpenNowFromOwnerHours(
  entries: OwnerHoursEntry[],
  now: Date = new Date(),
): boolean | null {
  const dayName = JS_DAY_TO_NAME[now.getDay()];
  if (!dayName) return null;

  const todayEntry = entries.find((e) => e.day === dayName);
  if (!todayEntry) return null;

  if (todayEntry.closed || !todayEntry.open || !todayEntry.close) {
    return false;
  }

  const openMinutes = parseTimeToMinutes(todayEntry.open);
  const closeMinutes = parseTimeToMinutes(todayEntry.close);
  if (openMinutes === null || closeMinutes === null) return null;

  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  if (closeMinutes > openMinutes) {
    return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
  }

  // Overnight hours (e.g., open 8 PM, close 2 AM)
  return currentMinutes >= openMinutes || currentMinutes < closeMinutes;
}

export { VALID_DAYS };

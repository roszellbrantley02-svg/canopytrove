/**
 * Resolve whether a storefront is currently open.
 *
 * Priority:
 * 1. Compute from hours strings (real-time, most accurate)
 * 2. Fall back to Google Places live signal (if available)
 * 3. Fall back to static Firestore values
 */

const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

/**
 * Parse a 12-hour time string like "9:00 AM" into minutes since midnight.
 */
function parseTime(raw: string): number | null {
  const match = raw.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) {
    return null;
  }

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3].toUpperCase();

  if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) {
    return null;
  }

  if (period === 'AM' && hours === 12) {
    hours = 0;
  } else if (period === 'PM' && hours !== 12) {
    hours += 12;
  }

  return hours * 60 + minutes;
}

/**
 * Parse a Google Places hours line like "Monday: 9:00 AM – 9:00 PM".
 */
function parseHoursLine(line: string): {
  day: string;
  openMinutes: number;
  closeMinutes: number;
  crossesMidnight: boolean;
} | null {
  const colonIndex = line.indexOf(':');
  if (colonIndex < 1) {
    return null;
  }

  const day = line.substring(0, colonIndex).trim();
  const rest = line.substring(colonIndex + 1).trim();

  if (/^closed$/i.test(rest)) {
    return null;
  }

  const parts = rest.split(/\s*[–\-—]\s*/);
  if (parts.length !== 2) {
    return null;
  }

  const openMinutes = parseTime(parts[0]);
  const closeMinutes = parseTime(parts[1]);

  if (openMinutes === null || closeMinutes === null) {
    return null;
  }

  return {
    day,
    openMinutes,
    closeMinutes,
    crossesMidnight: closeMinutes <= openMinutes,
  };
}

/**
 * Compute open/closed from hours strings. Returns null if hours are
 * unavailable or unparseable.
 */
export function computeOpenNowFromHours(
  hours: string[] | null | undefined,
  now?: Date,
): boolean | null {
  if (!hours || hours.length === 0) {
    return null;
  }

  const currentDate = now ?? new Date();
  const currentDayIndex = currentDate.getDay();
  const currentDayName = DAY_NAMES[currentDayIndex];
  const currentMinutes = currentDate.getHours() * 60 + currentDate.getMinutes();

  const todayLine = hours.find((line) =>
    line.trim().toLowerCase().startsWith(currentDayName.toLowerCase()),
  );

  if (!todayLine) {
    return null;
  }

  const todayParsed = parseHoursLine(todayLine);

  if (!todayParsed) {
    // "Closed" or unparseable
    return false;
  }

  // Normal hours
  if (!todayParsed.crossesMidnight) {
    return currentMinutes >= todayParsed.openMinutes && currentMinutes < todayParsed.closeMinutes;
  }

  // Crosses midnight — first half (after open today)
  if (currentMinutes >= todayParsed.openMinutes) {
    return true;
  }

  // Check overnight spillover from yesterday
  const yesterdayIndex = (currentDayIndex + 6) % 7;
  const yesterdayName = DAY_NAMES[yesterdayIndex];
  const yesterdayLine = hours.find((line) =>
    line.trim().toLowerCase().startsWith(yesterdayName.toLowerCase()),
  );

  if (!yesterdayLine) {
    return null;
  }

  const yesterdayParsed = parseHoursLine(yesterdayLine);
  if (!yesterdayParsed || !yesterdayParsed.crossesMidnight) {
    return false;
  }

  return currentMinutes < yesterdayParsed.closeMinutes;
}

type ResolveStorefrontOpenNowArgs = {
  hours?: string[] | null;
  liveOpenNow?: boolean | null;
  summaryOpenNow?: boolean | null;
  detailOpenNow?: boolean | null;
};

export function resolveStorefrontOpenNow({
  hours,
  liveOpenNow,
  summaryOpenNow,
  detailOpenNow,
}: ResolveStorefrontOpenNowArgs) {
  // 1. Compute from hours (real-time)
  const fromHours = computeOpenNowFromHours(hours);
  if (typeof fromHours === 'boolean') {
    return fromHours;
  }

  // 2. Google Places live signal
  if (typeof liveOpenNow === 'boolean') {
    return liveOpenNow;
  }

  // 3. Static Firestore values
  if (typeof summaryOpenNow === 'boolean') {
    return summaryOpenNow;
  }

  if (typeof detailOpenNow === 'boolean') {
    return detailOpenNow;
  }

  return null;
}

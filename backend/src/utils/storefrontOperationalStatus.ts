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
 * Default timezone for storefronts. All current storefronts are NY
 * dispensaries. When the app expands to other states, this should be
 * derived from the storefront's coordinates or a stored timezone field.
 */
const DEFAULT_STOREFRONT_TIMEZONE = 'America/New_York';

/**
 * Get the current day-of-week index (0 = Sunday) and minutes-since-midnight
 * in the storefront's local timezone, not the server's timezone.
 *
 * Cloud Run instances run in UTC, so `new Date().getHours()` returns UTC
 * hours. Google Places hours strings are in the store's local timezone,
 * so we must resolve the current time in that same timezone.
 */
function getLocalTimeComponents(
  date: Date,
  timezone: string,
): { dayIndex: number; minutes: number } {
  // Use Intl to get the hour, minute, and weekday in the target timezone
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: 'numeric',
    weekday: 'short',
    hour12: false,
  }).formatToParts(date);

  let hour = 0;
  let minute = 0;
  let weekday = '';
  for (const part of parts) {
    if (part.type === 'hour') hour = parseInt(part.value, 10);
    if (part.type === 'minute') minute = parseInt(part.value, 10);
    if (part.type === 'weekday') weekday = part.value;
  }

  // Intl hour12:false can return 24 for midnight in some environments
  if (hour === 24) hour = 0;

  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  return {
    dayIndex: weekdayMap[weekday] ?? date.getDay(),
    minutes: hour * 60 + minute,
  };
}

/**
 * Compute open/closed from hours strings. Returns null if hours are
 * unavailable or unparseable.
 */
export function computeOpenNowFromHours(
  hours: string[] | null | undefined,
  now?: Date,
  timezone?: string,
): boolean | null {
  if (!hours || hours.length === 0) {
    return null;
  }

  const currentDate = now ?? new Date();
  const tz = timezone ?? DEFAULT_STOREFRONT_TIMEZONE;
  const { dayIndex: currentDayIndex, minutes: currentMinutes } = getLocalTimeComponents(
    currentDate,
    tz,
  );
  const currentDayName = DAY_NAMES[currentDayIndex];

  const todayLine = hours.find((line) =>
    line.trim().toLowerCase().startsWith(currentDayName.toLowerCase()),
  );
  const todayParsed = todayLine ? parseHoursLine(todayLine) : null;

  if (todayParsed) {
    // Normal hours
    if (!todayParsed.crossesMidnight) {
      if (currentMinutes >= todayParsed.openMinutes && currentMinutes < todayParsed.closeMinutes) {
        return true;
      }
    } else if (currentMinutes >= todayParsed.openMinutes) {
      // Crosses midnight — first half (after open today)
      return true;
    }
  }

  // Check overnight spillover from yesterday
  const yesterdayIndex = (currentDayIndex + 6) % 7;
  const yesterdayName = DAY_NAMES[yesterdayIndex];
  const yesterdayLine = hours.find((line) =>
    line.trim().toLowerCase().startsWith(yesterdayName.toLowerCase()),
  );

  if (!yesterdayLine) {
    return todayLine ? false : null;
  }

  const yesterdayParsed = parseHoursLine(yesterdayLine);
  if (yesterdayParsed?.crossesMidnight && currentMinutes < yesterdayParsed.closeMinutes) {
    return true;
  }

  if (todayLine) {
    return false;
  }

  return null;
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

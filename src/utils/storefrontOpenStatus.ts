/**
 * Compute whether a storefront is currently open based on its published hours.
 *
 * Hours are stored as human-readable strings from Google Places, e.g.:
 *   "Monday: 9:00 AM – 9:00 PM"
 *   "Tuesday: Closed"
 *   "Saturday: 10:00 AM – 2:00 AM"  (crosses midnight)
 *
 * Falls back to the static openNow boolean from Firestore when hours are
 * unavailable or unparseable.
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

const DEFAULT_STOREFRONT_TIMEZONE = 'America/New_York';

/**
 * Parse a 12-hour time string like "9:00 AM" or "12:30 PM" into minutes since midnight.
 * Returns null if unparseable.
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
 * Extract the day name and open/close times from a Google Places hours string.
 * Returns null if the line indicates "Closed" or is unparseable.
 */
function parseHoursLine(line: string): {
  day: string;
  openMinutes: number;
  closeMinutes: number;
  crossesMidnight: boolean;
} | null {
  // Format: "Day: HH:MM AM – HH:MM PM" or "Day: Closed"
  const colonIndex = line.indexOf(':');
  if (colonIndex < 1) {
    return null;
  }

  const day = line.substring(0, colonIndex).trim();
  const rest = line.substring(colonIndex + 1).trim();

  if (/^closed$/i.test(rest)) {
    return null;
  }

  // Split on em dash (–), en dash (–), or hyphen (-)
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

function getLocalTimeComponents(
  date: Date,
  timezone: string,
): { dayIndex: number; minutes: number } {
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
 * Determine if a storefront is currently open based on its hours array.
 *
 * @param hours - Array of hours strings from Google Places
 * @param staticOpenNow - The static openNow boolean from Firestore (fallback)
 * @param now - Optional Date for testing (defaults to current time)
 * @returns `true` if open, `false` if closed, `null` if indeterminate
 */
export function computeOpenNow(
  hours: string[] | null | undefined,
  staticOpenNow: boolean | null,
  now?: Date,
  timezone: string = DEFAULT_STOREFRONT_TIMEZONE,
): boolean | null {
  if (!hours || hours.length === 0) {
    return staticOpenNow;
  }

  const currentDate = now ?? new Date();
  const { dayIndex: currentDayIndex, minutes: currentMinutes } = getLocalTimeComponents(
    currentDate,
    timezone,
  );
  const currentDayName = DAY_NAMES[currentDayIndex];

  // Find today's hours line
  const todayLine = hours.find((line) =>
    line.trim().toLowerCase().startsWith(currentDayName.toLowerCase()),
  );
  const todayParsed = todayLine ? parseHoursLine(todayLine) : null;

  if (todayParsed) {
    // Normal hours (e.g. 9:00 AM – 9:00 PM)
    if (!todayParsed.crossesMidnight) {
      if (currentMinutes >= todayParsed.openMinutes && currentMinutes < todayParsed.closeMinutes) {
        return true;
      }
    } else if (currentMinutes >= todayParsed.openMinutes) {
      // Crosses midnight (e.g. 10:00 AM – 2:00 AM)
      return true;
    }
  }

  // Otherwise check if we're in the overnight spillover from yesterday
  const yesterdayIndex = (currentDayIndex + 6) % 7;
  const yesterdayName = DAY_NAMES[yesterdayIndex];
  const yesterdayLine = hours.find((line) =>
    line.trim().toLowerCase().startsWith(yesterdayName.toLowerCase()),
  );

  if (!yesterdayLine) {
    return todayLine ? false : staticOpenNow;
  }

  const yesterdayParsed = parseHoursLine(yesterdayLine);

  if (yesterdayParsed?.crossesMidnight && currentMinutes < yesterdayParsed.closeMinutes) {
    return true;
  }

  if (todayLine) {
    return false;
  }

  return staticOpenNow;
}

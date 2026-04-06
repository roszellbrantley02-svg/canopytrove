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
): boolean | null {
  if (!hours || hours.length === 0) {
    return staticOpenNow;
  }

  const currentDate = now ?? new Date();
  const currentDayIndex = currentDate.getDay(); // 0 = Sunday
  const currentDayName = DAY_NAMES[currentDayIndex];
  const currentMinutes = currentDate.getHours() * 60 + currentDate.getMinutes();

  // Find today's hours line
  const todayLine = hours.find((line) =>
    line.trim().toLowerCase().startsWith(currentDayName.toLowerCase()),
  );

  if (!todayLine) {
    // No entry for today — fall back
    return staticOpenNow;
  }

  const todayParsed = parseHoursLine(todayLine);

  if (!todayParsed) {
    // "Closed" or unparseable → store is closed today
    return false;
  }

  // Normal hours (e.g. 9:00 AM – 9:00 PM)
  if (!todayParsed.crossesMidnight) {
    return currentMinutes >= todayParsed.openMinutes && currentMinutes < todayParsed.closeMinutes;
  }

  // Crosses midnight (e.g. 10:00 AM – 2:00 AM)
  // If current time is after the open time today, we're in the first part
  if (currentMinutes >= todayParsed.openMinutes) {
    return true;
  }

  // Otherwise check if we're in the overnight spillover from yesterday
  const yesterdayIndex = (currentDayIndex + 6) % 7;
  const yesterdayName = DAY_NAMES[yesterdayIndex];
  const yesterdayLine = hours.find((line) =>
    line.trim().toLowerCase().startsWith(yesterdayName.toLowerCase()),
  );

  if (!yesterdayLine) {
    return staticOpenNow;
  }

  const yesterdayParsed = parseHoursLine(yesterdayLine);

  if (!yesterdayParsed || !yesterdayParsed.crossesMidnight) {
    // Yesterday didn't cross midnight, so no spillover
    return false;
  }

  // We're in the overnight window if current time is before yesterday's close
  return currentMinutes < yesterdayParsed.closeMinutes;
}

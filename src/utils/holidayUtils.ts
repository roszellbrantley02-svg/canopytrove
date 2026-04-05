/**
 * Lightweight US holiday detection for storefront hours disclaimers.
 * Covers major holidays where dispensary hours are most likely to differ.
 * Does NOT cover every federal holiday — just the ones that commonly
 * affect retail operating hours.
 */

type HolidayInfo = {
  name: string;
  /** Short label shown on storefront cards. */
  notice: string;
};

/**
 * Returns holiday info if `date` falls on a major US retail holiday,
 * or `null` if it's a normal business day.
 */
export function getUSHolidayInfo(date: Date = new Date()): HolidayInfo | null {
  const month = date.getMonth(); // 0-indexed
  const day = date.getDate();
  const dayOfWeek = date.getDay(); // 0 = Sunday

  // New Year's Day — Jan 1
  if (month === 0 && day === 1) {
    return { name: "New Year's Day", notice: 'Holiday hours may differ' };
  }

  // MLK Day — 3rd Monday of January
  if (month === 0 && dayOfWeek === 1 && day >= 15 && day <= 21) {
    return { name: 'Martin Luther King Jr. Day', notice: 'Holiday hours may differ' };
  }

  // Presidents' Day — 3rd Monday of February
  if (month === 1 && dayOfWeek === 1 && day >= 15 && day <= 21) {
    return { name: "Presidents' Day", notice: 'Holiday hours may differ' };
  }

  // Easter — computed dynamically (moves every year)
  const easter = computeEasterDate(date.getFullYear());
  if (month === easter.getMonth() && day === easter.getDate()) {
    return { name: 'Easter Sunday', notice: 'Holiday hours may differ' };
  }

  // Memorial Day — last Monday of May
  if (month === 4 && dayOfWeek === 1 && day >= 25 && day <= 31) {
    return { name: 'Memorial Day', notice: 'Holiday hours may differ' };
  }

  // Independence Day — Jul 4
  if (month === 6 && day === 4) {
    return { name: 'Independence Day', notice: 'Holiday hours may differ' };
  }

  // Labor Day — 1st Monday of September
  if (month === 8 && dayOfWeek === 1 && day >= 1 && day <= 7) {
    return { name: 'Labor Day', notice: 'Holiday hours may differ' };
  }

  // Thanksgiving — 4th Thursday of November
  if (month === 10 && dayOfWeek === 4 && day >= 22 && day <= 28) {
    return { name: 'Thanksgiving', notice: 'Holiday hours may differ' };
  }

  // Christmas Eve — Dec 24
  if (month === 11 && day === 24) {
    return { name: 'Christmas Eve', notice: 'Holiday hours may differ' };
  }

  // Christmas Day — Dec 25
  if (month === 11 && day === 25) {
    return { name: 'Christmas Day', notice: 'Holiday hours may differ' };
  }

  // New Year's Eve — Dec 31
  if (month === 11 && day === 31) {
    return { name: "New Year's Eve", notice: 'Holiday hours may differ' };
  }

  // 4/20 — Cannabis industry holiday
  if (month === 3 && day === 20) {
    return { name: '4/20', notice: 'Special hours possible' };
  }

  return null;
}

/**
 * Anonymous Gregorian algorithm for computing Easter Sunday.
 * Valid for years 1583–4099.
 */
function computeEasterDate(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1; // 0-indexed
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month, day);
}

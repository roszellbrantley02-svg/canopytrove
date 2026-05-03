// Date formatters tuned for the Travel & Events tab. Uses Intl.DateTimeFormat
// (always available in Hermes + browser) with the event's IANA timezone so
// "7:00 PM EDT" stays "7:00 PM EDT" no matter where the user is.

import type { CanopyEvent } from '../types/events';

function formatPart(iso: string, tz: string, opts: Intl.DateTimeFormatOptions): string {
  try {
    return new Intl.DateTimeFormat('en-US', { ...opts, timeZone: tz }).format(new Date(iso));
  } catch {
    return new Intl.DateTimeFormat('en-US', opts).format(new Date(iso));
  }
}

/**
 * Card-friendly date label, e.g. "Wed, May 13" or "Jun 3 – 4" for multi-day.
 */
export function formatEventDateLabel(event: CanopyEvent): string {
  const tz = event.timezone || 'America/New_York';
  const startLabel = formatPart(event.startsAt, tz, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  if (!event.isMultiDay) return startLabel;

  // Multi-day: collapse "Jun 3" + "Jun 4" → "Jun 3 – 4"; cross-month → "Oct 2 – Nov 1".
  const startMonthDay = formatPart(event.startsAt, tz, { month: 'short', day: 'numeric' });
  const endMonthDay = formatPart(event.endsAt, tz, { month: 'short', day: 'numeric' });
  const startMonth = formatPart(event.startsAt, tz, { month: 'short' });
  const endMonth = formatPart(event.endsAt, tz, { month: 'short' });
  if (startMonth === endMonth) {
    const endDay = formatPart(event.endsAt, tz, { day: 'numeric' });
    return `${startMonthDay} – ${endDay}`;
  }
  return `${startMonthDay} – ${endMonthDay}`;
}

/**
 * Time window label for a single-day event, e.g. "12:00 – 6:00 PM EDT".
 * Returns "All day" when allDay is set, "" for multi-day events.
 */
export function formatEventTimeLabel(event: CanopyEvent): string {
  if (event.isMultiDay) return '';
  if (event.allDay) return 'All day';
  const tz = event.timezone || 'America/New_York';
  const start = formatPart(event.startsAt, tz, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  const end = formatPart(event.endsAt, tz, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  });
  return `${start} – ${end}`;
}

/**
 * Detail-screen full date+time line, e.g. "Wednesday, May 13, 2026 · 12:00 – 6:00 PM EDT".
 */
export function formatEventFullWhen(event: CanopyEvent): string {
  const tz = event.timezone || 'America/New_York';
  if (event.isMultiDay) {
    const startFull = formatPart(event.startsAt, tz, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
    const endFull = formatPart(event.endsAt, tz, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
    return `${startFull}  →  ${endFull}`;
  }

  const dateFull = formatPart(event.startsAt, tz, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  if (event.allDay) return `${dateFull} · All day`;
  return `${dateFull} · ${formatEventTimeLabel(event)}`;
}

/**
 * Short relative label for above-the-fold context, e.g. "Today", "Tomorrow",
 * "In 5 days", "Last week". Falls back to the date label for far-future or
 * far-past events.
 */
export function formatEventRelativeLabel(event: CanopyEvent, now: Date = new Date()): string {
  const start = new Date(event.startsAt).getTime();
  const today = startOfDayMs(now);
  const eventDay = startOfDayMs(new Date(event.startsAt));
  const daysAhead = Math.round((eventDay - today) / (24 * 60 * 60 * 1000));

  if (daysAhead === 0) return 'Today';
  if (daysAhead === 1) return 'Tomorrow';
  if (daysAhead === -1) return 'Yesterday';
  if (daysAhead > 1 && daysAhead <= 6) return `In ${daysAhead} days`;
  if (daysAhead < -1 && daysAhead >= -6) return `${Math.abs(daysAhead)} days ago`;
  if (daysAhead > 6 && daysAhead <= 30) return `In ${Math.round(daysAhead / 7)} weeks`;
  if (start >= today) return 'Upcoming';
  return 'Past';
}

function startOfDayMs(d: Date): number {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy.getTime();
}

/**
 * Human-friendly category label.
 */
export function formatEventCategoryLabel(event: CanopyEvent): string {
  switch (event.category) {
    case 'industry':
      return 'Industry';
    case 'consumer':
      return 'Consumer';
    case 'advocacy':
      return 'Advocacy';
    case 'parade':
      return 'Parade';
    case 'convention':
      return 'Convention';
    case 'brand_activation':
      return 'Brand Activation';
    case 'workshop':
      return 'Workshop';
    case 'other':
    default:
      return 'Event';
  }
}

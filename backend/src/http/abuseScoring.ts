import { logSecurityEvent } from './securityEventLogger';

/**
 * Lightweight in-memory abuse scoring.
 *
 * Each IP accumulates points for suspicious actions within a sliding window.
 * When the score exceeds the threshold, the IP is flagged for enhanced
 * scrutiny (lower rate limits, additional logging).
 *
 * Point values:
 * - Rate limit hit:      2 points
 * - Validation failure:  1 point
 * - Auth failure:        3 points
 * - Oversized request:   2 points
 * - Blocked request:     5 points
 */

interface AbuseEvent {
  ts: number;
  points: number;
}

interface AbuseRecord {
  events: AbuseEvent[];
  flaggedAt: number | null;
}

const abuseRecords = new Map<string, AbuseRecord>();
const WINDOW_MS = 10 * 60_000; // 10-minute sliding window
const THRESHOLD = 20;
const FLAG_DURATION_MS = 30 * 60_000; // 30-minute flag duration
const MAX_TRACKED_IPS = 4096;

function pruneEvents(record: AbuseRecord, now: number) {
  const cutoff = now - WINDOW_MS;
  record.events = record.events.filter((event) => event.ts > cutoff);
}

function computeScore(record: AbuseRecord) {
  let total = 0;
  for (const event of record.events) {
    total += event.points;
  }
  return total;
}

function sweepExpired(now: number) {
  if (abuseRecords.size <= MAX_TRACKED_IPS) return;
  for (const [ip, record] of abuseRecords.entries()) {
    pruneEvents(record, now);
    if (record.events.length === 0 && (!record.flaggedAt || record.flaggedAt < now)) {
      abuseRecords.delete(ip);
    }
  }
}

export function recordAbuseSignal(ip: string, points: number, path: string) {
  const now = Date.now();
  sweepExpired(now);

  let record = abuseRecords.get(ip);
  if (!record) {
    record = { events: [], flaggedAt: null };
    abuseRecords.set(ip, record);
  }

  pruneEvents(record, now);
  record.events.push({ ts: now, points });

  // Score is recomputed from in-window events on every signal — the
  // sliding window in the comment is now actually a sliding window. Old
  // implementation accumulated `score += points` monotonically and only
  // reset on flag-expiry, so an IP could drift to flag from sparse, far-
  // apart events that the window-pruning logic claimed to forget.
  const score = computeScore(record);

  if (score >= THRESHOLD && !record.flaggedAt) {
    record.flaggedAt = now + FLAG_DURATION_MS;
    logSecurityEvent({
      event: 'abuse_threshold_crossed',
      ip,
      path,
      method: 'N/A',
      detail: `Abuse score ${score} exceeded threshold ${THRESHOLD}`,
      meta: { score, eventCount: record.events.length },
    });
  }
}

export function isIpFlagged(ip: string): boolean {
  const record = abuseRecords.get(ip);
  if (!record?.flaggedAt) return false;
  if (record.flaggedAt < Date.now()) {
    record.flaggedAt = null;
    record.events = [];
    return false;
  }
  return true;
}

export function getAbuseScore(ip: string): number {
  const record = abuseRecords.get(ip);
  if (!record) return 0;
  pruneEvents(record, Date.now());
  return computeScore(record);
}

/** For testing */
export function clearAbuseState() {
  abuseRecords.clear();
}

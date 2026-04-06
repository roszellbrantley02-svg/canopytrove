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

interface AbuseRecord {
  score: number;
  events: number[]; // timestamps
  flaggedAt: number | null;
}

const abuseRecords = new Map<string, AbuseRecord>();
const WINDOW_MS = 10 * 60_000; // 10-minute sliding window
const THRESHOLD = 20;
const FLAG_DURATION_MS = 30 * 60_000; // 30-minute flag duration
const MAX_TRACKED_IPS = 4096;

function sweepExpired(now: number) {
  if (abuseRecords.size <= MAX_TRACKED_IPS) return;
  const cutoff = now - WINDOW_MS;
  for (const [ip, record] of abuseRecords.entries()) {
    record.events = record.events.filter((t) => t > cutoff);
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
    record = { score: 0, events: [], flaggedAt: null };
    abuseRecords.set(ip, record);
  }

  const cutoff = now - WINDOW_MS;
  record.events = record.events.filter((t) => t > cutoff);
  record.events.push(now);

  // Recalculate score — increment by the points for this event
  record.score += points;

  if (record.score >= THRESHOLD && !record.flaggedAt) {
    record.flaggedAt = now + FLAG_DURATION_MS;
    logSecurityEvent({
      event: 'abuse_threshold_crossed',
      ip,
      path,
      method: 'N/A',
      detail: `Abuse score ${record.score} exceeded threshold ${THRESHOLD}`,
      meta: { score: record.score, eventCount: record.events.length },
    });
  }
}

export function isIpFlagged(ip: string): boolean {
  const record = abuseRecords.get(ip);
  if (!record?.flaggedAt) return false;
  if (record.flaggedAt < Date.now()) {
    record.flaggedAt = null;
    record.score = 0;
    record.events = [];
    return false;
  }
  return true;
}

export function getAbuseScore(ip: string): number {
  return abuseRecords.get(ip)?.score ?? 0;
}

/** For testing */
export function clearAbuseState() {
  abuseRecords.clear();
}

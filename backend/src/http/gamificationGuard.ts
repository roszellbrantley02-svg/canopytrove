import { logSecurityEvent } from './securityEventLogger';

/**
 * Per-activity-type daily caps and minimum cooldowns for gamification events.
 * These prevent business-logic abuse like:
 * - Submitting unlimited photo_uploaded events without uploading photos
 * - Farming report_submitted points with spam reports
 * - Replaying friend_invited events
 *
 * Note: Some activities have natural server-side limits (e.g., review_submitted
 * is gated by the community service's 24hr duplicate check). These caps are
 * defense-in-depth for activities where the client triggers the event.
 */

type ActivityLimits = {
  maxPerDay: number;
  cooldownMs: number;
};

const ACTIVITY_LIMITS: Record<string, ActivityLimits> = {
  route_started: { maxPerDay: 50, cooldownMs: 10_000 }, // 50 routes/day, 10s cooldown
  review_submitted: { maxPerDay: 10, cooldownMs: 30_000 }, // 10 reviews/day, 30s cooldown
  photo_uploaded: { maxPerDay: 20, cooldownMs: 5_000 }, // 20 photos/day, 5s cooldown
  helpful_vote_received: { maxPerDay: 100, cooldownMs: 1_000 }, // 100 votes/day (received, less controllable)
  report_submitted: { maxPerDay: 5, cooldownMs: 60_000 }, // 5 reports/day, 1min cooldown
  friend_invited: { maxPerDay: 10, cooldownMs: 30_000 }, // 10 invites/day, 30s cooldown
  followers_updated: { maxPerDay: 20, cooldownMs: 10_000 }, // 20 updates/day, 10s cooldown
};

const DEFAULT_LIMITS: ActivityLimits = { maxPerDay: 20, cooldownMs: 5_000 };

interface ActivityRecord {
  count: number;
  dayKey: string;
  lastEventAt: number;
}

// profileId:activityType -> ActivityRecord
const activityTracker = new Map<string, ActivityRecord>();
const MAX_TRACKED_KEYS = 8192;

function getDayKey(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function sweepStaleRecords() {
  if (activityTracker.size <= MAX_TRACKED_KEYS) return;
  const today = getDayKey();
  const keysToDelete: string[] = [];
  activityTracker.forEach((record, key) => {
    if (record.dayKey !== today) {
      keysToDelete.push(key);
    }
  });
  keysToDelete.forEach((key) => activityTracker.delete(key));
}

export type GamificationGuardResult = {
  allowed: boolean;
  reason?: string;
};

/**
 * Check if a gamification event is allowed for a given profile and activity type.
 * If allowed, records the event. If blocked, returns the reason.
 */
export function checkGamificationEventAllowed(
  profileId: string,
  activityType: string,
  ip: string,
): GamificationGuardResult {
  sweepStaleRecords();

  const limits = ACTIVITY_LIMITS[activityType] ?? DEFAULT_LIMITS;
  const key = `${profileId}:${activityType}`;
  const today = getDayKey();
  const now = Date.now();

  let record = activityTracker.get(key);

  // Reset if it's a new day
  if (!record || record.dayKey !== today) {
    record = { count: 0, dayKey: today, lastEventAt: 0 };
    activityTracker.set(key, record);
  }

  // Check daily cap
  if (record.count >= limits.maxPerDay) {
    logSecurityEvent({
      event: 'abuse_threshold_crossed',
      ip,
      path: `/gamification/${profileId}/events`,
      method: 'POST',
      userId: profileId,
      detail: `Daily cap reached for ${activityType}: ${record.count}/${limits.maxPerDay}`,
      meta: { activityType, dailyCount: record.count, maxPerDay: limits.maxPerDay },
    });
    return {
      allowed: false,
      reason: `Daily limit reached for this activity. Try again tomorrow.`,
    };
  }

  // Check cooldown
  const elapsed = now - record.lastEventAt;
  if (record.lastEventAt > 0 && elapsed < limits.cooldownMs) {
    return {
      allowed: false,
      reason: `Please wait before submitting another ${activityType.replace(/_/g, ' ')} event.`,
    };
  }

  // Allow and record
  record.count += 1;
  record.lastEventAt = now;
  return { allowed: true };
}

/** For testing */
export function clearGamificationGuardState() {
  activityTracker.clear();
}

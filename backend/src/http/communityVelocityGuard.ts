import { logSecurityEvent } from './securityEventLogger';

/**
 * Per-profile velocity limits for community actions.
 *
 * Unlike IP-based rate limiting, this tracks actions per user identity,
 * preventing multi-IP attacks from the same account and cross-storefront
 * action flooding.
 */

type VelocityLimits = {
  maxPerHour: number;
  maxPerDay: number;
};

const COMMUNITY_VELOCITY_LIMITS: Record<string, VelocityLimits> = {
  review_submit: { maxPerHour: 5, maxPerDay: 15 },
  review_update: { maxPerHour: 10, maxPerDay: 30 },
  helpful_vote: { maxPerHour: 20, maxPerDay: 60 },
  report_submit: { maxPerHour: 3, maxPerDay: 10 },
  photo_upload: { maxPerHour: 15, maxPerDay: 40 },
};

const DEFAULT_VELOCITY: VelocityLimits = { maxPerHour: 20, maxPerDay: 60 };

interface VelocityRecord {
  hourKey: string;
  dayKey: string;
  hourCount: number;
  dayCount: number;
}

// profileId:actionType -> VelocityRecord
const velocityTracker = new Map<string, VelocityRecord>();
const MAX_TRACKED = 8192;

function getHourKey(): string {
  const d = new Date();
  return `${d.toISOString().slice(0, 13)}`; // YYYY-MM-DDTHH
}

function getDayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function sweepStale() {
  if (velocityTracker.size <= MAX_TRACKED) return;
  const day = getDayKey();
  const keysToDelete: string[] = [];
  velocityTracker.forEach((rec, key) => {
    if (rec.dayKey !== day) keysToDelete.push(key);
  });
  keysToDelete.forEach((key) => velocityTracker.delete(key));
}

export type VelocityCheckResult = {
  allowed: boolean;
  reason?: string;
};

export function checkCommunityVelocity(
  profileId: string,
  actionType: string,
  ip: string,
): VelocityCheckResult {
  sweepStale();

  const limits = COMMUNITY_VELOCITY_LIMITS[actionType] ?? DEFAULT_VELOCITY;
  const key = `${profileId}:${actionType}`;
  const hourKey = getHourKey();
  const dayKey = getDayKey();

  let record = velocityTracker.get(key);
  if (!record || record.dayKey !== dayKey) {
    record = { hourKey, dayKey, hourCount: 0, dayCount: 0 };
    velocityTracker.set(key, record);
  }

  // Reset hour counter if hour changed
  if (record.hourKey !== hourKey) {
    record.hourKey = hourKey;
    record.hourCount = 0;
  }

  // Check daily limit
  if (record.dayCount >= limits.maxPerDay) {
    logSecurityEvent({
      event: 'abuse_threshold_crossed',
      ip,
      path: `community/${actionType}`,
      method: 'POST',
      userId: profileId,
      detail: `Daily velocity limit for ${actionType}: ${record.dayCount}/${limits.maxPerDay}`,
    });
    return { allowed: false, reason: 'Daily limit reached for this action. Try again tomorrow.' };
  }

  // Check hourly limit
  if (record.hourCount >= limits.maxPerHour) {
    return { allowed: false, reason: "You're doing this too quickly. Please slow down." };
  }

  record.hourCount += 1;
  record.dayCount += 1;
  return { allowed: true };
}

/** For testing */
export function clearCommunityVelocityState() {
  velocityTracker.clear();
}

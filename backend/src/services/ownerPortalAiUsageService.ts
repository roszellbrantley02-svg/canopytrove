import { createHash } from 'node:crypto';
import { serverConfig } from '../config';
import { getBackendFirebaseDb } from '../firebase';

const OWNER_AI_USAGE_COLLECTION = 'ops_owner_ai_daily_usage';
const OWNER_AI_USAGE_TIME_ZONE = 'America/New_York';

type OwnerAiUsageRecord = {
  count: number;
  dayKey: string;
};

const ownerAiUsageMemoryStore = new Map<string, OwnerAiUsageRecord>();

export type OwnerAiDailyQuotaStatus = {
  allowed: boolean;
  used: number;
  remaining: number;
  limit: number;
  dayKey: string;
};

export class OwnerAiQuotaExceededError extends Error {
  readonly statusCode = 429;
  readonly code = 'OWNER_AI_DAILY_LIMIT_REACHED';

  constructor(public readonly quota: OwnerAiDailyQuotaStatus) {
    super('Daily AI request limit reached. Please try again tomorrow.');
  }
}

function getOwnerHash(ownerUid: string) {
  return createHash('sha256').update(ownerUid, 'utf8').digest('hex').slice(0, 24);
}

function getDayKey(now = Date.now()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: OWNER_AI_USAGE_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(now));

  const year = parts.find((part) => part.type === 'year')?.value ?? '1970';
  const month = parts.find((part) => part.type === 'month')?.value ?? '01';
  const day = parts.find((part) => part.type === 'day')?.value ?? '01';
  return `${year}-${month}-${day}`;
}

function getUsageKey(ownerUid: string, dayKey: string) {
  return `${dayKey}:${getOwnerHash(ownerUid)}`;
}

function shouldUseMemoryStore() {
  return process.env.NODE_ENV === 'test' || process.env.STOREFRONT_BACKEND_SOURCE === 'mock';
}

function buildQuotaStatus(dayKey: string, used: number): OwnerAiDailyQuotaStatus {
  const limit = serverConfig.ownerAiDailyRequestLimit;
  return {
    allowed: used <= limit,
    used,
    remaining: Math.max(0, limit - used),
    limit,
    dayKey,
  };
}

function consumeMemoryQuota(ownerUid: string, dayKey: string) {
  const usageKey = getUsageKey(ownerUid, dayKey);
  const existing = ownerAiUsageMemoryStore.get(usageKey);
  const used = existing ? existing.count + 1 : 1;
  ownerAiUsageMemoryStore.set(usageKey, {
    count: used,
    dayKey,
  });
  return buildQuotaStatus(dayKey, used);
}

async function consumePersistentQuota(ownerUid: string, dayKey: string) {
  const db = getBackendFirebaseDb();
  if (!db) {
    return null;
  }

  const usageRef = db.collection(OWNER_AI_USAGE_COLLECTION).doc(getUsageKey(ownerUid, dayKey));
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(usageRef);
    const existing = snapshot.exists ? (snapshot.data() as Partial<OwnerAiUsageRecord>) : null;
    const existingCount =
      typeof existing?.count === 'number' && Number.isFinite(existing.count)
        ? Math.max(0, Math.floor(existing.count))
        : 0;
    const used = existingCount + 1;

    transaction.set(
      usageRef,
      {
        count: used,
        dayKey,
      } satisfies OwnerAiUsageRecord,
      { merge: true },
    );

    return buildQuotaStatus(dayKey, used);
  });
}

export async function consumeOwnerAiDailyQuota(ownerUid: string): Promise<OwnerAiDailyQuotaStatus> {
  const dayKey = getDayKey();

  if (shouldUseMemoryStore()) {
    return consumeMemoryQuota(ownerUid, dayKey);
  }

  try {
    const persistentStatus = await consumePersistentQuota(ownerUid, dayKey);
    return persistentStatus ?? consumeMemoryQuota(ownerUid, dayKey);
  } catch {
    return consumeMemoryQuota(ownerUid, dayKey);
  }
}

export async function assertOwnerAiDailyQuota(ownerUid: string) {
  const quota = await consumeOwnerAiDailyQuota(ownerUid);
  if (!quota.allowed) {
    throw new OwnerAiQuotaExceededError(quota);
  }

  return quota;
}

export function clearOwnerAiUsageMemoryStateForTests() {
  ownerAiUsageMemoryStore.clear();
}

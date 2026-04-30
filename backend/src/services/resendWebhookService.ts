import { Webhook } from 'svix';
import { getTransactionalEmailRuntimeConfig } from '../config';
import { getOptionalFirestoreCollection } from '../firestoreCollections';
import { recordMemberWelcomeEmailDeliveryEvent } from './memberEmailSubscriptionService';
import { recordOwnerWelcomeEmailDeliveryEvent } from './ownerWelcomeEmailService';
import {
  getResendWebhookEventSummary,
  normalizeProviderEventId,
  normalizeProviderMessageId,
} from './transactionalEmailEventUtils';

type StoredTransactionalEmailWebhookRecord = {
  webhookId: string;
  provider: 'resend';
  eventType: string;
  emailId: string | null;
  occurredAt: string;
  receivedAt: string;
  recipientEmail: string | null;
  subject: string | null;
  summary: string | null;
  matchedTarget: 'member' | 'owner' | 'unmatched';
  matchedId: string | null;
};

type VerifiedResendWebhookEvent = {
  eventType: string;
  occurredAt: string;
  emailId: string | null;
  recipientEmail: string | null;
  subject: string | null;
  summary: string | null;
};

export type ProcessResendWebhookResult = {
  duplicate: boolean;
  webhookId: string;
  eventType: string;
  emailId: string | null;
  occurredAt: string;
  receivedAt: string;
  summary: string | null;
  matchedTarget: 'member' | 'owner' | 'unmatched';
  matchedId: string | null;
};

const RESEND_WEBHOOK_EVENTS_COLLECTION = 'transactional_email_webhook_events';
const resendWebhookEventStore = new Map<string, StoredTransactionalEmailWebhookRecord>();

function getNowIso() {
  return new Date().toISOString();
}

function trimValue(value: string | null | undefined) {
  return value?.trim() || null;
}

function normalizeIsoDate(value: string | null | undefined) {
  const trimmed = trimValue(value);
  return trimmed && !Number.isNaN(Date.parse(trimmed)) ? trimmed : null;
}

function getCollection() {
  return getOptionalFirestoreCollection<StoredTransactionalEmailWebhookRecord>(
    RESEND_WEBHOOK_EVENTS_COLLECTION,
  );
}

function normalizeStoredRecord(
  record: StoredTransactionalEmailWebhookRecord,
): StoredTransactionalEmailWebhookRecord {
  return {
    webhookId: normalizeProviderEventId(record.webhookId) ?? '',
    provider: 'resend',
    eventType: trimValue(record.eventType) ?? 'unknown',
    emailId: normalizeProviderMessageId(record.emailId),
    occurredAt: normalizeIsoDate(record.occurredAt) ?? getNowIso(),
    receivedAt: normalizeIsoDate(record.receivedAt) ?? getNowIso(),
    recipientEmail: trimValue(record.recipientEmail)?.toLowerCase() ?? null,
    subject: trimValue(record.subject),
    summary: trimValue(record.summary),
    matchedTarget:
      record.matchedTarget === 'member' || record.matchedTarget === 'owner'
        ? record.matchedTarget
        : 'unmatched',
    matchedId: trimValue(record.matchedId),
  };
}

async function getStoredRecord(webhookId: string) {
  const normalizedWebhookId = normalizeProviderEventId(webhookId);
  if (!normalizedWebhookId) {
    return null;
  }

  const collectionRef = getCollection();
  if (collectionRef) {
    const snapshot = await collectionRef.doc(normalizedWebhookId).get();
    if (!snapshot.exists) {
      return null;
    }

    return normalizeStoredRecord(snapshot.data() as StoredTransactionalEmailWebhookRecord);
  }

  const storedRecord = resendWebhookEventStore.get(normalizedWebhookId);
  return storedRecord ? normalizeStoredRecord(storedRecord) : null;
}

async function saveStoredRecord(record: StoredTransactionalEmailWebhookRecord) {
  const normalized = normalizeStoredRecord(record);
  const collectionRef = getCollection();
  if (collectionRef) {
    await collectionRef.doc(normalized.webhookId).set(normalized);
    return normalized;
  }

  resendWebhookEventStore.set(normalized.webhookId, normalized);
  return normalized;
}

function getRequiredHeader(headers: Record<string, string | undefined>, names: string[]) {
  for (const name of names) {
    const value = trimValue(headers[name.toLowerCase()]);
    if (value) {
      return value;
    }
  }

  return null;
}

/**
 * Thrown for Resend webhook errors that the route handler should turn
 * into a specific status code. Without this, the route was sniffing the
 * error message string to classify status — fragile (a transient 5xx
 * with the wrong wording would return 400 → Resend stops retrying →
 * event lost). Uses the same pattern as StripeIdentityWebhookError.
 */
export class ResendWebhookError extends Error {
  readonly statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'ResendWebhookError';
    this.statusCode = statusCode;
  }
}

function verifyResendWebhook(input: {
  rawBody: string;
  headers: Record<string, string | undefined>;
}) {
  const resendWebhookSecret = getTransactionalEmailRuntimeConfig().resendWebhookSecret;
  if (!resendWebhookSecret) {
    throw new ResendWebhookError('Resend webhook signature verification is not configured.', 503);
  }

  const webhookId = getRequiredHeader(input.headers, ['svix-id', 'webhook-id']);
  const webhookTimestamp = getRequiredHeader(input.headers, [
    'svix-timestamp',
    'webhook-timestamp',
  ]);
  const webhookSignature = getRequiredHeader(input.headers, [
    'svix-signature',
    'webhook-signature',
  ]);
  if (!webhookId || !webhookTimestamp || !webhookSignature) {
    throw new ResendWebhookError('Missing Resend webhook verification headers.');
  }

  let payload: unknown;
  try {
    payload = new Webhook(resendWebhookSecret).verify(input.rawBody, {
      'svix-id': webhookId,
      'svix-timestamp': webhookTimestamp,
      'svix-signature': webhookSignature,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Resend signature failure.';
    throw new ResendWebhookError(`Invalid Resend webhook signature. ${message}`.trim());
  }

  return {
    webhookId,
    payload,
  };
}

function normalizeResendWebhookPayload(payload: unknown): VerifiedResendWebhookEvent {
  if (typeof payload !== 'object' || !payload || Array.isArray(payload)) {
    throw new ResendWebhookError('Resend webhook payload must be an object.');
  }

  const record = payload as Record<string, unknown>;
  const eventType = trimValue(typeof record.type === 'string' ? record.type : null);
  const occurredAt = normalizeIsoDate(
    typeof record.created_at === 'string' ? record.created_at : null,
  );
  const data =
    typeof record.data === 'object' && record.data && !Array.isArray(record.data)
      ? (record.data as Record<string, unknown>)
      : null;
  if (!eventType || !occurredAt || !data) {
    throw new ResendWebhookError('Resend webhook payload is missing required email event fields.');
  }

  const recipientEmail = Array.isArray(data.to)
    ? (trimValue(typeof data.to[0] === 'string' ? data.to[0] : null)?.toLowerCase() ?? null)
    : (trimValue(typeof data.to === 'string' ? data.to : null)?.toLowerCase() ?? null);

  return {
    eventType,
    occurredAt,
    emailId: normalizeProviderMessageId(typeof data.email_id === 'string' ? data.email_id : null),
    recipientEmail,
    subject: trimValue(typeof data.subject === 'string' ? data.subject : null),
    summary: getResendWebhookEventSummary(data),
  };
}

async function matchAndApplyEvent(event: VerifiedResendWebhookEvent, webhookId: string) {
  if (!event.emailId) {
    return {
      matchedTarget: 'unmatched' as const,
      matchedId: null,
    };
  }

  const memberStatus = await recordMemberWelcomeEmailDeliveryEvent({
    providerMessageId: event.emailId,
    providerEventId: webhookId,
    eventType: event.eventType,
    occurredAt: event.occurredAt,
    summary: event.summary,
  });
  if (memberStatus) {
    return {
      matchedTarget: 'member' as const,
      matchedId: memberStatus.accountId,
    };
  }

  const ownerStatus = await recordOwnerWelcomeEmailDeliveryEvent({
    providerMessageId: event.emailId,
    providerEventId: webhookId,
    eventType: event.eventType,
    occurredAt: event.occurredAt,
    summary: event.summary,
  });
  if (ownerStatus) {
    return {
      matchedTarget: 'owner' as const,
      matchedId: ownerStatus.ownerUid,
    };
  }

  return {
    matchedTarget: 'unmatched' as const,
    matchedId: null,
  };
}

function toProcessResult(
  record: StoredTransactionalEmailWebhookRecord,
  duplicate: boolean,
): ProcessResendWebhookResult {
  return {
    duplicate,
    webhookId: record.webhookId,
    eventType: record.eventType,
    emailId: record.emailId,
    occurredAt: record.occurredAt,
    receivedAt: record.receivedAt,
    summary: record.summary,
    matchedTarget: record.matchedTarget,
    matchedId: record.matchedId,
  };
}

export async function processResendWebhook(input: {
  rawBody: string;
  headers: Record<string, string | undefined>;
}) {
  const verified = verifyResendWebhook(input);
  const existingRecord = await getStoredRecord(verified.webhookId);
  if (existingRecord) {
    return toProcessResult(existingRecord, true);
  }

  const event = normalizeResendWebhookPayload(verified.payload);
  const matched = await matchAndApplyEvent(event, verified.webhookId);
  const storedRecord = await saveStoredRecord({
    webhookId: verified.webhookId,
    provider: 'resend',
    eventType: event.eventType,
    emailId: event.emailId,
    occurredAt: event.occurredAt,
    receivedAt: getNowIso(),
    recipientEmail: event.recipientEmail,
    subject: event.subject,
    summary: event.summary,
    matchedTarget: matched.matchedTarget,
    matchedId: matched.matchedId,
  });

  return toProcessResult(storedRecord, false);
}

export async function listResendWebhookEvents(options?: { limit?: number }) {
  const collectionRef = getCollection();
  const records = collectionRef
    ? (await collectionRef.get()).docs.map((documentSnapshot) =>
        normalizeStoredRecord(documentSnapshot.data() as StoredTransactionalEmailWebhookRecord),
      )
    : Array.from(resendWebhookEventStore.values()).map(normalizeStoredRecord);

  const limitedRecords = records
    .sort((left, right) => right.receivedAt.localeCompare(left.receivedAt))
    .slice(0, Math.max(1, Math.min(options?.limit ?? 50, 200)));

  return {
    storage: collectionRef ? 'firestore' : 'memory',
    count: limitedRecords.length,
    items: limitedRecords.map((record) => ({
      webhookId: record.webhookId,
      provider: record.provider,
      eventType: record.eventType,
      emailId: record.emailId,
      occurredAt: record.occurredAt,
      receivedAt: record.receivedAt,
      recipientEmail: record.recipientEmail,
      subject: record.subject,
      summary: record.summary,
      matchedTarget: record.matchedTarget,
      matchedId: record.matchedId,
    })),
  };
}

export function clearResendWebhookMemoryStateForTests() {
  resendWebhookEventStore.clear();
}

import { getOptionalFirestoreCollection } from '../firestoreCollections';
import { sendTransactionalEmail } from './emailDeliveryService';
import { buildOwnerWelcomeEmail } from './transactionalEmailTemplates';
import {
  type TransactionalEmailDeliveryState,
  getDeliveryStateForResendEventType,
  normalizeDeliveryEventSummary,
  normalizeDeliveryEventType,
  normalizeProviderEventId,
  normalizeProviderMessageId,
} from './transactionalEmailEventUtils';

type OwnerWelcomeEmailRecord = {
  ownerUid: string;
  email: string;
  displayName: string | null;
  companyName: string | null;
  createdAt: string;
  updatedAt: string;
  welcomeEmailSentAt: string | null;
  lastWelcomeEmailAttemptAt: string | null;
  lastWelcomeEmailError: string | null;
  providerMessageId: string | null;
  lastDeliveryEventId: string | null;
  lastDeliveryEventType: string | null;
  lastDeliveryEventAt: string | null;
  lastDeliveryEventSummary: string | null;
};

export type OwnerWelcomeEmailStatus = {
  ownerUid: string;
  email: string | null;
  displayName: string | null;
  companyName: string | null;
  welcomeEmailSentAt: string | null;
  welcomeEmailState: Exclude<TransactionalEmailDeliveryState, 'not_requested'>;
  welcomeEmailError: string | null;
  welcomeEmailLastEventType: string | null;
  welcomeEmailLastEventAt: string | null;
  welcomeEmailLastEventSummary: string | null;
};

const OWNER_WELCOME_EMAILS_COLLECTION = 'owner_welcome_emails';
const ownerWelcomeEmailStore = new Map<string, OwnerWelcomeEmailRecord>();

function getNowIso() {
  return new Date().toISOString();
}

function trimValue(value: string | null | undefined) {
  return value?.trim() || null;
}

function normalizeEmail(value: string | null | undefined) {
  const trimmed = trimValue(value);
  return trimmed ? trimmed.toLowerCase() : null;
}

function normalizeIsoDate(value: string | null | undefined) {
  const trimmed = trimValue(value);
  return trimmed && !Number.isNaN(Date.parse(trimmed)) ? trimmed : null;
}

function truncateError(value: string | null | undefined) {
  const trimmed = trimValue(value);
  return trimmed ? trimmed.slice(0, 240) : null;
}

function normalizeRecord(record: OwnerWelcomeEmailRecord): OwnerWelcomeEmailRecord {
  return {
    ownerUid: record.ownerUid.trim(),
    email: normalizeEmail(record.email) ?? '',
    displayName: trimValue(record.displayName),
    companyName: trimValue(record.companyName),
    createdAt: normalizeIsoDate(record.createdAt) ?? getNowIso(),
    updatedAt: normalizeIsoDate(record.updatedAt) ?? getNowIso(),
    welcomeEmailSentAt: normalizeIsoDate(record.welcomeEmailSentAt),
    lastWelcomeEmailAttemptAt: normalizeIsoDate(record.lastWelcomeEmailAttemptAt),
    lastWelcomeEmailError: truncateError(record.lastWelcomeEmailError),
    providerMessageId: normalizeProviderMessageId(record.providerMessageId),
    lastDeliveryEventId: normalizeProviderEventId(record.lastDeliveryEventId),
    lastDeliveryEventType: normalizeDeliveryEventType(record.lastDeliveryEventType),
    lastDeliveryEventAt: normalizeIsoDate(record.lastDeliveryEventAt),
    lastDeliveryEventSummary: normalizeDeliveryEventSummary(record.lastDeliveryEventSummary),
  };
}

function createDefaultRecord(input: {
  ownerUid: string;
  email: string;
  displayName?: string | null;
  companyName?: string | null;
}): OwnerWelcomeEmailRecord {
  const now = getNowIso();
  return {
    ownerUid: input.ownerUid.trim(),
    email: normalizeEmail(input.email) ?? '',
    displayName: trimValue(input.displayName),
    companyName: trimValue(input.companyName),
    createdAt: now,
    updatedAt: now,
    welcomeEmailSentAt: null,
    lastWelcomeEmailAttemptAt: null,
    lastWelcomeEmailError: null,
    providerMessageId: null,
    lastDeliveryEventId: null,
    lastDeliveryEventType: null,
    lastDeliveryEventAt: null,
    lastDeliveryEventSummary: null,
  };
}

function getCollection() {
  return getOptionalFirestoreCollection<OwnerWelcomeEmailRecord>(OWNER_WELCOME_EMAILS_COLLECTION);
}

async function getRecord(
  ownerUid: string,
  options?: { email?: string | null; displayName?: string | null; companyName?: string | null }
) {
  const collectionRef = getCollection();
  if (collectionRef) {
    const snapshot = await collectionRef.doc(ownerUid).get();
    if (!snapshot.exists) {
      return createDefaultRecord({
        ownerUid,
        email: options?.email ?? '',
        displayName: options?.displayName,
        companyName: options?.companyName,
      });
    }

    return normalizeRecord(snapshot.data() as OwnerWelcomeEmailRecord);
  }

  const existingRecord = ownerWelcomeEmailStore.get(ownerUid);
  if (existingRecord) {
    return normalizeRecord(existingRecord);
  }

  return createDefaultRecord({
    ownerUid,
    email: options?.email ?? '',
    displayName: options?.displayName,
    companyName: options?.companyName,
  });
}

async function saveRecord(record: OwnerWelcomeEmailRecord) {
  const normalized = normalizeRecord(record);
  const collectionRef = getCollection();
  if (collectionRef) {
    await collectionRef.doc(normalized.ownerUid).set(normalized);
    return normalized;
  }

  ownerWelcomeEmailStore.set(normalized.ownerUid, normalized);
  return normalized;
}

function getWelcomeEmailState(record: OwnerWelcomeEmailRecord): OwnerWelcomeEmailStatus['welcomeEmailState'] {
  const deliveryState = getDeliveryStateForResendEventType(record.lastDeliveryEventType);
  if (deliveryState) {
    return deliveryState;
  }

  if (record.welcomeEmailSentAt) {
    return 'sent';
  }

  if (record.lastWelcomeEmailError && record.lastWelcomeEmailError !== 'not_configured') {
    return 'failed';
  }

  return 'pending_provider';
}

function toStatus(record: OwnerWelcomeEmailRecord): OwnerWelcomeEmailStatus {
  return {
    ownerUid: record.ownerUid,
    email: record.email || null,
    displayName: record.displayName,
    companyName: record.companyName,
    welcomeEmailSentAt: record.welcomeEmailSentAt,
    welcomeEmailState: getWelcomeEmailState(record),
    welcomeEmailError:
      record.lastWelcomeEmailError && record.lastWelcomeEmailError !== 'not_configured'
        ? record.lastWelcomeEmailError
        : null,
    welcomeEmailLastEventType: record.lastDeliveryEventType,
    welcomeEmailLastEventAt: record.lastDeliveryEventAt,
    welcomeEmailLastEventSummary: record.lastDeliveryEventSummary,
  };
}

async function findRecordByProviderMessageId(providerMessageId: string) {
  const normalizedMessageId = normalizeProviderMessageId(providerMessageId);
  if (!normalizedMessageId) {
    return null;
  }

  const collectionRef = getCollection();
  if (collectionRef) {
    const snapshot = await collectionRef
      .where('providerMessageId', '==', normalizedMessageId)
      .limit(1)
      .get();
    if (snapshot.empty) {
      return null;
    }

    return normalizeRecord(snapshot.docs[0]?.data() as OwnerWelcomeEmailRecord);
  }

  const record = Array.from(ownerWelcomeEmailStore.values()).find(
    (candidate) => normalizeProviderMessageId(candidate.providerMessageId) === normalizedMessageId
  );
  return record ? normalizeRecord(record) : null;
}

export async function sendOwnerWelcomeEmailIfNeeded(input: {
  ownerUid: string;
  email: string;
  displayName?: string | null;
  companyName?: string | null;
}) {
  const normalizedEmail = normalizeEmail(input.email);
  if (!normalizedEmail) {
    throw new Error('A valid owner email address is required for the owner welcome email.');
  }

  const previousRecord = await getRecord(input.ownerUid, {
    email: normalizedEmail,
    displayName: input.displayName ?? null,
    companyName: input.companyName ?? null,
  });
  const now = getNowIso();
  const nextRecord = await saveRecord({
    ...previousRecord,
    email: normalizedEmail,
    displayName: trimValue(input.displayName) ?? previousRecord.displayName,
    companyName: trimValue(input.companyName) ?? previousRecord.companyName,
    updatedAt: now,
  });

  if (nextRecord.welcomeEmailSentAt) {
    return toStatus(nextRecord);
  }

  const emailContent = buildOwnerWelcomeEmail({
    displayName: nextRecord.displayName,
    companyName: nextRecord.companyName,
  });
  const result = await sendTransactionalEmail({
    to: nextRecord.email,
    subject: emailContent.subject,
    html: emailContent.html,
    text: emailContent.text,
    idempotencyKey: `owner-welcome:${nextRecord.ownerUid}`,
    tags: [
      {
        name: 'email_type',
        value: 'owner_welcome',
      },
      {
        name: 'audience',
        value: 'owner',
      },
    ],
  });

  if (!result.ok) {
    if (result.code === 'not_configured') {
      return toStatus(
        await saveRecord({
          ...nextRecord,
          updatedAt: now,
          lastWelcomeEmailError: 'not_configured',
        })
      );
    }

    return toStatus(
      await saveRecord({
        ...nextRecord,
        updatedAt: now,
        lastWelcomeEmailAttemptAt: now,
        lastWelcomeEmailError: result.message,
      })
    );
  }

  return toStatus(
    await saveRecord({
      ...nextRecord,
      updatedAt: now,
      welcomeEmailSentAt: now,
      lastWelcomeEmailAttemptAt: now,
      lastWelcomeEmailError: null,
      providerMessageId: result.id,
    })
  );
}

export async function recordOwnerWelcomeEmailDeliveryEvent(input: {
  providerMessageId: string;
  providerEventId?: string | null;
  eventType: string;
  occurredAt?: string | null;
  summary?: string | null;
}) {
  const record = await findRecordByProviderMessageId(input.providerMessageId);
  if (!record) {
    return null;
  }

  return toStatus(
    await saveRecord({
      ...record,
      updatedAt: getNowIso(),
      lastDeliveryEventId: normalizeProviderEventId(input.providerEventId),
      lastDeliveryEventType: normalizeDeliveryEventType(input.eventType),
      lastDeliveryEventAt: normalizeIsoDate(input.occurredAt) ?? getNowIso(),
      lastDeliveryEventSummary: normalizeDeliveryEventSummary(input.summary),
    })
  );
}

export function clearOwnerWelcomeEmailMemoryStateForTests() {
  ownerWelcomeEmailStore.clear();
}

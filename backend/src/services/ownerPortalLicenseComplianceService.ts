import { OwnerLicenseComplianceDocument, OwnerPortalLicenseComplianceInput } from '../../../src/types/ownerPortal';
import { getBackendFirebaseDb } from '../firebase';
import { notifyOwnerPortalUser } from './ownerPortalAlertService';
import { getOwnerLicenseComplianceCollection } from './ownerPortalWorkspaceCollections';

const BUSINESS_VERIFICATIONS_COLLECTION = 'businessVerifications';

type OwnerBusinessVerificationSeed = {
  ownerUid: string;
  dispensaryId: string;
  licenseNumber?: string;
  licenseType?: string;
  state?: string;
};

let schedulerHandle: ReturnType<typeof setInterval> | null = null;
let schedulerStarted = false;
const ownerLicenseComplianceStore = new Map<string, OwnerLicenseComplianceDocument>();
const ownerBusinessVerificationSeedStore = new Map<string, OwnerBusinessVerificationSeed>();

function getNowIso() {
  return new Date().toISOString();
}

function addDays(isoDate: string, days: number) {
  const date = new Date(isoDate);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

function startOfIsoDay(isoDate: string) {
  const date = new Date(isoDate);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

function getDayDelta(fromIso: string, toIso: string) {
  const from = startOfIsoDay(fromIso).getTime();
  const to = startOfIsoDay(toIso).getTime();
  return Math.floor((to - from) / (24 * 60 * 60 * 1000));
}

function normalizeTrimmedString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function normalizeNullableIso(value: unknown) {
  if (value === null) {
    return null;
  }

  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }

  const nextValue = value.trim();
  return Number.isNaN(Date.parse(nextValue)) ? null : nextValue;
}

function deriveRenewalWindowStartsAt(expiresAt: string | null) {
  return expiresAt ? addDays(expiresAt, -120) : null;
}

function deriveRenewalUrgentAt(expiresAt: string | null) {
  return expiresAt ? addDays(expiresAt, -60) : null;
}

export function deriveOwnerLicenseRenewalStatus(input: {
  expiresAt: string | null;
  renewalSubmittedAt: string | null;
  nowIso?: string;
}): OwnerLicenseComplianceDocument['renewalStatus'] {
  const nowIso = input.nowIso ?? getNowIso();
  if (!input.expiresAt) {
    return 'unknown';
  }

  if (input.renewalSubmittedAt) {
    return 'submitted';
  }

  const daysUntilExpiry = getDayDelta(nowIso, input.expiresAt);
  if (daysUntilExpiry < 0) {
    return 'expired';
  }

  if (daysUntilExpiry <= 60) {
    return 'urgent';
  }

  if (daysUntilExpiry <= 120) {
    return 'window_open';
  }

  return 'active';
}

export function deriveOwnerLicenseReminderStage(input: {
  expiresAt: string | null;
  renewalSubmittedAt: string | null;
  nowIso?: string;
}): OwnerLicenseComplianceDocument['lastReminderStage'] {
  const nowIso = input.nowIso ?? getNowIso();
  if (!input.expiresAt || input.renewalSubmittedAt) {
    return null;
  }

  const daysUntilExpiry = getDayDelta(nowIso, input.expiresAt);
  if (daysUntilExpiry < 0) {
    return 'expired';
  }
  if (daysUntilExpiry <= 7) {
    return '7_day';
  }
  if (daysUntilExpiry <= 14) {
    return '14_day';
  }
  if (daysUntilExpiry <= 30) {
    return '30_day';
  }
  if (daysUntilExpiry <= 60) {
    return '60_day';
  }
  if (daysUntilExpiry <= 90) {
    return '90_day';
  }
  if (daysUntilExpiry <= 120) {
    return '120_day';
  }

  return null;
}

function buildDocId(ownerUid: string, dispensaryId: string) {
  return `${ownerUid}_${dispensaryId}`;
}

function getStoreDocId(ownerUid: string, dispensaryId: string) {
  return buildDocId(ownerUid, dispensaryId);
}

function setOwnerLicenseComplianceInMemory(record: OwnerLicenseComplianceDocument) {
  ownerLicenseComplianceStore.set(getStoreDocId(record.ownerUid, record.dispensaryId), record);
}

function removeOwnerLicenseComplianceInMemory(ownerUid: string, dispensaryId: string) {
  ownerLicenseComplianceStore.delete(getStoreDocId(ownerUid, dispensaryId));
}

export function clearOwnerLicenseComplianceMemoryStateForTests() {
  ownerLicenseComplianceStore.clear();
  ownerBusinessVerificationSeedStore.clear();
}

export function seedOwnerBusinessVerificationForTests(seed: OwnerBusinessVerificationSeed) {
  ownerBusinessVerificationSeedStore.set(seed.ownerUid, {
    ownerUid: seed.ownerUid,
    dispensaryId: seed.dispensaryId,
    licenseNumber: seed.licenseNumber,
    licenseType: seed.licenseType,
    state: seed.state,
  });
}

export async function deleteOwnerBusinessVerificationRecord(ownerUid: string) {
  const db = getBackendFirebaseDb();
  if (db) {
    await db.collection(BUSINESS_VERIFICATIONS_COLLECTION).doc(ownerUid).delete();
  }

  ownerBusinessVerificationSeedStore.delete(ownerUid);
  await deleteOwnerLicenseComplianceRecordsForOwner(ownerUid);
}

function normalizeOwnerLicenseCompliance(
  record: Partial<OwnerLicenseComplianceDocument>,
  fallback: {
    ownerUid: string;
    dispensaryId: string;
    createdAt?: string;
  }
): OwnerLicenseComplianceDocument {
  const createdAt = normalizeNullableIso(record.createdAt) ?? fallback.createdAt ?? getNowIso();
  const updatedAt = normalizeNullableIso(record.updatedAt) ?? getNowIso();
  const issuedAt = normalizeNullableIso(record.issuedAt);
  const expiresAt = normalizeNullableIso(record.expiresAt);
  const renewalSubmittedAt = normalizeNullableIso(record.renewalSubmittedAt);

  return {
    ownerUid: normalizeTrimmedString(record.ownerUid) || fallback.ownerUid,
    dispensaryId: normalizeTrimmedString(record.dispensaryId) || fallback.dispensaryId,
    licenseNumber: normalizeTrimmedString(record.licenseNumber),
    licenseType: normalizeTrimmedString(record.licenseType),
    jurisdiction: 'NY',
    issuedAt,
    expiresAt,
    renewalWindowStartsAt: deriveRenewalWindowStartsAt(expiresAt),
    renewalUrgentAt: deriveRenewalUrgentAt(expiresAt),
    renewalStatus: deriveOwnerLicenseRenewalStatus({
      expiresAt,
      renewalSubmittedAt,
      nowIso: updatedAt,
    }),
    renewalSubmittedAt,
    lastReminderSentAt: normalizeNullableIso(record.lastReminderSentAt),
    lastReminderStage:
      record.lastReminderStage === '120_day' ||
      record.lastReminderStage === '90_day' ||
      record.lastReminderStage === '60_day' ||
      record.lastReminderStage === '30_day' ||
      record.lastReminderStage === '14_day' ||
      record.lastReminderStage === '7_day' ||
      record.lastReminderStage === 'expired'
        ? record.lastReminderStage
        : null,
    source:
      record.source === 'admin_input' || record.source === 'verification_seed'
        ? record.source
        : 'owner_input',
    notes:
      typeof record.notes === 'string' && record.notes.trim() ? record.notes.trim() : null,
    createdAt,
    updatedAt,
  };
}

async function getOwnerBusinessVerificationSeed(ownerUid: string) {
  const db = getBackendFirebaseDb();
  if (!db) {
    return ownerBusinessVerificationSeedStore.get(ownerUid) ?? null;
  }

  const snapshot = await db.collection(BUSINESS_VERIFICATIONS_COLLECTION).doc(ownerUid).get();
  if (!snapshot.exists) {
    return ownerBusinessVerificationSeedStore.get(ownerUid) ?? null;
  }

  const data = snapshot.data() as OwnerBusinessVerificationSeed;
  if (!data?.dispensaryId) {
    return null;
  }

  return data;
}

export async function getOwnerLicenseCompliance(ownerUid: string, dispensaryId: string | null) {
  if (!dispensaryId) {
    return null;
  }

  const collectionRef = getOwnerLicenseComplianceCollection();
  const docId = buildDocId(ownerUid, dispensaryId);

  if (collectionRef) {
    const snapshot = await collectionRef.doc(docId).get();
    if (snapshot.exists) {
      return normalizeOwnerLicenseCompliance(snapshot.data() as OwnerLicenseComplianceDocument, {
        ownerUid,
        dispensaryId,
      });
    }
  }

  const inMemoryRecord = ownerLicenseComplianceStore.get(docId);
  if (inMemoryRecord) {
    return normalizeOwnerLicenseCompliance(inMemoryRecord, {
      ownerUid,
      dispensaryId,
      createdAt: inMemoryRecord.createdAt,
    });
  }

  const verificationSeed = await getOwnerBusinessVerificationSeed(ownerUid);
  if (!verificationSeed || verificationSeed.dispensaryId !== dispensaryId) {
    return null;
  }

  const seededRecord = normalizeOwnerLicenseCompliance(
    {
      ownerUid,
      dispensaryId,
      licenseNumber: verificationSeed.licenseNumber ?? '',
      licenseType: verificationSeed.licenseType ?? '',
      source: 'verification_seed',
      createdAt: getNowIso(),
      updatedAt: getNowIso(),
    },
    {
      ownerUid,
      dispensaryId,
    }
  );

  if (collectionRef) {
    await collectionRef.doc(docId).set(seededRecord, { merge: true });
  } else {
    setOwnerLicenseComplianceInMemory(seededRecord);
  }

  return seededRecord;
}

export async function saveOwnerLicenseCompliance(options: {
  ownerUid: string;
  dispensaryId: string;
  input: OwnerPortalLicenseComplianceInput;
  source?: OwnerLicenseComplianceDocument['source'];
}) {
  const existing = await getOwnerLicenseCompliance(options.ownerUid, options.dispensaryId);
  const nowIso = getNowIso();
  const nextRecord = normalizeOwnerLicenseCompliance(
    {
      ...(existing ?? {
        ownerUid: options.ownerUid,
        dispensaryId: options.dispensaryId,
        createdAt: nowIso,
      }),
      licenseNumber:
        options.input.licenseNumber !== undefined
          ? options.input.licenseNumber
          : existing?.licenseNumber,
      licenseType:
        options.input.licenseType !== undefined
          ? options.input.licenseType
          : existing?.licenseType,
      issuedAt:
        options.input.issuedAt !== undefined ? options.input.issuedAt : existing?.issuedAt,
      expiresAt:
        options.input.expiresAt !== undefined ? options.input.expiresAt : existing?.expiresAt,
      renewalSubmittedAt:
        options.input.renewalSubmittedAt !== undefined
          ? options.input.renewalSubmittedAt
          : existing?.renewalSubmittedAt,
      notes: options.input.notes !== undefined ? options.input.notes : existing?.notes,
      source: options.source ?? existing?.source ?? 'owner_input',
      createdAt: existing?.createdAt ?? nowIso,
      updatedAt: nowIso,
    },
    {
      ownerUid: options.ownerUid,
      dispensaryId: options.dispensaryId,
      createdAt: existing?.createdAt ?? nowIso,
    }
  );

  const collectionRef = getOwnerLicenseComplianceCollection();
  if (collectionRef) {
    await collectionRef.doc(buildDocId(options.ownerUid, options.dispensaryId)).set(nextRecord);
  } else {
    setOwnerLicenseComplianceInMemory(nextRecord);
  }

  return nextRecord;
}

export async function deleteOwnerLicenseCompliance(ownerUid: string, dispensaryId: string) {
  const collectionRef = getOwnerLicenseComplianceCollection();
  if (collectionRef) {
    await collectionRef.doc(buildDocId(ownerUid, dispensaryId)).delete();
  }

  removeOwnerLicenseComplianceInMemory(ownerUid, dispensaryId);
}

export async function deleteOwnerLicenseComplianceRecordsForOwner(ownerUid: string) {
  const collectionRef = getOwnerLicenseComplianceCollection();
  if (collectionRef) {
    const snapshot = await collectionRef.where('ownerUid', '==', ownerUid).get();
    const deleteResults = await Promise.allSettled(snapshot.docs.map(async (documentSnapshot) => documentSnapshot.ref.delete()));
    for (const result of deleteResults) {
      if (result.status === 'rejected') {
        console.warn('[ownerPortalLicenseComplianceService] failed to delete a compliance record during owner cleanup:', result.reason);
      }
    }
  }

  for (const [docId, record] of ownerLicenseComplianceStore.entries()) {
    if (record.ownerUid === ownerUid) {
      ownerLicenseComplianceStore.delete(docId);
    }
  }
}

function buildReminderMessage(
  compliance: OwnerLicenseComplianceDocument,
  stage: NonNullable<OwnerLicenseComplianceDocument['lastReminderStage']>
) {
  const expiresOn = compliance.expiresAt
    ? new Date(compliance.expiresAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
      })
    : 'an unknown date';

  switch (stage) {
    case 'expired':
      return {
        title: 'License renewal is overdue',
        body: `Your NY license tracker shows the current license expired on ${expiresOn}. Review the renewal status now.`,
      };
    case '7_day':
    case '14_day':
    case '30_day':
    case '60_day':
    case '90_day':
    case '120_day':
      return {
        title: 'License renewal window reminder',
        body: `Your NY license is tracked to expire on ${expiresOn}. Review your renewal checklist and submission status.`,
      };
    default:
      return null;
  }
}

export async function runOwnerLicenseComplianceSweep() {
  const collectionRef = getOwnerLicenseComplianceCollection();
  const records = collectionRef
    ? (await collectionRef.get()).docs.map((documentSnapshot) =>
        normalizeOwnerLicenseCompliance(documentSnapshot.data() as OwnerLicenseComplianceDocument, {
          ownerUid: (documentSnapshot.data() as OwnerLicenseComplianceDocument).ownerUid,
          dispensaryId: (documentSnapshot.data() as OwnerLicenseComplianceDocument).dispensaryId,
        })
      )
    : Array.from(ownerLicenseComplianceStore.values()).map((record) =>
        normalizeOwnerLicenseCompliance(record, {
          ownerUid: record.ownerUid,
          dispensaryId: record.dispensaryId,
          createdAt: record.createdAt,
        })
      );

  if (!records.length) {
    return {
      ok: true,
      processedCount: 0,
      remindedCount: 0,
    };
  }

  let remindedCount = 0;
  const nowIso = getNowIso();

  const reminderResults = await Promise.allSettled(
    records.map(async (current) => {
      const nextReminderStage = deriveOwnerLicenseReminderStage({
        expiresAt: current.expiresAt,
        renewalSubmittedAt: current.renewalSubmittedAt,
        nowIso,
      });
      const nextRenewalStatus = deriveOwnerLicenseRenewalStatus({
        expiresAt: current.expiresAt,
        renewalSubmittedAt: current.renewalSubmittedAt,
        nowIso,
      });

      const shouldRemind =
        Boolean(nextReminderStage) && nextReminderStage !== current.lastReminderStage;
      const reminderMessage =
        nextReminderStage ? buildReminderMessage(current, nextReminderStage) : null;

      if (shouldRemind && reminderMessage) {
        const notificationResult = await notifyOwnerPortalUser({
          ownerUid: current.ownerUid,
          title: reminderMessage.title,
          body: reminderMessage.body,
          data: {
            kind: 'owner_license_compliance',
            dispensaryId: current.dispensaryId,
            renewalStatus: nextRenewalStatus,
            reminderStage: String(nextReminderStage),
          },
        });

        if (notificationResult.notifiedOwnerCount > 0) {
          remindedCount += 1;
        }
      }

      if (
        nextReminderStage !== current.lastReminderStage ||
        nextRenewalStatus !== current.renewalStatus
      ) {
        const nextRecord = {
          ...current,
          renewalStatus: nextRenewalStatus,
          lastReminderStage: nextReminderStage,
          lastReminderSentAt:
            shouldRemind && reminderMessage ? nowIso : current.lastReminderSentAt,
          updatedAt: nowIso,
        };
        if (collectionRef) {
          await collectionRef
            .doc(buildDocId(current.ownerUid, current.dispensaryId))
            .set(nextRecord, { merge: true });
        } else {
          setOwnerLicenseComplianceInMemory(nextRecord);
        }
      }
    })
  );
  for (const result of reminderResults) {
    if (result.status === 'rejected') {
      console.warn('[ownerPortalLicenseComplianceService] failed to process a license compliance reminder:', result.reason);
    }
  }

  return {
    ok: true,
    processedCount: records.length,
    remindedCount,
  };
}

export function startOwnerLicenseComplianceScheduler(intervalHours: number) {
  if (schedulerStarted) {
    return;
  }

  schedulerStarted = true;
  const intervalMs = Math.max(intervalHours, 1) * 60 * 60 * 1000;
  void runOwnerLicenseComplianceSweep().catch(() => undefined);
  schedulerHandle = setInterval(() => {
    void runOwnerLicenseComplianceSweep().catch(() => undefined);
  }, intervalMs);
}

export function stopOwnerLicenseComplianceScheduler() {
  if (schedulerHandle) {
    clearInterval(schedulerHandle);
    schedulerHandle = null;
  }

  schedulerStarted = false;
}

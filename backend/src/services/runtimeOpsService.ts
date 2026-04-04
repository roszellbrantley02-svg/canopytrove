import { randomUUID } from 'node:crypto';
import { getOptionalFirestoreCollection } from '../firestoreCollections';
import { serverConfig } from '../config';
import { backendStorefrontSourceStatus } from '../sources';
import {
  RuntimeIncidentCounts,
  RuntimeIncidentRecord,
  RuntimeIncidentSeverity,
  RuntimeOpsStatus,
  RuntimePolicy,
  RuntimePolicyInput,
} from '../../../src/types/runtimeOps';
import { notifyRuntimeAlertSubscribers } from './opsAlertSubscriptionService';

const RUNTIME_INCIDENTS_COLLECTION = 'ops_runtime_incidents';
const RUNTIME_POLICY_COLLECTION = 'ops_runtime_policy';
const RUNTIME_POLICY_DOC_ID = 'current';
const AUTO_RECOVERY_WINDOW_MS = 15 * 60_000;
const INCIDENT_24H_WINDOW_MS = 24 * 60 * 60_000;

const runtimeIncidentStore = new Map<string, RuntimeIncidentRecord>();
let runtimePolicyStore: RuntimePolicy | null = null;

function getNowIso() {
  return new Date().toISOString();
}

function createId(prefix: string) {
  return `${prefix}-${randomUUID()}`;
}

function createDefaultPolicy(): RuntimePolicy {
  return {
    safeModeEnabled: false,
    ownerPortalWritesEnabled: true,
    promotionWritesEnabled: true,
    reviewRepliesEnabled: true,
    profileToolsWritesEnabled: true,
    updatedAt: new Date(0).toISOString(),
    reason: null,
    trigger: 'normal',
  };
}

function normalizePolicy(input: Partial<RuntimePolicy> | null | undefined): RuntimePolicy {
  const base = createDefaultPolicy();
  const nextPolicy = {
    ...base,
    ...input,
  };

  return {
    safeModeEnabled: nextPolicy.safeModeEnabled === true,
    ownerPortalWritesEnabled: nextPolicy.ownerPortalWritesEnabled !== false,
    promotionWritesEnabled: nextPolicy.promotionWritesEnabled !== false,
    reviewRepliesEnabled: nextPolicy.reviewRepliesEnabled !== false,
    profileToolsWritesEnabled: nextPolicy.profileToolsWritesEnabled !== false,
    updatedAt:
      typeof nextPolicy.updatedAt === 'string' && nextPolicy.updatedAt.trim()
        ? nextPolicy.updatedAt
        : getNowIso(),
    reason:
      typeof nextPolicy.reason === 'string' && nextPolicy.reason.trim()
        ? nextPolicy.reason.trim()
        : null,
    trigger:
      nextPolicy.trigger === 'automatic' ||
      nextPolicy.trigger === 'manual' ||
      nextPolicy.trigger === 'normal'
        ? nextPolicy.trigger
        : 'normal',
  };
}

function createAutomaticSafeModePolicy(reason: string): RuntimePolicy {
  return normalizePolicy({
    safeModeEnabled: true,
    ownerPortalWritesEnabled: false,
    promotionWritesEnabled: false,
    reviewRepliesEnabled: false,
    profileToolsWritesEnabled: false,
    updatedAt: getNowIso(),
    reason,
    trigger: 'automatic',
  });
}

function createOpenPolicy(reason?: string | null): RuntimePolicy {
  return normalizePolicy({
    safeModeEnabled: false,
    ownerPortalWritesEnabled: true,
    promotionWritesEnabled: true,
    reviewRepliesEnabled: true,
    profileToolsWritesEnabled: true,
    updatedAt: getNowIso(),
    reason: reason ?? null,
    trigger: 'normal',
  });
}

function normalizeMetadata(
  metadata: Record<string, unknown> | undefined,
): Record<string, string | number | boolean | null> {
  if (!metadata) {
    return {};
  }

  const entries = Object.entries(metadata).map(([key, value]) => {
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      value === null
    ) {
      return [key, value] as const;
    }

    return [key, JSON.stringify(value)] as const;
  });

  return Object.fromEntries(entries);
}

function createFingerprint(input: {
  kind: RuntimeIncidentRecord['kind'];
  source: string;
  path?: string | null;
  screen?: string | null;
  message: string;
}) {
  return [
    input.kind,
    input.source.trim().toLowerCase(),
    (input.path ?? '').trim().toLowerCase(),
    (input.screen ?? '').trim().toLowerCase(),
    input.message.trim().slice(0, 160).toLowerCase(),
  ].join(':');
}

function getRuntimeIncidentCollection() {
  return getOptionalFirestoreCollection<RuntimeIncidentRecord>(RUNTIME_INCIDENTS_COLLECTION);
}

function getRuntimePolicyCollection() {
  return getOptionalFirestoreCollection<RuntimePolicy>(RUNTIME_POLICY_COLLECTION);
}

async function saveRuntimeIncidentRecord(record: RuntimeIncidentRecord) {
  const collectionRef = getRuntimeIncidentCollection();
  if (collectionRef) {
    await collectionRef.doc(record.id).set(record);
    return record;
  }

  runtimeIncidentStore.set(record.id, record);
  return record;
}

async function listRuntimeIncidentRecords(limit = 20) {
  const collectionRef = getRuntimeIncidentCollection();
  if (collectionRef) {
    const snapshot = await collectionRef.orderBy('occurredAt', 'desc').limit(limit).get();
    return snapshot.docs.map(
      (documentSnapshot) => documentSnapshot.data() as RuntimeIncidentRecord,
    );
  }

  return Array.from(runtimeIncidentStore.values())
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
    .slice(0, limit);
}

async function getStoredRuntimePolicy() {
  const collectionRef = getRuntimePolicyCollection();
  if (collectionRef) {
    const snapshot = await collectionRef.doc(RUNTIME_POLICY_DOC_ID).get();
    if (!snapshot.exists) {
      return createDefaultPolicy();
    }

    return normalizePolicy(snapshot.data() as RuntimePolicy);
  }

  return runtimePolicyStore ? normalizePolicy(runtimePolicyStore) : createDefaultPolicy();
}

async function persistRuntimePolicy(policy: RuntimePolicy) {
  const normalized = normalizePolicy(policy);
  const collectionRef = getRuntimePolicyCollection();
  if (collectionRef) {
    await collectionRef.doc(RUNTIME_POLICY_DOC_ID).set(normalized);
    return normalized;
  }

  runtimePolicyStore = normalized;
  return normalized;
}

function computeIncidentCounts(incidents: RuntimeIncidentRecord[]): RuntimeIncidentCounts {
  const now = Date.now();
  let last15Minutes = 0;
  let criticalLast15Minutes = 0;
  let criticalLast24Hours = 0;
  let clientLast24Hours = 0;
  let serverLast24Hours = 0;

  incidents.forEach((incident) => {
    const occurredAt = Date.parse(incident.occurredAt);
    if (!Number.isFinite(occurredAt)) {
      return;
    }

    const ageMs = now - occurredAt;
    if (ageMs <= AUTO_RECOVERY_WINDOW_MS) {
      last15Minutes += 1;
      if (incident.severity === 'critical') {
        criticalLast15Minutes += 1;
      }
    }

    if (ageMs <= INCIDENT_24H_WINDOW_MS) {
      if (incident.severity === 'critical') {
        criticalLast24Hours += 1;
      }

      if (incident.kind === 'client') {
        clientLast24Hours += 1;
      }

      if (incident.kind === 'server') {
        serverLast24Hours += 1;
      }
    }
  });

  return {
    last15Minutes,
    criticalLast15Minutes,
    criticalLast24Hours,
    clientLast24Hours,
    serverLast24Hours,
  };
}

function shouldEnableAutomaticSafeMode(counts: RuntimeIncidentCounts) {
  return (
    serverConfig.runtimeAutoMitigationEnabled &&
    counts.criticalLast15Minutes >= serverConfig.runtimeIncidentThreshold
  );
}

export async function recordRuntimeIncident(input: {
  kind: RuntimeIncidentRecord['kind'];
  severity: RuntimeIncidentSeverity;
  source: string;
  message: string;
  path?: string | null;
  screen?: string | null;
  platform?: string | null;
  requestId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const record: RuntimeIncidentRecord = {
    id: createId('incident'),
    kind: input.kind,
    severity: input.severity,
    source: input.source.trim(),
    message: input.message.trim(),
    path: input.path?.trim() || null,
    screen: input.screen?.trim() || null,
    platform: input.platform?.trim() || null,
    requestId: input.requestId?.trim() || null,
    fingerprint: createFingerprint(input),
    occurredAt: getNowIso(),
    metadata: normalizeMetadata(input.metadata),
  };

  await saveRuntimeIncidentRecord(record);
  if (record.severity === 'critical') {
    await notifyRuntimeAlertSubscribers({
      title: 'Canopy Trove critical incident',
      body: record.message,
      data: {
        alertType: 'critical_incident',
        incidentId: record.id,
        incidentKind: record.kind,
        incidentSource: record.source,
        incidentSeverity: record.severity,
      },
      fingerprint: `runtime-incident:${record.fingerprint}`,
    });
  }
  await evaluateRuntimePolicy();
  return record;
}

export async function getRuntimeOpsStatus(limit = 12): Promise<RuntimeOpsStatus> {
  const [policyResult, incidentsResult] = await Promise.allSettled([
    getStoredRuntimePolicy(),
    listRuntimeIncidentRecords(Math.max(limit, 40)),
  ]);
  const policy = policyResult.status === 'fulfilled' ? policyResult.value : createDefaultPolicy();
  const incidents = incidentsResult.status === 'fulfilled' ? incidentsResult.value : [];
  if (policyResult.status === 'rejected') {
    console.warn(
      '[runtimeOpsService] failed to load runtime policy, using default:',
      policyResult.reason,
    );
  }
  if (incidentsResult.status === 'rejected') {
    console.warn('[runtimeOpsService] failed to load incident records:', incidentsResult.reason);
  }
  const { getRuntimeMonitoringStatus } = await import('./healthMonitorService');

  return {
    policy,
    incidentCounts: computeIncidentCounts(incidents),
    recentIncidents: incidents.slice(0, limit),
    monitoring: await getRuntimeMonitoringStatus(),
  };
}

export async function saveRuntimePolicy(input: RuntimePolicyInput) {
  const currentPolicy = await getStoredRuntimePolicy();

  const nextPolicy = normalizePolicy({
    ...currentPolicy,
    ...input,
    updatedAt: getNowIso(),
    reason:
      typeof input.reason === 'string' && input.reason.trim()
        ? input.reason.trim()
        : currentPolicy.reason,
    trigger: input.trigger ?? 'manual',
  });

  return persistRuntimePolicy(nextPolicy);
}

export async function evaluateRuntimePolicy() {
  const status = await getRuntimeOpsStatus();
  const currentPolicy = status.policy;
  const shouldEnableSafeMode = shouldEnableAutomaticSafeMode(status.incidentCounts);

  if (shouldEnableSafeMode && currentPolicy.trigger !== 'manual') {
    const nextPolicy = await persistRuntimePolicy(
      createAutomaticSafeModePolicy(
        `Automatic safe mode engaged after ${status.incidentCounts.criticalLast15Minutes} critical incidents in the last 15 minutes.`,
      ),
    );
    await notifyRuntimeAlertSubscribers({
      title: 'Canopy Trove entered protected mode',
      body:
        nextPolicy.reason ??
        'Protected mode engaged automatically after elevated incident pressure.',
      data: {
        alertType: 'protected_mode_enabled',
        incidentCount: String(status.incidentCounts.criticalLast15Minutes),
      },
      fingerprint: `runtime-policy:protected:${status.incidentCounts.criticalLast15Minutes}`,
    });
    return nextPolicy;
  }

  if (!shouldEnableSafeMode && currentPolicy.trigger === 'automatic') {
    const nextPolicy = await persistRuntimePolicy(
      createOpenPolicy('Automatic safe mode cleared after incident pressure dropped.'),
    );
    await notifyRuntimeAlertSubscribers({
      title: 'Canopy Trove resumed normal mode',
      body: nextPolicy.reason ?? 'Protected mode cleared after runtime incident pressure dropped.',
      data: {
        alertType: 'protected_mode_cleared',
      },
      fingerprint: 'runtime-policy:normal',
    });
    return nextPolicy;
  }

  return currentPolicy;
}

export async function assertRuntimePolicyAllowsOwnerAction(
  action: 'promotion' | 'review_reply' | 'profile_tools',
) {
  const policy = await getStoredRuntimePolicy();
  if (!policy.ownerPortalWritesEnabled) {
    const error = new Error(
      'Owner portal writes are temporarily paused while the system stabilizes.',
    ) as Error & {
      statusCode?: number;
    };
    error.statusCode = 503;
    throw error;
  }

  if (action === 'promotion' && !policy.promotionWritesEnabled) {
    const error = new Error(
      'Promotion changes are temporarily paused while the system stabilizes.',
    ) as Error & {
      statusCode?: number;
    };
    error.statusCode = 503;
    throw error;
  }

  if (action === 'review_reply' && !policy.reviewRepliesEnabled) {
    const error = new Error(
      'Review replies are temporarily paused while the system stabilizes.',
    ) as Error & {
      statusCode?: number;
    };
    error.statusCode = 503;
    throw error;
  }

  if (action === 'profile_tools' && !policy.profileToolsWritesEnabled) {
    const error = new Error(
      'Profile tool updates are temporarily paused while the system stabilizes.',
    ) as Error & {
      statusCode?: number;
    };
    error.statusCode = 503;
    throw error;
  }
}

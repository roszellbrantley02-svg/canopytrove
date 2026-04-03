import { storefrontApiBaseUrl } from '../config/storefrontSourceConfig';
import { requestJson } from './storefrontBackendHttp';
import type { RuntimeOpsPublicStatus, RuntimePolicy } from '../types/runtimeOps';

const RUNTIME_STATUS_TTL_MS = 15_000;

const defaultPolicy: RuntimePolicy = {
  safeModeEnabled: false,
  ownerPortalWritesEnabled: true,
  promotionWritesEnabled: true,
  reviewRepliesEnabled: true,
  profileToolsWritesEnabled: true,
  updatedAt: new Date(0).toISOString(),
  reason: null,
  trigger: 'normal',
};

const fallbackRuntimeStatus: RuntimeOpsPublicStatus = {
  policy: defaultPolicy,
  incidentCounts: {
    last15Minutes: 0,
    criticalLast15Minutes: 0,
    criticalLast24Hours: 0,
    clientLast24Hours: 0,
    serverLast24Hours: 0,
  },
  generatedAt: new Date(0).toISOString(),
};

let cachedRuntimeStatus: RuntimeOpsPublicStatus = fallbackRuntimeStatus;
let cachedAt = 0;
let inFlightStatusRequest: Promise<RuntimeOpsPublicStatus> | null = null;

export function getCachedRuntimeOpsStatus() {
  return cachedRuntimeStatus;
}

export function hasRuntimeSafeMode(status = cachedRuntimeStatus) {
  return status.policy.safeModeEnabled;
}

export function buildRuntimeStatusBanner(status = cachedRuntimeStatus) {
  if (status.policy.safeModeEnabled) {
    return (
      status.policy.reason ??
      'Canopy Trove is in protected mode while the system stabilizes. Some live owner actions are temporarily paused.'
    );
  }

  if (!status.policy.ownerPortalWritesEnabled) {
    return status.policy.reason ?? 'Owner workspace changes are temporarily paused.';
  }

  if (status.incidentCounts.criticalLast24Hours > 0) {
    return 'The system has recent incident activity. Live tools remain available, but monitoring is elevated.';
  }

  return null;
}

export function clearRuntimeOpsStatusCache() {
  cachedRuntimeStatus = fallbackRuntimeStatus;
  cachedAt = 0;
  inFlightStatusRequest = null;
}

export async function getRuntimeOpsStatus(options?: { force?: boolean }) {
  if (!storefrontApiBaseUrl) {
    return cachedRuntimeStatus;
  }

  if (!options?.force && cachedAt > 0 && Date.now() - cachedAt < RUNTIME_STATUS_TTL_MS) {
    return cachedRuntimeStatus;
  }

  if (!options?.force && inFlightStatusRequest) {
    return inFlightStatusRequest;
  }

  const request = requestJson<RuntimeOpsPublicStatus>('/runtime/status')
    .then((status) => {
      cachedRuntimeStatus = {
        ...status,
        policy: {
          ...defaultPolicy,
          ...status.policy,
        },
      };
      cachedAt = Date.now();
      return cachedRuntimeStatus;
    })
    .catch(() => cachedRuntimeStatus);

  inFlightStatusRequest = request;

  try {
    return await request;
  } finally {
    if (inFlightStatusRequest === request) {
      inFlightStatusRequest = null;
    }
  }
}

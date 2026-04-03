import { storefrontApiBaseUrl } from '../config/storefrontSourceConfig';
import { getCanopyTroveAuthIdTokenResult } from './canopyTroveAuthService';
import type {
  RuntimeAlertSubscriptionStatus,
  RuntimeMonitoringStatus,
  RuntimeOpsStatus,
  RuntimePolicy,
  RuntimePolicyInput,
} from '../types/runtimeOps';

type AdminRuntimeEvaluateResponse = {
  ok: boolean;
  policy: RuntimePolicy;
  status: RuntimeOpsStatus;
};

const ADMIN_RUNTIME_TIMEOUT_MS = 8_000;

function getAdminRuntimeBaseUrl() {
  if (!storefrontApiBaseUrl) {
    throw new Error('Storefront API base URL is not configured for admin runtime control.');
  }

  return storefrontApiBaseUrl.replace(/\/+$/, '');
}

async function createAdminHeaders() {
  const idTokenResult = await getCanopyTroveAuthIdTokenResult({
    forceRefresh: true,
  });
  if (!idTokenResult?.token) {
    throw new Error('Sign in with an internal admin account to use runtime controls.');
  }

  return new Headers({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${idTokenResult.token}`,
  });
}

async function requestAdminRuntimeJson<T>(pathname: string, init?: RequestInit) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, ADMIN_RUNTIME_TIMEOUT_MS);

  try {
    const headers = await createAdminHeaders();
    const response = await fetch(`${getAdminRuntimeBaseUrl()}${pathname}`, {
      ...init,
      headers,
      signal: controller.signal,
    });

    const rawText = await response.text();
    const payload = rawText ? (JSON.parse(rawText) as { error?: string } & T) : null;

    if (!response.ok) {
      throw new Error(
        payload?.error?.trim() || `Admin runtime request failed with ${response.status}.`,
      );
    }

    return payload as T;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Admin runtime request timed out.');
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export function hasConfiguredAdminRuntimeApi() {
  return Boolean(storefrontApiBaseUrl);
}

export function getAdminRuntimeConfigurationNote() {
  if (!storefrontApiBaseUrl) {
    return 'The backend API base URL is missing in this build.';
  }

  return null;
}

export function getAdminRuntimeStatus() {
  return requestAdminRuntimeJson<RuntimeOpsStatus>('/admin/runtime/status');
}

export function updateAdminRuntimePolicy(input: RuntimePolicyInput) {
  return requestAdminRuntimeJson<RuntimePolicy>('/admin/runtime/policy', {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export function evaluateAdminRuntimePolicy() {
  return requestAdminRuntimeJson<AdminRuntimeEvaluateResponse>('/admin/runtime/policy/evaluate', {
    method: 'POST',
  });
}

export function getAdminRuntimeMonitoringStatus() {
  return requestAdminRuntimeJson<RuntimeMonitoringStatus>('/admin/runtime/monitoring');
}

export function runAdminRuntimeMonitoringSweep() {
  return requestAdminRuntimeJson<RuntimeMonitoringStatus>('/admin/runtime/monitoring/run', {
    method: 'POST',
  });
}

export function getAdminRuntimeAlertStatus(devicePushToken?: string | null) {
  return requestAdminRuntimeJson<RuntimeAlertSubscriptionStatus>('/admin/runtime/alerts/status', {
    method: 'POST',
    body: JSON.stringify({
      devicePushToken: devicePushToken ?? undefined,
    }),
  });
}

export function syncAdminRuntimeAlerts(devicePushToken?: string | null) {
  return requestAdminRuntimeJson<RuntimeAlertSubscriptionStatus>('/admin/runtime/alerts/sync', {
    method: 'POST',
    body: JSON.stringify({
      devicePushToken: devicePushToken ?? undefined,
    }),
  });
}

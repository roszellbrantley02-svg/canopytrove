import { Platform } from 'react-native';
import { storefrontApiBaseUrl } from '../config/storefrontSourceConfig';
import { analyticsRuntimeState } from './analyticsRuntimeState';
import { captureMonitoringException } from './sentryMonitoringService';

type RuntimeErrorReport = {
  name?: string;
  message: string;
  stack?: string;
  isFatal?: boolean;
  source?: string;
  screen?: string;
};

type ErrorUtilsShape = {
  getGlobalHandler?: () => ((error: Error, isFatal?: boolean) => void) | undefined;
  setGlobalHandler?: (handler: (error: Error, isFatal?: boolean) => void) => void;
};

const REPORT_TIMEOUT_MS = 3_000;

let reportingInitialized = false;

type RuntimeReportingOptions = {
  captureToMonitoring?: boolean;
};

function createUrl() {
  if (!storefrontApiBaseUrl) {
    return null;
  }

  return `${storefrontApiBaseUrl.replace(/\/+$/, '')}/client-errors`;
}

async function postRuntimeReport(payload: RuntimeErrorReport) {
  const url = createUrl();
  if (!url) {
    return;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, REPORT_TIMEOUT_MS);

  try {
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...payload,
        platform: Platform.OS,
        reportedAt: new Date().toISOString(),
      }),
      signal: controller.signal,
    });
  } catch {
    // Runtime reporting must never block or crash the app.
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Returns true for errors that represent normal mid-flight cancellation
 * rather than a real failure. These are expected when:
 * - A screen unmounts while a fetch is in flight (React Navigation
 *   abort signal fires)
 * - A user pulls-to-refresh and the previous request is cancelled
 * - A debounced request gets superseded by a newer one
 *
 * Reporting these to Sentry/Cloud Logging creates noise that drowns
 * out real errors. Filtered out as of May 2 2026 after the
 * platform-error-log review.
 */
function isBenignCancellation(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (error.name === 'AbortError') return true;
  if (error.name === 'CanceledError') return true;
  // expo-fetch / fetch on RN sometimes throw this exact message text
  // for aborts that don't carry the AbortError name correctly.
  if (error.message === 'Aborted' || error.message === 'The operation was aborted.') {
    return true;
  }
  return false;
}

export function reportRuntimeError(
  error: unknown,
  context?: Omit<RuntimeErrorReport, 'message'>,
  options?: RuntimeReportingOptions,
) {
  const normalizedError =
    error instanceof Error
      ? error
      : new Error(typeof error === 'string' ? error : 'Unknown runtime error');

  // Drop benign abort-style errors at the source. Saves a Sentry
  // event + a backend log entry per cancelled request.
  if (isBenignCancellation(normalizedError)) {
    return;
  }

  if (options?.captureToMonitoring !== false) {
    captureMonitoringException(normalizedError, {
      source: context?.source,
      screen: context?.screen ?? analyticsRuntimeState.currentScreen ?? undefined,
      isFatal: context?.isFatal,
    });
  }

  void postRuntimeReport({
    name: context?.name ?? normalizedError.name,
    message: normalizedError.message || 'Unknown runtime error',
    stack: context?.stack ?? normalizedError.stack,
    isFatal: context?.isFatal,
    source: context?.source,
    screen: context?.screen ?? analyticsRuntimeState.currentScreen ?? undefined,
  });
}

export function initializeRuntimeReporting() {
  if (reportingInitialized) {
    return;
  }

  reportingInitialized = true;

  const errorUtils = (
    globalThis as typeof globalThis & {
      ErrorUtils?: ErrorUtilsShape;
    }
  ).ErrorUtils;

  const previousHandler = errorUtils?.getGlobalHandler?.();
  errorUtils?.setGlobalHandler?.((error, isFatal) => {
    reportRuntimeError(
      error,
      {
        isFatal,
        source: 'global-handler',
      },
      {
        captureToMonitoring: false,
      },
    );

    previousHandler?.(error, isFatal);
  });
}

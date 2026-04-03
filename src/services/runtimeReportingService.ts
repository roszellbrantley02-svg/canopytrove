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

export function reportRuntimeError(
  error: unknown,
  context?: Omit<RuntimeErrorReport, 'message'>,
  options?: RuntimeReportingOptions,
) {
  const normalizedError =
    error instanceof Error
      ? error
      : new Error(typeof error === 'string' ? error : 'Unknown runtime error');

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

import type { Express } from 'express';
import * as Sentry from '@sentry/node';

type BackendMonitoringContext = {
  source?: string;
  tags?: Record<string, string>;
  extras?: Record<string, unknown>;
};

function readConfiguredValue(value: string | null | undefined) {
  const normalizedValue = value?.trim();
  return normalizedValue ? normalizedValue : null;
}

function parseSampleRate(value: string | null | undefined, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    return fallback;
  }

  return parsed;
}

function normalizeError(error: unknown) {
  if (error instanceof Error) {
    return error;
  }

  return new Error(typeof error === 'string' ? error : 'Unknown backend error');
}

const sentryDsn = readConfiguredValue(process.env.SENTRY_DSN);
const sentryEnvironment =
  readConfiguredValue(process.env.SENTRY_ENVIRONMENT) ??
  process.env.NODE_ENV?.trim() ??
  'development';
const sentryTracesSampleRate = parseSampleRate(
  readConfiguredValue(process.env.SENTRY_TRACES_SAMPLE_RATE),
  process.env.NODE_ENV === 'production' ? 0.15 : 1,
);
const sentryLogsEnabled = readConfiguredValue(process.env.SENTRY_ENABLE_LOGS) === 'true';

let monitoringInitialized = false;
let processMonitoringInstalled = false;

export function isBackendMonitoringEnabled() {
  return Boolean(sentryDsn);
}

export function initializeBackendMonitoring() {
  if (monitoringInitialized || !sentryDsn) {
    return false;
  }

  Sentry.init({
    dsn: sentryDsn,
    environment: sentryEnvironment,
    tracesSampleRate: sentryTracesSampleRate,
    enableLogs: sentryLogsEnabled,
    sendDefaultPii: false,
  });

  Sentry.setTag('service', 'canopytrove-backend');
  monitoringInitialized = true;
  return true;
}

export function installBackendProcessMonitoring() {
  if (processMonitoringInstalled || !monitoringInitialized || !sentryDsn) {
    return;
  }

  process.on('uncaughtExceptionMonitor', (error) => {
    captureBackendException(error, {
      source: 'uncaught-exception',
    });
  });

  process.on('unhandledRejection', (reason) => {
    captureBackendException(reason, {
      source: 'unhandled-rejection',
    });
  });

  processMonitoringInstalled = true;
}

export function setupExpressErrorMonitoring(app: Express) {
  if (!monitoringInitialized || !sentryDsn) {
    return;
  }

  Sentry.setupExpressErrorHandler(app);
}

export function captureBackendException(error: unknown, context?: BackendMonitoringContext) {
  if (!monitoringInitialized || !sentryDsn) {
    return;
  }

  const normalizedError = normalizeError(error);

  try {
    Sentry.withScope((scope) => {
      if (context?.source) {
        scope.setTag('source', context.source);
      }

      for (const [key, value] of Object.entries(context?.tags ?? {})) {
        scope.setTag(key, value);
      }

      for (const [key, value] of Object.entries(context?.extras ?? {})) {
        scope.setExtra(key, value);
      }

      Sentry.captureException(normalizedError);
    });
  } catch {
    // Backend monitoring must never disrupt request handling.
  }
}

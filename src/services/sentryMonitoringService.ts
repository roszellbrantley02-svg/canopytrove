import type { ComponentType } from 'react';
import { analyticsRuntimeState } from './analyticsRuntimeState';

type MonitoringContext = {
  source?: string;
  screen?: string;
  isFatal?: boolean;
  tags?: Record<string, string>;
  extras?: Record<string, unknown>;
};

// Lazy-loaded Sentry SDK — keeps ~1MB out of the critical render path on web.
// The SDK is dynamically imported on first use so it doesn't block FCP/LCP.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
type SentryModule = typeof import('@sentry/react-native');
let _sentry: SentryModule | null = null;
let _sentryLoadPromise: Promise<SentryModule> | null = null;

function loadSentry(): Promise<SentryModule> {
  if (_sentry) return Promise.resolve(_sentry);
  if (!_sentryLoadPromise) {
    _sentryLoadPromise = import('@sentry/react-native').then((mod) => {
      _sentry = mod;
      return mod;
    });
  }
  return _sentryLoadPromise;
}

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

const sentryDsn = readConfiguredValue(process.env.EXPO_PUBLIC_SENTRY_DSN);
const sentryEnvironment =
  readConfiguredValue(process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT) ??
  (__DEV__ ? 'development' : 'production');
const sentryTracesSampleRate = parseSampleRate(
  readConfiguredValue(process.env.EXPO_PUBLIC_SENTRY_TRACES_SAMPLE_RATE),
  __DEV__ ? 1 : 0.15,
);
const sentryLogsEnabled =
  readConfiguredValue(process.env.EXPO_PUBLIC_SENTRY_ENABLE_LOGS) === 'true';

let sentryInitialized = false;

function normalizeError(error: unknown) {
  if (error instanceof Error) {
    return error;
  }

  return new Error(typeof error === 'string' ? error : 'Unknown runtime error');
}

export async function initializeSentryMonitoring() {
  if (sentryInitialized || !sentryDsn) {
    return;
  }

  const Sentry = await loadSentry();

  Sentry.init({
    dsn: sentryDsn,
    environment: sentryEnvironment,
    tracesSampleRate: sentryTracesSampleRate,
    enableLogs: sentryLogsEnabled,
    sendDefaultPii: false,
    debug: false,
  });

  Sentry.setTag('app', 'canopytrove');
  Sentry.setTag('runtime', 'expo');
  sentryInitialized = true;
}

export function isSentryMonitoringEnabled() {
  return Boolean(sentryDsn);
}

export function captureMonitoringException(error: unknown, context?: MonitoringContext) {
  if (!sentryInitialized || !_sentry || !sentryDsn) {
    return;
  }

  const Sentry = _sentry;
  const normalizedError = normalizeError(error);

  try {
    Sentry.withScope((scope) => {
      const screen = context?.screen ?? analyticsRuntimeState.currentScreen ?? undefined;
      if (screen) {
        scope.setTag('screen', screen);
      }

      if (context?.source) {
        scope.setTag('source', context.source);
      }

      if (typeof context?.isFatal === 'boolean') {
        scope.setTag('isFatal', String(context.isFatal));
      }

      for (const [key, value] of Object.entries(context?.tags ?? {})) {
        scope.setTag(key, value);
      }

      for (const [key, value] of Object.entries(context?.extras ?? {})) {
        scope.setExtra(key, value);
      }

      scope.setContext('runtime', {
        currentScreen: analyticsRuntimeState.currentScreen,
        currentSessionId: analyticsRuntimeState.currentSessionId,
        installId: analyticsRuntimeState.installId || undefined,
      });

      Sentry.captureException(normalizedError);
    });
  } catch {
    // Monitoring must never interfere with the app's recovery path.
  }
}

export function wrapAppWithSentry<T extends ComponentType<unknown>>(component: T) {
  // On web, skip wrapping — Sentry loads lazily after first render.
  // On native, Sentry.wrap() is applied once the SDK is ready.
  if (!_sentry) return component;
  return _sentry.wrap(component) as T;
}

type ClientRuntimeErrorReport = {
  name?: string;
  message: string;
  stack?: string;
  clientReportedFatal?: boolean;
  source?: string;
  screen?: string;
  platform?: string;
  reportedAt?: string;
};

import { logger } from '../observability/logger';
import { recordRuntimeIncident } from './runtimeOpsService';

export async function recordClientRuntimeError(
  report: ClientRuntimeErrorReport,
  ip: string | undefined,
  options?: {
    accountId?: string | null;
  },
) {
  const clientReportedFatal = report.clientReportedFatal ?? false;
  logger.error(
    JSON.stringify({
      type: 'client_runtime_error',
      ip: ip ?? null,
      accountId: options?.accountId ?? null,
      clientReportedFatal,
      platform: report.platform ?? null,
      screen: report.screen ?? null,
      source: report.source ?? null,
      reportedAt: report.reportedAt ?? new Date().toISOString(),
      name: report.name ?? 'Error',
      message: report.message,
      stack: report.stack ?? null,
    }),
  );

  await recordRuntimeIncident({
    kind: 'client',
    severity: 'warning',
    source: report.source ?? 'client-runtime',
    message: report.message,
    screen: report.screen ?? null,
    platform: report.platform ?? null,
    metadata: {
      ip: ip ?? null,
      accountId: options?.accountId ?? null,
      clientReportedFatal,
      name: report.name ?? 'Error',
      stack: report.stack ?? null,
      reportedAt: report.reportedAt ?? new Date().toISOString(),
    },
  });
}

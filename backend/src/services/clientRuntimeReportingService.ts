type ClientRuntimeErrorReport = {
  name?: string;
  message: string;
  stack?: string;
  isFatal?: boolean;
  source?: string;
  screen?: string;
  platform?: string;
  reportedAt?: string;
};

import { recordRuntimeIncident } from './runtimeOpsService';

export async function recordClientRuntimeError(
  report: ClientRuntimeErrorReport,
  ip: string | undefined
) {
  console.error(
    JSON.stringify({
      type: 'client_runtime_error',
      ip: ip ?? null,
      isFatal: report.isFatal ?? false,
      platform: report.platform ?? null,
      screen: report.screen ?? null,
      source: report.source ?? null,
      reportedAt: report.reportedAt ?? new Date().toISOString(),
      name: report.name ?? 'Error',
      message: report.message,
      stack: report.stack ?? null,
    })
  );

  await recordRuntimeIncident({
    kind: 'client',
    severity: report.isFatal ? 'critical' : 'warning',
    source: report.source ?? 'client-runtime',
    message: report.message,
    screen: report.screen ?? null,
    platform: report.platform ?? null,
    metadata: {
      ip: ip ?? null,
      name: report.name ?? 'Error',
      reportedAt: report.reportedAt ?? new Date().toISOString(),
    },
  });
}

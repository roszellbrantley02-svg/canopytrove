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

export function recordClientRuntimeError(report: ClientRuntimeErrorReport, ip: string | undefined) {
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
}

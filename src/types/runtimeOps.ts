export type RuntimeIncidentKind = 'client' | 'server' | 'security' | 'ops';

export type RuntimeIncidentSeverity = 'info' | 'warning' | 'critical';

export type RuntimeIncidentRecord = {
  id: string;
  kind: RuntimeIncidentKind;
  severity: RuntimeIncidentSeverity;
  source: string;
  message: string;
  path: string | null;
  screen: string | null;
  platform: string | null;
  requestId: string | null;
  fingerprint: string;
  occurredAt: string;
  metadata: Record<string, string | number | boolean | null>;
};

export type RuntimePolicyTrigger = 'automatic' | 'manual' | 'normal';

export type RuntimePolicy = {
  safeModeEnabled: boolean;
  ownerPortalWritesEnabled: boolean;
  promotionWritesEnabled: boolean;
  reviewRepliesEnabled: boolean;
  profileToolsWritesEnabled: boolean;
  updatedAt: string;
  reason: string | null;
  trigger: RuntimePolicyTrigger;
};

export type RuntimePolicyInput = Partial<
  Pick<
    RuntimePolicy,
    | 'safeModeEnabled'
    | 'ownerPortalWritesEnabled'
    | 'promotionWritesEnabled'
    | 'reviewRepliesEnabled'
    | 'profileToolsWritesEnabled'
  >
> & {
  reason?: string | null;
  trigger?: RuntimePolicyTrigger;
};

export type RuntimeIncidentCounts = {
  last15Minutes: number;
  criticalLast15Minutes: number;
  criticalLast24Hours: number;
  clientLast24Hours: number;
  serverLast24Hours: number;
};

export type RuntimeMonitoringTargetKind = 'website' | 'api' | 'custom';

export type RuntimeMonitoringTargetStatus = {
  id: string;
  label: string;
  url: string;
  kind: RuntimeMonitoringTargetKind;
  ok: boolean;
  statusCode: number | null;
  latencyMs: number | null;
  checkedAt: string;
  message: string;
};

export type RuntimeMonitoringStatus = {
  configured: boolean;
  schedulerEnabled: boolean;
  intervalMinutes: number;
  timeoutMs: number;
  alertWebhookConfigured: boolean;
  lastRunAt: string | null;
  lastSuccessfulRunAt: string | null;
  lastAlertAt: string | null;
  overallOk: boolean | null;
  healthyTargetCount: number;
  failingTargetCount: number;
  targets: RuntimeMonitoringTargetStatus[];
};

export type RuntimeAlertSubscriptionSource = 'owner_portal' | 'admin_runtime';

export type RuntimeAlertSubscriptionStatus = {
  source: RuntimeAlertSubscriptionSource;
  pushEnabled: boolean;
  updatedAt: string | null;
};

export type RuntimeOpsStatus = {
  policy: RuntimePolicy;
  incidentCounts: RuntimeIncidentCounts;
  recentIncidents: RuntimeIncidentRecord[];
  monitoring?: RuntimeMonitoringStatus | null;
};

export type RuntimeOpsPublicStatus = Pick<RuntimeOpsStatus, 'policy' | 'incidentCounts'> & {
  generatedAt: string;
};

export type RuntimeHealthMonitorCheckSeverity = 'info' | 'recommended' | 'required';

export type RuntimeHealthMonitorCheck = {
  name: string;
  ok: boolean;
  detail: string;
  severity?: RuntimeHealthMonitorCheckSeverity;
  observedAt?: string | null;
};

export type RuntimeHealthMonitorStatus = {
  ok: boolean;
  summary: string | null;
  updatedAt: string | null;
  lastSweepAt: string | null;
  targetUrl: string | null;
  checks: RuntimeHealthMonitorCheck[];
  notes: string[];
};

export type RuntimeHealthMonitorRunResponse = {
  ok: boolean;
  message: string;
  status: RuntimeHealthMonitorStatus;
};

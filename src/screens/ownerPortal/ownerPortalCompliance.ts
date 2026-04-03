import type { OwnerPortalWorkspaceDocument } from '../../types/ownerPortal';

export type OwnerPortalLicenseComplianceCheckItem = {
  id: string;
  label: string;
  completed: boolean;
  detail: string;
};

export type OwnerPortalLicenseComplianceDocument = {
  ownerUid?: string;
  dispensaryId?: string;
  licenseNumber: string;
  licenseType: string;
  state?: string | null;
  jurisdiction?: string | null;
  issuedAt: string | null;
  expiresAt: string | null;
  renewalWindowStartsAt: string | null;
  renewalWindowEndsAt?: string | null;
  renewalUrgentAt?: string | null;
  renewalSubmittedAt?: string | null;
  renewalStatus?: 'unknown' | 'active' | 'window_open' | 'urgent' | 'submitted' | 'expired';
  renewalSubmissionStatus?:
    | 'not_started'
    | 'draft'
    | 'submitted'
    | 'in_review'
    | 'approved'
    | 'rejected'
    | 'expired'
    | null;
  source?: 'owner_input' | 'admin_input' | 'verification_seed';
  notes?: string | null;
  lastReviewedAt?: string | null;
  lastReminderAt?: string | null;
  lastReminderSentAt?: string | null;
  lastReminderStage?:
    | '120_day'
    | '90_day'
    | '60_day'
    | '30_day'
    | '14_day'
    | '7_day'
    | 'expired'
    | null;
  checklist?: OwnerPortalLicenseComplianceCheckItem[];
  createdAt?: string;
  updatedAt?: string;
};

export type OwnerLicenseComplianceDocument = OwnerPortalLicenseComplianceDocument;

export type OwnerPortalWorkspaceWithCompliance = Omit<
  OwnerPortalWorkspaceDocument,
  'licenseCompliance'
> & {
  licenseCompliance: OwnerPortalLicenseComplianceDocument | null;
};

export type OwnerLicenseComplianceViewModelStage =
  | 'not_connected'
  | 'active'
  | 'renewal_window_open'
  | 'urgent'
  | 'submitted'
  | 'expired';

export type OwnerLicenseComplianceViewModel = {
  connected: boolean;
  stage: OwnerLicenseComplianceViewModelStage;
  statusLabel: string;
  statusBody: string;
  licenseIdentityLabel: string;
  primaryMetricValue: string;
  secondaryMetricValue: string;
  renewalWindowLabel: string;
  lastReminderLabel: string;
  lastReviewedLabel: string;
  lastUpdatedLabel: string;
  nextActionLabel: string;
  nextActionBody: string;
  progress: number;
  checklist: OwnerPortalLicenseComplianceCheckItem[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

function formatUtcDateLabel(iso: string | null | undefined) {
  if (!iso) {
    return 'Not set';
  }

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return 'Not set';
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function differenceInDays(fromIso: string, toIso: string) {
  const from = new Date(fromIso).getTime();
  const to = new Date(toIso).getTime();
  if (!Number.isFinite(from) || !Number.isFinite(to)) {
    return null;
  }

  return Math.floor((to - from) / DAY_MS);
}

function getNowIso() {
  return new Date().toISOString();
}

function createFallbackChecklist(): OwnerPortalLicenseComplianceCheckItem[] {
  return [
    {
      id: 'license-record',
      label: 'License record stored',
      completed: false,
      detail: 'Add a license record to begin tracking renewal timing.',
    },
    {
      id: 'renewal-window',
      label: 'Renewal window tracked',
      completed: false,
      detail: 'The tracker will calculate the NY renewal window automatically.',
    },
    {
      id: 'submission-plan',
      label: 'Submission plan ready',
      completed: false,
      detail: 'Use this workspace to stage notes, reminders, and renewal follow-up.',
    },
  ];
}

function deriveStage(compliance: OwnerPortalLicenseComplianceDocument | null, nowIso: string) {
  if (!compliance) {
    return 'not_connected' as const;
  }

  if (
    compliance.renewalStatus === 'submitted' ||
    compliance.renewalSubmissionStatus === 'submitted'
  ) {
    return 'submitted' as const;
  }

  if (compliance.renewalStatus === 'expired' || compliance.renewalSubmissionStatus === 'expired') {
    return 'expired' as const;
  }

  if (compliance.renewalStatus === 'urgent') {
    return 'urgent' as const;
  }

  if (compliance.renewalStatus === 'window_open') {
    return 'renewal_window_open' as const;
  }

  if (
    compliance.renewalSubmissionStatus === 'in_review' ||
    compliance.renewalSubmissionStatus === 'approved'
  ) {
    return 'submitted' as const;
  }

  if (!compliance.expiresAt) {
    return 'active' as const;
  }

  const daysUntilExpiry = differenceInDays(nowIso, compliance.expiresAt);
  if (daysUntilExpiry === null) {
    return 'active' as const;
  }

  if (daysUntilExpiry < 0) {
    return 'expired' as const;
  }

  if (daysUntilExpiry <= 60) {
    return 'urgent' as const;
  }

  if (daysUntilExpiry <= 120) {
    return 'renewal_window_open' as const;
  }

  return 'active' as const;
}

function buildPrimaryMetricValue(
  compliance: OwnerPortalLicenseComplianceDocument | null,
  stage: OwnerLicenseComplianceViewModelStage,
  nowIso: string,
) {
  if (!compliance?.expiresAt) {
    return 'Waiting on expiry date';
  }

  const daysUntilExpiry = differenceInDays(nowIso, compliance.expiresAt);
  if (daysUntilExpiry === null) {
    return 'Waiting on expiry date';
  }

  if (daysUntilExpiry < 0) {
    return 'Expired';
  }

  return `${daysUntilExpiry} days left`;
}

function buildSecondaryMetricValue(compliance: OwnerPortalLicenseComplianceDocument | null) {
  if (!compliance) {
    return 'Waiting on record';
  }

  if (compliance.renewalWindowStartsAt) {
    return formatUtcDateLabel(compliance.renewalWindowStartsAt);
  }

  if (compliance.expiresAt) {
    return formatUtcDateLabel(compliance.expiresAt);
  }

  return 'Waiting on date';
}

function buildNextActionLabel(stage: OwnerLicenseComplianceViewModelStage) {
  switch (stage) {
    case 'expired':
      return 'Resolve expiration';
    case 'urgent':
      return 'Submit renewal now';
    case 'renewal_window_open':
      return 'Prepare renewal submission';
    case 'submitted':
      return 'Track submission progress';
    case 'active':
      return 'Track renewal window';
    default:
      return 'Connect license record';
  }
}

function buildNextActionBody(stage: OwnerLicenseComplianceViewModelStage) {
  switch (stage) {
    case 'expired':
      return 'The tracked license has expired. Review the renewal record and move immediately.';
    case 'urgent':
      return 'The renewal deadline is close. Finish the packet and submit as soon as possible.';
    case 'renewal_window_open':
      return 'The NY renewal window is open. Review documents, reminders, and filing timing.';
    case 'submitted':
      return 'The renewal has been marked as submitted. Keep the record updated until the next cycle.';
    case 'active':
      return 'The license is active. Keep the next renewal date and supporting notes up to date.';
    default:
      return 'Add a license record to begin tracking renewal timing and reminders.';
  }
}

function buildStatusLabel(stage: OwnerLicenseComplianceViewModelStage) {
  switch (stage) {
    case 'expired':
      return 'Expired';
    case 'urgent':
      return 'Urgent';
    case 'renewal_window_open':
      return 'Renewal window open';
    case 'submitted':
      return 'Submitted';
    case 'active':
      return 'Active';
    default:
      return 'Not connected';
  }
}

function buildStatusBody(
  compliance: OwnerPortalLicenseComplianceDocument | null,
  stage: OwnerLicenseComplianceViewModelStage,
  nowIso: string,
) {
  if (!compliance) {
    return 'Connect a license record to start tracking renewal timing.';
  }

  if (stage === 'expired') {
    return `The tracked NY license expired on ${formatUtcDateLabel(compliance.expiresAt)}.`;
  }

  if (stage === 'urgent') {
    return `The tracked NY license expires on ${formatUtcDateLabel(compliance.expiresAt)}.`;
  }

  if (stage === 'renewal_window_open') {
    return `The NY renewal window opened on ${formatUtcDateLabel(compliance.renewalWindowStartsAt)}.`;
  }

  if (stage === 'submitted') {
    return `The renewal was marked as submitted on ${formatUtcDateLabel(compliance.renewalSubmittedAt ?? compliance.renewalWindowStartsAt ?? compliance.issuedAt)}.`;
  }

  return `The tracked NY license is active as of ${formatUtcDateLabel(nowIso)}.`;
}

function buildChecklist(compliance: OwnerPortalLicenseComplianceDocument | null) {
  if (!compliance) {
    return createFallbackChecklist();
  }

  if (compliance.checklist?.length) {
    return compliance.checklist;
  }

  return [
    {
      id: 'license-record',
      label: 'License record stored',
      completed: Boolean(compliance.licenseNumber && compliance.licenseType),
      detail: 'Keep the license number, type, and filing notes on file.',
    },
    {
      id: 'renewal-window',
      label: 'Renewal window tracked',
      completed: Boolean(compliance.renewalWindowStartsAt && compliance.expiresAt),
      detail: 'The NY renewal window is derived from the current expiration date.',
    },
    {
      id: 'submission-plan',
      label: 'Submission plan ready',
      completed:
        compliance.renewalSubmissionStatus === 'submitted' ||
        compliance.renewalSubmissionStatus === 'approved' ||
        compliance.renewalStatus === 'submitted',
      detail: 'Mark the renewal as submitted once the filing is complete.',
    },
  ];
}

function buildLastUpdatedLabel(compliance: OwnerPortalLicenseComplianceDocument | null) {
  if (!compliance) {
    return 'Last update: not recorded';
  }

  const sourceLabel =
    compliance.lastReviewedAt ??
    compliance.lastReminderSentAt ??
    compliance.lastReminderAt ??
    compliance.renewalWindowStartsAt ??
    compliance.issuedAt ??
    compliance.createdAt ??
    compliance.updatedAt ??
    null;

  return sourceLabel
    ? `Last update: ${formatUtcDateLabel(sourceLabel)}`
    : 'Last update: not recorded';
}

function buildProgress(
  compliance: OwnerPortalLicenseComplianceDocument | null,
  stage: OwnerLicenseComplianceViewModelStage,
  nowIso: string,
) {
  if (!compliance?.expiresAt) {
    return 0;
  }

  const expiresAt = new Date(compliance.expiresAt).getTime();
  const issuedAt = compliance.issuedAt ? new Date(compliance.issuedAt).getTime() : null;
  const now = new Date(nowIso).getTime();
  if (!Number.isFinite(expiresAt) || !Number.isFinite(now)) {
    return 0;
  }

  if (stage === 'expired') {
    return 100;
  }

  if (issuedAt !== null && Number.isFinite(issuedAt) && expiresAt > issuedAt) {
    const progress = ((now - issuedAt) / (expiresAt - issuedAt)) * 100;
    return Math.max(0, Math.min(100, progress));
  }

  if (stage === 'renewal_window_open') {
    return 68;
  }

  if (stage === 'urgent') {
    return 88;
  }

  if (stage === 'submitted') {
    return 82;
  }

  return 36;
}

function buildLicenseIdentityLabel(compliance: OwnerPortalLicenseComplianceDocument | null) {
  if (!compliance) {
    return 'License record not connected';
  }

  const licenseBits = [
    compliance.licenseType,
    compliance.licenseNumber,
    compliance.state ?? compliance.jurisdiction,
  ]
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter((value) => value.length > 0);

  return licenseBits.length ? licenseBits.join(' · ') : 'License record';
}

export function buildOwnerLicenseComplianceViewModel(
  workspace: OwnerPortalWorkspaceWithCompliance | null,
): OwnerLicenseComplianceViewModel {
  const nowIso = getNowIso();
  const compliance = workspace?.licenseCompliance ?? null;
  const stage = deriveStage(compliance, nowIso);

  return {
    connected: Boolean(compliance),
    stage,
    statusLabel: buildStatusLabel(stage),
    statusBody: buildStatusBody(compliance, stage, nowIso),
    licenseIdentityLabel: buildLicenseIdentityLabel(compliance),
    primaryMetricValue: buildPrimaryMetricValue(compliance, stage, nowIso),
    secondaryMetricValue: buildSecondaryMetricValue(compliance),
    renewalWindowLabel: compliance?.renewalWindowStartsAt
      ? `Window opens ${formatUtcDateLabel(compliance.renewalWindowStartsAt)}`
      : 'No renewal window yet',
    lastReminderLabel: compliance?.lastReminderSentAt
      ? `Last reminder: ${formatUtcDateLabel(compliance.lastReminderSentAt)}`
      : compliance?.lastReminderAt
        ? `Last reminder: ${formatUtcDateLabel(compliance.lastReminderAt)}`
        : 'Last reminder: not sent',
    lastReviewedLabel: compliance?.lastReviewedAt
      ? `Last review: ${formatUtcDateLabel(compliance.lastReviewedAt)}`
      : 'Last review: not recorded',
    lastUpdatedLabel: buildLastUpdatedLabel(compliance),
    nextActionLabel: buildNextActionLabel(stage),
    nextActionBody: buildNextActionBody(stage),
    progress: buildProgress(compliance, stage, nowIso),
    checklist: buildChecklist(compliance),
  };
}

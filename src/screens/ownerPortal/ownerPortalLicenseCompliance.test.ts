import { afterEach, describe, expect, it, vi } from 'vitest';
import type { OwnerPortalWorkspaceWithCompliance } from './ownerPortalCompliance';
import { buildOwnerLicenseComplianceViewModel } from './ownerPortalCompliance';

afterEach(() => {
  vi.useRealTimers();
});

function createWorkspace(
  compliance: NonNullable<OwnerPortalWorkspaceWithCompliance['licenseCompliance']>,
): OwnerPortalWorkspaceWithCompliance {
  return {
    ownerProfile: null,
    ownerClaim: null,
    storefrontSummary: null,
    metrics: {
      followerCount: 0,
      storefrontImpressions7d: 0,
      storefrontOpenCount7d: 0,
      routeStarts7d: 0,
      websiteTapCount7d: 0,
      phoneTapCount7d: 0,
      menuTapCount7d: 0,
      reviewCount30d: 0,
      openReportCount: 0,
      averageRating: null,
      replyRate: 0,
      openToRouteRate: 0,
      openToWebsiteRate: 0,
      openToPhoneRate: 0,
      openToMenuRate: 0,
    },
    patternFlags: [],
    recentReviews: [],
    recentReports: [],
    promotions: [],
    promotionPerformance: [],
    profileTools: null,
    ownerAlertStatus: {
      pushEnabled: false,
      updatedAt: null,
    },
    runtimeStatus: {
      policy: {
        safeModeEnabled: false,
      },
      incidentCounts: {
        criticalLast24Hours: 0,
        clientLast24Hours: 0,
      },
      openAiAvailable: false,
      sentryAvailable: false,
    } as any,
    licenseCompliance: compliance,
  };
}

describe('buildOwnerLicenseComplianceViewModel', () => {
  it('shows a fallback model when compliance data is not connected', () => {
    const viewModel = buildOwnerLicenseComplianceViewModel(null);

    expect(viewModel.connected).toBe(false);
    expect(viewModel.statusLabel).toBe('Not connected');
    expect(viewModel.checklist).toHaveLength(3);
  });

  it('derives a renewal-window-open model from workspace compliance data', () => {
    vi.setSystemTime(new Date('2026-03-30T12:00:00.000Z'));

    const viewModel = buildOwnerLicenseComplianceViewModel(
      createWorkspace({
        ownerUid: 'owner-1',
        dispensaryId: 'disp-1',
        licenseNumber: 'OCM-TEST-1001',
        licenseType: 'Adult-use retail dispensary',
        jurisdiction: 'NY',
        issuedAt: '2025-04-01T00:00:00.000Z',
        expiresAt: '2026-05-15T00:00:00.000Z',
        renewalWindowStartsAt: '2026-01-15T00:00:00.000Z',
        renewalUrgentAt: '2026-03-16T00:00:00.000Z',
        renewalStatus: 'window_open',
        renewalSubmittedAt: null,
        lastReminderSentAt: '2026-03-10T00:00:00.000Z',
        lastReminderStage: '90_day',
        source: 'verification_seed',
        notes: null,
        createdAt: '2025-04-01T00:00:00.000Z',
        updatedAt: '2026-03-20T00:00:00.000Z',
      }),
    );

    expect(viewModel.connected).toBe(true);
    expect(viewModel.stage).toBe('renewal_window_open');
    expect(viewModel.statusLabel).toBe('Renewal window open');
    expect(viewModel.primaryMetricValue).toContain('days left');
    expect(viewModel.nextActionLabel).toContain('Prepare');
  });

  it('marks an expired license as expired for immediate follow-up', () => {
    vi.setSystemTime(new Date('2026-06-01T12:00:00.000Z'));

    const viewModel = buildOwnerLicenseComplianceViewModel(
      createWorkspace({
        ownerUid: 'owner-2',
        dispensaryId: 'disp-2',
        licenseNumber: 'OCM-TEST-1002',
        licenseType: 'Adult-use retail dispensary',
        jurisdiction: 'NY',
        issuedAt: '2024-06-01T00:00:00.000Z',
        expiresAt: '2026-05-15T00:00:00.000Z',
        renewalWindowStartsAt: '2026-01-15T00:00:00.000Z',
        renewalUrgentAt: '2026-03-16T00:00:00.000Z',
        renewalStatus: 'expired',
        renewalSubmittedAt: null,
        lastReminderSentAt: null,
        lastReminderStage: null,
        source: 'verification_seed',
        notes: null,
        createdAt: '2024-06-01T00:00:00.000Z',
        updatedAt: '2026-05-16T00:00:00.000Z',
      }),
    );

    expect(viewModel.stage).toBe('expired');
    expect(viewModel.statusLabel).toBe('Expired');
    expect(viewModel.progress).toBe(100);
  });
});

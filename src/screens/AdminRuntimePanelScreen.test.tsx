import React from 'react';
import type { ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';
import { act, create } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const adminRuntimeMocks = vi.hoisted(() => ({
  evaluateAdminRuntimePolicy: vi.fn(),
  getAdminRuntimeAlertStatus: vi.fn(),
  getAdminRuntimeConfigurationNote: vi.fn(),
  getAdminRuntimeMonitoringStatus: vi.fn(),
  getAdminRuntimeStatus: vi.fn(),
  hasConfiguredAdminRuntimeApi: vi.fn(),
  runAdminRuntimeMonitoringSweep: vi.fn(),
  syncAdminRuntimeAlerts: vi.fn(),
  updateAdminRuntimePolicy: vi.fn(),
}));

const notificationMocks = vi.hoisted(() => ({
  getRegisteredOpsAlertPushToken: vi.fn(),
}));

vi.mock('react-native', () => ({
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  StyleSheet: {
    create: <T,>(styles: T): T => styles,
  },
  Text: 'Text',
  TextInput: 'TextInput',
  View: 'View',
}));

vi.mock('../components/MotionInView', () => ({
  MotionInView: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('../components/ScreenShell', () => ({
  ScreenShell: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('../components/SectionCard', () => ({
  SectionCard: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('../icons/AppUiIcon', () => ({
  AppUiIcon: 'AppUiIcon',
}));

vi.mock('./ownerPortal/ownerPortalStyles', () => ({
  ownerPortalStyles: new Proxy(
    {},
    {
      get: () => ({}),
    },
  ),
}));

vi.mock('./ownerPortal/OwnerPortalRuntimeStatusBanner', () => ({
  OwnerPortalRuntimeStatusBanner: () => null,
}));

vi.mock('../services/adminRuntimeService', () => ({
  evaluateAdminRuntimePolicy: adminRuntimeMocks.evaluateAdminRuntimePolicy,
  getAdminRuntimeAlertStatus: adminRuntimeMocks.getAdminRuntimeAlertStatus,
  getAdminRuntimeConfigurationNote: adminRuntimeMocks.getAdminRuntimeConfigurationNote,
  getAdminRuntimeMonitoringStatus: adminRuntimeMocks.getAdminRuntimeMonitoringStatus,
  getAdminRuntimeStatus: adminRuntimeMocks.getAdminRuntimeStatus,
  hasConfiguredAdminRuntimeApi: adminRuntimeMocks.hasConfiguredAdminRuntimeApi,
  runAdminRuntimeMonitoringSweep: adminRuntimeMocks.runAdminRuntimeMonitoringSweep,
  syncAdminRuntimeAlerts: adminRuntimeMocks.syncAdminRuntimeAlerts,
  updateAdminRuntimePolicy: adminRuntimeMocks.updateAdminRuntimePolicy,
}));

vi.mock('../services/opsAlertNotificationService', () => ({
  getRegisteredOpsAlertPushToken: notificationMocks.getRegisteredOpsAlertPushToken,
}));

import { AdminRuntimePanelScreen } from './AdminRuntimePanelScreen';

function flushEffects() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function findPressableByLabel(root: ReactTestInstance, label: string) {
  return root.find(
    (node) => String(node.type) === 'Pressable' && node.props.accessibilityLabel === label,
  );
}

describe('AdminRuntimePanelScreen', () => {
  let renderer: ReactTestRenderer | null = null;

  beforeEach(() => {
    renderer = null;
    vi.clearAllMocks();
    adminRuntimeMocks.hasConfiguredAdminRuntimeApi.mockReturnValue(true);
    adminRuntimeMocks.getAdminRuntimeConfigurationNote.mockReturnValue(null);
    notificationMocks.getRegisteredOpsAlertPushToken.mockResolvedValue(null);
    adminRuntimeMocks.getAdminRuntimeStatus.mockResolvedValue({
      policy: {
        safeModeEnabled: false,
        ownerPortalWritesEnabled: true,
        promotionWritesEnabled: true,
        reviewRepliesEnabled: true,
        profileToolsWritesEnabled: true,
        updatedAt: '2026-04-11T00:00:00.000Z',
        reason: null,
        trigger: 'normal',
      },
      incidentCounts: {
        last15Minutes: 1,
        criticalLast15Minutes: 0,
        criticalLast24Hours: 0,
        clientLast24Hours: 0,
        serverLast24Hours: 0,
      },
      recentIncidents: [],
    });
    adminRuntimeMocks.getAdminRuntimeMonitoringStatus.mockResolvedValue({
      configured: true,
      overallOk: true,
      healthyTargetCount: 2,
      failingTargetCount: 0,
      intervalMinutes: 5,
      timeoutMs: 2500,
      lastRunAt: '2026-04-11T00:00:00.000Z',
      targets: [
        {
          id: 'api',
          kind: 'api',
          label: 'API',
          url: 'https://api.canopytrove.com/health',
          ok: true,
          message: 'Healthy',
          latencyMs: 120,
          statusCode: 200,
          checkedAt: '2026-04-11T00:00:00.000Z',
        },
      ],
    });
    adminRuntimeMocks.getAdminRuntimeAlertStatus.mockResolvedValue({
      source: 'admin_runtime',
      pushEnabled: false,
      updatedAt: null,
    });
  });

  afterEach(() => {
    renderer?.unmount();
  });

  it('adds explicit accessibility labels to runtime controls and toggle switches', async () => {
    await act(async () => {
      renderer = create(<AdminRuntimePanelScreen />);
      await flushEffects();
      await flushEffects();
    });

    const root = renderer!.root;

    expect(findPressableByLabel(root, 'Run manual health sweep').props.accessibilityRole).toBe(
      'button',
    );
    expect(findPressableByLabel(root, 'Enable incident alerts').props.accessibilityRole).toBe(
      'button',
    );
    expect(findPressableByLabel(root, 'Enable protected mode').props.accessibilityRole).toBe(
      'button',
    );
    expect(findPressableByLabel(root, 'Resume normal mode').props.accessibilityRole).toBe(
      'button',
    );
    expect(
      findPressableByLabel(root, 'Re-evaluate from incident pressure').props.accessibilityRole,
    ).toBe('button');
    expect(findPressableByLabel(root, 'Apply current policy').props.accessibilityRole).toBe(
      'button',
    );
    expect(findPressableByLabel(root, 'Refresh runtime panel').props.accessibilityRole).toBe(
      'button',
    );

    expect(findPressableByLabel(root, 'Protected mode').props.accessibilityState).toEqual({
      checked: false,
    });
    expect(findPressableByLabel(root, 'Owner writes').props.accessibilityState).toEqual({
      checked: true,
    });
  });
});

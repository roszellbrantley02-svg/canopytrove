import React from 'react';
import { act, create } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

const workspaceMocks = vi.hoisted(() => ({
  useOwnerPortalWorkspace: vi.fn(),
}));

vi.mock('react-native', () => ({
  Platform: {
    OS: 'web' as const,
  },
  Pressable: 'Pressable',
  StyleSheet: {
    create: <T,>(styles: T): T => styles,
  },
  Text: 'Text',
  View: 'View',
}));

vi.mock('react-native-svg', () => ({
  __esModule: true,
  default: 'Svg',
  Circle: 'Circle',
  Line: 'Line',
  Path: 'Path',
  Rect: 'Rect',
}));

vi.mock('@react-navigation/native', () => ({
  useRoute: () => ({ params: {} }),
}));

vi.mock('../components/withScreenErrorBoundary', () => ({
  withScreenErrorBoundary: <T,>(Component: T) => Component,
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

vi.mock('../components/InlineFeedbackPanel', () => ({
  InlineFeedbackPanel: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));

vi.mock('./ownerPortal/useOwnerPortalWorkspace', () => ({
  useOwnerPortalWorkspace: workspaceMocks.useOwnerPortalWorkspace,
}));

import { OwnerPortalBadgesScreen } from './OwnerPortalBadgesScreen';

describe('OwnerPortalBadgesScreen', () => {
  it('renders locked owner badges without crashing on icon lookup', () => {
    workspaceMocks.useOwnerPortalWorkspace.mockReturnValue({
      workspace: {
        tier: 'verified',
        ownerProfile: {
          earnedBadgeIds: [],
          selectedBadgeIds: [],
          badgeLevel: 0,
        },
        profileTools: null,
      },
      isLoading: false,
      isSaving: false,
      errorText: null,
      saveBadgeDisplaySettings: vi.fn(),
    });

    expect(() => {
      act(() => {
        create(<OwnerPortalBadgesScreen />);
      });
    }).not.toThrow();
  });
});

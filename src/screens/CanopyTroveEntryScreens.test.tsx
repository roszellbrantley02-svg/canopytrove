import React from 'react';
import type * as ThemeTokensModule from '../theme/tokens';
import type { ReactTestRenderer } from 'react-test-renderer';
import { act, create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const navigationMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  replace: vi.fn(),
}));

const authMocks = vi.hoisted(() => ({
  signInCanopyTroveEmailPassword: vi.fn(),
  signUpCanopyTroveEmailPassword: vi.fn(),
}));

const analyticsMocks = vi.hoisted(() => ({
  trackAnalyticsEvent: vi.fn(),
}));

const memberEmailMocks = vi.hoisted(() => ({
  syncMemberEmailSubscription: vi.fn(),
}));

const runtimeReportingMocks = vi.hoisted(() => ({
  reportRuntimeError: vi.fn(),
}));

vi.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  TextInput: 'TextInput',
  Pressable: 'Pressable',
  KeyboardAvoidingView: 'KeyboardAvoidingView',
  Platform: {
    OS: 'web' as const,
  },
  StyleSheet: {
    create: <T,>(styles: T): T => styles,
  },
}));

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => navigationMocks,
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

vi.mock('../components/withScreenErrorBoundary', () => ({
  withScreenErrorBoundary: <T,>(Component: T) => Component,
}));

vi.mock('../icons/AppUiIcon', () => ({
  AppUiIcon: 'AppUiIcon',
}));

vi.mock('../config/ownerPortalConfig', () => ({
  ownerPortalAccessAvailable: true,
}));

vi.mock('../theme/tokens', async (importOriginal) => {
  const actual = await importOriginal<typeof ThemeTokensModule>();
  return {
    ...actual,
    colors: {
      ...actual.colors,
      textSoft: '#ccc',
      backgroundDeep: '#000',
    },
  };
});

vi.mock('../services/analyticsService', () => ({
  trackAnalyticsEvent: analyticsMocks.trackAnalyticsEvent,
}));

vi.mock('../services/canopyTroveAuthService', () => ({
  signInCanopyTroveEmailPassword: authMocks.signInCanopyTroveEmailPassword,
  signUpCanopyTroveEmailPassword: authMocks.signUpCanopyTroveEmailPassword,
}));

vi.mock('../services/memberEmailSubscriptionService', () => ({
  syncMemberEmailSubscription: memberEmailMocks.syncMemberEmailSubscription,
}));

vi.mock('../services/runtimeReportingService', () => ({
  reportRuntimeError: runtimeReportingMocks.reportRuntimeError,
}));

import { Pressable, Text } from 'react-native';
import { CanopyTroveSignInScreen } from './CanopyTroveSignInScreen';
import { CanopyTroveSignUpScreen } from './CanopyTroveSignUpScreen';

function renderNode(node: React.ReactElement) {
  let renderer: ReactTestRenderer;
  act(() => {
    renderer = create(node);
  });
  return { renderer: renderer!, root: renderer!.root };
}

function pressButtonByLabel(root: ReactTestRenderer['root'], label: string) {
  const button = root.findAllByType(Pressable).find((candidate) => {
    const buttonLabel = candidate.props.accessibilityLabel;
    if (buttonLabel === label) {
      return true;
    }

    const textValues = candidate
      .findAllByType(Text)
      .map((node) => node.props.children)
      .flat()
      .filter((value) => typeof value === 'string');

    return textValues.includes(label);
  });

  expect(button).toBeDefined();

  act(() => {
    button!.props.onPress();
  });
}

describe('Canopy Trove customer entry screens', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lets owners escape from member sign in to the owner portal', () => {
    const { root } = renderNode(<CanopyTroveSignInScreen />);

    pressButtonByLabel(root, 'Use owner portal');

    expect(navigationMocks.replace).toHaveBeenCalledWith('OwnerPortalSignIn');
  });

  it('lets owners escape from member sign up to the owner portal', () => {
    const { root } = renderNode(<CanopyTroveSignUpScreen />);

    pressButtonByLabel(root, 'Create owner account instead');

    expect(navigationMocks.replace).toHaveBeenCalledWith('OwnerPortalSignUp');
  });
});

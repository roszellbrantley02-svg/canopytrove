import React from 'react';
import type { ReactTestRenderer } from 'react-test-renderer';
import { act, create } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ageGateMocks = vi.hoisted(() => ({
  hasAcceptedAgeGate: vi.fn(),
  acceptAgeGate: vi.fn(),
}));

const appLifecycleMocks = vi.hoisted(() => ({
  useCanopyTroveFonts: vi.fn(),
  initializeAppCheck: vi.fn(() => Promise.resolve(false)),
  initializeAnalytics: vi.fn(() => Promise.resolve()),
  initializePostVisitPrompts: vi.fn(() => Promise.resolve()),
  primeAppBootstrap: vi.fn(() => Promise.resolve()),
  initializeRuntimeReporting: vi.fn(),
  getRuntimeOpsStatus: vi.fn(() => Promise.resolve(undefined)),
  migrateLegacyStorageNamespace: vi.fn(() => Promise.resolve()),
  initializeSentryMonitoring: vi.fn(),
}));

vi.mock('react-native', () => ({
  Animated: {
    View: 'AnimatedView',
    Value: class {
      value: number;

      constructor(value: number) {
        this.value = value;
      }

      setValue(nextValue: number) {
        this.value = nextValue;
      }

      stopAnimation(callback?: (value: number) => void) {
        callback?.(this.value);
      }

      interpolate() {
        return this;
      }
    },
    timing: () => ({
      start: (callback?: () => void) => callback?.(),
      stop: () => undefined,
    }),
  },
  StyleSheet: {
    create: <T,>(styles: T) => styles,
    absoluteFillObject: {},
  },
  Platform: {
    OS: 'web' as const,
    select: <T,>(options: { default?: T; web?: T }) => options.web ?? options.default,
  },
}));

vi.mock('expo-status-bar', () => ({
  StatusBar: 'StatusBar',
}));

vi.mock('react-native-gesture-handler', () => ({
  GestureHandlerRootView: 'GestureHandlerRootView',
}));

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: 'SafeAreaProvider',
}));

vi.mock('./src/screens/AgeGateScreen', () => ({
  AgeGateScreen: ({ onAccept }: { onAccept: () => void }) =>
    React.createElement('AgeGateScreen', { onAccept }),
}));

vi.mock('./src/components/AppBootScreen', () => ({
  AppBootScreen: () => React.createElement('AppBootScreen'),
}));

vi.mock('./src/navigation/RootNavigator', () => ({
  RootNavigator: () => React.createElement('RootNavigator'),
}));

vi.mock('./src/context/StorefrontController', () => ({
  StorefrontControllerProvider: ({ children }: { children: React.ReactNode }) =>
    React.createElement('StorefrontControllerProvider', null, children),
}));

vi.mock('./src/music/MusicPlayerContext', () => ({
  MusicPlayerProvider: ({ children }: { children: React.ReactNode }) =>
    React.createElement('MusicPlayerProvider', null, children),
  useMusicPlayer: () => ({
    isMusicEnabled: true,
    isReady: true,
    isSuppressed: false,
    suppressionReason: null,
    setMusicEnabled: () => undefined,
    toggleMusic: () => undefined,
  }),
}));

vi.mock('./src/components/AppErrorBoundary', () => ({
  AppErrorBoundary: ({ children }: { children: React.ReactNode }) =>
    React.createElement('AppErrorBoundary', null, children),
}));

vi.mock('./src/components/AnalyticsBridge', () => ({
  AnalyticsBridge: () => React.createElement('AnalyticsBridge'),
}));

vi.mock('./src/components/FavoriteDealNotificationBridge', () => ({
  FavoriteDealNotificationBridge: () => React.createElement('FavoriteDealNotificationBridge'),
}));

vi.mock('./src/components/GamificationRewardToastHost', () => ({
  GamificationRewardToastHost: () => React.createElement('GamificationRewardToastHost'),
}));

vi.mock('./src/services/ageGateService', () => ({
  hasAcceptedAgeGate: ageGateMocks.hasAcceptedAgeGate,
  acceptAgeGate: ageGateMocks.acceptAgeGate,
}));

vi.mock('./src/services/appBootstrapService', () => ({
  primeAppBootstrap: appLifecycleMocks.primeAppBootstrap,
}));

vi.mock('./src/services/appCheckService', () => ({
  initializeAppCheck: appLifecycleMocks.initializeAppCheck,
}));

vi.mock('./src/services/analyticsService', () => ({
  initializeAnalytics: appLifecycleMocks.initializeAnalytics,
}));

vi.mock('./src/services/postVisitPromptService', () => ({
  initializePostVisitPrompts: appLifecycleMocks.initializePostVisitPrompts,
}));

vi.mock('./src/services/runtimeReportingService', () => ({
  initializeRuntimeReporting: appLifecycleMocks.initializeRuntimeReporting,
}));

vi.mock('./src/services/runtimeOpsService', () => ({
  getRuntimeOpsStatus: appLifecycleMocks.getRuntimeOpsStatus,
}));

vi.mock('./src/services/storageMigrationService', () => ({
  migrateLegacyStorageNamespace: appLifecycleMocks.migrateLegacyStorageNamespace,
}));

vi.mock('./src/theme/fontSystem', () => ({
  useCanopyTroveFonts: appLifecycleMocks.useCanopyTroveFonts,
}));

vi.mock('./src/services/sentryMonitoringService', () => ({
  initializeSentryMonitoring: appLifecycleMocks.initializeSentryMonitoring,
  wrapAppWithSentry: <T,>(Component: T) => Component,
}));

import App, { MINIMUM_BOOT_DISPLAY_MS } from './App';

async function flushTimers(milliseconds: number) {
  await act(async () => {
    vi.advanceTimersByTime(milliseconds);
    await Promise.resolve();
  });
}

async function renderApp() {
  let renderer: ReactTestRenderer;

  await act(async () => {
    renderer = create(<App />);
    await Promise.resolve();
  });

  return renderer!;
}

describe('App entry flow', () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
    vi.clearAllMocks();
    ageGateMocks.hasAcceptedAgeGate.mockResolvedValue(false);
    ageGateMocks.acceptAgeGate.mockResolvedValue(undefined);
    appLifecycleMocks.useCanopyTroveFonts.mockReturnValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('holds the boot screen until the minimum delay elapses before showing the age gate', async () => {
    const renderer = await renderApp();

    expect(renderer.root.findAllByType('AppBootScreen')).toHaveLength(1);
    expect(renderer.root.findAllByType('RootNavigator')).toHaveLength(0);

    await flushTimers(MINIMUM_BOOT_DISPLAY_MS - 1);

    expect(renderer.root.findAllByType('AppBootScreen')).toHaveLength(1);
    expect(renderer.root.findAllByType('RootNavigator')).toHaveLength(0);

    await flushTimers(1);

    expect(renderer.root.findAllByType('AppBootScreen')).toHaveLength(0);
    expect(renderer.root.findAllByType('AgeGateScreen')).toHaveLength(1);
  });

  it('preloads the main app behind the boot screen for returning users who already passed the age gate', async () => {
    ageGateMocks.hasAcceptedAgeGate.mockResolvedValue(true);

    const renderer = await renderApp();

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(renderer.root.findAllByType('AppBootScreen')).toHaveLength(1);
    expect(renderer.root.findAllByType('AgeGateScreen')).toHaveLength(0);
    expect(renderer.root.findAllByType('RootNavigator')).toHaveLength(1);

    await flushTimers(MINIMUM_BOOT_DISPLAY_MS);

    expect(renderer.root.findAllByType('AgeGateScreen')).toHaveLength(0);
    expect(appLifecycleMocks.primeAppBootstrap).toHaveBeenCalledTimes(1);
  });

  it('enters the main app after the user accepts the age gate', async () => {
    const renderer = await renderApp();

    await flushTimers(MINIMUM_BOOT_DISPLAY_MS);

    const ageGate = renderer.root.findByType('AgeGateScreen');

    await act(async () => {
      ageGate.props.onAccept();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(ageGateMocks.acceptAgeGate).toHaveBeenCalledTimes(1);
    expect(renderer.root.findAllByType('RootNavigator')).toHaveLength(1);

    // primeAppBootstrap runs immediately after age-gate acceptance
    expect(appLifecycleMocks.primeAppBootstrap).toHaveBeenCalledTimes(1);

    // Analytics is deferred by 1500ms to free the main thread.
    expect(appLifecycleMocks.initializeAnalytics).not.toHaveBeenCalled();
    expect(appLifecycleMocks.initializePostVisitPrompts).not.toHaveBeenCalled();
    expect(appLifecycleMocks.getRuntimeOpsStatus).not.toHaveBeenCalled();

    await flushTimers(1500);

    expect(appLifecycleMocks.initializeAnalytics).toHaveBeenCalledTimes(1);
    expect(appLifecycleMocks.initializeRuntimeReporting).toHaveBeenCalledTimes(1);
    expect(appLifecycleMocks.initializePostVisitPrompts).not.toHaveBeenCalled();
    expect(appLifecycleMocks.getRuntimeOpsStatus).not.toHaveBeenCalled();

    // Post-visit prompts and runtime ops status stay deferred longer to protect first paint.
    await flushTimers(2500);

    expect(appLifecycleMocks.initializePostVisitPrompts).toHaveBeenCalledTimes(1);
    expect(appLifecycleMocks.getRuntimeOpsStatus).toHaveBeenCalledTimes(1);
  });

  it('does not block entry when age-gate persistence is slow', async () => {
    let resolveAcceptGate: (() => void) | null = null;
    ageGateMocks.acceptAgeGate.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveAcceptGate = resolve;
        }),
    );

    const renderer = await renderApp();

    await flushTimers(MINIMUM_BOOT_DISPLAY_MS);

    const ageGate = renderer.root.findByType('AgeGateScreen');

    await act(async () => {
      ageGate.props.onAccept();
      await Promise.resolve();
    });

    expect(renderer.root.findAllByType('RootNavigator')).toHaveLength(1);
    expect(renderer.root.findAllByType('AgeGateScreen')).toHaveLength(0);
    expect(ageGateMocks.acceptAgeGate).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveAcceptGate?.();
      await Promise.resolve();
    });

    expect(renderer.root.findAllByType('RootNavigator')).toHaveLength(1);
  });
});

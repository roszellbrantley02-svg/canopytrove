import React from 'react';
import { Animated, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AgeGateScreen } from './src/screens/AgeGateScreen';
import { AnalyticsBridge } from './src/components/AnalyticsBridge';
import { AppErrorBoundary } from './src/components/AppErrorBoundary';
import { GamificationRewardToastHost } from './src/components/GamificationRewardToastHost';
import { AppBootScreen } from './src/components/AppBootScreen';
import { StorefrontControllerProvider } from './src/context/StorefrontController';
import { MusicPlayerProvider } from './src/music/MusicPlayerContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { acceptAgeGate, hasAcceptedAgeGate } from './src/services/ageGateService';
import { initializeAppCheck } from './src/services/appCheckService';
import { primeAppBootstrap } from './src/services/appBootstrapService';
import { initializeAnalytics } from './src/services/analyticsService';
import { initializePostVisitPrompts } from './src/services/postVisitPromptService';
import { initializeRuntimeReporting } from './src/services/runtimeReportingService';
import { getRuntimeOpsStatus } from './src/services/runtimeOpsService';
import { initializeSentryMonitoring } from './src/services/sentryMonitoringService';
import { migrateLegacyStorageNamespace } from './src/services/storageMigrationService';
import { useCanopyTroveFonts } from './src/theme/fontSystem';

export const MINIMUM_BOOT_DISPLAY_MS = 800;
const CROSSFADE_DURATION_MS = 420;

type AppPhase = 'boot' | 'age-gate' | 'main';

function useAppPhase(
  fontsReady: boolean,
  ageGateStatus: 'checking' | 'required' | 'accepted',
): AppPhase {
  const [minimumBootElapsed, setMinimumBootElapsed] = React.useState(false);

  React.useEffect(() => {
    const timer = setTimeout(() => setMinimumBootElapsed(true), MINIMUM_BOOT_DISPLAY_MS);
    return () => clearTimeout(timer);
  }, []);

  if (!fontsReady || ageGateStatus === 'checking' || !minimumBootElapsed) {
    return 'boot';
  }

  return ageGateStatus === 'accepted' ? 'main' : 'age-gate';
}

function useCrossfade(visible: boolean) {
  // Lazy init: React re-evaluates the useRef argument every render, which
  // would allocate a throwaway Animated.Value each time. Using a ref with a
  // null sentinel + lazy populate avoids both the allocation AND the edge
  // case where the hook is passed a different initial visibility on remount.
  const opacityRef = React.useRef<Animated.Value | null>(null);
  if (opacityRef.current === null) {
    opacityRef.current = new Animated.Value(visible ? 1 : 0);
  }
  const opacity = opacityRef.current;

  // Track the latest visible value in a ref so the running animation can
  // re-decide its target mid-flight without closing over a stale value.
  const visibleRef = React.useRef(visible);
  visibleRef.current = visible;

  React.useEffect(() => {
    // Cancel any prior animation so we don't stack tweens — otherwise a
    // quick visible/invisible flip fires two .start() calls whose callbacks
    // race and the final opacity can settle on the wrong value.
    opacity.stopAnimation();
    const animation = Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: CROSSFADE_DURATION_MS,
      useNativeDriver: true,
    });
    animation.start();
    return () => {
      animation.stop();
    };
  }, [visible, opacity]);

  return opacity;
}

function App() {
  const fontsReady = useCanopyTroveFonts();
  const [ageGateStatus, setAgeGateStatus] = React.useState<'checking' | 'required' | 'accepted'>(
    'checking',
  );

  const phase = useAppPhase(fontsReady, ageGateStatus);
  const shouldRenderMain = fontsReady && ageGateStatus === 'accepted';

  const bootOpacity = useCrossfade(phase === 'boot');
  const ageGateOpacity = useCrossfade(phase === 'age-gate');
  const mainOpacity = useCrossfade(phase === 'main');

  React.useEffect(() => {
    let isActive = true;

    void (async () => {
      await migrateLegacyStorageNamespace();
      const didAcceptAgeGate = await hasAcceptedAgeGate();
      if (isActive) {
        setAgeGateStatus(didAcceptAgeGate ? 'accepted' : 'required');
      }
    })();

    return () => {
      isActive = false;
    };
  }, []);

  React.useEffect(() => {
    if (ageGateStatus !== 'accepted') {
      return;
    }

    // Prime storefront data immediately — it feeds the first visible screen.
    void primeAppBootstrap();

    // Kick off App Check attestation in the background. Token fetches
    // later (in the HTTP client) await completion if still in flight.
    // No-op on web and in dev clients without the native module.
    void initializeAppCheck();

    // Defer non-critical services so they don't compete with first render.
    // Tier 1 (1.5s): error monitoring + analytics — needed for all traffic.
    const tier1Handle = setTimeout(() => {
      void initializeSentryMonitoring();
      initializeRuntimeReporting();
      void initializeAnalytics();
    }, 1500);

    // Tier 2 (4s): features only useful for authenticated users — post-visit
    // prompts (location services), runtime ops status (owner portal).
    // These are heavier and anonymous browse traffic never needs them.
    const tier2Handle = setTimeout(() => {
      void initializePostVisitPrompts().catch(() => undefined);
      void getRuntimeOpsStatus({ force: true }).catch(() => undefined);
    }, 4000);

    return () => {
      clearTimeout(tier1Handle);
      clearTimeout(tier2Handle);
    };
  }, [ageGateStatus]);

  const handleAcceptAgeGate = React.useCallback(() => {
    setAgeGateStatus('accepted');
    void acceptAgeGate();
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StatusBar style="light" />

        {phase === 'boot' ? (
          <Animated.View style={[styles.layer, { opacity: bootOpacity }]} pointerEvents="auto">
            <AppBootScreen />
          </Animated.View>
        ) : null}

        {phase === 'age-gate' ? (
          <Animated.View
            style={[styles.layer, { opacity: ageGateOpacity }]}
            pointerEvents={phase === 'age-gate' ? 'auto' : 'none'}
          >
            {fontsReady ? <AgeGateScreen onAccept={handleAcceptAgeGate} /> : null}
          </Animated.View>
        ) : null}

        {shouldRenderMain ? (
          <Animated.View
            style={[styles.layer, { opacity: mainOpacity }]}
            pointerEvents={phase === 'main' ? 'auto' : 'none'}
          >
            <StorefrontControllerProvider>
              <MusicPlayerProvider>
                <AppErrorBoundary area="main-navigation">
                  <AnalyticsBridge />
                  <RootNavigator />
                  <GamificationRewardToastHost />
                </AppErrorBoundary>
              </MusicPlayerProvider>
            </StorefrontControllerProvider>
          </Animated.View>
        ) : null}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  layer: {
    ...StyleSheet.absoluteFillObject,
  },
});

export default App;

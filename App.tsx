import React from 'react';
import { Animated, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AgeGateScreen } from './src/screens/AgeGateScreen';
import { AnalyticsBridge } from './src/components/AnalyticsBridge';
import { AppErrorBoundary } from './src/components/AppErrorBoundary';
import { FavoriteDealNotificationBridge } from './src/components/FavoriteDealNotificationBridge';
import { GamificationRewardToastHost } from './src/components/GamificationRewardToastHost';
import { AppBootScreen } from './src/components/AppBootScreen';
import { StorefrontControllerProvider } from './src/context/StorefrontController';
import { RootNavigator } from './src/navigation/RootNavigator';
import { acceptAgeGate, hasAcceptedAgeGate } from './src/services/ageGateService';
import { primeAppBootstrap } from './src/services/appBootstrapService';
import { initializeAnalytics } from './src/services/analyticsService';
import { initializePostVisitPrompts } from './src/services/postVisitPromptService';
import { initializeRuntimeReporting } from './src/services/runtimeReportingService';
import { getRuntimeOpsStatus } from './src/services/runtimeOpsService';
import { initializeSentryMonitoring, wrapAppWithSentry } from './src/services/sentryMonitoringService';
import { migrateLegacyStorageNamespace } from './src/services/storageMigrationService';
import { useCanopyTroveFonts } from './src/theme/fontSystem';

initializeSentryMonitoring();

export const MINIMUM_BOOT_DISPLAY_MS = 2000;
const CROSSFADE_DURATION_MS = 420;

type AppPhase = 'boot' | 'age-gate' | 'main';

function useAppPhase(fontsReady: boolean, ageGateStatus: 'checking' | 'required' | 'accepted'): AppPhase {
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
  const opacity = React.useRef(new Animated.Value(visible ? 1 : 0)).current;

  React.useEffect(() => {
    Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: CROSSFADE_DURATION_MS,
      useNativeDriver: true,
    }).start();
  }, [visible, opacity]);

  return opacity;
}

function App() {
  const fontsReady = useCanopyTroveFonts();
  const [ageGateStatus, setAgeGateStatus] = React.useState<'checking' | 'required' | 'accepted'>(
    'checking'
  );

  const phase = useAppPhase(fontsReady, ageGateStatus);

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

    initializeRuntimeReporting();

    void Promise.all([
      initializeAnalytics(),
      initializePostVisitPrompts().catch(() => undefined),
      primeAppBootstrap(),
      getRuntimeOpsStatus({ force: true }).catch(() => undefined),
    ]);
  }, [ageGateStatus]);

  const handleAcceptAgeGate = React.useCallback(() => {
    void acceptAgeGate().then(() => {
      setAgeGateStatus('accepted');
    });
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

        {phase === 'age-gate' || phase === 'boot' ? (
          <Animated.View
            style={[styles.layer, { opacity: ageGateOpacity }]}
            pointerEvents={phase === 'age-gate' ? 'auto' : 'none'}
          >
            {fontsReady ? <AgeGateScreen onAccept={handleAcceptAgeGate} /> : null}
          </Animated.View>
        ) : null}

        {phase === 'main' || phase === 'age-gate' ? (
          <Animated.View
            style={[styles.layer, { opacity: mainOpacity }]}
            pointerEvents={phase === 'main' ? 'auto' : 'none'}
          >
            {ageGateStatus === 'accepted' ? (
              <StorefrontControllerProvider>
                <AppErrorBoundary area="main-navigation">
                  <AnalyticsBridge />
                  <FavoriteDealNotificationBridge />
                  <RootNavigator />
                  <GamificationRewardToastHost />
                </AppErrorBoundary>
              </StorefrontControllerProvider>
            ) : null}
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

export default wrapAppWithSentry(App);

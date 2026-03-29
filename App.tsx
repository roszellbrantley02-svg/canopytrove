import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AgeGateScreen } from './src/screens/AgeGateScreen';
import { AnalyticsBridge } from './src/components/AnalyticsBridge';
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
import { migrateLegacyStorageNamespace } from './src/services/storageMigrationService';

export default function App() {
  const [ageGateStatus, setAgeGateStatus] = React.useState<'checking' | 'required' | 'accepted'>(
    'checking'
  );

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
    ]);
  }, [ageGateStatus]);

  const handleAcceptAgeGate = React.useCallback(() => {
    void acceptAgeGate().then(() => {
      setAgeGateStatus('accepted');
    });
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        {ageGateStatus === 'checking' ? <AppBootScreen /> : null}
        {ageGateStatus === 'required' ? <AgeGateScreen onAccept={handleAcceptAgeGate} /> : null}
        {ageGateStatus === 'accepted' ? (
          <StorefrontControllerProvider>
            <AnalyticsBridge />
            <FavoriteDealNotificationBridge />
            <RootNavigator />
            <GamificationRewardToastHost />
          </StorefrontControllerProvider>
        ) : null}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

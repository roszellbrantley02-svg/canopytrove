import React, { Suspense } from 'react';
import type { NavigationContainerRef } from '@react-navigation/native';
import { getPathFromState, NavigationContainer } from '@react-navigation/native';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { CanopyTroveTabBar } from '../components/CanopyTroveTabBar';
import { PostVisitPromptHost } from '../components/PostVisitPromptHost';
import { colors } from '../theme/tokens';

/* Notification bridges use expo-notifications which has no web implementation.
   Lazy-require on native only to prevent bundler errors on web. */
/* eslint-disable @typescript-eslint/no-require-imports */
const NotificationResponseBridge =
  Platform.OS !== 'web'
    ? require('../components/NotificationResponseBridge').NotificationResponseBridge
    : () => null;

const FavoriteDealNotificationBridge =
  Platform.OS !== 'web'
    ? require('../components/FavoriteDealNotificationBridge').FavoriteDealNotificationBridge
    : () => null;
/* eslint-enable @typescript-eslint/no-require-imports */

import { trackScreenView } from '../services/analyticsService';
import { navigationTheme } from '../theme/navigationTheme';
import { motion } from '../theme/tokens';
import type { RootStackParamList } from './rootNavigatorConfig';
import {
  Stack,
  Tab,
  stackNavigatorScreenOptions,
  stackScreens,
  tabNavigatorScreenOptions,
  tabScreens,
} from './rootNavigatorConfig';
import { linkingConfig } from './linkingConfig';
import { getActiveRouteName } from './rootNavigatorTracking';
import { syncWebRouteMetadata } from './webRouteMetadata';

export type { RootStackParamList, RootTabParamList } from './rootNavigatorConfig';

function getCurrentWebPath(
  state: Parameters<
    NonNullable<React.ComponentProps<typeof NavigationContainer>['onStateChange']>
  >[0],
): string {
  if (Platform.OS !== 'web') {
    return '/';
  }

  const pathFromState = state ? getPathFromState(state, linkingConfig.config) : null;
  const fallbackPath = typeof window !== 'undefined' ? window.location.pathname : '/';
  const rawPath = pathFromState || fallbackPath;

  if (!rawPath) {
    return '/';
  }

  const withoutQuery = rawPath.split(/[?#]/, 1)[0] || '/';
  const withLeadingSlash = withoutQuery.startsWith('/') ? withoutQuery : `/${withoutQuery}`;
  const collapsed = withLeadingSlash.replace(/\/{2,}/g, '/');

  if (collapsed.length > 1 && collapsed.endsWith('/')) {
    return collapsed.slice(0, -1);
  }

  return collapsed;
}

function TabsNavigator() {
  return (
    <Tab.Navigator
      detachInactiveScreens={false}
      tabBar={(props) => <CanopyTroveTabBar {...props} />}
      screenOptions={tabNavigatorScreenOptions}
    >
      {tabScreens.map((screen) => (
        <Tab.Screen key={screen.name} name={screen.name} component={screen.component} />
      ))}
    </Tab.Navigator>
  );
}

const fallbackStyles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    paddingBottom: 48,
  },
  indicator: {
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSoft,
    letterSpacing: 0.4,
  },
});

/* Suspense fallback shown while lazy-loaded screens are being fetched.
   Branded shell with subtle text so transitions feel intentional. */
function ScreenLoadingFallback() {
  return (
    <View style={fallbackStyles.container}>
      <ActivityIndicator size="small" color={colors.accent} style={fallbackStyles.indicator} />
      <Text style={fallbackStyles.label}>Loading</Text>
    </View>
  );
}

export function RootNavigator() {
  const navigationRef = React.useRef<NavigationContainerRef<RootStackParamList>>(null);
  const routeNameRef = React.useRef<string | null>(null);
  const [navigationReady, setNavigationReady] = React.useState(false);

  // Reset routeNameRef on mount/unmount to prevent duplicate analytics events
  React.useEffect(() => {
    return () => {
      routeNameRef.current = null;
    };
  }, []);

  return (
    <NavigationContainer
      ref={navigationRef}
      linking={linkingConfig}
      theme={navigationTheme}
      onReady={() => {
        const activeRouteName = navigationRef.current?.getCurrentRoute()?.name ?? null;
        const currentRoute = navigationRef.current?.getCurrentRoute();
        syncWebRouteMetadata(getCurrentWebPath(navigationRef.current?.getRootState()), {
          name: currentRoute?.name,
          params: currentRoute?.params,
        });
        routeNameRef.current = activeRouteName;
        setNavigationReady(true);
        if (activeRouteName) {
          trackScreenView(activeRouteName);
        }
      }}
      onStateChange={(state) => {
        const activeRouteName = getActiveRouteName(state);
        const currentRoute = navigationRef.current?.getCurrentRoute();
        syncWebRouteMetadata(getCurrentWebPath(state), {
          name: currentRoute?.name,
          params: currentRoute?.params,
        });
        if (!activeRouteName || routeNameRef.current === activeRouteName) {
          return;
        }

        routeNameRef.current = activeRouteName;
        trackScreenView(activeRouteName);
      }}
    >
      <Suspense fallback={<ScreenLoadingFallback />}>
        <Stack.Navigator screenOptions={stackNavigatorScreenOptions}>
          <Stack.Screen
            name="Tabs"
            component={TabsNavigator}
            options={{
              animation: 'fade',
              animationDuration: motion.quick,
            }}
          />
          {stackScreens
            .filter((screen) => screen.name !== 'Tabs')
            .map((screen) => (
              <Stack.Screen
                key={screen.name}
                name={screen.name as keyof RootStackParamList}
                component={screen.component as React.ComponentType<object>}
                options={screen.options}
              />
            ))}
        </Stack.Navigator>
      </Suspense>
      <NotificationResponseBridge navigationReady={navigationReady} navigationRef={navigationRef} />
      <FavoriteDealNotificationBridge />
      <PostVisitPromptHost navigationRef={navigationRef} />
    </NavigationContainer>
  );
}

import React from 'react';
import type { NavigationContainerRef } from '@react-navigation/native';
import { NavigationContainer } from '@react-navigation/native';
import { CanopyTroveTabBar } from '../components/CanopyTroveTabBar';
import { FavoriteDealNotificationBridge } from '../components/FavoriteDealNotificationBridge';
import { NotificationResponseBridge } from '../components/NotificationResponseBridge';
import { PostVisitPromptHost } from '../components/PostVisitPromptHost';
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

export type { RootStackParamList, RootTabParamList } from './rootNavigatorConfig';

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

export function RootNavigator() {
  const navigationRef = React.useRef<NavigationContainerRef<RootStackParamList>>(null);
  const routeNameRef = React.useRef<string | null>(null);
  const [navigationReady, setNavigationReady] = React.useState(false);

  return (
    <NavigationContainer
      ref={navigationRef}
      linking={linkingConfig}
      theme={navigationTheme}
      onReady={() => {
        const activeRouteName = navigationRef.current?.getCurrentRoute()?.name ?? null;
        routeNameRef.current = activeRouteName;
        setNavigationReady(true);
        if (activeRouteName) {
          trackScreenView(activeRouteName);
        }
      }}
      onStateChange={(state) => {
        const activeRouteName = getActiveRouteName(state);
        if (!activeRouteName || routeNameRef.current === activeRouteName) {
          return;
        }

        routeNameRef.current = activeRouteName;
        trackScreenView(activeRouteName);
      }}
    >
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
              name={screen.name}
              component={screen.component}
              options={screen.options}
            />
          ))}
      </Stack.Navigator>
      <NotificationResponseBridge navigationReady={navigationReady} navigationRef={navigationRef} />
      <FavoriteDealNotificationBridge />
      <PostVisitPromptHost navigationRef={navigationRef} />
    </NavigationContainer>
  );
}

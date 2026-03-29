import React from 'react';
import {
  NavigationContainer,
  NavigationContainerRef,
} from '@react-navigation/native';
import { CanopyTroveTabBar } from '../components/CanopyTroveTabBar';
import { PostVisitPromptHost } from '../components/PostVisitPromptHost';
import { trackScreenView } from '../services/analyticsService';
import { navigationTheme } from '../theme/navigationTheme';
import { motion } from '../theme/tokens';
import {
  RootStackParamList,
  Stack,
  Tab,
  stackNavigatorScreenOptions,
  stackScreens,
  tabNavigatorScreenOptions,
  tabScreens,
} from './rootNavigatorConfig';
import { getActiveRouteName } from './rootNavigatorTracking';

export type { RootStackParamList, RootTabParamList } from './rootNavigatorConfig';

function TabsNavigator() {
  return (
    <Tab.Navigator
      detachInactiveScreens={true}
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

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={navigationTheme}
      onReady={() => {
        const activeRouteName = navigationRef.current?.getCurrentRoute()?.name ?? null;
        routeNameRef.current = activeRouteName;
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
      <Stack.Navigator
        screenOptions={stackNavigatorScreenOptions}
      >
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
      <PostVisitPromptHost navigationRef={navigationRef} />
    </NavigationContainer>
  );
}

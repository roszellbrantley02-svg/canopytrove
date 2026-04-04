import React from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppTabIcon } from '../icons/AppTabIcons';
import { HapticPressable } from './HapticPressable';
import { colors, fontFamilies, motion, radii, spacing, textStyles } from '../theme/tokens';
import type { RootTabParamList } from '../navigation/RootNavigator';

const TAB_LABELS: Record<keyof RootTabParamList, string> = {
  Nearby: 'Nearby',
  Browse: 'Browse',
  HotDeals: 'Specials',
  Profile: 'Profile',
};

const TAB_ICONS: Record<keyof RootTabParamList, 'nearby' | 'browse' | 'hotDeals' | 'profile'> = {
  Nearby: 'nearby',
  Browse: 'browse',
  HotDeals: 'hotDeals',
  Profile: 'profile',
};

const HOT_DEALS_TAB_COLOR = '#F5C86A';

type TabBarItemProps = {
  accessibilityLabel?: string;
  focused: boolean;
  label: string;
  iconName: 'nearby' | 'browse' | 'hotDeals' | 'profile';
  accentColor?: string;
  onLongPress: () => void;
  onPress: () => void;
  routeKey: string;
  testID?: string;
};

function TabBarItem({
  accessibilityLabel,
  focused,
  label,
  iconName,
  accentColor,
  onLongPress,
  onPress,
  routeKey,
  testID,
}: TabBarItemProps) {
  const focusProgress = React.useRef(new Animated.Value(focused ? 1 : 0)).current;

  React.useEffect(() => {
    const animation = Animated.spring(focusProgress, {
      toValue: focused ? 1 : 0,
      stiffness: 260,
      damping: 24,
      mass: 0.9,
      useNativeDriver: true,
    });

    animation.start();

    return () => {
      animation.stop();
    };
  }, [focusProgress, focused]);

  return (
    <HapticPressable
      key={routeKey}
      accessibilityRole="button"
      accessibilityState={focused ? { selected: true } : {}}
      accessibilityLabel={accessibilityLabel}
      hapticType={focused ? undefined : 'selection'}
      testID={testID}
      onLongPress={onLongPress}
      onPress={onPress}
      style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
    >
      <Animated.View
        style={[
          styles.itemChrome,
          focused && styles.itemChromeFocused,
          focused && accentColor
            ? { borderColor: `${accentColor}1A`, backgroundColor: `${accentColor}08` }
            : undefined,
          {
            transform: [
              {
                translateY: focusProgress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -2],
                }),
              },
              {
                scale: focusProgress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 1.01],
                }),
              },
            ],
          },
        ]}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            styles.itemGlow,
            styles.itemGlowFocused,
            {
              opacity: focusProgress.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 1],
              }),
            },
          ]}
        />
        <Animated.View
          style={[
            styles.iconPlate,
            focused && styles.iconPlateFocused,
            focused && accentColor
              ? { borderColor: `${accentColor}44`, ...styles.iconPlateAccent }
              : undefined,
            {
              transform: [
                {
                  scale: focusProgress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.04],
                  }),
                },
              ],
            },
          ]}
        >
          <Animated.View
            style={[
              styles.iconShadow,
              styles.iconShadowFocused,
              accentColor ? { backgroundColor: `${accentColor}0D` } : undefined,
              {
                opacity: focusProgress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 1],
                }),
              },
            ]}
          />
          <AppTabIcon
            name={iconName}
            size={focused ? 27 : 23}
            focused={focused}
            accentColor={accentColor}
          />
        </Animated.View>
        <Animated.Text
          style={[
            styles.label,
            focused ? styles.labelFocused : styles.labelIdle,
            {
              opacity: focusProgress.interpolate({
                inputRange: [0, 1],
                outputRange: [0.72, 1],
              }),
              transform: [
                {
                  translateY: focusProgress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [2, 0],
                  }),
                },
              ],
            },
          ]}
        >
          {label}
        </Animated.Text>
        <Animated.View
          style={[
            styles.focusPip,
            accentColor ? { backgroundColor: accentColor, shadowColor: accentColor } : undefined,
            {
              opacity: focusProgress,
              transform: [
                {
                  scaleX: focusProgress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.6, 1],
                  }),
                },
              ],
            },
          ]}
        />
      </Animated.View>
    </HapticPressable>
  );
}

export function CanopyTroveTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const bottomOffset = Math.max(insets.bottom + spacing.xs, spacing.lg);
  const barProgress = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const animation = Animated.timing(barProgress, {
      toValue: 1,
      duration: motion.standard,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });

    animation.start();

    return () => {
      animation.stop();
    };
  }, [barProgress]);

  return (
    <View pointerEvents="box-none" style={styles.shell}>
      <Animated.View
        style={[
          styles.barMotion,
          {
            bottom: bottomOffset,
            opacity: barProgress.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 1],
            }),
            transform: [
              {
                translateY: barProgress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [18, 0],
                }),
              },
              {
                scale: barProgress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.98, 1],
                }),
              },
            ],
          },
        ]}
      >
        <LinearGradient
          colors={['rgba(5, 10, 14, 0.98)', 'rgba(12, 20, 27, 0.95)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.bar}
        >
          <View pointerEvents="none" style={styles.barHighlight} />
          {state.routes.map((route, index) => {
            const routeName = route.name as keyof RootTabParamList;
            const focused = state.index === index;
            const { options } = descriptors[route.key];

            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });

              if (!focused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            };

            const onLongPress = () => {
              navigation.emit({
                type: 'tabLongPress',
                target: route.key,
              });
            };

            return (
              <TabBarItem
                key={route.key}
                accessibilityLabel={options.tabBarAccessibilityLabel}
                focused={focused}
                iconName={TAB_ICONS[routeName]}
                label={TAB_LABELS[routeName]}
                accentColor={routeName === 'HotDeals' ? HOT_DEALS_TAB_COLOR : undefined}
                onLongPress={onLongPress}
                onPress={onPress}
                routeKey={route.key}
                testID={options.tabBarButtonTestID}
              />
            );
          })}
        </LinearGradient>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 40,
  },
  barMotion: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xs + 2,
    paddingBottom: spacing.xs + 2,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    shadowColor: colors.shadow,
    shadowOpacity: 0.38,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 14 },
    elevation: 16,
    overflow: 'hidden',
  },
  barHighlight: {
    position: 'absolute',
    top: 0,
    left: 20,
    right: 20,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
  },
  item: {
    flex: 1,
    minHeight: 60,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs + 1,
    paddingVertical: 0,
  },
  itemPressed: {
    opacity: 0.92,
  },
  itemChrome: {
    alignSelf: 'stretch',
    minHeight: 56,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: 'transparent',
    overflow: 'hidden',
    position: 'relative',
    paddingTop: spacing.xs + 1,
    paddingBottom: spacing.sm + 2,
  },
  itemChromeFocused: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderColor: 'rgba(143, 255, 209, 0.10)',
  },
  itemGlow: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  itemGlowFocused: {
    backgroundColor: 'rgba(0, 245, 140, 0.04)',
  },
  iconPlate: {
    width: 44,
    height: 44,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(143, 255, 209, 0.10)',
    backgroundColor: 'rgba(11, 19, 25, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.shadow,
    shadowOpacity: 0.24,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },
  iconPlateAccent: {
    backgroundColor: 'rgba(9, 17, 22, 1)',
  },
  iconPlateFocused: {
    backgroundColor: 'rgba(9, 17, 22, 1)',
    borderColor: 'rgba(245, 200, 106, 0.28)',
    shadowColor: colors.primary,
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  iconShadow: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: 15,
    backgroundColor: 'transparent',
  },
  iconShadowFocused: {
    backgroundColor: 'rgba(245, 200, 106, 0.05)',
  },
  label: {
    ...textStyles.caption,
    fontFamily: fontFamilies.bodyBold,
    fontSize: 10,
    letterSpacing: 0.15,
  },
  labelFocused: {
    color: colors.text,
  },
  labelIdle: {
    color: 'rgba(169, 185, 180, 0.64)',
  },
  focusPip: {
    position: 'absolute',
    bottom: spacing.xs + 1,
    width: 16,
    height: 2,
    borderRadius: radii.pill,
    backgroundColor: colors.gold,
    shadowColor: colors.gold,
    shadowOpacity: 0.32,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
});

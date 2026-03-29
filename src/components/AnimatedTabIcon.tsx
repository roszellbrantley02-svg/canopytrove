import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, typography } from '../theme/tokens';

type AnimatedTabIconProps = {
  focused: boolean;
  iconName: 'navigate-circle' | 'compass' | 'map' | 'person-circle';
  label: string;
};

export function AnimatedTabIcon({
  focused,
  iconName,
  label,
}: AnimatedTabIconProps) {
  const progress = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: focused ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });

    animation.start();

    return () => {
      animation.stop();
    };
  }, [focused, progress]);

  return (
    <Animated.View
      style={[
        styles.wrap,
        {
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [0, -2],
              }),
            },
            {
              scale: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 1.05],
              }),
            },
          ],
        },
      ]}
    >
      <Animated.View
        style={[
          styles.plate,
          {
            opacity: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [0.3, 1],
            }),
          },
        ]}
      >
        <View
          style={[
            styles.glow,
            focused ? styles.glowFocused : styles.glowIdle,
          ]}
        >
          <Ionicons
            name={iconName}
            size={focused ? 20 : 18}
            color={focused ? colors.primary : colors.textSoft}
          />
        </View>
      </Animated.View>
      <Text style={[styles.label, focused ? styles.labelFocused : styles.labelIdle]}>
        {label}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    minWidth: 66,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  plate: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    minWidth: 42,
    height: 34,
    borderRadius: radii.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  glowFocused: {
    backgroundColor: 'rgba(0,245,140,0.12)',
    borderColor: 'rgba(0,245,140,0.24)',
  },
  glowIdle: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderColor: 'rgba(255,255,255,0.06)',
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    lineHeight: typography.caption + 2,
    letterSpacing: 0.4,
  },
  labelFocused: {
    color: colors.primary,
  },
  labelIdle: {
    color: colors.textSoft,
  },
});

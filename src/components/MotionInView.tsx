import type { PropsWithChildren } from 'react';
import React, { useEffect, useRef } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Animated, Easing, Platform, View } from 'react-native';
import { motion } from '../theme/tokens';
import { useReducedMotion } from '../hooks/useReducedMotion';

const isWeb = Platform.OS === 'web';

type MotionInViewProps = PropsWithChildren<{
  delay?: number;
  distance?: number;
  duration?: number;
  dense?: boolean;
  style?: StyleProp<ViewStyle>;
}>;

/**
 * On native, runs a JS-driven Animated.timing reveal (translateY + optional scale).
 * On web, renders children immediately with no animation to avoid hundreds of
 * concurrent requestAnimationFrame callbacks that cause jitter on mobile browsers.
 * Also skips animation when the user has prefers-reduced-motion enabled.
 */
export function MotionInView({
  children,
  delay = 0,
  distance = motion.revealDistance,
  duration = motion.standard,
  dense = false,
  style,
}: MotionInViewProps) {
  const reducedMotion = useReducedMotion();

  if (isWeb || reducedMotion) {
    return <View style={style}>{children}</View>;
  }

  return (
    <NativeMotionInView
      delay={delay}
      distance={distance}
      duration={duration}
      dense={dense}
      style={style}
    >
      {children}
    </NativeMotionInView>
  );
}

function NativeMotionInView({
  children,
  delay = 0,
  distance = motion.revealDistance,
  duration = motion.standard,
  dense = false,
  style,
}: MotionInViewProps) {
  const progress = useRef(new Animated.Value(0)).current;
  const resolvedDistance = dense ? motion.denseRevealDistance : distance;
  const resolvedDuration = dense ? motion.dense : duration;

  useEffect(() => {
    let animation: Animated.CompositeAnimation | null = null;
    const frameId = requestAnimationFrame(() => {
      progress.setValue(0);
      animation = Animated.timing(progress, {
        toValue: 1,
        duration: resolvedDuration,
        delay,
        easing: Easing.bezier(0.22, 1, 0.36, 1),
        useNativeDriver: true,
      });

      animation.start();
    });

    return () => {
      cancelAnimationFrame(frameId);
      animation?.stop();
    };
  }, [delay, progress, resolvedDuration]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [resolvedDistance, 0],
              }),
            },
            ...(dense
              ? []
              : [
                  {
                    scale: progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [motion.revealScale, 1],
                    }),
                  },
                ]),
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

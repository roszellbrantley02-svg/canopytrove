import type { PropsWithChildren } from 'react';
import React, { useEffect, useRef } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Animated, Easing, Platform, View } from 'react-native';
import { motion } from '../theme/tokens';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useAdaptiveMotion } from '../hooks/useAdaptiveMotion';

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
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);
  const frameIdRef = useRef<number | null>(null);
  const adaptiveMotion = useAdaptiveMotion();
  const resolvedDistance = dense ? motion.denseRevealDistance : distance;
  const resolvedDuration = dense ? motion.dense : duration;
  const adaptiveDistance = adaptiveMotion.distance(resolvedDistance);
  const adaptiveDuration = adaptiveMotion.duration(resolvedDuration);

  useEffect(() => {
    frameIdRef.current = requestAnimationFrame(() => {
      progress.setValue(0);
      animationRef.current = Animated.timing(progress, {
        toValue: 1,
        duration: adaptiveDuration,
        delay,
        easing: Easing.bezier(0.22, 1, 0.36, 1),
        useNativeDriver: true,
      });

      animationRef.current.start();
    });

    return () => {
      if (frameIdRef.current !== null) {
        cancelAnimationFrame(frameIdRef.current);
      }
      if (animationRef.current) {
        animationRef.current.stop();
      }
    };
  }, [adaptiveDuration, delay, progress]);

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
                outputRange: [adaptiveDistance, 0],
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

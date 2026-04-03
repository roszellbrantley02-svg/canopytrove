import type { PropsWithChildren } from 'react';
import React, { useEffect, useRef } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Animated, Easing } from 'react-native';
import { motion } from '../theme/tokens';

type MotionInViewProps = PropsWithChildren<{
  delay?: number;
  distance?: number;
  duration?: number;
  dense?: boolean;
  style?: StyleProp<ViewStyle>;
}>;

export function MotionInView({
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

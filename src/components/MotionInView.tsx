import React, { PropsWithChildren, useEffect, useRef } from 'react';
import { Animated, Easing, InteractionManager, StyleProp, ViewStyle } from 'react-native';
import { motion } from '../theme/tokens';

type MotionInViewProps = PropsWithChildren<{
  delay?: number;
  distance?: number;
  duration?: number;
  style?: StyleProp<ViewStyle>;
}>;

export function MotionInView({
  children,
  delay = 0,
  distance = motion.revealDistance,
  duration = motion.standard,
  style,
}: MotionInViewProps) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let animation: Animated.CompositeAnimation | null = null;
    const interaction = InteractionManager.runAfterInteractions(() => {
      progress.setValue(0);
      animation = Animated.timing(progress, {
        toValue: 1,
        duration,
        delay,
        easing: Easing.bezier(0.22, 1, 0.36, 1),
        useNativeDriver: true,
      });

      animation.start();
    });

    return () => {
      interaction.cancel();
      animation?.stop();
    };
  }, [delay, duration, progress]);

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
                outputRange: [distance, 0],
              }),
            },
            {
              scale: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [motion.revealScale, 1],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

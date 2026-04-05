import React, { useEffect, useRef } from 'react';
import { Animated, Platform, Easing } from 'react-native';
import { AppBootHeader, AppBootHero, AppBootLayout } from './appBoot/AppBootSections';

export function AppBootScreen() {
  const pulse = useRef(new Animated.Value(0)).current;
  const sweep = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]),
    );

    const sweepAnimation = Animated.loop(
      Animated.timing(sweep, {
        toValue: 1,
        duration: 1800,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: Platform.OS !== 'web',
      }),
    );

    pulseAnimation.start();
    sweepAnimation.start();

    return () => {
      pulseAnimation.stop();
      sweepAnimation.stop();
      pulse.setValue(0);
      sweep.setValue(0);
    };
  }, [pulse, sweep]);

  return (
    <AppBootLayout>
      <AppBootHeader pulse={pulse} sweep={sweep} />
      <AppBootHero pulse={pulse} />
    </AppBootLayout>
  );
}

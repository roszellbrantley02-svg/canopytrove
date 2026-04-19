/* eslint-disable @typescript-eslint/no-require-imports */
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, type ViewStyle } from 'react-native';

/**
 * Canopy Trove loading screen.
 *
 * Animated map-pin with a compass rose inside: the pin rotates one direction,
 * the compass rotates the opposite direction. Both use native driver —
 * runs on the UI thread, no JS work per frame.
 *
 * Source art:
 *   assets/loading/pin.png     — green pin teardrop, centered on its head pivot
 *   assets/loading/compass.png — gold 8-point compass rose
 */

type LoadingScreenProps = {
  /** Overall pin size in dp. Default 220. */
  size?: number;
  /** One full rotation period in ms. Default 3200 (slower = calmer). */
  durationMs?: number;
  /** Full-screen vs inline. Default 'full' (dark bg fill). */
  variant?: 'full' | 'inline';
  /** Override background color (defaults to CT dark #121614). */
  backgroundColor?: string;
};

const PIN_SOURCE = require('../../assets/loading/pin.png');
const COMPASS_SOURCE = require('../../assets/loading/compass.png');

export function LoadingScreen({
  size = 220,
  durationMs = 3200,
  variant = 'full',
  backgroundColor = '#121614',
}: LoadingScreenProps) {
  const pinSpin = useRef(new Animated.Value(0)).current;
  const compassSpin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pinLoop = Animated.loop(
      Animated.timing(pinSpin, {
        toValue: 1,
        duration: durationMs,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    // Compass slightly faster so the counter-rotation reads clearly.
    const compassLoop = Animated.loop(
      Animated.timing(compassSpin, {
        toValue: 1,
        duration: Math.round(durationMs * 0.75),
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    pinLoop.start();
    compassLoop.start();
    return () => {
      pinLoop.stop();
      compassLoop.stop();
    };
  }, [pinSpin, compassSpin, durationMs]);

  const pinRotate = pinSpin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  const compassRotate = compassSpin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '-360deg'], // opposite direction
  });

  // Compass is 512px natural; its center must coincide with the pin's center (pin PNG is 1024px
  // centered on its head). Rendering both at `size` dp with identical bounds keeps the centers aligned.
  const compassSize = size * 0.45; // compass visually fills the ring inside the pin head

  const containerStyle: ViewStyle =
    variant === 'full' ? { ...styles.full, backgroundColor } : { ...styles.inline };
  const loaderStageStyle = { width: size, height: size };
  const pinStyle = {
    width: size,
    height: size,
    transform: [{ rotate: pinRotate }],
  };
  const compassStyle = {
    width: compassSize,
    height: compassSize,
    transform: [{ rotate: compassRotate }],
  };

  return (
    <View style={containerStyle} accessibilityRole="progressbar" accessibilityLabel="Loading">
      <View style={[styles.loaderStage, loaderStageStyle]}>
        <Animated.Image
          source={PIN_SOURCE}
          style={[styles.rotatingLayer, pinStyle]}
          resizeMode="contain"
        />
        <Animated.Image
          source={COMPASS_SOURCE}
          style={[styles.rotatingLayer, compassStyle]}
          resizeMode="contain"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  full: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inline: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderStage: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rotatingLayer: {
    position: 'absolute',
  },
});
 
/* eslint-disable @typescript-eslint/no-require-imports */
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';

/**
 * Canopy Trove loading screen.
 *
 * Animated map-pin with a compass rose inside: the pin rotates one direction,
 * the compass rotates the opposite direction. Both use native driver —
 * runs on the UI thread, no JS work per frame.
 *
 * Source art:
 *   assets/loading/pin.png     — green pin teardrop, tight-cropped so the
 *                                visible shape fills ~86% of the canvas
 *   assets/loading/compass.png — gold 8-point compass rose, tight-cropped
 *
 * Sizing: when `size` is omitted, the pin fills ~85% of the screen's shorter
 * dimension so the logo dominates the view on boot. Pass an explicit `size`
 * only when embedding inline in a smaller surface.
 */

type LoadingScreenProps = {
  /**
   * Overall pin size in dp. When omitted, defaults to ~85% of the shorter
   * window dimension so the logo fills the screen on boot. Pass an explicit
   * value only for small inline placements.
   */
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

// When no explicit size is passed, fill this fraction of the shorter window
// dimension. Chosen so that the spinning pin dominates the boot view without
// touching the notch/home-indicator safe insets.
const DEFAULT_FILL_FRACTION = 0.85;

export function LoadingScreen({
  size,
  durationMs = 3200,
  variant = 'full',
  backgroundColor = '#121614',
}: LoadingScreenProps) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const resolvedSize =
    typeof size === 'number' && size > 0
      ? size
      : Math.min(windowWidth, windowHeight) * DEFAULT_FILL_FRACTION;
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

  // Compass and pin PNGs are now both center-cropped to their visible content
  // so rendering both at `resolvedSize` dp keeps their geometric centers
  // aligned. The compass is intentionally smaller than the pin so it reads as
  // sitting inside the pin's head circle rather than overlaying the whole pin.
  const compassSize = resolvedSize * 0.4;

  const containerStyle: ViewStyle =
    variant === 'full' ? { ...styles.full, backgroundColor } : { ...styles.inline };
  const loaderStageStyle = { width: resolvedSize, height: resolvedSize };
  const pinStyle = {
    width: resolvedSize,
    height: resolvedSize,
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

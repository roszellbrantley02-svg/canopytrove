/**
 * Holographic shine overlay painted on top of every StorefrontRouteCard.
 *
 * A soft diagonal specular band sweeps across the card every 2.4s. Drawn
 * in an absolutely-positioned <Canvas> with a Skia RuntimeEffect shader
 * so it composites above the card image without re-rendering the card.
 *
 * Driven by `react-native-reanimated`'s shared values — Skia 2.x reuses
 * reanimated's hook set for all animated uniforms, so any time you see
 * `useDerivedValue` from reanimated here it is the right one.
 *
 * Kill-switch: the wrapper in StorefrontRouteCard only mounts this when
 * `featureFlags.cardSkiaEnabled` is true. The flag flips off whenever
 * `EXPO_PUBLIC_DISABLE_CARD_SKIA=true` so a single OTA can hide it if
 * it ever regresses on a device class.
 */

import React from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Canvas, Fill, Shader, Skia } from '@shopify/react-native-skia';
import {
  Easing,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

type Props = {
  /** Disable the shine for cards where it would compete visually. */
  enabled?: boolean;
};

const SHINE_SRC = `
uniform float u_time;
uniform float2 u_resolution;

half4 main(float2 fragCoord) {
  float2 uv = fragCoord / u_resolution;
  // Diagonal band sweeping left → right with a gentle downward tilt.
  float band = (uv.x + uv.y * 0.25) - u_time;
  float shine = smoothstep(0.0, 0.04, band) - smoothstep(0.04, 0.14, band);
  // Soft edge mask so the band never sticks to the card corners.
  float edge =
    smoothstep(0.0, 0.08, uv.x) *
    smoothstep(0.0, 0.08, 1.0 - uv.x) *
    smoothstep(0.0, 0.08, uv.y) *
    smoothstep(0.0, 0.08, 1.0 - uv.y);
  float alpha = shine * edge * 0.32;
  // Warm champagne specular — feels premium against the dark card surface.
  return half4(half3(1.0, 0.94, 0.78) * alpha, alpha);
}
`;

const shineEffect = Skia.RuntimeEffect.Make(SHINE_SRC);

function StorefrontRouteCardSkiaOverlayComponent({ enabled = true }: Props) {
  const [size, setSize] = React.useState({ width: 0, height: 0 });
  const progress = useSharedValue(0);

  const onLayout = React.useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
  }, []);

  React.useEffect(() => {
    if (!enabled) {
      progress.value = 0;
      return;
    }
    progress.value = 0;
    progress.value = withRepeat(
      withTiming(1.3, { duration: 2400, easing: Easing.linear }),
      -1,
      false,
    );
  }, [enabled, progress]);

  const uniforms = useDerivedValue(() => ({
    u_time: progress.value,
    u_resolution: [Math.max(size.width, 1), Math.max(size.height, 1)] as [number, number],
  }));

  if (!enabled || !shineEffect) {
    return null;
  }

  return (
    <View pointerEvents="none" onLayout={onLayout} style={StyleSheet.absoluteFill}>
      {size.width > 0 && size.height > 0 ? (
        <Canvas style={StyleSheet.absoluteFill}>
          <Fill>
            <Shader source={shineEffect} uniforms={uniforms} />
          </Fill>
        </Canvas>
      ) : null}
    </View>
  );
}

export const StorefrontRouteCardSkiaOverlay = React.memo(StorefrontRouteCardSkiaOverlayComponent);

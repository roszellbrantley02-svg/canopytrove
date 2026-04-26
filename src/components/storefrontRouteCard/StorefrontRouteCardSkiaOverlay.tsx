/**
 * Holographic shine overlay painted on top of every StorefrontRouteCard.
 *
 * A soft diagonal specular band sweeps across the card, then rests idle for a
 * randomized 3–5 minute window before repeating. The staggered cadence means
 * only one or two cards in a scrolling list will be shining at any given moment
 * — the premium-signal we liked from the original constant loop without the
 * visual noise of every card sparkling at once.
 *
 * Drawn in an absolutely-positioned <Canvas> with a Skia RuntimeEffect shader
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
import { Platform, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Canvas, Fill, Shader, Skia } from '@shopify/react-native-skia';
import {
  Easing,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
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

const shineEffect =
  Platform.OS === 'web' || typeof Skia.RuntimeEffect?.Make !== 'function'
    ? null
    : Skia.RuntimeEffect.Make(SHINE_SRC);

// One visible sweep lasts 2.4s. Between sweeps the band sits parked off-screen
// (progress = 1.3) so the card looks completely static. The idle window is a
// random value between these bounds chosen once per mount, which staggers the
// cadence across cards in a scrolling list so they never all shine together.
const SWEEP_DURATION_MS = 2400;
const MIN_IDLE_MS = 3 * 60 * 1000; // 3 minutes
const MAX_IDLE_MS = 5 * 60 * 1000; // 5 minutes

function pickIdleDelayMs() {
  const jitter = Math.random() * (MAX_IDLE_MS - MIN_IDLE_MS);
  return Math.round(MIN_IDLE_MS + jitter);
}

function StorefrontRouteCardSkiaOverlayComponent({ enabled = true }: Props) {
  const [size, setSize] = React.useState({ width: 0, height: 0 });
  const progress = useSharedValue(0);
  // Also randomize the initial delay so the first sweep on each card fires at
  // a slightly different time after mount. Without this every card on screen
  // would shine in unison on the first pass before diverging.
  const initialDelayMsRef = React.useRef<number>(Math.round(Math.random() * MAX_IDLE_MS));

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
    progress.value = withDelay(
      initialDelayMsRef.current,
      withRepeat(
        withSequence(
          // Visible sweep left → right.
          withTiming(1.3, { duration: SWEEP_DURATION_MS, easing: Easing.linear }),
          // Snap back to the hidden starting position, then idle 3–5 minutes
          // before the next sweep. Re-picking the idle window every iteration
          // keeps neighbouring cards from re-locking into sync.
          withTiming(0, { duration: 0 }),
          withDelay(pickIdleDelayMs(), withTiming(0, { duration: 0 })),
        ),
        -1,
        false,
      ),
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

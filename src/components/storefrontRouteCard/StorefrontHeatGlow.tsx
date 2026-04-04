import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

// ---------------------------------------------------------------------------
// Heat levels — driven by route starts per hour from the backend
// ---------------------------------------------------------------------------

/**
 * 0 = no heat (no glow rendered)
 * 1 = faint    — barely visible warm tint
 * 2 = warm     — noticeable amber glow
 * 3 = hot      — orange pulse, clearly active
 * 4 = blazing  — bright orange-red, strong pulse
 * 5 = inferno  — red-orange radiance, fastest pulse
 */
export type HeatLevel = 0 | 1 | 2 | 3 | 4 | 5;

/** Route-starts-per-hour thresholds that map to each heat level. */
export const HEAT_THRESHOLDS = {
  faint: 3,
  warm: 8,
  hot: 15,
  blazing: 30,
  inferno: 50,
} as const;

export function routeStartsToHeatLevel(routeStartsPerHour: number): HeatLevel {
  if (routeStartsPerHour >= HEAT_THRESHOLDS.inferno) return 5;
  if (routeStartsPerHour >= HEAT_THRESHOLDS.blazing) return 4;
  if (routeStartsPerHour >= HEAT_THRESHOLDS.hot) return 3;
  if (routeStartsPerHour >= HEAT_THRESHOLDS.warm) return 2;
  if (routeStartsPerHour >= HEAT_THRESHOLDS.faint) return 1;
  return 0;
}

// ---------------------------------------------------------------------------
// Visual config per level
// ---------------------------------------------------------------------------

type HeatVisualConfig = {
  /** Gradient colors (bottom → top, warm → transparent). */
  colors: [string, string, string];
  /** Gradient stops. */
  locations: [number, number, number];
  /** Peak opacity of the glow layer. */
  maxOpacity: number;
  /** Min opacity during the breathing cycle. */
  minOpacity: number;
  /** Breathing pulse duration (ms). */
  pulseDuration: number;
  /** Border glow color. */
  borderColor: string;
};

const HEAT_CONFIG: Record<Exclude<HeatLevel, 0>, HeatVisualConfig> = {
  1: {
    colors: ['rgba(255,180,80,0.10)', 'rgba(255,160,60,0.04)', 'transparent'],
    locations: [0, 0.4, 1],
    maxOpacity: 0.6,
    minOpacity: 0.3,
    pulseDuration: 4000,
    borderColor: 'rgba(255,180,80,0.12)',
  },
  2: {
    colors: ['rgba(255,160,50,0.18)', 'rgba(255,140,40,0.08)', 'transparent'],
    locations: [0, 0.45, 1],
    maxOpacity: 0.75,
    minOpacity: 0.4,
    pulseDuration: 3200,
    borderColor: 'rgba(255,160,50,0.20)',
  },
  3: {
    colors: ['rgba(255,120,30,0.26)', 'rgba(255,100,20,0.12)', 'transparent'],
    locations: [0, 0.5, 1],
    maxOpacity: 0.85,
    minOpacity: 0.5,
    pulseDuration: 2600,
    borderColor: 'rgba(255,120,30,0.28)',
  },
  4: {
    colors: ['rgba(255,80,20,0.35)', 'rgba(255,60,10,0.16)', 'transparent'],
    locations: [0, 0.55, 1],
    maxOpacity: 0.92,
    minOpacity: 0.6,
    pulseDuration: 2000,
    borderColor: 'rgba(255,80,20,0.35)',
  },
  5: {
    colors: ['rgba(255,50,10,0.44)', 'rgba(255,30,0,0.22)', 'rgba(255,120,40,0.06)'],
    locations: [0, 0.5, 1],
    maxOpacity: 1,
    minOpacity: 0.65,
    pulseDuration: 1400,
    borderColor: 'rgba(255,50,10,0.42)',
  },
};

// ---------------------------------------------------------------------------
// Animated heat glow component
// ---------------------------------------------------------------------------

/** Duration of the fade-out when heat level drops to 0 (ms). */
const COOLDOWN_FADE_DURATION = 1200;

/** Duration of the cross-fade when transitioning between non-zero levels (ms). */
const LEVEL_TRANSITION_DURATION = 800;

type StorefrontHeatGlowProps = {
  heatLevel: HeatLevel;
};

/**
 * Renders an animated gradient glow behind the storefront card.
 *
 * The glow breathes (pulses opacity) with speed + intensity that
 * scales with the heat level. When the level drops — including all
 * the way to 0 — the glow smoothly fades out rather than vanishing
 * instantly. This prevents the "stuck hot" appearance and gives a
 * natural cooldown effect.
 *
 * Lifecycle:
 *  - Level goes UP   → cross-fade to the hotter config
 *  - Level goes DOWN → cross-fade to the cooler config
 *  - Level hits 0    → fade to fully transparent, then unmount
 */
export function StorefrontHeatGlow({ heatLevel }: StorefrontHeatGlowProps) {
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const envelopeAnim = useRef(new Animated.Value(heatLevel > 0 ? 1 : 0)).current;
  const pulseRef = useRef<Animated.CompositeAnimation | null>(null);

  // Track the previous level so we know if we're cooling down
  const prevLevelRef = useRef(heatLevel);

  // The "render level" is the level we use for colors/config.
  // When cooling to 0 we keep the last non-zero level visible during the fade.
  const [renderLevel, setRenderLevel] = useState<Exclude<HeatLevel, 0> | null>(
    heatLevel > 0 ? (heatLevel as Exclude<HeatLevel, 0>) : null,
  );

  useEffect(() => {
    const prevLevel = prevLevelRef.current;
    prevLevelRef.current = heatLevel;

    // ── Heating up or staying hot ────────────────────────────────────
    if (heatLevel > 0) {
      setRenderLevel(heatLevel as Exclude<HeatLevel, 0>);

      // If we were at 0 before, fade the envelope in
      if (prevLevel === 0) {
        Animated.timing(envelopeAnim, {
          toValue: 1,
          duration: LEVEL_TRANSITION_DURATION,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }).start();
      }

      // Restart the pulse loop with the new level's timing
      if (pulseRef.current) {
        pulseRef.current.stop();
      }

      const config = HEAT_CONFIG[heatLevel as Exclude<HeatLevel, 0>];
      pulseAnim.setValue(0);
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: config.pulseDuration / 2,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0,
            duration: config.pulseDuration / 2,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      );
      pulseRef.current = loop;
      loop.start();

      return () => {
        loop.stop();
        pulseRef.current = null;
      };
    }

    // ── Cooling down to 0 ────────────────────────────────────────────
    // Keep the current renderLevel visible while fading the envelope out.
    if (pulseRef.current) {
      pulseRef.current.stop();
      pulseRef.current = null;
    }

    Animated.timing(envelopeAnim, {
      toValue: 0,
      duration: COOLDOWN_FADE_DURATION,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setRenderLevel(null);
      }
    });

    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally keyed on heatLevel only
  }, [heatLevel]);

  // Nothing to render (never been hot, or fade-out completed)
  if (renderLevel === null) return null;

  const config = HEAT_CONFIG[renderLevel];
  const animatedPulseOpacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [config.minOpacity, config.maxOpacity],
  });

  // Combined opacity = envelope (fade in/out) × pulse (breathing)
  const combinedOpacity = Animated.multiply(envelopeAnim, animatedPulseOpacity);

  return (
    <Animated.View
      pointerEvents="none"
      style={[glowStyles.container, { opacity: combinedOpacity }]}
    >
      <LinearGradient
        colors={config.colors}
        locations={config.locations}
        start={{ x: 0.5, y: 1 }}
        end={{ x: 0.5, y: 0 }}
        style={glowStyles.gradient}
      />
      <View style={[glowStyles.borderGlow, { borderColor: config.borderColor }]} />
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Heat label for the card (e.g. "🔥 Heating Up")
// ---------------------------------------------------------------------------

export function getHeatLabel(heatLevel: HeatLevel): string | null {
  switch (heatLevel) {
    case 1:
      return 'Warming up';
    case 2:
      return 'Getting busy';
    case 3:
      return 'Hot right now';
    case 4:
      return 'Blazing';
    case 5:
      return 'On fire';
    default:
      return null;
  }
}

export function getHeatColor(heatLevel: HeatLevel): string {
  switch (heatLevel) {
    case 1:
      return '#FFB450';
    case 2:
      return '#FFA032';
    case 3:
      return '#FF7820';
    case 4:
      return '#FF5014';
    case 5:
      return '#FF320A';
    default:
      return 'transparent';
  }
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const glowStyles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
    overflow: 'hidden',
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
  },
  borderGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
    borderWidth: 1,
  },
});

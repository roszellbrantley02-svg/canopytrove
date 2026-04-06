import React, { useEffect, useRef } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Animated, Platform, Easing, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radii } from '../theme/tokens';

type ShimmerBlockProps = {
  style?: StyleProp<ViewStyle>;
  shimmerWidth?: number;
  borderRadius?: number;
  testID?: string;
};

/**
 * CSS-only shimmer for web avoids JS-driven Animated.timing that causes
 * main-thread jitter on mobile browsers (INP regression).
 */
function WebShimmerBlock({ style, borderRadius = radii.md, testID }: ShimmerBlockProps) {
  return (
    <View testID={testID} style={[styles.base, { borderRadius }, style]}>
      <View
        // @ts-expect-error – RNW supports className for injecting CSS animations
        className="ct-shimmer-sweep"
        style={styles.webShimmerStrip}
      />
    </View>
  );
}

function NativeShimmerBlock({
  style,
  shimmerWidth = 132,
  borderRadius = radii.md,
  testID,
}: ShimmerBlockProps) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: 1400,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    );

    animation.start();

    return () => {
      animation.stop();
      progress.setValue(0);
    };
  }, [progress]);

  return (
    <View testID={testID} style={[styles.base, { borderRadius }, style]}>
      <Animated.View
        style={[
          styles.shimmerWrap,
          {
            width: shimmerWidth,
            transform: [
              {
                translateX: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-shimmerWidth, shimmerWidth * 1.8],
                }),
              },
              { rotate: '16deg' },
            ],
          },
        ]}
      >
        <LinearGradient
          colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.14)', 'rgba(255,255,255,0)']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.shimmer}
        />
      </Animated.View>
    </View>
  );
}

export function ShimmerBlock(props: ShimmerBlockProps) {
  if (Platform.OS === 'web') {
    return <WebShimmerBlock {...props} />;
  }
  return <NativeShimmerBlock {...props} />;
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
    backgroundColor: colors.surfaceElevated,
  },
  shimmerWrap: {
    position: 'absolute',
    top: -24,
    bottom: -24,
  },
  shimmer: {
    flex: 1,
  },
  webShimmerStrip: {
    position: 'absolute',
    top: -24,
    bottom: -24,
    width: 132,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
});

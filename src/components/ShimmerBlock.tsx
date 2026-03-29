import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radii } from '../theme/tokens';

type ShimmerBlockProps = {
  style?: StyleProp<ViewStyle>;
  shimmerWidth?: number;
  borderRadius?: number;
};

export function ShimmerBlock({
  style,
  shimmerWidth = 132,
  borderRadius = radii.md,
}: ShimmerBlockProps) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: 1400,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      })
    );

    animation.start();

    return () => {
      animation.stop();
      progress.setValue(0);
    };
  }, [progress]);

  return (
    <View style={[styles.base, { borderRadius }, style]}>
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
});

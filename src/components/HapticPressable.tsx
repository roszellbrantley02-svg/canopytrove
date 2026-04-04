import React, { useCallback, useRef } from 'react';
import type { GestureResponderEvent, PressableProps } from 'react-native';
import { Animated, Platform, Pressable, Vibration } from 'react-native';

type HapticPressableProps = PressableProps & {
  hapticType?: 'selection' | 'impact' | 'notification';
  enableScale?: boolean;
};

const HAPTIC_VIBRATION_MS: Record<NonNullable<HapticPressableProps['hapticType']>, number> = {
  selection: 8,
  impact: 12,
  notification: 18,
};

function triggerHaptic(type?: HapticPressableProps['hapticType']) {
  if (!type || Platform.OS !== 'android') {
    return;
  }

  Vibration.vibrate(HAPTIC_VIBRATION_MS[type]);
}

export function HapticPressable({
  hapticType,
  enableScale = true,
  onPressIn,
  onPressOut,
  style,
  ...props
}: HapticPressableProps) {
  const scaleValue = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(
    (event: GestureResponderEvent) => {
      if (!props.disabled) {
        triggerHaptic(hapticType);
      }
      if (enableScale) {
        Animated.spring(scaleValue, {
          toValue: 0.97,
          useNativeDriver: true,
          speed: 50,
          bounciness: 0,
        }).start();
      }
      onPressIn?.(event);
    },
    [hapticType, enableScale, scaleValue, onPressIn, props.disabled],
  );

  const handlePressOut = useCallback(
    (event: GestureResponderEvent) => {
      if (enableScale) {
        Animated.spring(scaleValue, {
          toValue: 1,
          useNativeDriver: true,
          speed: 40,
          bounciness: 4,
        }).start();
      }
      onPressOut?.(event);
    },
    [enableScale, scaleValue, onPressOut],
  );

  if (!enableScale) {
    return (
      <Pressable {...props} style={style} onPressIn={handlePressIn} onPressOut={handlePressOut} />
    );
  }

  return (
    <Animated.View style={{ transform: [{ scale: scaleValue }] }}>
      <Pressable {...props} style={style} onPressIn={handlePressIn} onPressOut={handlePressOut} />
    </Animated.View>
  );
}

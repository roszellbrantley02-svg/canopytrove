import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { GestureResponderEvent, PressableProps, ViewStyle } from 'react-native';
import { Animated, Platform, Pressable, Vibration } from 'react-native';
import * as Haptics from 'expo-haptics';

const isWeb = Platform.OS === 'web';

type HapticPressableProps = PressableProps & {
  hapticType?: 'selection' | 'impact' | 'notification';
  enableScale?: boolean;
};

const HAPTIC_VIBRATION_MS: Record<NonNullable<HapticPressableProps['hapticType']>, number> = {
  selection: 8,
  impact: 12,
  notification: 18,
};

function triggerAndroidFallback(type: NonNullable<HapticPressableProps['hapticType']>) {
  if (Platform.OS === 'android') {
    Vibration.vibrate(HAPTIC_VIBRATION_MS[type]);
  }
}

export function triggerHapticFeedback(type?: HapticPressableProps['hapticType']) {
  if (!type || Platform.OS === 'web') {
    return;
  }

  const runHaptic = async () => {
    try {
      if (type === 'selection') {
        await Haptics.selectionAsync();
        return;
      }
      if (type === 'impact') {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        return;
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      triggerAndroidFallback(type);
    }
  };

  void runHaptic();
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
  const currentAnimationRef = useRef<Animated.CompositeAnimation | null>(null);

  const handlePressIn = useCallback(
    (event: GestureResponderEvent) => {
      if (!props.disabled) {
        triggerHapticFeedback(hapticType);
      }
      if (enableScale) {
        if (currentAnimationRef.current) {
          currentAnimationRef.current.stop();
        }
        currentAnimationRef.current = Animated.spring(scaleValue, {
          toValue: 0.97,
          useNativeDriver: Platform.OS !== 'web',
          speed: 50,
          bounciness: 0,
        });
        currentAnimationRef.current.start();
      }
      onPressIn?.(event);
    },
    [hapticType, enableScale, scaleValue, onPressIn, props.disabled],
  );

  const handlePressOut = useCallback(
    (event: GestureResponderEvent) => {
      if (enableScale) {
        if (currentAnimationRef.current) {
          currentAnimationRef.current.stop();
        }
        currentAnimationRef.current = Animated.spring(scaleValue, {
          toValue: 1,
          useNativeDriver: Platform.OS !== 'web',
          speed: 40,
          bounciness: 4,
        });
        currentAnimationRef.current.start();
      }
      onPressOut?.(event);
    },
    [enableScale, scaleValue, onPressOut],
  );

  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    return () => {
      if (currentAnimationRef.current) {
        currentAnimationRef.current.stop();
      }
    };
  }, []);

  const webHoverProps = isWeb
    ? {
        onMouseEnter: () => setHovered(true),
        onMouseLeave: () => setHovered(false),
      }
    : {};

  const webCursorStyle: ViewStyle | undefined =
    isWeb && !props.disabled ? ({ cursor: 'pointer' } as unknown as ViewStyle) : undefined;

  const hoverOpacityStyle: ViewStyle | undefined =
    isWeb && hovered && !props.disabled ? { opacity: 0.88 } : undefined;

  if (!enableScale) {
    return (
      <Pressable
        {...props}
        {...webHoverProps}
        style={[style, webCursorStyle, hoverOpacityStyle] as PressableProps['style']}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      />
    );
  }

  // On web, skip the Animated.View scale wrapper — CSS transforms on wrapper
  // elements can cause inconsistent click/press event handling across browsers.
  // Web gets hover-opacity feedback instead, which is a better UX pattern anyway.
  if (isWeb) {
    return (
      <Pressable
        {...props}
        {...webHoverProps}
        style={[style, webCursorStyle, hoverOpacityStyle] as PressableProps['style']}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      />
    );
  }

  return (
    <Animated.View style={[{ transform: [{ scale: scaleValue }] }, hoverOpacityStyle]}>
      <Pressable
        {...props}
        {...webHoverProps}
        style={[style, webCursorStyle] as PressableProps['style']}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      />
    </Animated.View>
  );
}

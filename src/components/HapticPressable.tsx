import React from 'react';
import { Platform, Pressable, PressableProps, Vibration } from 'react-native';

type HapticPressableProps = PressableProps & {
  hapticType?: 'selection' | 'impact' | 'notification';
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

export function HapticPressable({ hapticType, onPressIn, ...props }: HapticPressableProps) {
  return (
    <Pressable
      {...props}
      onPressIn={(event) => {
        if (!props.disabled) {
          triggerHaptic(hapticType);
        }
        onPressIn?.(event);
      }}
    />
  );
}

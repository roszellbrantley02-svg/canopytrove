import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { AppIconProps } from './AppIcons';
import { colors } from '../theme/tokens';

type LayeredAppIconProps = {
  icon: React.ComponentType<AppIconProps>;
  size?: number;
  outlineColor?: string;
  fillColor?: string;
  outlineStroke?: number;
  fillStroke?: number;
};

export function LayeredAppIcon({
  icon: Icon,
  size = 24,
  outlineColor = colors.primary,
  fillColor = colors.text,
  outlineStroke = 3.4,
  fillStroke = 1.8,
}: LayeredAppIconProps) {
  return (
    <View style={[styles.shell, { width: size, height: size }]}>
      <Icon size={size} color={outlineColor} strokeWidth={outlineStroke} />
      <View pointerEvents="none" style={styles.overlay}>
        <Icon size={size} color={fillColor} strokeWidth={fillStroke} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

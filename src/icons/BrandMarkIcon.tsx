import React from 'react';
import { Image, StyleSheet } from 'react-native';

type BrandMarkIconProps = {
  size?: number;
  opacity?: number;
};

const brandMarkSource = require('../../assets/logo-mark-tight.png');

export function BrandMarkIcon({
  size = 24,
  opacity = 1,
}: BrandMarkIconProps) {
  return (
    <Image
      source={brandMarkSource}
      fadeDuration={0}
      resizeMode="contain"
      style={[styles.icon, { width: size, height: size, opacity }]}
    />
  );
}

const styles = StyleSheet.create({
  icon: {
    alignSelf: 'center',
  },
});

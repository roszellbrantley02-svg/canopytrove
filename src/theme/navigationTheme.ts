import type { Theme } from '@react-navigation/native';
import { DarkTheme } from '@react-navigation/native';
import { colors } from './tokens';

export const navigationTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.primary,
    background: colors.background,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
    notification: colors.warning,
  },
};

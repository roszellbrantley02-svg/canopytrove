import React from 'react';
import { useFonts } from 'expo-font';
import { Text, TextInput } from 'react-native';
import { DMSans_400Regular, DMSans_500Medium, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
import { SpaceGrotesk_500Medium, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { fontFamilies } from './tokens';

type DefaultStyledComponent = {
  defaultProps?: {
    style?: unknown;
  };
};

let didApplyGlobalTypographyDefaults = false;

function mergeDefaultStyle(current: unknown, next: { fontFamily: string }) {
  if (Array.isArray(current)) {
    return [...current, next];
  }

  if (current) {
    return [current, next];
  }

  return next;
}

function applyDefaultFont(component: unknown, fontFamily: string) {
  const target = component as DefaultStyledComponent;
  target.defaultProps = target.defaultProps ?? {};
  target.defaultProps.style = mergeDefaultStyle(target.defaultProps.style, {
    fontFamily,
  });
}

export function applyGlobalTypographyDefaults() {
  if (didApplyGlobalTypographyDefaults) {
    return;
  }

  applyDefaultFont(Text, fontFamilies.body);
  applyDefaultFont(TextInput, fontFamilies.body);
  didApplyGlobalTypographyDefaults = true;
}

export function useCanopyTroveFonts() {
  const [loaded, error] = useFonts({
    [fontFamilies.body]: DMSans_400Regular,
    [fontFamilies.bodyMedium]: DMSans_500Medium,
    [fontFamilies.bodyBold]: DMSans_700Bold,
    [fontFamilies.displayMedium]: SpaceGrotesk_500Medium,
    [fontFamilies.display]: SpaceGrotesk_700Bold,
  });

  React.useEffect(() => {
    if (loaded) {
      applyGlobalTypographyDefaults();
    }
  }, [loaded]);

  return loaded || Boolean(error);
}

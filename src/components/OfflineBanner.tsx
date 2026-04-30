import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useOfflineAware } from '../hooks/useOfflineAware';
import { colors, spacing, textStyles } from '../theme/tokens';

/**
 * Thin top banner that appears whenever device connectivity is lost.
 * Sits inside the main app render alongside RootNavigator so every
 * screen inherits the indicator without each having to wire it up.
 *
 * Renders nothing when online (no layout shift, no flicker on the
 * common path). Uses SafeAreaView so the banner clears the iOS notch
 * and Android status bar without overlaying screen content underneath.
 */
export function OfflineBanner() {
  const { isOnline } = useOfflineAware();

  if (isOnline) {
    return null;
  }

  return (
    <SafeAreaView edges={['top']} style={styles.container} pointerEvents="none">
      <View style={styles.bar} accessibilityRole="alert" accessibilityLiveRegion="polite">
        <Text style={styles.text} numberOfLines={1}>
          You{'’'}re offline. Some features may not work until you{'’'}re back online.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.danger,
    zIndex: 9999,
  },
  bar: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  text: {
    ...textStyles.caption,
    color: '#0B0E10',
    textAlign: 'center',
    fontWeight: '600',
  },
});

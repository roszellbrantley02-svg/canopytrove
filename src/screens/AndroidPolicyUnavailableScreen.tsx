import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ScreenShell } from '../components/ScreenShell';
import { SectionCard } from '../components/SectionCard';
import { withScreenErrorBoundary } from '../components/withScreenErrorBoundary';
import { colors, radii, spacing, textStyles } from '../theme/tokens';
import type { RootStackParamList } from '../navigation/rootNavigatorConfig';

type AndroidPolicyUnavailableScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList>;
  route: RouteProp<RootStackParamList, keyof RootStackParamList>;
};

function AndroidPolicyUnavailableScreenInner({
  navigation,
  route,
}: AndroidPolicyUnavailableScreenProps) {
  const routeName = String(route.name);
  const isOwnerRoute = routeName.startsWith('Owner');
  const title = isOwnerRoute
    ? 'Business tools stay off Android.'
    : 'Product tools stay off Android.';
  const body = isOwnerRoute
    ? 'This Android build is limited to licensed storefront discovery, reviews, and verification. Business workspace tools are available on iPhone and web.'
    : 'This Android build does not include product, brand, COA, or product-review discovery. Verify storefront licenses and browse storefront information here.';

  return (
    <ScreenShell
      eyebrow={isOwnerRoute ? 'Business workspace' : 'Android review build'}
      title={title}
      subtitle="The Android experience stays focused on storefront information and license checks."
    >
      <View style={styles.content}>
        <SectionCard title={title} body={body}>
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Browse storefronts"
              style={styles.primaryButton}
              onPress={() => navigation.navigate('Tabs', { screen: 'Browse' })}
            >
              <Text style={styles.primaryButtonText}>Browse Storefronts</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Verify a storefront license"
              style={styles.secondaryButton}
              onPress={() => navigation.navigate('Tabs', { screen: 'Verify' })}
            >
              <Text style={styles.secondaryButtonText}>Verify License</Text>
            </Pressable>
          </View>
        </SectionCard>
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  primaryButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
  },
  primaryButtonText: {
    ...textStyles.button,
    color: colors.backgroundDeep,
  },
  secondaryButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingHorizontal: spacing.lg,
  },
  secondaryButtonText: {
    ...textStyles.button,
    color: colors.text,
  },
});

export const AndroidPolicyUnavailableScreen = withScreenErrorBoundary(
  AndroidPolicyUnavailableScreenInner,
  'android-policy-unavailable-screen',
);

export default AndroidPolicyUnavailableScreen;

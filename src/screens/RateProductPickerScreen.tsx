/**
 * Rate Product Picker Screen
 *
 * Manual entry point reached from the Verify menu → "Rate a product".
 * Users type a brand name + product name, we normalize them into the
 * same slug the backend uses, and push them into ProductReviewComposer.
 *
 * Rating is still gated to signed-in members. The Verify menu routes
 * anonymous users to MemberSignIn, but we also belt-and-suspenders it
 * here so deep-linking into the composer cannot happen for anonymous
 * users.
 */

import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppUiIcon } from '../icons/AppUiIcon';
import { InlineFeedbackPanel } from '../components/InlineFeedbackPanel';
import { MotionInView } from '../components/MotionInView';
import { ScreenShell } from '../components/ScreenShell';
import { SectionCard } from '../components/SectionCard';
import { withScreenErrorBoundary } from '../components/withScreenErrorBoundary';
import { useStorefrontProfileController } from '../context/StorefrontController';
import { buildClientProductSlug } from '../services/productReviewService';
import { colors, fontFamilies, radii, spacing, textStyles, typography } from '../theme/tokens';
import type { RootStackParamList } from '../navigation/rootNavigatorConfig';

type RateProductPickerScreenProps = NativeStackScreenProps<RootStackParamList, 'RateProductPicker'>;

function RateProductPickerScreenInner({ navigation }: RateProductPickerScreenProps) {
  const { authSession } = useStorefrontProfileController();
  const isAuthenticated = authSession.status === 'authenticated';

  const [brandName, setBrandName] = React.useState('');
  const [productName, setProductName] = React.useState('');

  const trimmedBrand = brandName.trim();
  const trimmedProduct = productName.trim();
  const slug = React.useMemo(
    () => buildClientProductSlug(trimmedBrand, trimmedProduct),
    [trimmedBrand, trimmedProduct],
  );
  const canSubmit = Boolean(slug) && trimmedBrand.length > 0 && trimmedProduct.length > 0;

  const handleSubmit = React.useCallback(() => {
    if (!isAuthenticated) {
      navigation.navigate('MemberSignIn', {
        redirectTo: { kind: 'goBack' },
      });
      return;
    }
    if (!canSubmit || !slug) {
      return;
    }
    navigation.replace('ProductReviewComposer', {
      productSlug: slug,
      brandName: trimmedBrand,
      productName: trimmedProduct,
    });
  }, [canSubmit, isAuthenticated, navigation, slug, trimmedBrand, trimmedProduct]);

  return (
    <ScreenShell
      eyebrow="Rate a product"
      title="Which product are you reviewing?"
      subtitle="Type the brand and product name exactly as they appear on the package."
      headerPill={undefined}
      resetScrollOnFocus={true}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        enabled={Platform.OS === 'ios'}
        keyboardVerticalOffset={24}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.stack}>
            {!isAuthenticated ? (
              <MotionInView delay={60}>
                <InlineFeedbackPanel
                  tone="info"
                  label="Sign in to rate"
                  title="Only signed-in members can post product reviews."
                  body="You can still look up products — tap Continue and we'll take you to sign in first."
                  iconName="lock-closed-outline"
                />
              </MotionInView>
            ) : null}

            <MotionInView delay={90}>
              <SectionCard
                title="Tell us about the product"
                body="Brand + product name is what other members will see. We don't send this to lab partners — it's just the key we use to group reviews together."
                eyebrow="Manual entry"
                iconName="star-outline"
                tone="gold"
              >
                <View style={styles.form}>
                  <View style={styles.field}>
                    <Text style={styles.fieldLabel}>Brand name</Text>
                    <TextInput
                      value={brandName}
                      onChangeText={setBrandName}
                      placeholder="e.g. Hudson Hemp"
                      placeholderTextColor={colors.textSoft}
                      style={styles.input}
                      autoCapitalize="words"
                      autoCorrect={false}
                      returnKeyType="next"
                      accessibilityLabel="Brand name"
                      accessibilityHint="Enter the brand printed on the package."
                    />
                  </View>
                  <View style={styles.field}>
                    <Text style={styles.fieldLabel}>Product name</Text>
                    <TextInput
                      value={productName}
                      onChangeText={setProductName}
                      placeholder="e.g. Sunrise Gummies 5mg"
                      placeholderTextColor={colors.textSoft}
                      style={styles.input}
                      autoCapitalize="words"
                      autoCorrect={false}
                      returnKeyType="done"
                      onSubmitEditing={handleSubmit}
                      accessibilityLabel="Product name"
                      accessibilityHint="Enter the product name with strain or format if it's on the label."
                    />
                  </View>

                  {slug ? (
                    <View style={styles.slugPreview}>
                      <Text style={styles.slugPreviewLabel}>Review key</Text>
                      <Text style={styles.slugPreviewValue} numberOfLines={1}>
                        {slug}
                      </Text>
                    </View>
                  ) : null}
                </View>

                <Pressable
                  disabled={!canSubmit}
                  onPress={handleSubmit}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    !canSubmit && styles.primaryButtonDisabled,
                    pressed && styles.primaryButtonPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={
                    isAuthenticated ? 'Continue to write a review' : 'Sign in to continue'
                  }
                >
                  <AppUiIcon
                    name={isAuthenticated ? 'star-outline' : 'lock-closed-outline'}
                    size={16}
                    color={colors.backgroundDeep}
                  />
                  <Text style={styles.primaryButtonText}>
                    {isAuthenticated ? 'Continue' : 'Sign in to continue'}
                  </Text>
                </Pressable>
              </SectionCard>
            </MotionInView>

            <MotionInView delay={140}>
              <InlineFeedbackPanel
                tone="info"
                label="Tip"
                title="Already have the product in your hand?"
                body="Scanning its QR or COA from the Verify menu is usually faster and lets us auto-fill the brand and product name for you."
                iconName="camera-outline"
              />
            </MotionInView>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenShell>
  );
}

export const RateProductPickerScreen = withScreenErrorBoundary(
  RateProductPickerScreenInner,
  'rate-product-picker-screen',
);

const styles = StyleSheet.create({
  scrollContent: {
    paddingVertical: spacing.lg,
  },
  stack: {
    gap: spacing.lg,
  },
  form: {
    gap: spacing.md,
  },
  field: {
    gap: spacing.xs,
  },
  fieldLabel: {
    ...textStyles.labelCaps,
    color: colors.textSoft,
    fontSize: 11,
    letterSpacing: 0.6,
  },
  input: {
    minHeight: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: 'rgba(8, 14, 19, 0.78)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    fontFamily: fontFamilies.body,
    fontSize: typography.body,
  },
  slugPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: 'rgba(196, 184, 176, 0.06)',
  },
  slugPreviewLabel: {
    ...textStyles.labelCaps,
    color: colors.textSoft,
    fontSize: 10,
    letterSpacing: 0.6,
  },
  slugPreviewValue: {
    ...textStyles.caption,
    color: colors.text,
    fontWeight: '700',
    flex: 1,
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.md,
    shadowColor: colors.primary,
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  primaryButtonDisabled: {
    opacity: 0.55,
    shadowOpacity: 0.1,
  },
  primaryButtonPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  primaryButtonText: {
    ...textStyles.button,
    color: colors.background,
    fontWeight: '800',
  },
});
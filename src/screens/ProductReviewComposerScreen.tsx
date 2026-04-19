/**
 * Product Review Composer Screen
 *
 * Members-only composer for rating + reviewing a product (brand+name slug).
 * Reached from ProductReviewsDetailScreen "Rate this product" or from
 * ScanResultScreen for signed-in members. Anonymous users are bounced to
 * MemberSignIn before reaching this screen.
 *
 * Intentionally narrower than the storefront WriteReview composer — no
 * GIF picker, no photos in this first cut. We ship the chart-first viewing
 * surface in MyProductsScreen and let members add depth here over time.
 */

import React from 'react';
import {
  ActivityIndicator,
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
import { trackAnalyticsEvent } from '../services/analyticsService';
import {
  PRODUCT_REVIEW_EFFECT_TAGS,
  submitProductReviewRequest,
  type ProductReviewEffectTag,
} from '../services/productReviewService';
import { colors, radii, spacing, textStyles } from '../theme/tokens';
import type { RootStackParamList } from '../navigation/rootNavigatorConfig';

type ProductReviewComposerScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'ProductReviewComposer'
>;

const MIN_REVIEW_TEXT_LENGTH = 10;
const MAX_REVIEW_TEXT_LENGTH = 2000;
const MAX_EFFECT_TAGS = 4;

const RATING_LABELS: Record<number, string> = {
  1: 'Pass',
  2: 'Meh',
  3: 'Decent',
  4: 'Great',
  5: 'Loved it',
};

function ProductReviewComposerScreenInner({ route, navigation }: ProductReviewComposerScreenProps) {
  const { productSlug, brandName, productName } = route.params;
  const { authSession, appProfile } = useStorefrontProfileController();
  const profileId = appProfile?.id ?? null;
  const isAuthenticated = authSession.status === 'authenticated';
  const authorName = appProfile?.displayName?.trim() || 'Member';

  const [rating, setRating] = React.useState<number>(0);
  const [text, setText] = React.useState<string>('');
  const [tags, setTags] = React.useState<ProductReviewEffectTag[]>([]);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    trackAnalyticsEvent('product_review_composer_opened', {
      productSlug,
      brandId: brandName || null,
    });
  }, [brandName, productSlug]);

  const trimmedText = text.trim();
  const validationError = React.useMemo<string | null>(() => {
    if (rating < 1 || rating > 5) {
      return 'Pick a star rating (1–5).';
    }
    if (trimmedText.length < MIN_REVIEW_TEXT_LENGTH) {
      const remaining = MIN_REVIEW_TEXT_LENGTH - trimmedText.length;
      return `Add at least ${remaining} more character${remaining === 1 ? '' : 's'} to submit.`;
    }
    if (trimmedText.length > MAX_REVIEW_TEXT_LENGTH) {
      return `Trim your review to ${MAX_REVIEW_TEXT_LENGTH} characters.`;
    }
    return null;
  }, [rating, trimmedText]);

  const canSubmit = !validationError && !submitting && isAuthenticated && profileId !== null;

  const toggleTag = React.useCallback((tag: ProductReviewEffectTag) => {
    setTags((prev) => {
      if (prev.includes(tag)) {
        return prev.filter((t) => t !== tag);
      }
      if (prev.length >= MAX_EFFECT_TAGS) {
        return prev;
      }
      return [...prev, tag];
    });
  }, []);

  const handleSubmit = React.useCallback(async () => {
    if (!profileId || !isAuthenticated) {
      navigation.navigate('MemberSignIn', {
        redirectTo: { kind: 'goBack' },
      });
      return;
    }
    if (validationError) {
      setError(validationError);
      return;
    }
    setSubmitting(true);
    setError(null);
    const result = await submitProductReviewRequest(productSlug, {
      brandName,
      productName,
      profileId,
      authorName,
      rating,
      text: trimmedText,
      effectTags: tags,
    });
    setSubmitting(false);
    if (result.ok) {
      trackAnalyticsEvent('product_review_submitted', {
        productSlug,
        brandId: brandName || null,
        rating,
        tagCount: tags.length,
      });
      navigation.goBack();
    } else {
      setError(result.error);
    }
  }, [
    authorName,
    brandName,
    isAuthenticated,
    navigation,
    productName,
    productSlug,
    profileId,
    rating,
    tags,
    trimmedText,
    validationError,
  ]);

  if (!isAuthenticated) {
    return (
      <ScreenShell
        eyebrow={brandName || 'Product'}
        title="Sign in to rate"
        subtitle="Members can rate and review products they scan."
      >
        <View style={styles.scrollContent}>
          <InlineFeedbackPanel
            tone="info"
            label="Members only"
            title="Sign in to share a review."
            body="Reviews are limited to signed-in members so we can keep the feed authentic."
            iconName="lock-closed-outline"
          />
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              navigation.navigate('MemberSignIn', {
                redirectTo: { kind: 'goBack' },
              })
            }
            style={({ pressed }) => [styles.submitButton, pressed && styles.submitButtonPressed]}
          >
            <Text style={styles.submitButtonText}>Sign in</Text>
          </Pressable>
        </View>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      eyebrow={brandName || 'Product'}
      title={productName || 'Rate this product'}
      subtitle="Share what you noticed — flavor, effects, value. Be honest and kind."
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.stack}>
          <MotionInView dense delay={40}>
            <SectionCard title="Your rating" eyebrow="Step 1" tone="primary">
              <View style={styles.starRow}>
                {[1, 2, 3, 4, 5].map((value) => {
                  const isActive = value <= rating;
                  return (
                    <Pressable
                      key={value}
                      accessibilityRole="button"
                      accessibilityLabel={`${value} star${value === 1 ? '' : 's'}`}
                      onPress={() => setRating(value)}
                      style={({ pressed }) => [
                        styles.starButton,
                        pressed && styles.starButtonPressed,
                      ]}
                    >
                      <AppUiIcon
                        name={isActive ? 'star' : 'star-outline'}
                        size={28}
                        color={isActive ? (colors.accent ?? colors.primary) : colors.textSoft}
                      />
                    </Pressable>
                  );
                })}
              </View>
              <Text style={styles.ratingLabel}>
                {rating > 0 ? `${rating}.0 · ${RATING_LABELS[rating]}` : 'Tap a star to rate.'}
              </Text>
            </SectionCard>
          </MotionInView>

          <MotionInView dense delay={70}>
            <SectionCard title="Your review" eyebrow="Step 2" tone="primary">
              <TextInput
                style={styles.textInput}
                placeholder="What stood out? Flavor, effects, value, packaging…"
                placeholderTextColor={colors.textMuted}
                value={text}
                onChangeText={setText}
                multiline
                maxLength={MAX_REVIEW_TEXT_LENGTH}
                textAlignVertical="top"
                accessibilityLabel="Review text"
              />
              <Text style={styles.charCount}>
                {trimmedText.length} / {MAX_REVIEW_TEXT_LENGTH}
              </Text>
            </SectionCard>
          </MotionInView>

          <MotionInView dense delay={100}>
            <SectionCard
              title="Effects (optional)"
              eyebrow="Step 3"
              tone="primary"
              body={`Pick up to ${MAX_EFFECT_TAGS} that match your experience.`}
            >
              <View style={styles.tagWrap}>
                {PRODUCT_REVIEW_EFFECT_TAGS.map((tag) => {
                  const selected = tags.includes(tag);
                  return (
                    <Pressable
                      key={tag}
                      accessibilityRole="button"
                      accessibilityLabel={`${selected ? 'Remove' : 'Add'} ${tag} tag`}
                      onPress={() => toggleTag(tag)}
                      style={({ pressed }) => [
                        styles.tagPill,
                        selected && styles.tagPillSelected,
                        pressed && styles.tagPillPressed,
                      ]}
                    >
                      <Text style={[styles.tagPillText, selected && styles.tagPillTextSelected]}>
                        {tag}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </SectionCard>
          </MotionInView>

          {error ? (
            <MotionInView dense delay={120}>
              <InlineFeedbackPanel
                tone="warning"
                label="Couldn't submit"
                title="We couldn't post your review."
                body={error}
                iconName="warning-outline"
              />
            </MotionInView>
          ) : null}

          {validationError && !error ? (
            <Text style={styles.helperText}>{validationError}</Text>
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Post review"
            disabled={!canSubmit}
            onPress={handleSubmit}
            style={({ pressed }) => [
              styles.submitButton,
              !canSubmit && styles.submitButtonDisabled,
              pressed && canSubmit && styles.submitButtonPressed,
            ]}
          >
            {submitting ? (
              <ActivityIndicator size="small" color={colors.background} />
            ) : (
              <>
                <AppUiIcon name="send-outline" size={14} color={colors.background} />
                <Text style={styles.submitButtonText}>Post review</Text>
              </>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </ScreenShell>
  );
}

export const ProductReviewComposerScreen = withScreenErrorBoundary(
  ProductReviewComposerScreenInner,
  'product-review-composer-screen',
);

const styles = StyleSheet.create({
  scrollContent: {
    paddingVertical: spacing.lg,
    gap: spacing.lg,
  },
  stack: {
    gap: spacing.lg,
  },
  starRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  starButton: {
    padding: spacing.sm,
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  starButtonPressed: {
    opacity: 0.7,
  },
  ratingLabel: {
    ...textStyles.caption,
    color: colors.textSoft,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  textInput: {
    ...textStyles.body,
    color: colors.text,
    minHeight: 132,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    backgroundColor: 'rgba(196, 184, 176, 0.06)',
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  charCount: {
    ...textStyles.caption,
    color: colors.textSoft,
    textAlign: 'right',
    marginTop: spacing.xs,
  },
  tagWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  tagPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: 'rgba(196, 184, 176, 0.06)',
  },
  tagPillSelected: {
    borderColor: 'rgba(0, 245, 140, 0.36)',
    backgroundColor: 'rgba(0, 245, 140, 0.10)',
  },
  tagPillPressed: {
    opacity: 0.75,
  },
  tagPillText: {
    ...textStyles.caption,
    color: colors.textSoft,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  tagPillTextSelected: {
    color: colors.primary,
  },
  helperText: {
    ...textStyles.caption,
    color: colors.textSoft,
    textAlign: 'center',
  },
  submitButton: {
    minHeight: 48,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  submitButtonPressed: {
    opacity: 0.85,
  },
  submitButtonDisabled: {
    opacity: 0.55,
  },
  submitButtonText: {
    ...textStyles.button,
    color: colors.background,
    fontWeight: '800',
  },
});

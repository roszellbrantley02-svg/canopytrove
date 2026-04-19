/**
 * Product Reviews Detail Screen
 *
 * Drill-down reached only from MyProductsScreen's "More" action. Shows the
 * full review list for a single brand+product slug: aggregate header, tag
 * highlights, and text reviews. Writing a new review is gated to signed-in
 * members (the CTA routes to the composer).
 */

import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppUiIcon } from '../icons/AppUiIcon';
import { InlineFeedbackPanel } from '../components/InlineFeedbackPanel';
import { MotionInView } from '../components/MotionInView';
import { ScreenShell } from '../components/ScreenShell';
import { SectionCard } from '../components/SectionCard';
import { withScreenErrorBoundary } from '../components/withScreenErrorBoundary';
import { useStorefrontProfileController } from '../context/StorefrontController';
import {
  fetchProductReviews,
  type ProductReviewAggregate,
  type ProductReviewSummary,
} from '../services/productReviewService';
import { colors, radii, spacing, textStyles } from '../theme/tokens';
import type { RootStackParamList } from '../navigation/rootNavigatorConfig';

type ProductReviewsDetailScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'ProductReviewsDetail'
>;

function ProductReviewsDetailScreenInner({ route, navigation }: ProductReviewsDetailScreenProps) {
  const { productSlug, brandName, productName } = route.params;
  const { authSession, appProfile } = useStorefrontProfileController();
  const profileId = appProfile?.id ?? null;
  const isAuthenticated = authSession.status === 'authenticated';

  const [reviews, setReviews] = React.useState<ProductReviewSummary[]>([]);
  const [aggregate, setAggregate] = React.useState<ProductReviewAggregate | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      const result = await fetchProductReviews(productSlug, profileId ?? undefined);
      if (cancelled) return;
      if (result.ok) {
        setReviews(result.reviews);
        setAggregate(result.aggregate);
      } else {
        setError(result.error);
      }
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [productSlug, profileId]);

  const handleRatePress = React.useCallback(() => {
    if (!isAuthenticated) {
      navigation.navigate('MemberSignIn', {
        redirectTo: {
          kind: 'navigate',
          screen: 'ProductReviewComposer',
          params: {
            productSlug,
            brandName,
            productName,
          },
        },
      });
      return;
    }
    navigation.push('ProductReviewComposer', {
      productSlug,
      brandName,
      productName,
    });
  }, [brandName, isAuthenticated, navigation, productName, productSlug]);

  return (
    <ScreenShell
      eyebrow={brandName || 'Product'}
      title={productName || 'Product reviews'}
      subtitle={
        aggregate && aggregate.reviewCount > 0
          ? `${aggregate.averageRating.toFixed(1)} avg · ${aggregate.reviewCount} review${
              aggregate.reviewCount === 1 ? '' : 's'
            }`
          : 'Be the first to share a review.'
      }
    >
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.loadingText}>Loading reviews…</Text>
          </View>
        ) : (
          <View style={styles.stack}>
            {error ? (
              <MotionInView dense delay={40}>
                <InlineFeedbackPanel
                  tone="warning"
                  label="Couldn't load"
                  title="We couldn't load reviews right now."
                  body={error}
                  iconName="warning-outline"
                />
              </MotionInView>
            ) : null}

            {aggregate ? (
              <MotionInView dense delay={70}>
                <AggregateCard aggregate={aggregate} />
              </MotionInView>
            ) : null}

            <MotionInView dense delay={90}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  isAuthenticated ? 'Rate this product' : 'Sign in to rate this product'
                }
                onPress={handleRatePress}
                style={({ pressed }) => [styles.rateButton, pressed && styles.rateButtonPressed]}
              >
                <AppUiIcon
                  name={isAuthenticated ? 'star' : 'lock-closed-outline'}
                  size={14}
                  color={colors.background}
                />
                <Text style={styles.rateButtonText}>
                  {isAuthenticated ? 'Rate this product' : 'Sign in to rate'}
                </Text>
              </Pressable>
            </MotionInView>

            {reviews.length === 0 ? (
              <MotionInView dense delay={120}>
                <InlineFeedbackPanel
                  tone="info"
                  label="No reviews yet"
                  title="Nobody has rated this product yet."
                  body="When members rate it, their reviews show up here. Your take could be the first."
                  iconName="chatbubbles-outline"
                />
              </MotionInView>
            ) : (
              reviews.map((review, index) => (
                <MotionInView key={review.id} dense delay={130 + index * 20}>
                  <ReviewCard review={review} />
                </MotionInView>
              ))
            )}
          </View>
        )}
      </ScrollView>
    </ScreenShell>
  );
}

function AggregateCard({ aggregate }: { aggregate: ProductReviewAggregate }) {
  const max = Math.max(1, ...Object.values(aggregate.ratingDistribution));
  const stars: Array<1 | 2 | 3 | 4 | 5> = [5, 4, 3, 2, 1];
  return (
    <SectionCard title="Community rating" eyebrow="At a glance" tone="primary">
      <View style={styles.aggregateRow}>
        <View style={styles.aggregateScore}>
          <Text style={styles.aggregateScoreText}>
            {aggregate.reviewCount > 0 ? aggregate.averageRating.toFixed(1) : '—'}
          </Text>
          <Text style={styles.aggregateScoreCaption}>
            {aggregate.reviewCount} review{aggregate.reviewCount === 1 ? '' : 's'}
          </Text>
        </View>
        <View style={styles.distributionCol}>
          {stars.map((star) => {
            const count = aggregate.ratingDistribution[star] ?? 0;
            const width = `${Math.round((count / max) * 100)}%` as const;
            return (
              <View key={star} style={styles.distributionRow}>
                <Text style={styles.distributionLabel}>{star}★</Text>
                <View style={styles.distributionTrack}>
                  <View style={[styles.distributionFill, { width }]} />
                </View>
                <Text style={styles.distributionCount}>{count}</Text>
              </View>
            );
          })}
        </View>
      </View>
      {aggregate.topEffectTags.length > 0 ? (
        <View style={styles.tagRow}>
          {aggregate.topEffectTags.map(({ tag, count }) => (
            <View key={tag} style={styles.tagPill}>
              <Text style={styles.tagPillText}>
                {tag} · {count}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </SectionCard>
  );
}

function ReviewCard({ review }: { review: ProductReviewSummary }) {
  return (
    <View style={styles.reviewCard}>
      <View style={styles.reviewHeader}>
        <Text style={styles.reviewAuthor}>{review.authorName}</Text>
        <View style={styles.reviewRating}>
          <AppUiIcon name="star" size={12} color={colors.accent ?? colors.primary} />
          <Text style={styles.reviewRatingText}>{review.rating}.0</Text>
        </View>
      </View>
      <Text style={styles.reviewTime}>{review.relativeTime}</Text>
      <Text style={styles.reviewText}>{review.text}</Text>
      {review.effectTags.length > 0 ? (
        <View style={styles.tagRow}>
          {review.effectTags.map((tag) => (
            <View key={tag} style={styles.reviewTag}>
              <Text style={styles.reviewTagText}>{tag}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export const ProductReviewsDetailScreen = withScreenErrorBoundary(
  ProductReviewsDetailScreenInner,
  'product-reviews-detail-screen',
);

const styles = StyleSheet.create({
  scrollContent: {
    paddingVertical: spacing.lg,
  },
  stack: {
    gap: spacing.lg,
  },
  loading: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xl,
  },
  loadingText: {
    ...textStyles.caption,
    color: colors.textSoft,
  },
  rateButton: {
    minHeight: 48,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  rateButtonPressed: {
    opacity: 0.85,
  },
  rateButtonText: {
    ...textStyles.button,
    color: colors.background,
    fontWeight: '900',
  },
  aggregateRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'stretch',
  },
  aggregateScore: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: 'rgba(232, 160, 0, 0.10)',
    minWidth: 86,
  },
  aggregateScoreText: {
    ...textStyles.section,
    color: colors.accent ?? colors.primary,
    fontWeight: '900',
  },
  aggregateScoreCaption: {
    ...textStyles.caption,
    color: colors.textSoft,
    textAlign: 'center',
  },
  distributionCol: {
    flex: 1,
    gap: 4,
    justifyContent: 'center',
  },
  distributionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  distributionLabel: {
    ...textStyles.caption,
    color: colors.textSoft,
    width: 22,
  },
  distributionTrack: {
    flex: 1,
    height: 6,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(196, 184, 176, 0.12)',
    overflow: 'hidden',
  },
  distributionFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
  },
  distributionCount: {
    ...textStyles.caption,
    color: colors.textSoft,
    width: 22,
    textAlign: 'right',
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  tagPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(0, 245, 140, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(0, 245, 140, 0.24)',
  },
  tagPillText: {
    ...textStyles.caption,
    color: colors.primary,
    fontWeight: '700',
  },
  reviewCard: {
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: 'rgba(196, 184, 176, 0.06)',
    borderWidth: 1,
    borderColor: colors.borderSoft,
    gap: spacing.xs,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reviewAuthor: {
    ...textStyles.bodyStrong,
    color: colors.text,
  },
  reviewRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  reviewRatingText: {
    ...textStyles.caption,
    color: colors.accent ?? colors.primary,
    fontWeight: '800',
  },
  reviewTime: {
    ...textStyles.caption,
    color: colors.textSoft,
  },
  reviewText: {
    ...textStyles.body,
    color: colors.text,
    marginTop: spacing.xs,
    lineHeight: 20,
  },
  reviewTag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(46, 204, 113, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(46, 204, 113, 0.3)',
  },
  reviewTagText: {
    ...textStyles.caption,
    color: colors.primary,
    fontSize: 11,
    fontWeight: '700',
  },
});

/**
 * My Products Screen
 *
 * Profile-only surface for reviewing + browsing products. Intentionally
 * compact: lots of products out there, so the layout is dense. Two side-
 * by-side columns:
 *   - Your top-rated — the signed-in member's own ratings, ranked
 *   - Community favorites — what everyone is rating highly
 *
 * Tapping "More" on any row drills into ProductReviewsDetailScreen where
 * the full text reviews live. Anonymous users see a sign-in gate instead.
 */

import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
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
  fetchCommunityFavoriteProducts,
  fetchMyProductReviews,
  type MemberProductReviewRecord,
  type ProductReviewAggregate,
} from '../services/productReviewService';
import { colors, radii, spacing, textStyles } from '../theme/tokens';
import type { RootStackParamList } from '../navigation/rootNavigatorConfig';

type MyProductsScreenProps = NativeStackScreenProps<RootStackParamList, 'MyProducts'>;

type FilterMode = 'all' | 'mine' | 'community';

function MyProductsScreenInner({ navigation }: MyProductsScreenProps) {
  const { authSession, appProfile } = useStorefrontProfileController();
  const profileId = appProfile?.id ?? null;
  const isAuthenticated = authSession.status === 'authenticated';

  const [mine, setMine] = React.useState<MemberProductReviewRecord[]>([]);
  const [community, setCommunity] = React.useState<ProductReviewAggregate[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<FilterMode>('all');

  const loadData = React.useCallback(
    async (showSpinner: boolean) => {
      if (!isAuthenticated || !profileId) {
        setLoading(false);
        setRefreshing(false);
        return;
      }
      if (showSpinner) setLoading(true);
      else setRefreshing(true);
      setError(null);
      try {
        const [mineResult, communityResult] = await Promise.all([
          fetchMyProductReviews(profileId),
          fetchCommunityFavoriteProducts(),
        ]);
        if (mineResult.ok) {
          setMine(mineResult.reviews);
        } else {
          setError(mineResult.error);
        }
        if (communityResult.ok) {
          setCommunity(communityResult.favorites);
        } else if (!error) {
          setError(communityResult.error);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [isAuthenticated, profileId, error],
  );

  React.useEffect(() => {
    if (isAuthenticated) {
      trackAnalyticsEvent('my_products_opened');
      trackAnalyticsEvent('community_favorites_viewed');
      void loadData(true);
    } else {
      setLoading(false);
    }
  }, [isAuthenticated, loadData]);

  const handleFilterChange = React.useCallback((next: FilterMode) => {
    setFilter(next);
    trackAnalyticsEvent('my_products_filter_changed', { filter: next });
  }, []);

  const handleOpenDetail = React.useCallback(
    (productSlug: string, brandName: string, productName: string) => {
      trackAnalyticsEvent('my_product_detail_opened', { productSlug });
      navigation.push('ProductReviewsDetail', {
        productSlug,
        brandName,
        productName,
      });
    },
    [navigation],
  );

  const minePeak = React.useMemo(() => {
    const sorted = [...mine].sort((a, b) => b.rating - a.rating);
    return sorted.slice(0, 12);
  }, [mine]);

  const communityPeak = React.useMemo(() => community.slice(0, 12), [community]);

  // Unauthenticated gate
  if (!isAuthenticated) {
    return (
      <ScreenShell
        eyebrow="Review products"
        title="Sign in to rate products"
        subtitle="Reviews are a member-only feature."
      >
        <View style={styles.gateStack}>
          <MotionInView dense delay={80}>
            <InlineFeedbackPanel
              tone="info"
              label="Members only"
              title="Sign in to rate products you've scanned and see what others think."
              body="Scanning and verifying licensed shops stays free for everyone. Ratings and product reviews live here in your Profile when you're signed in."
              iconName="lock-closed-outline"
            />
          </MotionInView>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sign in"
            onPress={() =>
              navigation.navigate('MemberSignIn', {
                redirectTo: { kind: 'goBack' },
              })
            }
            style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}
          >
            <Text style={styles.primaryButtonText}>Sign in</Text>
          </Pressable>
        </View>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      eyebrow="Review products"
      title="Your products"
      subtitle={
        mine.length > 0
          ? `${mine.length} rated • ${community.length} trending in the community`
          : 'Rate the products you scan and see what the community loves.'
      }
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadData(false)}
            tintColor={colors.primary}
          />
        }
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.loadingText}>Loading your products…</Text>
          </View>
        ) : (
          <View style={styles.stack}>
            {error ? (
              <MotionInView dense delay={40}>
                <InlineFeedbackPanel
                  tone="warning"
                  label="Couldn't load"
                  title="We couldn't pull product reviews right now."
                  body={error}
                  iconName="warning-outline"
                />
              </MotionInView>
            ) : null}

            <MotionInView dense delay={60}>
              <FilterRow current={filter} onChange={handleFilterChange} />
            </MotionInView>

            {(filter === 'all' || filter === 'mine') && (
              <MotionInView dense delay={90}>
                <CompactColumn
                  title="Your top picks"
                  emptyHint="Rate a product from the scan result screen and it shows up here."
                  rows={minePeak.map((record) => ({
                    key: record.id,
                    productSlug: record.productSlug,
                    brandName: record.brandName,
                    productName: record.productName,
                    primary: `${record.rating}.0`,
                    secondary: `${record.effectTags.slice(0, 2).join(' · ') || '—'}`,
                    label: 'You',
                  }))}
                  onOpen={handleOpenDetail}
                />
              </MotionInView>
            )}

            {(filter === 'all' || filter === 'community') && (
              <MotionInView dense delay={120}>
                <CompactColumn
                  title="Community favorites"
                  emptyHint="No community ratings yet. Yours could be the first."
                  rows={communityPeak.map((aggregate) => ({
                    key: aggregate.productSlug,
                    productSlug: aggregate.productSlug,
                    brandName: aggregate.brandName,
                    productName: aggregate.productName,
                    primary: aggregate.averageRating ? aggregate.averageRating.toFixed(1) : '—',
                    secondary: `${aggregate.reviewCount} rating${
                      aggregate.reviewCount === 1 ? '' : 's'
                    }`,
                    label: 'Community',
                  }))}
                  onOpen={handleOpenDetail}
                />
              </MotionInView>
            )}

            <MotionInView dense delay={150}>
              <InlineFeedbackPanel
                tone="info"
                label="How it works"
                title="Rate products you scan, then tap More on a row to see what everyone else is saying."
                body="Reviews are aggregated by brand and product name, so different batches of the same item roll into the same page."
                iconName="information-circle-outline"
              />
            </MotionInView>
          </View>
        )}
      </ScrollView>
    </ScreenShell>
  );
}

/* ── Small presentational pieces ─────────────────────────────────────── */

function FilterRow({
  current,
  onChange,
}: {
  current: FilterMode;
  onChange: (mode: FilterMode) => void;
}) {
  const options: Array<{ key: FilterMode; label: string }> = [
    { key: 'all', label: 'Both' },
    { key: 'mine', label: 'Mine' },
    { key: 'community', label: 'Community' },
  ];
  return (
    <View style={styles.filterRow}>
      {options.map((opt) => {
        const active = current === opt.key;
        return (
          <Pressable
            key={opt.key}
            accessibilityRole="button"
            accessibilityLabel={`Show ${opt.label}`}
            onPress={() => onChange(opt.key)}
            style={({ pressed }) => [
              styles.filterPill,
              active && styles.filterPillActive,
              pressed && styles.filterPillPressed,
            ]}
          >
            <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

type CompactRow = {
  key: string;
  productSlug: string;
  brandName: string;
  productName: string;
  primary: string;
  secondary: string;
  label: string;
};

function CompactColumn({
  title,
  emptyHint,
  rows,
  onOpen,
}: {
  title: string;
  emptyHint: string;
  rows: CompactRow[];
  onOpen: (productSlug: string, brandName: string, productName: string) => void;
}) {
  return (
    <SectionCard title={title} eyebrow="Ranked" tone="primary">
      {rows.length === 0 ? (
        <Text style={styles.emptyHint}>{emptyHint}</Text>
      ) : (
        <View style={styles.rowList}>
          {rows.map((row, index) => (
            <View key={row.key} style={styles.row}>
              <View style={styles.rowRank}>
                <Text style={styles.rowRankText}>{index + 1}</Text>
              </View>
              <View style={styles.rowMain}>
                <Text style={styles.rowProduct} numberOfLines={1}>
                  {row.productName || 'Untitled product'}
                </Text>
                <Text style={styles.rowBrand} numberOfLines={1}>
                  {row.brandName || 'Unknown brand'} · {row.secondary}
                </Text>
              </View>
              <View style={styles.rowPrimary}>
                <AppUiIcon name="star" size={11} color={colors.accent ?? colors.primary} />
                <Text style={styles.rowPrimaryText}>{row.primary}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Open reviews for ${row.productName}`}
                onPress={() => onOpen(row.productSlug, row.brandName, row.productName)}
                style={({ pressed }) => [styles.rowMore, pressed && styles.rowMorePressed]}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.rowMoreText}>More</Text>
                <AppUiIcon name="chevron-forward" size={12} color={colors.primary} />
              </Pressable>
            </View>
          ))}
        </View>
      )}
    </SectionCard>
  );
}

export const MyProductsScreen = withScreenErrorBoundary(
  MyProductsScreenInner,
  'my-products-screen',
);

const styles = StyleSheet.create({
  scrollContent: {
    paddingVertical: spacing.lg,
  },
  stack: {
    gap: spacing.lg,
  },
  loadingContainer: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xl,
  },
  loadingText: {
    ...textStyles.caption,
    color: colors.textSoft,
  },
  gateStack: {
    gap: spacing.lg,
    paddingVertical: spacing.lg,
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonPressed: {
    opacity: 0.85,
  },
  primaryButtonText: {
    ...textStyles.button,
    color: colors.background,
    fontWeight: '900',
  },
  filterRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  filterPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(196, 184, 176, 0.08)',
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  filterPillActive: {
    backgroundColor: 'rgba(0, 245, 140, 0.14)',
    borderColor: 'rgba(0, 245, 140, 0.45)',
  },
  filterPillPressed: {
    opacity: 0.7,
  },
  filterPillText: {
    ...textStyles.caption,
    color: colors.textSoft,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  filterPillTextActive: {
    color: colors.primary,
  },
  rowList: {
    gap: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  rowRank: {
    width: 22,
    height: 22,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(196, 184, 176, 0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowRankText: {
    ...textStyles.caption,
    color: colors.textSoft,
    fontWeight: '800',
  },
  rowMain: {
    flex: 1,
    minWidth: 0,
  },
  rowProduct: {
    ...textStyles.body,
    color: colors.text,
    fontWeight: '700',
  },
  rowBrand: {
    ...textStyles.caption,
    color: colors.textSoft,
  },
  rowPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(232, 160, 0, 0.10)',
  },
  rowPrimaryText: {
    ...textStyles.caption,
    color: colors.accent ?? colors.primary,
    fontWeight: '800',
  },
  rowMore: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  rowMorePressed: {
    opacity: 0.6,
  },
  rowMoreText: {
    ...textStyles.caption,
    color: colors.primary,
    fontWeight: '800',
  },
  emptyHint: {
    ...textStyles.caption,
    color: colors.textSoft,
    lineHeight: 20,
    paddingVertical: spacing.sm,
  },
});

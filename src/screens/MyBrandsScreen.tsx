import React, { useEffect, useState } from 'react';
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
import { ScreenShell } from '../components/ScreenShell';
import { SectionCard } from '../components/SectionCard';
import { withScreenErrorBoundary } from '../components/withScreenErrorBoundary';
import { useStorefrontProfileController } from '../context/StorefrontController';
import { trackAnalyticsEvent } from '../services/analyticsService';
import { listFavoriteBrands, removeFavoriteBrand } from '../services/brandService';
import { getCanopyTroveAuthIdToken } from '../services/canopyTroveAuthService';
import { colors, radii, spacing, textStyles } from '../theme/tokens';
import type { RootStackParamList } from '../navigation/rootNavigatorConfig';
import type { BrandProfile, BrandSortKey } from '../types/brandTypes';

type MyBrandsScreenProps = NativeStackScreenProps<RootStackParamList, 'MyBrands'>;

type SortState = {
  dimension: BrandSortKey;
  filter?: string;
};

function MyBrandsScreenInner({ navigation }: MyBrandsScreenProps) {
  const { authSession, profileId } = useStorefrontProfileController();
  const isAuthenticated = authSession.status === 'authenticated';
  const [brands, setBrands] = useState<BrandProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sortState, setSortState] = useState<SortState>({ dimension: 'potency' });

  const loadBrands = React.useCallback(
    async (showSpinner = true) => {
      try {
        if (showSpinner) setLoading(true);
        else setRefreshing(true);

        if (!isAuthenticated || !profileId) {
          setBrands([]);
          return;
        }

        const token = await getCanopyTroveAuthIdToken();
        const data = await listFavoriteBrands({ profileId, token: token ?? undefined });
        setBrands(data);

        if (showSpinner) {
          trackAnalyticsEvent('my_brands_opened');
        }
      } catch (error) {
        console.warn('Failed to load brands', error);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [isAuthenticated, profileId],
  );

  useEffect(() => {
    void loadBrands();
  }, [loadBrands]);

  const handleSortChange = (dimension: BrandSortKey) => {
    setSortState({ dimension, filter: undefined });
    trackAnalyticsEvent('my_brands_sort_changed', { dimension });
  };

  const handleFilterChange = (filter: string) => {
    setSortState({ ...sortState, filter: filter === '' ? undefined : filter });
    trackAnalyticsEvent('my_brands_filter_changed', { filter });
  };

  const handleBrandTap = (brand: BrandProfile) => {
    trackAnalyticsEvent('my_brand_tapped', { brandId: brand.brandId });
    navigation.push('BrandDetail', { brandId: brand.brandId });
  };

  const handleRemoveBrand = async (brandId: string) => {
    if (!isAuthenticated || !profileId) {
      return;
    }
    try {
      const token = await getCanopyTroveAuthIdToken();
      await removeFavoriteBrand(brandId, { profileId, token: token ?? undefined });
      setBrands((prev) => prev.filter((b) => b.brandId !== brandId));
      trackAnalyticsEvent('my_brand_removed', { brandId });
    } catch (error) {
      console.warn('Failed to remove brand', error);
    }
  };

  const getSortedAndFilteredBrands = () => {
    let sorted = [...brands];

    if (sortState.filter) {
      const filterVal = sortState.filter;
      sorted = sorted.filter((b) => {
        if (sortState.dimension === 'smell') {
          return b.smellTags.some((tag) => tag === filterVal);
        }
        if (sortState.dimension === 'taste') {
          return b.tasteTags.some((tag) => tag === filterVal);
        }
        return true;
      });
    }

    switch (sortState.dimension) {
      case 'smell':
        return sorted.sort((a, b) => {
          const smellA = a.smellTags[0] ?? '';
          const smellB = b.smellTags[0] ?? '';
          if (smellA !== smellB) return smellA.localeCompare(smellB);
          return b.totalScans - a.totalScans;
        });
      case 'taste':
        return sorted.sort((a, b) => {
          const tasteA = a.tasteTags[0] ?? '';
          const tasteB = b.tasteTags[0] ?? '';
          if (tasteA !== tasteB) return tasteA.localeCompare(tasteB);
          return b.totalScans - a.totalScans;
        });
      case 'potency':
      default:
        return sorted.sort((a, b) => b.avgThcPercent - a.avgThcPercent);
    }
  };

  const getFilterOptions = (): string[] => {
    if (sortState.dimension === 'potency') return [];

    const seen = new Set<string>();
    brands.forEach((b) => {
      if (sortState.dimension === 'smell') {
        b.smellTags.forEach((tag) => seen.add(tag));
      } else if (sortState.dimension === 'taste') {
        b.tasteTags.forEach((tag) => seen.add(tag));
      }
    });
    return Array.from(seen).sort();
  };

  const sortedBrands = getSortedAndFilteredBrands();
  const filterOptions = getFilterOptions();

  if (loading) {
    return (
      <ScreenShell
        eyebrow="Your brands"
        title="Save what you love."
        subtitle="Sort by how it smells, tastes, or hits."
      >
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ScreenShell>
    );
  }

  if (brands.length === 0) {
    return (
      <ScreenShell
        eyebrow="Your brands"
        title="Save what you love."
        subtitle="Sort by how it smells, tastes, or hits."
      >
        <View style={styles.centerContainer}>
          <Text style={styles.emptyStateTitle}>No saved brands yet</Text>
          <Text style={styles.emptyStateText}>Scan a product or browse brands to get started.</Text>
          <Pressable
            accessibilityRole="button"
            style={styles.ctaButton}
            onPress={() => navigation.navigate('BrowseBrands')}
          >
            <Text style={styles.ctaButtonText}>Browse Brands</Text>
          </Pressable>
        </View>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      eyebrow="Your brands"
      title="Save what you love."
      subtitle="Sort by how it smells, tastes, or hits."
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadBrands(false)} />
        }
        contentContainerStyle={styles.content}
      >
        <View style={styles.sortRow}>
          {(['potency', 'smell', 'taste'] as const).map((dim) => (
            <Pressable
              key={dim}
              accessibilityRole="button"
              style={[styles.sortChip, sortState.dimension === dim && styles.sortChipActive]}
              onPress={() => handleSortChange(dim)}
            >
              <Text
                style={[
                  styles.sortChipText,
                  sortState.dimension === dim && styles.sortChipTextActive,
                ]}
              >
                {dim === 'potency' ? 'Potency' : dim === 'smell' ? 'Smell' : 'Taste'}
              </Text>
            </Pressable>
          ))}
        </View>

        {filterOptions.length > 0 && (
          <View style={styles.filterRow}>
            <Pressable
              accessibilityRole="button"
              style={[styles.filterChip, !sortState.filter && styles.filterChipActive]}
              onPress={() => handleFilterChange('')}
            >
              <Text
                style={[styles.filterChipText, !sortState.filter && styles.filterChipTextActive]}
              >
                All
              </Text>
            </Pressable>
            {filterOptions.map((filter) => (
              <Pressable
                key={filter}
                accessibilityRole="button"
                style={[styles.filterChip, sortState.filter === filter && styles.filterChipActive]}
                onPress={() => handleFilterChange(filter)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    sortState.filter === filter && styles.filterChipTextActive,
                  ]}
                >
                  {filter}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {sortedBrands.length === 0 ? (
          <View style={styles.centerContainer}>
            <Text style={styles.emptyStateText}>No brands match this filter.</Text>
          </View>
        ) : (
          sortedBrands.map((brand) => (
            <Pressable
              key={brand.brandId}
              accessibilityRole="button"
              style={styles.brandCard}
              onPress={() => handleBrandTap(brand)}
            >
              <SectionCard title={brand.displayName}>
                <View style={styles.brandCardContent}>
                  <View style={styles.brandInfo}>
                    {brand.aggregateDominantTerpene && (
                      <View style={styles.brandChip}>
                        <Text style={styles.brandChipText}>{brand.aggregateDominantTerpene}</Text>
                      </View>
                    )}
                    <View style={styles.brandMeta}>
                      <Text style={styles.brandMetaText}>{brand.avgThcPercent}% THC</Text>
                      <Text style={styles.brandMetaText}>
                        {Math.round(brand.contaminantPassRate * 100)}% pass rate
                      </Text>
                    </View>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${brand.displayName}`}
                    style={styles.removeButton}
                    onPress={(e) => {
                      e.stopPropagation();
                      void handleRemoveBrand(brand.brandId);
                    }}
                  >
                    <Text style={styles.removeButtonText}>Remove</Text>
                  </Pressable>
                </View>
              </SectionCard>
            </Pressable>
          ))
        )}

        <View style={{ height: spacing.lg }} />
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  emptyStateTitle: {
    ...textStyles.section,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  emptyStateText: {
    ...textStyles.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  ctaButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
  },
  ctaButtonText: {
    ...textStyles.button,
    color: colors.background,
  },
  sortRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  sortChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sortChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  sortChipText: {
    ...textStyles.caption,
    fontWeight: '600',
    color: colors.text,
  },
  sortChipTextActive: {
    color: colors.background,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    ...textStyles.caption,
    color: colors.text,
  },
  filterChipTextActive: {
    color: colors.background,
  },
  brandCard: {
    marginBottom: spacing.md,
  },
  brandCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brandInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  brandChip: {
    backgroundColor: colors.primary,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    marginBottom: spacing.sm,
  },
  brandChipText: {
    ...textStyles.caption,
    color: colors.background,
    fontWeight: '600',
  },
  brandMeta: {
    gap: spacing.xs,
  },
  brandMetaText: {
    ...textStyles.caption,
    color: colors.textMuted,
  },
  removeButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.danger,
    opacity: 0.8,
  },
  removeButtonText: {
    ...textStyles.caption,
    fontWeight: '600',
    color: '#fff',
  },
});

export const MyBrandsScreen = withScreenErrorBoundary(MyBrandsScreenInner, 'my-brands');
export default MyBrandsScreen;

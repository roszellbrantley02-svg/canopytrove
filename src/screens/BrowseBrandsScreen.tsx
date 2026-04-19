import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenShell } from '../components/ScreenShell';
import { SectionCard } from '../components/SectionCard';
import { withScreenErrorBoundary } from '../components/withScreenErrorBoundary';
import { useStorefrontProfileController } from '../context/StorefrontController';
import { trackAnalyticsEvent } from '../services/analyticsService';
import { listBrands, addFavoriteBrand } from '../services/brandService';
import { getCanopyTroveAuthIdToken } from '../services/canopyTroveAuthService';
import { colors, radii, spacing, textStyles } from '../theme/tokens';
import type { RootStackParamList } from '../navigation/rootNavigatorConfig';
import type { BrandProfileSummary, BrandSortKey } from '../types/brandTypes';

type BrowseBrandsScreenProps = NativeStackScreenProps<RootStackParamList, 'BrowseBrands'>;

type SortState = {
  dimension: BrandSortKey;
  filter?: string;
};

function BrowseBrandsScreenInner({ navigation }: BrowseBrandsScreenProps) {
  const { authSession, profileId } = useStorefrontProfileController();
  const isAuthenticated = authSession.status === 'authenticated';
  const [brands, setBrands] = useState<BrandProfileSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sortState, setSortState] = useState<SortState>({ dimension: 'potency' });
  const [filterOptions, setFilterOptions] = useState<string[]>([]);
  const [savedBrandIds, setSavedBrandIds] = useState<Set<string>>(new Set());

  const loadBrands = React.useCallback(
    async (showSpinner = true, sort?: BrandSortKey, filter?: string) => {
      try {
        if (showSpinner) setLoading(true);
        else setRefreshing(true);

        const sortDim = sort || sortState.dimension;
        const filterVal = filter !== undefined ? filter : sortState.filter;

        const result = await listBrands({
          sort: sortDim,
          filter: filterVal || undefined,
        });

        setBrands(result.brands);
        if (result.filterOptions) {
          setFilterOptions(
            sortDim === 'smell'
              ? result.filterOptions.smell || []
              : sortDim === 'taste'
                ? result.filterOptions.taste || []
                : [],
          );
        }

        if (showSpinner) {
          trackAnalyticsEvent('browse_brands_opened');
        }
      } catch (error) {
        console.error('Failed to load brands', error);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [sortState.dimension, sortState.filter],
  );

  useEffect(() => {
    void loadBrands();
  }, [loadBrands]);

  const handleSortChange = (dimension: BrandSortKey) => {
    setSortState({ dimension, filter: undefined });
    trackAnalyticsEvent('browse_brands_sort_changed', { dimension });
  };

  const handleFilterChange = (filter: string) => {
    const newFilter = filter === '' ? undefined : filter;
    setSortState((current) => ({ ...current, filter: newFilter }));
  };

  const handleBrandTap = (brandId: string) => {
    navigation.push('BrandDetail', { brandId });
  };

  const handleSaveBrand = async (brandId: string) => {
    if (!isAuthenticated || !profileId) {
      navigation.navigate('MemberSignIn', { redirectTo: { kind: 'goBack' } });
      return;
    }
    try {
      const token = await getCanopyTroveAuthIdToken();
      await addFavoriteBrand(brandId, { profileId, token: token ?? undefined });
      setSavedBrandIds(new Set([...savedBrandIds, brandId]));
      trackAnalyticsEvent('browse_brand_saved', { brandId });
    } catch (error) {
      console.error('Failed to save brand', error);
    }
  };

  if (loading) {
    return (
      <ScreenShell eyebrow="Browse" title="Discover brands." subtitle="Find what you love.">
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell eyebrow="Browse" title="Discover brands." subtitle="Find what you love.">
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadBrands(false)} />
        }
        contentContainerStyle={styles.content}
      >
        {/* Sort Controls */}
        <View style={styles.sortRow}>
          {(['potency', 'smell', 'taste'] as const).map((dim) => (
            <Pressable
              key={dim}
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

        {/* Filter Controls */}
        {filterOptions.length > 0 && (
          <View style={styles.filterRow}>
            <Pressable
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

        {/* Brand List */}
        {brands.length === 0 ? (
          <View style={styles.centerContainer}>
            <Text style={styles.emptyStateText}>No brands found.</Text>
          </View>
        ) : (
          brands.map((brand) => (
            <Pressable
              key={brand.brandId}
              style={styles.brandCard}
              onPress={() => handleBrandTap(brand.brandId)}
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
                    style={[
                      styles.saveButton,
                      savedBrandIds.has(brand.brandId) && styles.saveButtonSaved,
                    ]}
                    onPress={(e) => {
                      e.stopPropagation();
                      if (!savedBrandIds.has(brand.brandId)) {
                        void handleSaveBrand(brand.brandId);
                      }
                    }}
                  >
                    <Text style={styles.saveButtonText}>
                      {savedBrandIds.has(brand.brandId) ? '♥' : '♡'}
                    </Text>
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
  emptyStateText: {
    ...textStyles.body,
    color: colors.textMuted,
    textAlign: 'center',
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
  saveButton: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  saveButtonSaved: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  saveButtonText: {
    fontSize: 24,
    color: colors.text,
  },
});

export const BrowseBrandsScreen = withScreenErrorBoundary(BrowseBrandsScreenInner, 'browse-brands');
export default BrowseBrandsScreen;

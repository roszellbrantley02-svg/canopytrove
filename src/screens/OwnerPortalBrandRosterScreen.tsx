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
import { withScreenErrorBoundary } from '../components/withScreenErrorBoundary';
import { InlineFeedbackPanel } from '../components/InlineFeedbackPanel';
import { MotionInView } from '../components/MotionInView';
import { ScreenShell } from '../components/ScreenShell';
import { SectionCard } from '../components/SectionCard';

import { ownerPortalStyles as sharedStyles } from './ownerPortal/ownerPortalStyles';
import {
  getOwnerPortalBrands,
  saveOwnerPortalBrands,
} from '../services/ownerPortalWorkspaceService';
import { listBrands } from '../services/brandService';
import type { BrandProfileSummary } from '../types/brandTypes';
import { colors, radii, spacing, textStyles } from '../theme/tokens';

type State = {
  loading: boolean;
  saving: boolean;
  error: string | null;
  successNote: string | null;
  selectedIds: string[];
  originalIds: string[];
  catalog: BrandProfileSummary[];
  searchQuery: string;
};

const INITIAL_STATE: State = {
  loading: true,
  saving: false,
  error: null,
  successNote: null,
  selectedIds: [],
  originalIds: [],
  catalog: [],
  searchQuery: '',
};

function OwnerPortalBrandRosterScreenInner() {
  const [state, setState] = React.useState<State>(INITIAL_STATE);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [roster, brandList] = await Promise.all([
          getOwnerPortalBrands(),
          listBrands({ limit: 200 }),
        ]);
        if (cancelled) return;
        setState((prev) => ({
          ...prev,
          loading: false,
          selectedIds: roster.brandIds ?? [],
          originalIds: roster.brandIds ?? [],
          catalog: brandList.brands ?? [],
        }));
      } catch (err) {
        if (cancelled) return;
        setState((prev) => ({
          ...prev,
          loading: false,
          error:
            err instanceof Error
              ? err.message
              : 'Could not load your brand roster. Try again in a moment.',
        }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const hasChanges = React.useMemo(() => {
    if (state.selectedIds.length !== state.originalIds.length) return true;
    const a = [...state.selectedIds].sort();
    const b = [...state.originalIds].sort();
    return a.some((id, i) => id !== b[i]);
  }, [state.selectedIds, state.originalIds]);

  const toggleBrand = React.useCallback((brandId: string) => {
    setState((prev) => {
      const next = prev.selectedIds.includes(brandId)
        ? prev.selectedIds.filter((id) => id !== brandId)
        : [...prev.selectedIds, brandId];
      return { ...prev, selectedIds: next, successNote: null };
    });
  }, []);

  const handleSave = React.useCallback(async () => {
    setState((prev) => ({ ...prev, saving: true, error: null, successNote: null }));
    try {
      const result = await saveOwnerPortalBrands(state.selectedIds);
      setState((prev) => ({
        ...prev,
        saving: false,
        originalIds: result.brandIds,
        selectedIds: result.brandIds,
        successNote: `Roster updated. Shoppers can now see these brands at your shop.`,
      }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        saving: false,
        error:
          err instanceof Error
            ? err.message
            : 'Could not save your brand roster. Try again in a moment.',
      }));
    }
  }, [state.selectedIds]);

  const filteredCatalog = React.useMemo(() => {
    const q = state.searchQuery.trim().toLowerCase();
    if (!q) return state.catalog;
    return state.catalog.filter(
      (brand) =>
        brand.displayName.toLowerCase().includes(q) || brand.brandId.toLowerCase().includes(q),
    );
  }, [state.catalog, state.searchQuery]);

  const selectedCount = state.selectedIds.length;

  if (state.loading) {
    return (
      <ScreenShell
        eyebrow="Owner Portal"
        title="Brands we carry"
        subtitle="Loading your roster..."
        headerPill="Brands"
      >
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      eyebrow="Owner Portal"
      title="Brands we carry"
      subtitle="Tell shoppers which brands you stock. Your roster powers the 'Where to find it' lookup on scan results."
      headerPill="Brands"
    >
      <ScrollView contentContainerStyle={sharedStyles.form}>
        {state.error ? (
          <InlineFeedbackPanel title="Could not save" tone="danger" body={state.error} />
        ) : null}
        {state.successNote ? (
          <InlineFeedbackPanel title="Saved" tone="success" body={state.successNote} />
        ) : null}

        <MotionInView delay={60}>
          <SectionCard
            title="Your roster"
            body={`${selectedCount} brand${selectedCount === 1 ? '' : 's'} selected. Shoppers see these on scan results when a product matches.`}
          >
            {selectedCount === 0 ? (
              <Text style={styles.emptyNote}>
                No brands selected yet. Tap any brand below to add it.
              </Text>
            ) : (
              <View style={styles.chipWrap}>
                {state.selectedIds.map((id) => {
                  const meta = state.catalog.find((b) => b.brandId === id);
                  return (
                    <Pressable
                      key={`selected-${id}`}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${meta?.displayName ?? id}`}
                      onPress={() => toggleBrand(id)}
                      style={styles.chipSelected}
                    >
                      <Text style={styles.chipSelectedText}>{meta?.displayName ?? id} ×</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </SectionCard>
        </MotionInView>

        <MotionInView delay={120}>
          <SectionCard title="Add brands" body="Search the NY catalog and tap any brand you stock.">
            <TextInput
              value={state.searchQuery}
              onChangeText={(text) => setState((prev) => ({ ...prev, searchQuery: text }))}
              placeholder="Search brands..."
              placeholderTextColor={colors.textSoft}
              style={styles.searchInput}
              autoCorrect={false}
              autoCapitalize="none"
            />
            <View style={styles.catalogList}>
              {filteredCatalog.slice(0, 60).map((brand) => {
                const isSelected = state.selectedIds.includes(brand.brandId);
                return (
                  <Pressable
                    key={brand.brandId}
                    accessibilityRole="button"
                    accessibilityLabel={`${isSelected ? 'Remove' : 'Add'} ${brand.displayName}`}
                    onPress={() => toggleBrand(brand.brandId)}
                    style={[styles.catalogRow, isSelected && styles.catalogRowSelected]}
                  >
                    <Text
                      style={[styles.catalogRowText, isSelected && styles.catalogRowTextSelected]}
                    >
                      {brand.displayName}
                    </Text>
                    <Text style={styles.catalogRowAction}>{isSelected ? '✓' : '+'}</Text>
                  </Pressable>
                );
              })}
              {filteredCatalog.length === 0 ? (
                <Text style={styles.emptyNote}>No brands match your search.</Text>
              ) : null}
            </View>
          </SectionCard>
        </MotionInView>

        <MotionInView delay={180}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Save roster"
            accessibilityState={{ disabled: state.saving || !hasChanges }}
            disabled={state.saving || !hasChanges}
            onPress={handleSave}
            style={[
              sharedStyles.primaryButton,
              (state.saving || !hasChanges) && styles.buttonDisabled,
            ]}
          >
            <Text style={sharedStyles.primaryButtonText}>
              {state.saving ? 'Saving...' : 'Save roster'}
            </Text>
          </Pressable>
        </MotionInView>
      </ScrollView>
    </ScreenShell>
  );
}

export const OwnerPortalBrandRosterScreen = withScreenErrorBoundary(
  OwnerPortalBrandRosterScreenInner,
  'owner-portal-brand-roster',
);

export default OwnerPortalBrandRosterScreen;

const styles = StyleSheet.create({
  loadingWrap: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chipSelected: {
    backgroundColor: colors.surfaceHighlight,
    borderRadius: radii.md,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  chipSelectedText: {
    ...textStyles.caption,
    color: colors.text,
  },
  searchInput: {
    backgroundColor: colors.surface,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    minHeight: 44,
  },
  catalogList: {
    gap: spacing.xs,
  },
  catalogRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    minHeight: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  catalogRowSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.surfaceHighlight,
  },
  catalogRowText: {
    ...textStyles.body,
    color: colors.text,
    flex: 1,
  },
  catalogRowTextSelected: {
    color: colors.text,
    fontWeight: '600',
  },
  catalogRowAction: {
    ...textStyles.bodyStrong,
    color: colors.accent,
    marginLeft: spacing.sm,
  },
  emptyNote: {
    ...textStyles.caption,
    color: colors.textSoft,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});

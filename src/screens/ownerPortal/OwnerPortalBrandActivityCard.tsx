import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { AppUiIcon } from '../../icons/AppUiIcon';
import { SectionCard } from '../../components/SectionCard';
import {
  getOwnerPortalBrandActivity,
  type OwnerPortalBrandActivityBrand,
  type OwnerPortalBrandActivityResponse,
} from '../../services/ownerPortalWorkspaceService';
import { captureMonitoringException } from '../../services/sentryMonitoringService';
import { colors, radii, spacing, textStyles } from '../../theme/tokens';

type OwnerPortalBrandActivityCardProps = {
  locationId?: string | null;
  sinceDays?: number;
  limit?: number;
};

function formatScansLabel(count: number): string {
  if (count === 1) {
    return '1 scan nearby';
  }
  return `${count} scans nearby`;
}

function formatGeneratedAt(timestamp: string | null): string {
  if (!timestamp) {
    return '';
  }
  try {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) {
      return '';
    }
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return '';
  }
}

export function OwnerPortalBrandActivityCard({
  locationId,
  sinceDays = 7,
  limit = 5,
}: OwnerPortalBrandActivityCardProps) {
  const [brands, setBrands] = React.useState<OwnerPortalBrandActivityBrand[] | null>(null);
  const [generatedAt, setGeneratedAt] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [errorText, setErrorText] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setIsLoading(true);
    setErrorText(null);
    try {
      const response: OwnerPortalBrandActivityResponse = await getOwnerPortalBrandActivity({
        locationId,
        sinceDays,
        limit,
      });
      setBrands(response.brands ?? []);
      setGeneratedAt(response.generatedAt ?? null);
    } catch (error) {
      setErrorText(
        error instanceof Error ? error.message : 'Unable to load brand activity right now.',
      );
      captureMonitoringException(error, {
        source: 'OwnerPortalBrandActivityCard',
        tags: { errorContext: 'loadBrandActivity' },
      });
    } finally {
      setIsLoading(false);
    }
  }, [limit, locationId, sinceDays]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const showEmpty = !isLoading && !errorText && brands !== null && brands.length === 0;
  const hasResults = !isLoading && !errorText && brands !== null && brands.length > 0;
  const generatedLabel = formatGeneratedAt(generatedAt);

  return (
    <SectionCard
      title="Brand activity nearby"
      body={`What shoppers have been scanning near your shop in the last ${sinceDays} day${sinceDays === 1 ? '' : 's'}.`}
      iconName="pricetag-outline"
      tone="cyan"
    >
      {isLoading && brands === null ? (
        <View style={styles.stateBlock}>
          <ActivityIndicator size="small" color={colors.cyan} />
          <Text style={styles.stateText}>Checking nearby scans…</Text>
        </View>
      ) : null}

      {errorText ? (
        <View style={styles.stateBlock}>
          <AppUiIcon name="warning-outline" size={18} color={colors.danger} />
          <Text style={[styles.stateText, styles.errorText]}>{errorText}</Text>
          <Pressable
            onPress={() => {
              void load();
            }}
            accessibilityRole="button"
            style={styles.retryButton}
          >
            <Text style={styles.retryButtonText}>Try again</Text>
          </Pressable>
        </View>
      ) : null}

      {showEmpty ? (
        <View style={styles.stateBlock}>
          <AppUiIcon name="stats-chart-outline" size={22} color={colors.textSoft} />
          <Text style={styles.stateText}>
            No brand scans tracked near your shop yet. Once nearby customers start scanning
            products, you will see which brands are trending here.
          </Text>
        </View>
      ) : null}

      {hasResults ? (
        <View style={styles.list}>
          {brands!.map((brand, index) => (
            <View key={brand.brandId} style={styles.row}>
              <View style={styles.rankBadge}>
                <Text style={styles.rankText}>{index + 1}</Text>
              </View>
              <View style={styles.rowCopy}>
                <Text style={styles.brandName}>{brand.brandName}</Text>
                <Text style={styles.brandMeta}>{formatScansLabel(brand.scansNearby)}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.footerRow}>
        <Text style={styles.footerMeta}>
          {generatedLabel ? `Updated ${generatedLabel}.` : 'Scans are aggregated anonymously.'}
        </Text>
        <Pressable
          onPress={() => {
            void load();
          }}
          disabled={isLoading}
          accessibilityRole="button"
          accessibilityLabel={isLoading ? 'Refreshing brand activity' : 'Refresh brand activity'}
          style={[styles.refreshButton, isLoading && styles.refreshButtonDisabled]}
        >
          <Text style={styles.refreshButtonText}>{isLoading ? 'Refreshing…' : 'Refresh'}</Text>
        </Pressable>
      </View>
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  stateBlock: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  stateText: {
    ...textStyles.body,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  errorText: {
    color: colors.danger,
  },
  retryButton: {
    marginTop: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.surfaceGlass,
  },
  retryButtonText: {
    ...textStyles.button,
    color: colors.text,
  },
  list: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surfaceGlass,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radii.md,
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(0, 215, 255, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(0, 215, 255, 0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    ...textStyles.bodyStrong,
    color: '#B8F6FF',
    fontSize: 13,
  },
  rowCopy: {
    flex: 1,
    gap: 2,
  },
  brandName: {
    ...textStyles.bodyStrong,
    color: colors.text,
  },
  brandMeta: {
    ...textStyles.caption,
    color: colors.textMuted,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    flexWrap: 'wrap',
  },
  footerMeta: {
    ...textStyles.caption,
    color: colors.textSoft,
    flex: 1,
  },
  refreshButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.surfaceGlass,
  },
  refreshButtonDisabled: {
    opacity: 0.5,
  },
  refreshButtonText: {
    ...textStyles.button,
    color: colors.text,
  },
});

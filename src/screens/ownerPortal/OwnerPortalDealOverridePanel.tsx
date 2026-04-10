import { colors } from '../../theme/tokens';
import React from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import {
  clearAllStorefrontPromotionOverrides,
  saveStorefrontPromotionOverrides,
} from '../../services/storefrontPromotionOverrideService';
import { getOwnerPortalPreviewStorefrontSummaries } from '../../services/ownerPortalPreviewService';
import type { StorefrontSummary } from '../../types/storefront';
import {
  MAX_STOREFRONT_PROMOTION_BADGES,
  normalizeStorefrontPromotionBadges,
} from '../../utils/storefrontPromotions';
import { OwnerPortalDealBadgeEditor } from './OwnerPortalDealBadgeEditor';
import { ownerPortalStyles as styles } from './ownerPortalStyles';

const QUICK_BADGES = ['Open Late', 'Today Only', 'Fresh Drop', 'Community Event', 'Weekend Update'];
const DURATION_OPTIONS = [
  { label: '2h', hours: 2 },
  { label: '6h', hours: 6 },
  { label: '12h', hours: 12 },
  { label: '24h', hours: 24 },
  { label: '72h', hours: 72 },
] as const;
const MAX_VISIBLE_RESULTS = 8;

type OwnerPortalDealOverridePanelProps = {
  claimedStorefront: StorefrontSummary;
};

function matchesStorefront(summary: StorefrontSummary, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return true;
  }

  return [summary.displayName, summary.addressLine1, summary.city, summary.zip]
    .join(' ')
    .toLowerCase()
    .includes(normalizedQuery);
}

function dedupeStorefronts(items: StorefrontSummary[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) {
      return false;
    }
    seen.add(item.id);
    return true;
  });
}

export function OwnerPortalDealOverridePanel({
  claimedStorefront,
}: OwnerPortalDealOverridePanelProps) {
  const [allStorefronts, setAllStorefronts] = React.useState<StorefrontSummary[]>([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = React.useState(true);
  const [catalogError, setCatalogError] = React.useState<string | null>(null);
  const [searchText, setSearchText] = React.useState('');
  const [selectedStorefrontId, setSelectedStorefrontId] = React.useState(claimedStorefront.id);
  const [batchBadges, setBatchBadges] = React.useState<string[]>([]);
  const [batchBadgeDraft, setBatchBadgeDraft] = React.useState('');
  const [durationHours, setDurationHours] = React.useState<number>(24);
  const [customDurationInput, setCustomDurationInput] = React.useState('');
  const [statusText, setStatusText] = React.useState<string | null>(null);
  const [isSavingAll, setIsSavingAll] = React.useState(false);

  React.useEffect(() => {
    let alive = true;

    void (async () => {
      try {
        const summaries = await getOwnerPortalPreviewStorefrontSummaries();
        if (!alive) {
          return;
        }

        const sorted = [...summaries].sort((left, right) =>
          left.displayName.localeCompare(right.displayName),
        );
        setAllStorefronts(sorted);
        setCatalogError(null);
      } catch (error) {
        if (!alive) {
          return;
        }

        setCatalogError(
          error instanceof Error ? error.message : 'Unable to load preview storefront cards.',
        );
      } finally {
        if (alive) {
          setIsLoadingCatalog(false);
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const storefrontCatalog = React.useMemo(
    () => dedupeStorefronts([claimedStorefront, ...allStorefronts]),
    [allStorefronts, claimedStorefront],
  );

  React.useEffect(() => {
    if (!storefrontCatalog.some((storefront) => storefront.id === selectedStorefrontId)) {
      setSelectedStorefrontId(storefrontCatalog[0]?.id ?? claimedStorefront.id);
    }
  }, [claimedStorefront.id, selectedStorefrontId, storefrontCatalog]);

  const selectedStorefront = React.useMemo(
    () =>
      storefrontCatalog.find((storefront) => storefront.id === selectedStorefrontId) ??
      claimedStorefront,
    [claimedStorefront, selectedStorefrontId, storefrontCatalog],
  );

  const filteredStorefronts = React.useMemo(
    () => storefrontCatalog.filter((storefront) => matchesStorefront(storefront, searchText)),
    [searchText, storefrontCatalog],
  );

  const visibleStorefronts = React.useMemo(
    () => filteredStorefronts.slice(0, MAX_VISIBLE_RESULTS),
    [filteredStorefronts],
  );

  const normalizedBatchBadges = React.useMemo(
    () => normalizeStorefrontPromotionBadges(batchBadges),
    [batchBadges],
  );

  const canAddBatchBadge =
    Boolean(batchBadgeDraft.trim()) &&
    normalizedBatchBadges.length < MAX_STOREFRONT_PROMOTION_BADGES;
  const customDurationHours = Number.parseInt(customDurationInput.trim(), 10);
  const hasCustomDuration =
    Number.isFinite(customDurationHours) && customDurationHours >= 1 && customDurationHours <= 720;

  const handleAddBatchBadge = React.useCallback((nextBadge: string) => {
    setBatchBadges((current) => normalizeStorefrontPromotionBadges([...current, nextBadge]));
    setBatchBadgeDraft('');
    setStatusText(null);
  }, []);

  const handleRemoveBatchBadge = React.useCallback((badge: string) => {
    setBatchBadges((current) => current.filter((entry) => entry !== badge));
    setStatusText(null);
  }, []);

  const handleApplyToAll = React.useCallback(async () => {
    if (!normalizedBatchBadges.length) {
      setStatusText('Add at least one badge before applying a test update to every preview card.');
      return;
    }

    if (!storefrontCatalog.length) {
      setStatusText('No preview storefront cards are loaded yet.');
      return;
    }

    setIsSavingAll(true);
    setStatusText(null);

    try {
      const saved = await saveStorefrontPromotionOverrides(
        storefrontCatalog.map((storefront) => ({
          storefrontId: storefront.id,
          badges: normalizedBatchBadges,
          durationHours,
        })),
      );
      setStatusText(
        `Applied ${saved.length} temporary update override${saved.length === 1 ? '' : 's'} across ${storefrontCatalog.length} preview card${storefrontCatalog.length === 1 ? '' : 's'}.`,
      );
    } catch (error) {
      setStatusText(
        error instanceof Error ? error.message : 'Unable to apply the preview update override.',
      );
    } finally {
      setIsSavingAll(false);
    }
  }, [durationHours, normalizedBatchBadges, storefrontCatalog]);

  const handleClearAll = React.useCallback(async () => {
    setIsSavingAll(true);
    setStatusText(null);

    try {
      await clearAllStorefrontPromotionOverrides();
      setBatchBadges([]);
      setBatchBadgeDraft('');
      setStatusText('Cleared the sample update from every preview storefront.');
    } catch (error) {
      setStatusText(
        error instanceof Error ? error.message : 'Unable to clear the sample update right now.',
      );
    } finally {
      setIsSavingAll(false);
    }
  }, []);

  return (
    <View style={styles.form}>
      <Text style={styles.helperText}>
        Use this preview area to try a sample update across demo storefront cards. It stays separate
        from your live storefront settings.
      </Text>

      <View style={styles.form}>
        <Text style={styles.statusLabel}>Choose a preview storefront</Text>
        <TextInput
          value={searchText}
          onChangeText={setSearchText}
          placeholder="Search storefronts by name or city"
          placeholderTextColor={colors.textSoft}
          style={styles.input}
        />
        {catalogError ? <Text style={styles.errorText}>{catalogError}</Text> : null}
        {isLoadingCatalog ? (
          <Text style={styles.helperText}>Loading preview storefronts...</Text>
        ) : null}
        {!isLoadingCatalog && !visibleStorefronts.length ? (
          <Text style={styles.helperText}>No preview storefronts match this search.</Text>
        ) : null}
        <View style={styles.list}>
          {visibleStorefronts.map((storefront) => {
            const selected = storefront.id === selectedStorefront.id;
            return (
              <Pressable
                key={storefront.id}
                onPress={() => setSelectedStorefrontId(storefront.id)}
                style={[styles.resultCard, selected && styles.resultCardSelected]}
              >
                <View style={styles.resultBody}>
                  <Text style={styles.resultTitle}>{storefront.displayName}</Text>
                  <Text style={styles.resultMeta}>
                    {storefront.city} • {storefront.addressLine1}
                  </Text>
                </View>
                <Text style={styles.helperText}>
                  {selected ? 'Selected below' : 'Choose this storefront'}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {filteredStorefronts.length > visibleStorefronts.length ? (
          <Text style={styles.helperText}>
            Showing {visibleStorefronts.length} of {filteredStorefronts.length} matching preview
            storefronts.
          </Text>
        ) : null}
      </View>

      <View style={styles.sectionDivider} />

      <View style={styles.form}>
        <Text style={styles.statusLabel}>Selected preview card</Text>
        <Text style={styles.helperText}>
          Use the original single-card editor below for {selectedStorefront.displayName}.
        </Text>
        <OwnerPortalDealBadgeEditor storefront={selectedStorefront} />
      </View>

      <View style={styles.sectionDivider} />

      <View style={styles.form}>
        <Text style={styles.statusLabel}>Apply one test update to every preview card</Text>
        <Text style={styles.helperText}>
          Use this when you want to see the whole app light up at once with the main updates lane.
          These overrides stay local to this preview build until you clear them.
        </Text>

        <View style={styles.inlineActionRow}>
          <TextInput
            value={batchBadgeDraft}
            onChangeText={setBatchBadgeDraft}
            placeholder="Add a badge like Open Late"
            placeholderTextColor={colors.textSoft}
            style={[styles.input, styles.inlineInput]}
            maxLength={24}
          />
          <Pressable
            disabled={!canAddBatchBadge}
            onPress={() => handleAddBatchBadge(batchBadgeDraft)}
            style={[
              styles.secondaryButton,
              styles.inlineButton,
              !canAddBatchBadge && styles.buttonDisabled,
            ]}
          >
            <Text style={styles.secondaryButtonText}>Add Badge</Text>
          </Pressable>
        </View>

        <View style={styles.row}>
          {QUICK_BADGES.map((badge) => (
            <Pressable
              key={badge}
              disabled={normalizedBatchBadges.length >= MAX_STOREFRONT_PROMOTION_BADGES}
              onPress={() => handleAddBatchBadge(badge)}
              style={[
                styles.choiceChip,
                normalizedBatchBadges.includes(badge) && styles.choiceChipSelected,
                normalizedBatchBadges.length >= MAX_STOREFRONT_PROMOTION_BADGES &&
                !normalizedBatchBadges.includes(badge)
                  ? styles.buttonDisabled
                  : null,
              ]}
            >
              <Text
                style={[
                  styles.choiceChipText,
                  normalizedBatchBadges.includes(badge) && styles.choiceChipTextSelected,
                ]}
              >
                {badge}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.wrapRow}>
          {normalizedBatchBadges.length ? (
            normalizedBatchBadges.map((badge) => (
              <Pressable
                key={badge}
                onPress={() => handleRemoveBatchBadge(badge)}
                style={[styles.liveBadgeChip, styles.liveBadgeChipActive]}
              >
                <Text numberOfLines={1} style={styles.liveBadgeChipText}>
                  {badge} x
                </Text>
              </Pressable>
            ))
          ) : (
            <Text style={styles.helperText}>
              No global preview badges yet. Add one to test all cards.
            </Text>
          )}
        </View>

        <View style={styles.form}>
          <Text style={styles.statusLabel}>How long should the all-card test stay live?</Text>
          <View style={styles.row}>
            {DURATION_OPTIONS.map((option) => {
              const selected = option.hours === durationHours;
              return (
                <Pressable
                  key={option.label}
                  onPress={() => setDurationHours(option.hours)}
                  style={[styles.choiceChip, selected && styles.choiceChipSelected]}
                >
                  <Text style={[styles.choiceChipText, selected && styles.choiceChipTextSelected]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.inlineActionRow}>
            <TextInput
              value={customDurationInput}
              onChangeText={setCustomDurationInput}
              placeholder="Custom hours"
              placeholderTextColor={colors.textSoft}
              keyboardType="number-pad"
              style={[styles.input, styles.inlineInput]}
              maxLength={3}
            />
            <Pressable
              disabled={!hasCustomDuration}
              onPress={() => {
                setDurationHours(customDurationHours);
                setStatusText(null);
              }}
              style={[
                styles.secondaryButton,
                styles.inlineButton,
                !hasCustomDuration && styles.buttonDisabled,
              ]}
            >
              <Text style={styles.secondaryButtonText}>Use Custom</Text>
            </Pressable>
          </View>
          <Text style={styles.helperText}>Custom duration accepts 1 to 720 hours.</Text>
        </View>

        {statusText ? <Text style={styles.helperText}>{statusText}</Text> : null}

        <View style={styles.inlineActionRow}>
          <Pressable
            disabled={isSavingAll}
            onPress={() => {
              void handleApplyToAll();
            }}
            style={[
              styles.primaryButton,
              styles.inlineButtonPrimary,
              isSavingAll && styles.buttonDisabled,
            ]}
          >
            <Text style={styles.primaryButtonText}>
              {isSavingAll ? 'Saving...' : 'Apply To Every Card'}
            </Text>
          </Pressable>
          <Pressable
            disabled={isSavingAll}
            onPress={() => {
              void handleClearAll();
            }}
            style={[
              styles.secondaryButton,
              styles.inlineButton,
              isSavingAll && styles.buttonDisabled,
            ]}
          >
            <Text style={styles.secondaryButtonText}>Clear All</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

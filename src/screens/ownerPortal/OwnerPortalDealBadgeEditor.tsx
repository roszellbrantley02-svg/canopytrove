import React from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { StorefrontRouteCard } from '../../components/StorefrontRouteCard';
import {
  clearStorefrontPromotionOverride,
  getStorefrontPromotionOverride,
  saveStorefrontPromotionOverride,
} from '../../services/storefrontPromotionOverrideService';
import type { StorefrontSummary } from '../../types/storefront';
import {
  formatStorefrontPromotionExpiry,
  getStorefrontPromotionBadges,
  getStorefrontPromotionTextFromBadges,
  MAX_STOREFRONT_PROMOTION_BADGES,
  normalizeStorefrontPromotionBadges,
} from '../../utils/storefrontPromotions';
import { ownerPortalStyles as styles } from './ownerPortalStyles';

const QUICK_BADGES = ['10% Off', '20% Off', 'Today Only', 'Fresh Drop', 'Bundle Deal'];
const DURATION_OPTIONS = [
  { label: '2h', hours: 2 },
  { label: '6h', hours: 6 },
  { label: '12h', hours: 12 },
  { label: '24h', hours: 24 },
  { label: '72h', hours: 72 },
] as const;

type OwnerPortalDealBadgeEditorProps = {
  storefront: StorefrontSummary;
};

export function OwnerPortalDealBadgeEditor({ storefront }: OwnerPortalDealBadgeEditorProps) {
  const initialBadges = React.useMemo(
    () =>
      getStorefrontPromotionBadges({
        promotionBadges: storefront.promotionBadges,
        promotionText: storefront.promotionText,
      }),
    [storefront.promotionBadges, storefront.promotionText],
  );
  const [badges, setBadges] = React.useState<string[]>(() => initialBadges);
  const [badgeDraft, setBadgeDraft] = React.useState('');
  const [durationHours, setDurationHours] = React.useState<number>(24);
  const [customDurationInput, setCustomDurationInput] = React.useState('');
  const [expiresAt, setExpiresAt] = React.useState<string | null>(
    storefront.promotionExpiresAt ?? null,
  );
  const [statusText, setStatusText] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    let alive = true;

    void (async () => {
      const override = await getStorefrontPromotionOverride(storefront.id);
      if (!alive) {
        return;
      }

      if (!override) {
        setBadges(initialBadges);
        setExpiresAt(storefront.promotionExpiresAt ?? null);
        return;
      }

      setBadges(override.badges);
      setExpiresAt(override.expiresAt);
    })();

    return () => {
      alive = false;
    };
  }, [initialBadges, storefront.id, storefront.promotionExpiresAt]);

  const normalizedBadges = React.useMemo(
    () => normalizeStorefrontPromotionBadges(badges),
    [badges],
  );
  const previewStorefront = React.useMemo<StorefrontSummary>(
    () => ({
      ...storefront,
      promotionBadges: normalizedBadges,
      promotionText: getStorefrontPromotionTextFromBadges(normalizedBadges),
      promotionExpiresAt: expiresAt,
    }),
    [expiresAt, normalizedBadges, storefront],
  );

  const canAddBadge =
    Boolean(badgeDraft.trim()) && normalizedBadges.length < MAX_STOREFRONT_PROMOTION_BADGES;
  const customDurationHours = Number.parseInt(customDurationInput.trim(), 10);
  const hasCustomDuration =
    Number.isFinite(customDurationHours) && customDurationHours >= 1 && customDurationHours <= 720;

  const handleAddBadge = React.useCallback((nextBadge: string) => {
    setBadges((current) => normalizeStorefrontPromotionBadges([...current, nextBadge]));
    setBadgeDraft('');
    setStatusText(null);
  }, []);

  const handleRemoveBadge = React.useCallback((badge: string) => {
    setBadges((current) => current.filter((entry) => entry !== badge));
    setStatusText(null);
  }, []);

  const handleSave = React.useCallback(async () => {
    setIsSaving(true);
    setStatusText(null);

    try {
      const override = await saveStorefrontPromotionOverride({
        storefrontId: storefront.id,
        badges: normalizedBadges,
        durationHours,
      });
      setExpiresAt(override?.expiresAt ?? null);
      setStatusText(
        override
          ? 'Live special badges saved. Nearby, Browse, and the Specials lane will refresh with this storefront update.'
          : 'All live special badges were cleared from this storefront.',
      );
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : 'Unable to save live special badges.');
    } finally {
      setIsSaving(false);
    }
  }, [durationHours, normalizedBadges, storefront.id]);

  const handleClear = React.useCallback(async () => {
    setIsSaving(true);
    setStatusText(null);

    try {
      await clearStorefrontPromotionOverride(storefront.id);
      setBadges([]);
      setExpiresAt(null);
      setStatusText('Live special badges cleared from this storefront.');
    } catch (error) {
      setStatusText(
        error instanceof Error ? error.message : 'Unable to clear live special badges.',
      );
    } finally {
      setIsSaving(false);
    }
  }, [storefront.id]);

  return (
    <View style={styles.form}>
      <StorefrontRouteCard
        storefront={previewStorefront}
        variant="feature"
        primaryActionLabel="Go Now"
        secondaryActionLabel="View Shop"
        onPrimaryActionPress={() => undefined}
        onSecondaryActionPress={() => undefined}
      />

      <Text style={styles.helperText}>
        Add up to {MAX_STOREFRONT_PROMOTION_BADGES} short badges. Any active badge stack turns the
        card into the hot-deal lane automatically. Use the planner above when you want the separate
        owner-highlight treatment instead.
      </Text>

      <View style={styles.inlineActionRow}>
        <TextInput
          value={badgeDraft}
          onChangeText={setBadgeDraft}
          placeholder="Add a badge like 20% Off"
          placeholderTextColor="#738680"
          style={[styles.input, styles.inlineInput]}
          maxLength={24}
        />
        <Pressable
          disabled={!canAddBadge}
          onPress={() => handleAddBadge(badgeDraft)}
          style={[
            styles.secondaryButton,
            styles.inlineButton,
            !canAddBadge && styles.buttonDisabled,
          ]}
        >
          <Text style={styles.secondaryButtonText}>Add Badge</Text>
        </Pressable>
      </View>

      <View style={styles.row}>
        {QUICK_BADGES.map((badge) => (
          <Pressable
            key={badge}
            disabled={normalizedBadges.length >= MAX_STOREFRONT_PROMOTION_BADGES}
            onPress={() => handleAddBadge(badge)}
            style={[
              styles.choiceChip,
              normalizedBadges.includes(badge) && styles.choiceChipSelected,
              normalizedBadges.length >= MAX_STOREFRONT_PROMOTION_BADGES &&
              !normalizedBadges.includes(badge)
                ? styles.buttonDisabled
                : null,
            ]}
          >
            <Text
              style={[
                styles.choiceChipText,
                normalizedBadges.includes(badge) && styles.choiceChipTextSelected,
              ]}
            >
              {badge}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.wrapRow}>
        {normalizedBadges.length ? (
          normalizedBadges.map((badge) => (
            <Pressable
              key={badge}
              onPress={() => handleRemoveBadge(badge)}
              style={[styles.liveBadgeChip, styles.liveBadgeChipActive]}
            >
              <Text numberOfLines={1} style={styles.liveBadgeChipText}>
                {badge} x
              </Text>
            </Pressable>
          ))
        ) : (
          <Text style={styles.helperText}>
            No live badges yet. Add one to turn the card into a hot deal.
          </Text>
        )}
      </View>

      <View style={styles.form}>
        <Text style={styles.statusLabel}>How long should this deal stay live?</Text>
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
            placeholderTextColor="#738680"
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

      {expiresAt ? (
        <Text style={styles.successText}>{formatStorefrontPromotionExpiry(expiresAt)}</Text>
      ) : null}
      {statusText ? <Text style={styles.helperText}>{statusText}</Text> : null}

      <View style={styles.inlineActionRow}>
        <Pressable
          disabled={isSaving}
          onPress={() => {
            void handleSave();
          }}
          style={[
            styles.primaryButton,
            styles.inlineButtonPrimary,
            isSaving && styles.buttonDisabled,
          ]}
        >
          <Text style={styles.primaryButtonText}>{isSaving ? 'Saving...' : 'Save Special'}</Text>
        </Pressable>
        <Pressable
          disabled={isSaving || normalizedBadges.length === 0}
          onPress={() => {
            void handleClear();
          }}
          style={[
            styles.secondaryButton,
            styles.inlineButton,
            (isSaving || normalizedBadges.length === 0) && styles.buttonDisabled,
          ]}
        >
          <Text style={styles.secondaryButtonText}>Clear Hot Deal</Text>
        </Pressable>
      </View>
    </View>
  );
}

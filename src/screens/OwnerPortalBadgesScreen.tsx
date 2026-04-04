import React from 'react';
import type { RouteProp } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import { Pressable, Text, View } from 'react-native';
import { InlineFeedbackPanel } from '../components/InlineFeedbackPanel';
import { MotionInView } from '../components/MotionInView';
import { ScreenShell } from '../components/ScreenShell';
import { SectionCard } from '../components/SectionCard';
import { AppUiIcon } from '../icons/AppUiIcon';

import type { RootStackParamList } from '../navigation/RootNavigator';
import { OWNER_MAX_FEATURED_BADGES } from '../domain/canopyTroveGamification/ownerBadgeDefinitions';
import {
  getAllOwnerBadgeDefinitions,
  validateOwnerSelectedBadges,
  selectedBadgeIdsToLabels,
} from '../domain/canopyTroveGamification/ownerBadgeEvaluation';
import { ownerPortalStyles as styles } from './ownerPortal/ownerPortalStyles';
import { useOwnerPortalWorkspace } from './ownerPortal/useOwnerPortalWorkspace';
import type { GamificationBadgeDefinition } from '../types/storefront';
import type { AppUiIconName } from '../icons/AppUiIcon';
import { colors, spacing, textStyles } from '../theme/tokens';
import { StyleSheet } from 'react-native';

type OwnerPortalBadgesRoute = RouteProp<RootStackParamList, 'OwnerPortalBadges'>;

export function OwnerPortalBadgesScreen() {
  const _route = useRoute<OwnerPortalBadgesRoute>();
  const preview = false;
  const { workspace, isLoading, isSaving, errorText, saveProfileTools } =
    useOwnerPortalWorkspace(preview);

  const ownerProfile = workspace?.ownerProfile ?? null;
  const earnedBadgeIds = React.useMemo(
    () => ownerProfile?.earnedBadgeIds ?? [],
    [ownerProfile?.earnedBadgeIds],
  );
  const currentSelectedIds = ownerProfile?.selectedBadgeIds ?? [];

  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = React.useState(false);

  // Sync local state with workspace data
  const selectedKey = currentSelectedIds.join(',');
  React.useEffect(() => {
    setSelectedIds([...currentSelectedIds]);
    setHasUnsavedChanges(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when the serialized key changes
  }, [selectedKey]);

  const allOwnerBadges = React.useMemo(() => getAllOwnerBadgeDefinitions(), []);
  const earnedSet = React.useMemo(() => new Set(earnedBadgeIds), [earnedBadgeIds]);
  const selectedSet = React.useMemo(() => new Set(selectedIds), [selectedIds]);

  const toggleBadge = React.useCallback(
    (badgeId: string) => {
      setSelectedIds((prev) => {
        const next = prev.includes(badgeId)
          ? prev.filter((id) => id !== badgeId)
          : prev.length < OWNER_MAX_FEATURED_BADGES
            ? [...prev, badgeId]
            : prev;
        return validateOwnerSelectedBadges(next, earnedBadgeIds);
      });
      setHasUnsavedChanges(true);
    },
    [earnedBadgeIds],
  );

  const handleSave = React.useCallback(() => {
    if (!workspace?.profileTools) return;

    const labels = selectedBadgeIdsToLabels(selectedIds);
    void saveProfileTools({
      ...workspace.profileTools,
      featuredBadges: labels,
    });
  }, [workspace?.profileTools, selectedIds, saveProfileTools]);

  const earnedBadges = allOwnerBadges.filter((b) => earnedSet.has(b.id));
  const lockedBadges = allOwnerBadges.filter((b) => !earnedSet.has(b.id));

  return (
    <ScreenShell
      eyebrow="Owner Portal"
      title="Storefront Badges"
      subtitle={`${earnedBadgeIds.length} earned \u2022 ${selectedIds.length}/${OWNER_MAX_FEATURED_BADGES} displayed`}
      headerPill={'Badges'}
    >
      <MotionInView delay={70}>
        <View style={styles.portalHeroCard}>
          <View style={styles.portalHeroGlow} />
          <Text style={styles.portalHeroKicker}>Badge showcase</Text>
          <Text numberOfLines={2} style={styles.portalHeroTitle}>
            Earn badges and show them on your storefront card.
          </Text>
          <Text numberOfLines={2} style={styles.portalHeroBody}>
            Toggle badges on or off. Up to {OWNER_MAX_FEATURED_BADGES} badges display next to your
            storefront name on cards and the detail page.
          </Text>
          <View style={styles.portalHeroMetricRow}>
            <View style={styles.portalHeroMetricCard}>
              <Text style={styles.portalHeroMetricValue}>{earnedBadgeIds.length}</Text>
              <Text style={styles.portalHeroMetricLabel}>Earned</Text>
            </View>
            <View style={styles.portalHeroMetricCard}>
              <Text style={styles.portalHeroMetricValue}>{selectedIds.length}</Text>
              <Text style={styles.portalHeroMetricLabel}>Displayed</Text>
            </View>
            <View style={styles.portalHeroMetricCard}>
              <Text style={styles.portalHeroMetricValue}>{ownerProfile?.badgeLevel ?? 0}</Text>
              <Text style={styles.portalHeroMetricLabel}>Badge Level</Text>
            </View>
          </View>
        </View>
      </MotionInView>

      {isLoading ? (
        <InlineFeedbackPanel
          tone="info"
          iconName="time-outline"
          label="Loading"
          title="Loading badge data"
          body="Syncing your earned badges and current display settings."
        />
      ) : null}

      {errorText ? (
        <InlineFeedbackPanel
          tone="danger"
          iconName="alert-circle-outline"
          label="Error"
          title="Could not load badges"
          body={errorText}
        />
      ) : null}

      {/* Earned badges — toggleable */}
      <MotionInView delay={140}>
        <SectionCard
          title="Your earned badges"
          body="Tap to toggle display on your storefront card."
        >
          {earnedBadges.length === 0 ? (
            <View style={badgeStyles.emptyState}>
              <AppUiIcon name="ribbon-outline" size={28} color={colors.textMuted} />
              <Text style={badgeStyles.emptyText}>
                No badges earned yet. Complete activities to earn your first badge.
              </Text>
            </View>
          ) : (
            <View style={badgeStyles.badgeList}>
              {earnedBadges.map((badge) => (
                <OwnerBadgeToggleRow
                  key={badge.id}
                  badge={badge}
                  isEarned={true}
                  isSelected={selectedSet.has(badge.id)}
                  canSelect={selectedIds.length < OWNER_MAX_FEATURED_BADGES}
                  onToggle={toggleBadge}
                />
              ))}
            </View>
          )}
        </SectionCard>
      </MotionInView>

      {/* Locked badges — greyed out */}
      <MotionInView delay={210}>
        <SectionCard title="Locked badges" body="Complete the requirement to unlock these.">
          {lockedBadges.length === 0 ? (
            <View style={badgeStyles.emptyState}>
              <AppUiIcon name="trophy-outline" size={28} color={colors.primary} />
              <Text style={badgeStyles.emptyText}>You have unlocked every available badge.</Text>
            </View>
          ) : (
            <View style={badgeStyles.badgeList}>
              {lockedBadges.map((badge) => (
                <OwnerBadgeToggleRow
                  key={badge.id}
                  badge={badge}
                  isEarned={false}
                  isSelected={false}
                  canSelect={false}
                  onToggle={toggleBadge}
                />
              ))}
            </View>
          )}
        </SectionCard>
      </MotionInView>

      {/* Save button */}
      <MotionInView delay={280}>
        <View style={styles.ctaPanel}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Save badge display settings"
            accessibilityHint="Updates which badges appear on your storefront card."
            disabled={preview || isSaving || !hasUnsavedChanges}
            onPress={handleSave}
            style={[
              styles.primaryButton,
              (preview || isSaving || !hasUnsavedChanges) && styles.buttonDisabled,
            ]}
          >
            <Text style={styles.primaryButtonText}>
              {preview
                ? 'Preview Only'
                : isSaving
                  ? 'Saving...'
                  : hasUnsavedChanges
                    ? 'Save Badge Display'
                    : 'No Changes'}
            </Text>
          </Pressable>
        </View>
      </MotionInView>
    </ScreenShell>
  );
}

// ---------------------------------------------------------------------------
// Badge toggle row component
// ---------------------------------------------------------------------------

function OwnerBadgeToggleRow({
  badge,
  isEarned,
  isSelected,
  canSelect,
  onToggle,
}: {
  badge: GamificationBadgeDefinition;
  isEarned: boolean;
  isSelected: boolean;
  canSelect: boolean;
  onToggle: (id: string) => void;
}) {
  const isEarlyPartner = badge.id === 'owner_early_partner';

  const tierPillBg = isEarned ? `${badge.color}22` : 'rgba(255,255,255,0.06)';
  const tierPillBorder = isEarned ? `${badge.color}44` : 'rgba(255,255,255,0.08)';
  const tierPillStyle = badge.tier
    ? { backgroundColor: tierPillBg, borderColor: tierPillBorder }
    : undefined;
  const tierTextColor = isEarned ? badge.color : colors.textMuted;
  const tierTextStyle = badge.tier ? { color: tierTextColor } : undefined;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${isSelected ? 'Remove' : 'Display'} ${badge.name} badge`}
      accessibilityState={{ selected: isSelected, disabled: !isEarned }}
      disabled={!isEarned || (!isSelected && !canSelect)}
      onPress={() => onToggle(badge.id)}
      style={[
        badgeStyles.badgeRow,
        isSelected && badgeStyles.badgeRowSelected,
        !isEarned && badgeStyles.badgeRowLocked,
      ]}
    >
      <View
        style={[
          badgeStyles.badgeIconWrap,
          isEarlyPartner && badgeStyles.badgeIconWrapDiamond,
          !isEarned && badgeStyles.badgeIconWrapLocked,
        ]}
      >
        <AppUiIcon
          name={badge.icon as AppUiIconName}
          size={20}
          color={isEarned ? badge.color : colors.textMuted}
        />
      </View>
      <View style={badgeStyles.badgeCopy}>
        <View style={badgeStyles.badgeNameRow}>
          <Text
            numberOfLines={1}
            style={[badgeStyles.badgeName, !isEarned && badgeStyles.badgeNameLocked]}
          >
            {badge.name}
          </Text>
          {badge.tier ? (
            <View style={[badgeStyles.tierPill, tierPillStyle]}>
              <Text style={[badgeStyles.tierText, tierTextStyle]}>{badge.tier.toUpperCase()}</Text>
            </View>
          ) : null}
        </View>
        <Text
          numberOfLines={2}
          style={[badgeStyles.badgeDesc, !isEarned && badgeStyles.badgeDescLocked]}
        >
          {badge.description}
        </Text>
        <Text style={badgeStyles.badgePoints}>
          {badge.points} pts
          {isEarlyPartner ? ' \u2022 Limited Edition' : ''}
        </Text>
      </View>
      <View style={badgeStyles.toggleArea}>
        {isEarned ? (
          <View
            style={[
              badgeStyles.toggleIndicator,
              isSelected ? badgeStyles.toggleOn : badgeStyles.toggleOff,
            ]}
          >
            <AppUiIcon
              name={isSelected ? 'eye-outline' : 'eye-off-outline'}
              size={14}
              color={isSelected ? colors.backgroundDeep : colors.textMuted}
            />
          </View>
        ) : (
          <AppUiIcon name="lock-closed-outline" size={16} color={colors.textSoft} />
        )}
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const badgeStyles = StyleSheet.create({
  badgeList: {
    gap: spacing.sm,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.surfaceElevated,
  },
  badgeRowSelected: {
    borderColor: 'rgba(0,245,140,0.32)',
    backgroundColor: 'rgba(0,245,140,0.06)',
  },
  badgeRowLocked: {
    opacity: 0.5,
  },
  badgeIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeIconWrapDiamond: {
    borderRadius: 22,
    backgroundColor: 'rgba(255,209,102,0.12)',
    borderColor: 'rgba(255,209,102,0.24)',
  },
  badgeIconWrapLocked: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderColor: 'rgba(255,255,255,0.06)',
  },
  badgeCopy: {
    flex: 1,
    gap: 2,
  },
  badgeNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  badgeName: {
    ...textStyles.bodyStrong,
    color: colors.text,
  },
  badgeNameLocked: {
    color: colors.textMuted,
  },
  tierPill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    borderWidth: 1,
  },
  tierText: {
    ...textStyles.caption,
    fontSize: 9,
    letterSpacing: 0.5,
  },
  badgeDesc: {
    ...textStyles.caption,
    color: colors.textMuted,
    lineHeight: 16,
  },
  badgeDescLocked: {
    color: colors.textSoft,
  },
  badgePoints: {
    ...textStyles.caption,
    color: colors.accent,
    fontSize: 11,
  },
  toggleArea: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleIndicator: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleOn: {
    backgroundColor: colors.primary,
  },
  toggleOff: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  emptyState: {
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    gap: spacing.md,
  },
  emptyText: {
    ...textStyles.body,
    color: colors.textMuted,
    textAlign: 'center',
  },
});

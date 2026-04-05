import React from 'react';
import { StyleSheet, Text, View, FlatList } from 'react-native';
import { MotionInView } from '../components/MotionInView';
import { ScreenShell } from '../components/ScreenShell';
import { withScreenErrorBoundary } from '../components/withScreenErrorBoundary';
import { useStorefrontRewardsController } from '../context/StorefrontController';
import { useProfileDerivedState } from './profile/useProfileDerivedState';
import { useStorefrontProfileController } from '../context/StorefrontController';
import type { AppUiIconName } from '../icons/AppUiIcon';
import { AppUiIcon } from '../icons/AppUiIcon';
import { colors, spacing, textStyles, motion, radii } from '../theme/tokens';

function BadgeGalleryScreenInner() {
  const { badgeDefinitions, gamificationState, levelTitle } = useStorefrontRewardsController();
  const { appProfile, profileId } = useStorefrontProfileController();

  const { earnedBadges, nextBadges } = useProfileDerivedState({
    appProfile,
    badgeDefinitions,
    backendSeedStatus: null,
    gamificationState,
    levelTitle,
    profileId,
    rank: null,
  });

  const renderEarnedBadgeCard = ({
    item,
    index,
  }: {
    item: (typeof earnedBadges)[0];
    index: number;
  }) => (
    <MotionInView key={item.id} dense delay={Math.min(index, 8) * 40}>
      <View style={styles.badgeCard}>
        <View style={[styles.badgeIcon, { backgroundColor: item.color }]}>
          <AppUiIcon name={item.icon as AppUiIconName} size={24} color={colors.background} />
        </View>
        <Text style={styles.badgeName} numberOfLines={2}>
          {item.name}
        </Text>
        <Text style={styles.badgeDescription} numberOfLines={3}>
          {item.description}
        </Text>
        <View style={styles.badgeMeta}>
          <Text style={styles.badgeMetaText}>
            {item.tier ? `${item.tier} • ` : ''}
            {item.category}
          </Text>
        </View>
      </View>
    </MotionInView>
  );

  const renderNextBadgeCard = ({
    item,
    index,
  }: {
    item: (typeof nextBadges)[0];
    index: number;
  }) => (
    <MotionInView key={item.badge.id} dense delay={Math.min(index, 8) * 40}>
      <View style={styles.progressCard}>
        <View style={styles.progressHeader}>
          <View style={[styles.progressBadgeIcon, { backgroundColor: item.badge.color }]}>
            <AppUiIcon
              name={item.badge.icon as AppUiIconName}
              size={18}
              color={colors.background}
            />
          </View>
          <View style={styles.progressText}>
            <Text style={styles.progressTitle}>{item.badge.name}</Text>
            <Text style={styles.progressDescription} numberOfLines={2}>
              {item.badge.description}
            </Text>
          </View>
          <Text style={styles.progressLabel}>{item.label}</Text>
        </View>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${Math.max(6, item.progress * 100)}%`,
                backgroundColor: item.badge.color,
              },
            ]}
          />
        </View>
      </View>
    </MotionInView>
  );

  const numColumns = 2;
  const columnWrapperStyle = { gap: spacing.md };

  return (
    <ScreenShell
      eyebrow="Profile"
      title="Trophy Case"
      subtitle={`${earnedBadges.length} earned`}
      showHero={false}
    >
      {earnedBadges.length === 0 && nextBadges.length === 0 ? (
        <MotionInView delay={motion.quick}>
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>No badges yet</Text>
            <Text style={styles.emptyBody}>
              Earn badges by visiting storefronts, writing reviews, and building your reputation.
            </Text>
          </View>
        </MotionInView>
      ) : (
        <View style={styles.container}>
          {earnedBadges.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Earned Badges</Text>
                <Text style={styles.sectionCount}>{earnedBadges.length}</Text>
              </View>
              <FlatList
                data={earnedBadges}
                renderItem={renderEarnedBadgeCard}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                numColumns={numColumns}
                columnWrapperStyle={columnWrapperStyle}
                contentContainerStyle={styles.badgeGrid}
              />
            </View>
          )}

          {nextBadges.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>In Progress</Text>
                <Text style={styles.sectionCount}>{nextBadges.length}</Text>
              </View>
              <FlatList
                data={nextBadges}
                renderItem={renderNextBadgeCard}
                keyExtractor={(item) => item.badge.id}
                scrollEnabled={false}
                contentContainerStyle={styles.progressList}
              />
            </View>
          )}
        </View>
      )}
    </ScreenShell>
  );
}

export const BadgeGalleryScreen = withScreenErrorBoundary(
  BadgeGalleryScreenInner,
  'badge-gallery-screen',
);

const styles = StyleSheet.create({
  container: {
    gap: spacing.xxl,
  },
  section: {
    gap: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    ...textStyles.section,
    color: colors.text,
  },
  sectionCount: {
    ...textStyles.caption,
    color: colors.textMuted,
    backgroundColor: 'rgba(143, 255, 209, 0.06)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  badgeGrid: {
    gap: spacing.md,
  },
  badgeCard: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: 'rgba(8, 14, 19, 0.72)',
    borderWidth: 1,
    borderColor: colors.borderSoft,
    shadowColor: colors.shadow,
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },
  badgeIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeName: {
    ...textStyles.body,
    color: colors.text,
    fontWeight: '600',
    textAlign: 'center',
  },
  badgeDescription: {
    ...textStyles.caption,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 16,
  },
  badgeMeta: {
    marginTop: spacing.xs,
  },
  badgeMetaText: {
    ...textStyles.caption,
    color: colors.textSoft,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  progressList: {
    gap: spacing.md,
  },
  progressCard: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: 'rgba(8, 14, 19, 0.72)',
    borderWidth: 1,
    borderColor: colors.borderSoft,
    shadowColor: colors.shadow,
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  progressBadgeIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  progressText: {
    flex: 1,
    gap: spacing.xs,
  },
  progressTitle: {
    ...textStyles.body,
    color: colors.text,
    fontWeight: '600',
  },
  progressDescription: {
    ...textStyles.caption,
    color: colors.textMuted,
    lineHeight: 16,
  },
  progressLabel: {
    ...textStyles.caption,
    color: colors.textSoft,
    fontWeight: '600',
    textAlign: 'right',
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(143, 255, 209, 0.08)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  emptyContainer: {
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
  },
  emptyTitle: {
    ...textStyles.section,
    color: colors.text,
  },
  emptyBody: {
    ...textStyles.body,
    color: colors.textMuted,
    textAlign: 'center',
  },
});

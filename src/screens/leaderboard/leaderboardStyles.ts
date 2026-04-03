import { StyleSheet } from 'react-native';
import { colors, radii, spacing, textStyles, typography } from '../../theme/tokens';

export const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 42,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: 'rgba(8, 14, 19, 0.74)',
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  headerBadgeText: {
    ...textStyles.labelCaps,
    color: colors.text,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  statCard: {
    flexGrow: 1,
    minWidth: 120,
    borderRadius: radii.lg,
    backgroundColor: 'rgba(8, 14, 19, 0.72)',
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  statValue: {
    color: colors.text,
    fontSize: typography.section,
    fontWeight: '900',
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  helperText: {
    marginTop: spacing.md,
    color: colors.textSoft,
    ...textStyles.body,
    lineHeight: 22,
  },
  progressCard: {
    gap: spacing.md,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  progressTitle: {
    ...textStyles.section,
    color: colors.text,
  },
  progressSubtitle: {
    ...textStyles.labelCaps,
    color: colors.goldSoft,
  },
  progressBarTrack: {
    height: 12,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: radii.pill,
    backgroundColor: colors.gold,
  },
  progressCaption: {
    ...textStyles.caption,
    color: colors.textMuted,
  },
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  badgeCard: {
    width: '47%',
    minWidth: 148,
    borderRadius: radii.lg,
    backgroundColor: 'rgba(8, 14, 19, 0.72)',
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  badgeCardLocked: {
    backgroundColor: 'rgba(9, 14, 19, 0.82)',
    borderColor: 'rgba(255,255,255,0.06)',
  },
  badgeIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeIconWrapLocked: {
    backgroundColor: colors.surfaceElevated,
  },
  badgeName: {
    ...textStyles.bodyStrong,
    color: colors.text,
  },
  badgeCategory: {
    ...textStyles.caption,
    color: colors.textSoft,
    textTransform: 'capitalize',
  },
  badgeDescription: {
    ...textStyles.caption,
    color: colors.textMuted,
    lineHeight: 18,
  },
  leaderboardList: {
    gap: spacing.md,
  },
  entryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: 'rgba(8, 14, 19, 0.74)',
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  entryCardCurrent: {
    borderColor: 'rgba(245, 200, 106, 0.24)',
    backgroundColor: 'rgba(245, 200, 106, 0.08)',
  },
  rankBlock: {
    width: 54,
    minHeight: 54,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  rankValue: {
    color: colors.goldSoft,
    fontSize: typography.section,
    fontWeight: '900',
  },
  entryMain: {
    flex: 1,
    gap: 2,
  },
  entryName: {
    ...textStyles.bodyStrong,
    color: colors.text,
  },
  entryMeta: {
    ...textStyles.caption,
    color: colors.textMuted,
    lineHeight: 18,
  },
  entryStats: {
    alignItems: 'flex-end',
    gap: 2,
  },
  entryPoints: {
    color: colors.goldSoft,
    fontSize: typography.section,
    fontWeight: '900',
  },
  entryPointsLabel: {
    ...textStyles.labelCaps,
    color: colors.textSoft,
  },
});

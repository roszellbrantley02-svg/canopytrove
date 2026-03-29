import { StyleSheet } from 'react-native';
import { colors, radii, spacing, typography } from '../../theme/tokens';

export const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  headerBadgeText: {
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  statCard: {
    flexGrow: 1,
    minWidth: 120,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
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
    fontSize: typography.body,
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
    color: colors.text,
    fontSize: typography.section,
    fontWeight: '900',
  },
  progressSubtitle: {
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: '800',
    textTransform: 'uppercase',
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
    backgroundColor: colors.primary,
  },
  progressCaption: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '700',
  },
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  badgeCard: {
    width: '47%',
    minWidth: 148,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  badgeCardLocked: {
    backgroundColor: colors.cardMuted,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  badgeIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeIconWrapLocked: {
    backgroundColor: colors.surfaceElevated,
  },
  badgeName: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '800',
  },
  badgeCategory: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  badgeDescription: {
    color: colors.textMuted,
    fontSize: typography.caption,
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
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  entryCardCurrent: {
    borderColor: colors.warning,
    backgroundColor: colors.cardMuted,
  },
  rankBlock: {
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankValue: {
    color: colors.warning,
    fontSize: typography.section,
    fontWeight: '900',
  },
  entryMain: {
    flex: 1,
    gap: 2,
  },
  entryName: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '800',
  },
  entryMeta: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 18,
  },
  entryStats: {
    alignItems: 'flex-end',
    gap: 2,
  },
  entryPoints: {
    color: colors.primary,
    fontSize: typography.section,
    fontWeight: '900',
  },
  entryPointsLabel: {
    color: colors.textSoft,
    fontSize: typography.caption,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
});

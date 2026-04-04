import { StyleSheet } from 'react-native';
import { colors, radii, spacing, textStyles, typography } from '../../theme/tokens';

export const styles = StyleSheet.create({
  filters: {
    gap: spacing.lg,
    padding: spacing.xl,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: 'rgba(15, 24, 31, 0.86)',
    shadowColor: colors.shadow,
    shadowOpacity: 0.2,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  filtersHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  filtersHeaderCompact: {
    flexDirection: 'column',
  },
  filtersHeaderCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  filtersEyebrow: {
    ...textStyles.labelCaps,
    color: colors.textSoft,
  },
  filtersTitle: {
    ...textStyles.section,
    color: colors.text,
  },
  filtersPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(245, 200, 106, 0.22)',
    backgroundColor: 'rgba(245, 200, 106, 0.10)',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  filtersPillCompact: {
    alignSelf: 'flex-start',
  },
  filtersPillText: {
    ...textStyles.caption,
    color: colors.goldSoft,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  locationButton: {
    minHeight: 44,
    borderRadius: radii.pill,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  locationButtonText: {
    ...textStyles.button,
    color: colors.backgroundDeep,
    textTransform: 'uppercase',
  },
  errorText: {
    color: colors.warning,
    fontSize: typography.caption,
    lineHeight: 18,
  },
  locationSummary: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  locationMode: {
    ...textStyles.labelCaps,
    color: colors.textSoft,
  },
  locationLabel: {
    ...textStyles.bodyStrong,
    color: colors.text,
  },
  sortRow: {
    flexDirection: 'row',
    gap: spacing.md,
    flexWrap: 'wrap',
  },
  sortChip: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.cardMuted,
  },
  sortChipActive: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  sortChipText: {
    ...textStyles.caption,
    color: colors.textSoft,
  },
  sortChipTextActive: {
    color: colors.backgroundDeep,
  },
  list: {
    gap: spacing.lg,
  },
  loadMoreButton: {
    minHeight: 52,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  loadMoreButtonDisabled: {
    opacity: 0.72,
  },
  loadMoreButtonText: {
    ...textStyles.button,
    color: colors.text,
    textTransform: 'uppercase',
  },
  emptyState: {
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: typography.section,
    fontWeight: '800',
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 22,
  },
  memberGateActions: {
    flexDirection: 'row',
    gap: spacing.md,
    flexWrap: 'wrap',
  },
  memberGatePrimaryButton: {
    minHeight: 52,
    flex: 1,
    borderRadius: radii.pill,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  memberGatePrimaryButtonText: {
    ...textStyles.button,
    color: colors.backgroundDeep,
    textTransform: 'uppercase',
  },
  memberGateSecondaryButton: {
    minHeight: 52,
    flex: 1,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.cardMuted,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  memberGateSecondaryButtonText: {
    ...textStyles.button,
    color: colors.text,
    textTransform: 'uppercase',
  },
});

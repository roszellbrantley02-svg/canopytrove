import { StyleSheet } from 'react-native';
import { colors, radii, spacing, typography } from '../../theme/tokens';

export const styles = StyleSheet.create({
  filters: {
    gap: spacing.md,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  locationButton: {
    minHeight: 40,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  locationButtonText: {
    color: colors.background,
    fontSize: typography.caption,
    fontWeight: '900',
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
    borderColor: 'rgba(255,122,122,0.28)',
    backgroundColor: 'rgba(255,122,122,0.08)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: 2,
  },
  locationMode: {
    color: colors.danger,
    fontSize: typography.caption,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  locationLabel: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '800',
  },
  sortRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  sortChip: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.card,
  },
  sortChipActive: {
    backgroundColor: colors.danger,
    borderColor: colors.danger,
  },
  sortChipText: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  sortChipTextActive: {
    color: colors.background,
  },
  list: {
    gap: spacing.lg,
  },
  loadMoreButton: {
    minHeight: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(255,122,122,0.3)',
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  loadMoreButtonDisabled: {
    opacity: 0.72,
  },
  loadMoreButtonText: {
    color: colors.danger,
    fontSize: typography.body,
    fontWeight: '800',
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
});

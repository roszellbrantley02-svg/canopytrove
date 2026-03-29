import { StyleSheet } from 'react-native';
import { colors, radii, spacing, typography } from '../../theme/tokens';

export const customerSupportStyles = StyleSheet.create({
  list: {
    gap: spacing.md,
  },
  form: {
    gap: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  input: {
    minHeight: 50,
    borderRadius: radii.lg,
    backgroundColor: 'rgba(8, 14, 19, 0.76)',
    borderWidth: 1,
    borderColor: colors.borderSoft,
    color: colors.text,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: typography.body,
  },
  helperText: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 22,
  },
  mutedText: {
    color: colors.textSoft,
    fontSize: typography.caption,
    lineHeight: 18,
  },
  resultCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: 'rgba(8, 14, 19, 0.72)',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  resultCardWarm: {
    borderColor: 'rgba(245, 200, 106, 0.18)',
    backgroundColor: 'rgba(245, 200, 106, 0.08)',
  },
  resultTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '900',
  },
  resultMeta: {
    color: colors.goldSoft,
    fontSize: typography.caption,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  primaryButton: {
    minHeight: 50,
    borderRadius: radii.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    shadowColor: colors.primary,
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  primaryButtonDanger: {
    backgroundColor: colors.danger,
    shadowColor: colors.danger,
  },
  primaryButtonText: {
    color: colors.background,
    fontSize: typography.body,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  secondaryButton: {
    minHeight: 46,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: 'rgba(8, 14, 19, 0.76)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '800',
  },
  buttonDisabled: {
    opacity: 0.45,
  },
});

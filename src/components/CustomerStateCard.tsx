import React, { PropsWithChildren } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, typography } from '../theme/tokens';

type CustomerStateTone = 'neutral' | 'warm' | 'info' | 'danger' | 'success';

type CustomerStateCardProps = PropsWithChildren<{
  title: string;
  body: string;
  iconName?: React.ComponentProps<typeof Ionicons>['name'];
  eyebrow?: string;
  note?: string;
  tone?: CustomerStateTone;
  centered?: boolean;
}>;

const toneStyles: Record<
  CustomerStateTone,
  {
    borderColor: string;
    backgroundColor: string;
    iconColor: string;
    eyebrowColor: string;
  }
> = {
  neutral: {
    borderColor: colors.borderSoft,
    backgroundColor: 'rgba(8, 14, 19, 0.72)',
    iconColor: colors.accent,
    eyebrowColor: colors.goldSoft,
  },
  warm: {
    borderColor: 'rgba(245, 200, 106, 0.18)',
    backgroundColor: 'rgba(245, 200, 106, 0.08)',
    iconColor: colors.goldSoft,
    eyebrowColor: colors.goldSoft,
  },
  info: {
    borderColor: 'rgba(0, 215, 255, 0.18)',
    backgroundColor: 'rgba(0, 215, 255, 0.08)',
    iconColor: colors.cyan,
    eyebrowColor: colors.cyan,
  },
  danger: {
    borderColor: 'rgba(255, 122, 122, 0.22)',
    backgroundColor: 'rgba(255, 122, 122, 0.08)',
    iconColor: colors.rose,
    eyebrowColor: colors.rose,
  },
  success: {
    borderColor: 'rgba(0, 245, 140, 0.18)',
    backgroundColor: 'rgba(0, 245, 140, 0.08)',
    iconColor: colors.primary,
    eyebrowColor: colors.primary,
  },
};

export function CustomerStateCard({
  title,
  body,
  iconName = 'sparkles-outline',
  eyebrow,
  note,
  tone = 'neutral',
  centered = false,
  children,
}: CustomerStateCardProps) {
  const toneStyle = toneStyles[tone];

  return (
    <View
      style={[
        styles.card,
        {
          borderColor: toneStyle.borderColor,
          backgroundColor: toneStyle.backgroundColor,
        },
        centered && styles.cardCentered,
      ]}
    >
      <View style={[styles.header, centered && styles.headerCentered]}>
        <View
          style={[
            styles.iconWrap,
            { borderColor: toneStyle.borderColor },
            centered && styles.iconWrapCentered,
          ]}
        >
          <Ionicons name={iconName} size={18} color={toneStyle.iconColor} />
        </View>
        <View style={[styles.copy, centered && styles.copyCentered]}>
          {eyebrow ? (
            <Text style={[styles.eyebrow, { color: toneStyle.eyebrowColor }, centered && styles.textCentered]}>
              {eyebrow}
            </Text>
          ) : null}
          <Text style={[styles.title, centered && styles.textCentered]}>{title}</Text>
          <Text style={[styles.body, centered && styles.textCentered]}>{body}</Text>
          {note ? <Text style={[styles.note, centered && styles.textCentered]}>{note}</Text> : null}
        </View>
      </View>
      {children ? <View style={styles.footer}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.xl,
    borderWidth: 1,
    padding: spacing.xl,
    gap: spacing.lg,
    shadowColor: colors.shadow,
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  cardCentered: {
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  headerCentered: {
    flexDirection: 'column',
    alignItems: 'center',
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: radii.md,
    borderWidth: 1,
    backgroundColor: 'rgba(8, 14, 19, 0.78)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapCentered: {
    width: 52,
    height: 52,
    borderRadius: 18,
  },
  copy: {
    flex: 1,
    gap: spacing.xs,
  },
  copyCentered: {
    alignItems: 'center',
  },
  eyebrow: {
    fontSize: typography.caption,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  title: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '900',
    lineHeight: 22,
  },
  body: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 22,
  },
  note: {
    color: colors.textSoft,
    fontSize: typography.caption,
    lineHeight: 18,
  },
  footer: {
    width: '100%',
    gap: spacing.md,
  },
  textCentered: {
    textAlign: 'center',
  },
});

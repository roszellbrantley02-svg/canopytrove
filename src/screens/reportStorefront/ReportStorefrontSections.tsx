import React from 'react';
import { Text, View } from 'react-native';
import { CustomerStateCard } from '../../components/CustomerStateCard';
import { AppUiIcon } from '../../icons/AppUiIcon';
import { storefrontSourceMode } from '../../config/storefrontSourceConfig';
import { colors, radii, spacing, typography } from '../../theme/tokens';

const MIN_REPORT_DESCRIPTION_LENGTH = 12;

export type StorefrontReportEntryMode = 'general_report' | 'suggest_edit' | 'report_closed';

export const REPORT_REASONS = [
  'Listing issue',
  'Address issue',
  'Store closed',
  'Wrong storefront',
  'Other',
];

export const REPORT_SCREEN_NAME = 'ReportStorefront';

export function isReportReason(value: string): value is (typeof REPORT_REASONS)[number] {
  return REPORT_REASONS.includes(value as (typeof REPORT_REASONS)[number]);
}

export function getReportScreenTitle(mode: StorefrontReportEntryMode, storefrontName: string) {
  if (mode === 'suggest_edit') {
    return `Suggest an edit for ${storefrontName}`;
  }

  if (mode === 'report_closed') {
    return `Report ${storefrontName} as closed`;
  }

  return `Report ${storefrontName}`;
}

export function getReportScreenSubtitle(mode: StorefrontReportEntryMode) {
  if (mode === 'suggest_edit') {
    return 'Use this flow to correct storefront details that look stale, incomplete, or misleading.';
  }

  if (mode === 'report_closed') {
    return 'Use this flow when a storefront appears closed or no longer operating at the listed location.';
  }

  return 'Use reports for listing or storefront problems. They support moderation and quality control only.';
}

export function getReportSnapshotBody(mode: StorefrontReportEntryMode) {
  if (mode === 'suggest_edit') {
    return 'Suggested edits go into the same moderation and admin review queue as other storefront reports so listing fixes can be reviewed cleanly.';
  }

  if (mode === 'report_closed') {
    return 'Closure reports go straight into the moderation and admin review queue so storefront status changes can be checked quickly.';
  }

  return 'Reports help clean up storefront quality and moderation issues. This flow is separate from customer engagement features.';
}

export function getReportDetailsPlaceholder(mode: StorefrontReportEntryMode) {
  if (mode === 'suggest_edit') {
    return 'Describe the storefront detail that should be corrected and what the correct information should be.';
  }

  if (mode === 'report_closed') {
    return 'Describe why this storefront appears closed and any signs that confirmed it.';
  }

  return 'Describe the issue with this storefront listing.';
}

export function getReportSubmitBody(mode: StorefrontReportEntryMode) {
  if (mode === 'suggest_edit') {
    return 'Send the storefront correction once the reason and notes are accurate. Admin review can use it to improve listing quality.';
  }

  if (mode === 'report_closed') {
    return 'Send the closure report once the notes are accurate. The moderation queue will review the storefront status from there.';
  }

  return 'Send the report once the reason and notes are accurate. Reports are reviewed for quality control only.';
}

export function getReportValidationState(textLength: number) {
  if (textLength >= MIN_REPORT_DESCRIPTION_LENGTH) {
    return null;
  }

  return `Add ${MIN_REPORT_DESCRIPTION_LENGTH - textLength} more characters so the report can be reviewed.`;
}

export function getReportSubmitErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : '';

  if (
    message.includes('403') ||
    message.includes('forbidden') ||
    message.includes('not allowed') ||
    message.includes('cannot submit')
  ) {
    return 'This profile cannot submit reports right now.';
  }

  if (message.includes('429') || message.includes('too many') || message.includes('rate')) {
    return 'Too many report attempts right now. Wait a moment and try again.';
  }

  return 'Could not submit the report right now. Try again.';
}

export function getReportStorageBody() {
  return 'Every report stores the storefront id, your profile id, the reason you picked, your notes, and a timestamp so it can be reviewed later.';
}

export function getReportRoutingBody() {
  if (storefrontSourceMode === 'api') {
    return 'This build sends reports to the Canopy Trove backend moderation path. When backend Firestore is configured, the report is written into the storefront_reports review queue.';
  }

  return 'This preview build stores reports locally on this device for testing. They stay in the Canopy Trove storefront community cache until the live backend moderation path is enabled.';
}

export function getReportRoutingIconName() {
  return storefrontSourceMode === 'api' ? 'server-outline' : 'phone-portrait-outline';
}

type ReportStorefrontInfoCardProps = {
  title: string;
  body: string;
  iconName: React.ComponentProps<typeof AppUiIcon>['name'];
  iconColor: string;
};

export function ReportStorefrontInfoCard({
  title,
  body,
  iconName,
  iconColor,
}: ReportStorefrontInfoCardProps) {
  return (
    <View style={styles.infoCard}>
      <View style={styles.infoHeader}>
        <View style={styles.infoIconWrap}>
          <AppUiIcon name={iconName} size={18} color={iconColor} />
        </View>
        <View style={styles.infoCopy}>
          <Text style={styles.infoTitle}>{title}</Text>
          <Text style={styles.infoBody}>{body}</Text>
        </View>
      </View>
    </View>
  );
}

type ReportStorefrontValidationCardProps = {
  validationState: string | null;
};

export function ReportStorefrontValidationCard({
  validationState,
}: ReportStorefrontValidationCardProps) {
  if (validationState) {
    return (
      <CustomerStateCard
        title="More detail is still needed"
        body={validationState}
        tone="warm"
        iconName="document-text-outline"
        eyebrow="Validation"
      />
    );
  }

  return (
    <CustomerStateCard
      title="Reports are for quality control"
      body="Reports help correct storefront data and moderation issues. They are reviewed separately from customer engagement activity."
      tone="neutral"
      iconName="shield-checkmark-outline"
      eyebrow="Reassurance"
    />
  );
}

const styles = {
  infoCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: 'rgba(8, 14, 19, 0.72)',
    padding: spacing.lg,
    gap: spacing.md,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  infoIconWrap: {
    width: 38,
    height: 38,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: 'rgba(8, 14, 19, 0.78)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  infoTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '900',
  },
  infoBody: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 22,
  },
} as const;

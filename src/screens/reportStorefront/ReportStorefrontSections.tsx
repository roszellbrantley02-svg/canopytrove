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
    return 'Suggest a fix if any storefront details look outdated, incomplete, or wrong.';
  }

  if (mode === 'report_closed') {
    return 'Use this when a storefront appears closed or no longer operates at this location.';
  }

  return 'Use reports for listing problems or storefront issues. Our team reviews them separately from reviews and other customer activity.';
}

export function getReportSnapshotBody(mode: StorefrontReportEntryMode) {
  if (mode === 'suggest_edit') {
    return 'Suggested edits are reviewed by our team before listing details are updated.';
  }

  if (mode === 'report_closed') {
    return 'Closure reports go straight to our team so storefront status changes can be checked quickly.';
  }

  return 'Reports help keep storefront details accurate. This screen is only for reporting issues.';
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
    return 'Send the suggested correction once your notes are accurate. Our team will review it and update the listing if needed.';
  }

  if (mode === 'report_closed') {
    return 'Send the closure report once the notes are accurate. Our team will review the storefront status from there.';
  }

  return 'Send the report once the reason and notes are accurate. Our team will review it from there.';
}

export function getReportValidationState(textLength: number) {
  if (textLength >= MIN_REPORT_DESCRIPTION_LENGTH) {
    return null;
  }

  return `Add ${MIN_REPORT_DESCRIPTION_LENGTH - textLength} more characters so we can understand the issue.`;
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
  return 'Your report includes the storefront, the reason you chose, your notes, and a timestamp so our team can review it later.';
}

export function getReportRoutingBody() {
  if (storefrontSourceMode === 'api') {
    return 'This report is sent to the Canopy Trove team for review.';
  }

  return 'This preview build keeps reports on this device for testing until live reporting is turned on.';
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
      title="Report is ready"
      body="You have added enough detail for our team to review this report."
      tone="neutral"
      iconName="shield-checkmark-outline"
      eyebrow="Ready"
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

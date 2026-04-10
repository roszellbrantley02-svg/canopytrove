import { Platform } from 'react-native';
import type { OwnerPortalWorkspaceDocument, OwnerProfileDocument } from '../../types/ownerPortal';
import type { RuntimeOpsStatus } from '../../types/runtimeOps';
import {
  formatStatusLabel,
  isPendingReviewStatus,
  isVerifiedStatus,
} from './ownerPortalStatusUtils';
import type { OwnerPortalStageItem } from './OwnerPortalStageList';

export type OwnerPortalHomeSummaryTile = {
  label: string;
  value: string;
  body: string;
};

export type OwnerPortalHomeDerivedMetrics = {
  topPromotion: OwnerPortalWorkspaceDocument['promotionPerformance'][number] | null;
  totalActions7d: number;
  activePromotionCount: number;
  openRate: number;
  visibilityMax: number;
  actionMixMax: number;
  responseMixMax: number;
  topPromotionTrackedActions: number;
};

export function formatOwnerValue(value: string | null | undefined) {
  return formatStatusLabel(value);
}

export function getTopPromotion(workspace: OwnerPortalWorkspaceDocument | null) {
  if (!workspace) {
    return null;
  }

  return (
    [...workspace.promotionPerformance].sort((left, right) => {
      if (right.metrics.actionRate !== left.metrics.actionRate) {
        return right.metrics.actionRate - left.metrics.actionRate;
      }

      return right.metrics.impressions - left.metrics.impressions;
    })[0] ?? null
  );
}

export function getJourneyItems(input: {
  preview: boolean;
  signedIn: boolean;
  hasBusinessDetails: boolean;
  hasClaimedListing: boolean;
  businessVerificationStatus: string | null | undefined;
  identityVerificationStatus: string | null | undefined;
  subscriptionStatus: string | null | undefined;
}): OwnerPortalStageItem[] {
  return [
    {
      label: 'Signed in',
      body: input.preview
        ? 'Preview mode is open, so you can look around before anything goes live.'
        : input.signedIn
          ? 'You are signed in and ready to keep setting up the business side of the app.'
          : 'Sign in first so this space can connect to the right business account.',
      tone: input.preview || input.signedIn ? 'complete' : 'current',
    },
    {
      label: 'Business details',
      body: input.hasBusinessDetails
        ? 'Your business name and company details are already in place.'
        : 'Add the core business details so the storefront and verification steps feel complete.',
      tone: input.hasBusinessDetails ? 'complete' : 'current',
    },
    {
      label: 'Storefront connected',
      body: input.hasClaimedListing
        ? 'Your business is connected to a storefront in the app.'
        : Platform.OS === 'android'
          ? 'Connect the right storefront so you can update photos, details, and updates.'
          : 'Connect the right storefront so you can update photos, details, and offers.',
      tone: input.hasClaimedListing ? 'complete' : 'pending',
    },
    {
      label: 'Business approved',
      body: isVerifiedStatus(input.businessVerificationStatus)
        ? 'Your business details have been approved.'
        : isPendingReviewStatus(input.businessVerificationStatus)
          ? 'Your business details are being reviewed.'
          : 'Send in your business details so this step can be approved.',
      tone: isVerifiedStatus(input.businessVerificationStatus)
        ? 'complete'
        : isPendingReviewStatus(input.businessVerificationStatus)
          ? 'current'
          : input.hasClaimedListing
            ? 'current'
            : 'pending',
    },
    {
      label: 'Owner identity',
      body: isVerifiedStatus(input.identityVerificationStatus)
        ? 'Your identity has been verified.'
        : isPendingReviewStatus(input.identityVerificationStatus)
          ? 'Your identity documents are being reviewed.'
          : 'Finish identity verification so the business account is fully ready.',
      tone: isVerifiedStatus(input.identityVerificationStatus)
        ? 'complete'
        : isPendingReviewStatus(input.identityVerificationStatus)
          ? 'current'
          : 'pending',
    },
    {
      label: 'Plan',
      body:
        input.subscriptionStatus && input.subscriptionStatus !== 'inactive'
          ? 'Your business plan is active or currently in trial.'
          : 'Pick a plan when you are ready for the full owner experience.',
      tone:
        input.subscriptionStatus && input.subscriptionStatus !== 'inactive'
          ? 'complete'
          : 'pending',
    },
  ];
}

export function getRuntimeStatusMessage(status: RuntimeOpsStatus | null) {
  if (!status) {
    return 'Checking whether storefront updates are ready.';
  }

  if (status.policy.safeModeEnabled) {
    return (
      status.policy.reason ??
      'Some updates are temporarily paused while we smooth things out behind the scenes.'
    );
  }

  if (status.incidentCounts.criticalLast24Hours > 0) {
    return 'Everything is still available, but we are watching the system a little more closely right now.';
  }

  return 'Everything is running normally.';
}

export function getRuntimeStatusTone(status: RuntimeOpsStatus | null) {
  if (!status) {
    return 'warm' as const;
  }

  if (status.policy.safeModeEnabled || status.incidentCounts.criticalLast24Hours > 0) {
    return 'warm' as const;
  }

  return 'success' as const;
}

export function getOwnerStatusChips(input: {
  preview: boolean;
  allowlisted: boolean;
  ownerProfile: OwnerProfileDocument | null;
}) {
  return [
    input.allowlisted ? 'Owner approved' : 'Invite only',
    input.ownerProfile?.subscriptionStatus
      ? formatOwnerValue(input.ownerProfile.subscriptionStatus)
      : 'No active plan',
    input.ownerProfile?.dispensaryId ? 'Storefront connected' : 'Storefront not connected',
  ];
}

export function getProfileSummaryTiles(
  ownerProfile: OwnerProfileDocument | null,
): OwnerPortalHomeSummaryTile[] {
  if (!ownerProfile) {
    return [];
  }

  return [
    {
      label: 'Level',
      value: `${ownerProfile.badgeLevel}`,
      body: 'Your current business level in the app.',
    },
    {
      label: 'Next step',
      value: formatOwnerValue(ownerProfile.onboardingStep),
      body: 'Where you left off in setup.',
    },
    {
      label: 'Plan',
      value: formatOwnerValue(ownerProfile.subscriptionStatus),
      body: 'Your current business plan.',
    },
  ];
}

export function getOwnerHomeDerivedMetrics(
  workspace: OwnerPortalWorkspaceDocument | null,
): OwnerPortalHomeDerivedMetrics {
  const topPromotion = getTopPromotion(workspace);
  const totalActions7d = workspace
    ? workspace.metrics.routeStarts7d +
      workspace.metrics.websiteTapCount7d +
      workspace.metrics.menuTapCount7d +
      workspace.metrics.phoneTapCount7d
    : 0;
  const activePromotionCount =
    workspace?.promotions.filter((promotion) => promotion.status === 'active').length ?? 0;
  const openRate =
    workspace && workspace.metrics.storefrontImpressions7d > 0
      ? (workspace.metrics.storefrontOpenCount7d / workspace.metrics.storefrontImpressions7d) * 100
      : 0;
  const visibilityMax = workspace
    ? Math.max(
        workspace.metrics.storefrontImpressions7d,
        workspace.metrics.storefrontOpenCount7d,
        workspace.metrics.followerCount,
        workspace.metrics.reviewCount30d,
        1,
      )
    : 1;
  const actionMixMax = Math.max(totalActions7d, 1);
  const responseMixMax = workspace
    ? Math.max(
        workspace.metrics.openReportCount,
        activePromotionCount,
        workspace.metrics.reviewCount30d,
        1,
      )
    : 1;
  const topPromotionTrackedActions = topPromotion
    ? topPromotion.metrics.redeemStarts +
      topPromotion.metrics.websiteTaps +
      topPromotion.metrics.menuTaps +
      topPromotion.metrics.phoneTaps
    : 0;

  return {
    topPromotion,
    totalActions7d,
    activePromotionCount,
    openRate,
    visibilityMax,
    actionMixMax,
    responseMixMax,
    topPromotionTrackedActions,
  };
}

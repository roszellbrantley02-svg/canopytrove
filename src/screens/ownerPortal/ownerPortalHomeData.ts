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
      label: 'Account access',
      body: input.preview
        ? 'Preview mode is open for full local testing. Live owner access still depends on the approved email path.'
        : input.signedIn
          ? 'The real owner account is signed in and can continue onboarding from this dashboard.'
          : 'Sign in first so the owner workspace can attach to the correct account.',
      tone: input.preview || input.signedIn ? 'complete' : 'current',
    },
    {
      label: 'Business profile',
      body: input.hasBusinessDetails
        ? 'Legal and company details are present and ready for the storefront claim step.'
        : 'Business details still need to be finished before claim and verification feel complete.',
      tone: input.hasBusinessDetails ? 'complete' : 'current',
    },
    {
      label: 'Claimed listing',
      body: input.hasClaimedListing
        ? 'A storefront is linked to the owner workspace.'
        : 'Claim the correct dispensary listing before business verification can be treated as live.',
      tone: input.hasClaimedListing ? 'complete' : 'pending',
    },
    {
      label: 'Business verification',
      body: isVerifiedStatus(input.businessVerificationStatus)
        ? 'Business review is complete.'
        : isPendingReviewStatus(input.businessVerificationStatus)
          ? 'Business documents are in review.'
          : 'Business proof still needs to be submitted and approved.',
      tone: isVerifiedStatus(input.businessVerificationStatus)
        ? 'complete'
        : isPendingReviewStatus(input.businessVerificationStatus)
          ? 'current'
          : input.hasClaimedListing
            ? 'current'
            : 'pending',
    },
    {
      label: 'Identity verification',
      body: isVerifiedStatus(input.identityVerificationStatus)
        ? 'Identity review is complete.'
        : isPendingReviewStatus(input.identityVerificationStatus)
          ? 'Identity package is in review.'
          : 'Identity review still needs to be completed before premium access can go live.',
      tone: isVerifiedStatus(input.identityVerificationStatus)
        ? 'complete'
        : isPendingReviewStatus(input.identityVerificationStatus)
          ? 'current'
          : 'pending',
    },
    {
      label: 'Subscription access',
      body:
        input.subscriptionStatus && input.subscriptionStatus !== 'inactive'
          ? 'Premium owner access is active or in trial.'
          : 'Billing is the final step after claim and verification are complete.',
      tone:
        input.subscriptionStatus && input.subscriptionStatus !== 'inactive'
          ? 'complete'
          : 'pending',
    },
  ];
}

export function getRuntimeStatusMessage(status: RuntimeOpsStatus | null) {
  if (!status) {
    return 'Runtime monitoring is still loading for this owner workspace.';
  }

  if (status.policy.safeModeEnabled) {
    return (
      status.policy.reason ??
      'Protected mode is active while the system stabilizes. Live owner writes may be limited.'
    );
  }

  if (status.incidentCounts.criticalLast24Hours > 0) {
    return 'Monitoring is elevated because the system logged recent critical incidents, but live tools are still available.';
  }

  return 'Runtime monitoring is clear. Owner AI, storefront tools, and incident tracking are available.';
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
    input.preview ? 'Preview workspace' : input.allowlisted ? 'Approved owner' : 'Invite flow',
    input.ownerProfile?.subscriptionStatus
      ? formatOwnerValue(input.ownerProfile.subscriptionStatus)
      : 'Plan inactive',
    input.ownerProfile?.dispensaryId ? 'Storefront connected' : 'No listing claimed',
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
      label: 'Badge Level',
      value: `${ownerProfile.badgeLevel}`,
      body: 'Current premium storefront badge level.',
    },
    {
      label: 'Onboarding',
      value: formatOwnerValue(ownerProfile.onboardingStep),
      body: 'Where the owner journey currently resumes.',
    },
    {
      label: 'Plan Access',
      value: formatOwnerValue(ownerProfile.subscriptionStatus),
      body: 'Current premium plan state for this owner account.',
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

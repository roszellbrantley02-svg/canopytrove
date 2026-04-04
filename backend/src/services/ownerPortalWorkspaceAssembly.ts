import {
  OwnerPortalWorkspaceDocument,
  OwnerWorkspaceMetrics,
  OwnerWorkspaceReviewRecord,
} from '../../../src/types/ownerPortal';
import { AppReview } from '../../../src/types/storefront';
import { RuntimeOpsStatus } from '../../../src/types/runtimeOps';
import { StorefrontSummaryApiDocument } from '../types';
import { StoredStorefrontReportRecord } from './storefrontCommunityService';

export function buildEmptyOwnerPortalWorkspace(
  runtimeStatus: RuntimeOpsStatus,
): OwnerPortalWorkspaceDocument {
  return {
    ownerProfile: null,
    ownerClaim: null,
    storefrontSummary: null,
    metrics: {
      followerCount: 0,
      storefrontImpressions7d: 0,
      storefrontOpenCount7d: 0,
      routeStarts7d: 0,
      websiteTapCount7d: 0,
      phoneTapCount7d: 0,
      menuTapCount7d: 0,
      reviewCount30d: 0,
      openReportCount: 0,
      averageRating: null,
      replyRate: 0,
      openToRouteRate: 0,
      openToWebsiteRate: 0,
      openToPhoneRate: 0,
      openToMenuRate: 0,
    },
    patternFlags: [],
    recentReviews: [],
    recentReports: [],
    promotions: [],
    promotionPerformance: [],
    profileTools: null,
    licenseCompliance: null,
    ownerAlertStatus: {
      pushEnabled: false,
      updatedAt: null,
    },
    runtimeStatus,
  };
}

export function buildOwnerWorkspaceReviews({
  recentReviews,
  storefrontId,
}: {
  recentReviews: AppReview[];
  storefrontId: string | null;
}): OwnerWorkspaceReviewRecord[] {
  return recentReviews.slice(0, 8).map((review) => ({
    ...review,
    storefrontId: storefrontId ?? '',
    ownerReply: review.ownerReply ?? null,
    isLowRating: review.rating <= 2,
  }));
}

export function buildOwnerWorkspaceReports({
  recentReports,
}: {
  recentReports: StoredStorefrontReportRecord[];
}): OwnerPortalWorkspaceDocument['recentReports'] {
  return recentReports.slice(0, 8).map((report) => ({
    ...report,
    moderationStatus:
      report.moderationStatus === 'reviewed' || report.moderationStatus === 'dismissed'
        ? report.moderationStatus
        : 'open',
    reviewedAt: report.reviewedAt ?? null,
    reviewNotes: report.reviewNotes ?? null,
  }));
}

export function buildOwnerWorkspaceMetrics({
  followerCount,
  storefrontMetrics,
  recentReports,
  recentReviews,
}: {
  followerCount: number;
  storefrontMetrics: {
    impressions7d: number;
    opens7d: number;
    routes7d: number;
    websiteTaps7d: number;
    phoneTaps7d: number;
    menuTaps7d: number;
    reviews30d: number;
  };
  recentReports: StoredStorefrontReportRecord[];
  recentReviews: Array<{
    rating: number;
    ownerReply?: { text?: string | null } | null;
  }>;
}): OwnerWorkspaceMetrics {
  const replyCount = recentReviews.filter((review) => review.ownerReply?.text?.trim()).length;
  const openBase = storefrontMetrics.opens7d || 0;

  return {
    followerCount,
    storefrontImpressions7d: storefrontMetrics.impressions7d,
    storefrontOpenCount7d: storefrontMetrics.opens7d,
    routeStarts7d: storefrontMetrics.routes7d,
    websiteTapCount7d: storefrontMetrics.websiteTaps7d,
    phoneTapCount7d: storefrontMetrics.phoneTaps7d,
    menuTapCount7d: storefrontMetrics.menuTaps7d,
    reviewCount30d: storefrontMetrics.reviews30d,
    openReportCount: recentReports.filter((report) => report.moderationStatus === 'open').length,
    averageRating: recentReviews.length
      ? Math.round(
          (recentReviews.reduce((sum, review) => sum + review.rating, 0) / recentReviews.length) *
            10,
        ) / 10
      : null,
    replyRate: recentReviews.length
      ? Math.round((replyCount / recentReviews.length) * 100) / 100
      : 0,
    openToRouteRate:
      openBase > 0 ? Math.round((storefrontMetrics.routes7d / openBase) * 1000) / 10 : 0,
    openToWebsiteRate:
      openBase > 0 ? Math.round((storefrontMetrics.websiteTaps7d / openBase) * 1000) / 10 : 0,
    openToPhoneRate:
      openBase > 0 ? Math.round((storefrontMetrics.phoneTaps7d / openBase) * 1000) / 10 : 0,
    openToMenuRate:
      openBase > 0 ? Math.round((storefrontMetrics.menuTaps7d / openBase) * 1000) / 10 : 0,
  };
}

export function buildOwnerWorkspaceSummarySnapshot(
  storefrontSummary: StorefrontSummaryApiDocument,
): OwnerPortalWorkspaceDocument['storefrontSummary'] {
  return {
    id: storefrontSummary.id,
    displayName: storefrontSummary.displayName,
    addressLine1: storefrontSummary.addressLine1,
    city: storefrontSummary.city,
    state: storefrontSummary.state,
    zip: storefrontSummary.zip,
    promotionText: storefrontSummary.promotionText ?? null,
    promotionBadges: storefrontSummary.promotionBadges ?? [],
  };
}

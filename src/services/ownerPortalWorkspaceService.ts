import type {
  OwnerAiActionPlan,
  OwnerAiDraftRequest,
  OwnerAiProfileSuggestion,
  OwnerAiPromotionDraft,
  OwnerAiReviewReplyDraft,
  OwnerPortalLicenseComplianceInput,
  OwnerPortalProfileToolsInput,
  OwnerPortalPromotionInput,
  OwnerPortalWorkspaceDocument,
  OwnerStorefrontProfileToolsDocument,
  OwnerStorefrontPromotionDocument,
} from '../types/ownerPortal';
import { requestJson } from './storefrontBackendHttp';

function requestOwnerPortalJson<T>(
  pathname: string,
  init?: Omit<RequestInit, 'body'> & { body?: unknown },
) {
  const body =
    init && Object.prototype.hasOwnProperty.call(init, 'body')
      ? JSON.stringify(init.body)
      : undefined;
  const headers = new Headers(init?.headers);
  if (body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }

  return requestJson<T>(pathname, {
    ...init,
    headers: body === undefined ? init?.headers : headers,
    body,
  });
}

export function getOwnerPortalWorkspace() {
  return requestOwnerPortalJson<OwnerPortalWorkspaceDocument>('/owner-portal/workspace');
}

export function saveOwnerPortalLicenseCompliance(input: OwnerPortalLicenseComplianceInput) {
  return requestOwnerPortalJson<OwnerPortalWorkspaceDocument['licenseCompliance']>(
    '/owner-portal/license-compliance',
    {
      method: 'PUT',
      body: input,
    },
  );
}

export function saveOwnerPortalProfileTools(input: OwnerPortalProfileToolsInput) {
  return requestOwnerPortalJson<OwnerStorefrontProfileToolsDocument>(
    '/owner-portal/profile-tools',
    {
      method: 'PUT',
      body: input,
    },
  );
}

export function createOwnerPortalPromotion(input: OwnerPortalPromotionInput) {
  return requestOwnerPortalJson<OwnerStorefrontPromotionDocument>('/owner-portal/promotions', {
    method: 'POST',
    body: input,
  });
}

export function updateOwnerPortalPromotion(promotionId: string, input: OwnerPortalPromotionInput) {
  return requestOwnerPortalJson<OwnerStorefrontPromotionDocument>(
    `/owner-portal/promotions/${encodeURIComponent(promotionId)}`,
    {
      method: 'PUT',
      body: input,
    },
  );
}

export function replyToOwnerPortalReview(reviewId: string, text: string) {
  return requestOwnerPortalJson<OwnerPortalWorkspaceDocument['recentReviews'][number]>(
    `/owner-portal/reviews/${encodeURIComponent(reviewId)}/reply`,
    {
      method: 'POST',
      body: {
        text,
      },
    },
  );
}

export function syncOwnerPortalAlerts(devicePushToken?: string | null) {
  return requestOwnerPortalJson<OwnerPortalWorkspaceDocument['ownerAlertStatus']>(
    '/owner-portal/alerts/sync',
    {
      method: 'POST',
      body: {
        devicePushToken: devicePushToken ?? undefined,
      },
    },
  );
}

export function getOwnerPortalAiActionPlan() {
  return requestOwnerPortalJson<OwnerAiActionPlan>('/owner-portal/ai/action-plan');
}

export function getOwnerPortalAiPromotionDraft(input: OwnerAiDraftRequest) {
  return requestOwnerPortalJson<OwnerAiPromotionDraft>('/owner-portal/ai/promotion-draft', {
    method: 'POST',
    body: input,
  });
}

export function getOwnerPortalAiReviewReplyDraft(reviewId: string, input: OwnerAiDraftRequest) {
  return requestOwnerPortalJson<OwnerAiReviewReplyDraft>(
    `/owner-portal/ai/reviews/${encodeURIComponent(reviewId)}/reply-draft`,
    {
      method: 'POST',
      body: input,
    },
  );
}

export function getOwnerPortalAiProfileSuggestion(input: OwnerAiDraftRequest) {
  return requestOwnerPortalJson<OwnerAiProfileSuggestion>('/owner-portal/ai/profile-suggestion', {
    method: 'POST',
    body: input,
  });
}

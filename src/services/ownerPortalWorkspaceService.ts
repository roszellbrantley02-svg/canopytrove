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

const AI_REQUEST_TIMEOUT_MS = 25_000;

function requestOwnerPortalJson<T>(
  pathname: string,
  init?: Omit<RequestInit, 'body'> & { body?: unknown },
  options?: { timeoutMs?: number },
) {
  const body =
    init && Object.prototype.hasOwnProperty.call(init, 'body')
      ? JSON.stringify(init.body)
      : undefined;
  const headers = new Headers(init?.headers);
  if (body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }

  return requestJson<T>(
    pathname,
    {
      ...init,
      headers: body === undefined ? init?.headers : headers,
      body,
    },
    options?.timeoutMs ? { timeoutMs: options.timeoutMs } : undefined,
  );
}

const WORKSPACE_REQUEST_TIMEOUT_MS = 15_000;

export function getOwnerPortalWorkspace(locationId?: string | null) {
  const query = locationId ? `?locationId=${encodeURIComponent(locationId)}` : '';
  return requestOwnerPortalJson<OwnerPortalWorkspaceDocument>(
    `/owner-portal/workspace${query}`,
    undefined,
    { timeoutMs: WORKSPACE_REQUEST_TIMEOUT_MS },
  );
}

export function saveOwnerPortalLicenseCompliance(
  input: OwnerPortalLicenseComplianceInput,
  locationId?: string | null,
) {
  return requestOwnerPortalJson<OwnerPortalWorkspaceDocument['licenseCompliance']>(
    '/owner-portal/license-compliance',
    {
      method: 'PUT',
      body: { ...input, ...(locationId ? { locationId } : {}) },
    },
  );
}

export function saveOwnerPortalProfileTools(
  input: OwnerPortalProfileToolsInput,
  locationId?: string | null,
) {
  return requestOwnerPortalJson<OwnerStorefrontProfileToolsDocument>(
    '/owner-portal/profile-tools',
    {
      method: 'PUT',
      body: { ...input, ...(locationId ? { locationId } : {}) },
    },
  );
}

export function createOwnerPortalPromotion(
  input: OwnerPortalPromotionInput,
  locationId?: string | null,
) {
  return requestOwnerPortalJson<OwnerStorefrontPromotionDocument>('/owner-portal/promotions', {
    method: 'POST',
    body: { ...input, ...(locationId ? { locationId } : {}) },
  });
}

export function updateOwnerPortalPromotion(
  promotionId: string,
  input: OwnerPortalPromotionInput,
  locationId?: string | null,
) {
  return requestOwnerPortalJson<OwnerStorefrontPromotionDocument>(
    `/owner-portal/promotions/${encodeURIComponent(promotionId)}`,
    {
      method: 'PUT',
      body: { ...input, ...(locationId ? { locationId } : {}) },
    },
  );
}

export function deleteOwnerPortalPromotion(promotionId: string, locationId?: string | null) {
  return requestOwnerPortalJson<{ deleted: boolean; promotionId: string }>(
    `/owner-portal/promotions/${encodeURIComponent(promotionId)}`,
    {
      method: 'DELETE',
      body: locationId ? { locationId } : undefined,
    },
  );
}

export function replyToOwnerPortalReview(
  reviewId: string,
  text: string,
  locationId?: string | null,
) {
  return requestOwnerPortalJson<OwnerPortalWorkspaceDocument['recentReviews'][number]>(
    `/owner-portal/reviews/${encodeURIComponent(reviewId)}/reply`,
    {
      method: 'POST',
      body: {
        text,
        ...(locationId ? { locationId } : {}),
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
  return requestOwnerPortalJson<OwnerAiActionPlan>('/owner-portal/ai/action-plan', undefined, {
    timeoutMs: AI_REQUEST_TIMEOUT_MS,
  });
}

export function getOwnerPortalAiPromotionDraft(input: OwnerAiDraftRequest) {
  return requestOwnerPortalJson<OwnerAiPromotionDraft>(
    '/owner-portal/ai/promotion-draft',
    { method: 'POST', body: input },
    { timeoutMs: AI_REQUEST_TIMEOUT_MS },
  );
}

export function getOwnerPortalAiReviewReplyDraft(reviewId: string, input: OwnerAiDraftRequest) {
  return requestOwnerPortalJson<OwnerAiReviewReplyDraft>(
    `/owner-portal/ai/reviews/${encodeURIComponent(reviewId)}/reply-draft`,
    { method: 'POST', body: input },
    { timeoutMs: AI_REQUEST_TIMEOUT_MS },
  );
}

export function getOwnerPortalAiProfileSuggestion(input: OwnerAiDraftRequest) {
  return requestOwnerPortalJson<OwnerAiProfileSuggestion>(
    '/owner-portal/ai/profile-suggestion',
    { method: 'POST', body: input },
    { timeoutMs: AI_REQUEST_TIMEOUT_MS },
  );
}

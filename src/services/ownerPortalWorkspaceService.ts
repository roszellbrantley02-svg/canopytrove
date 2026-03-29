import {
  OwnerPortalProfileToolsInput,
  OwnerPortalPromotionInput,
  OwnerPortalWorkspaceDocument,
  OwnerStorefrontProfileToolsDocument,
  OwnerStorefrontPromotionDocument,
} from '../types/ownerPortal';
import { requestJson } from './storefrontBackendHttp';

export function getOwnerPortalWorkspace() {
  return requestJson<OwnerPortalWorkspaceDocument>('/owner-portal/workspace');
}

export function saveOwnerPortalProfileTools(input: OwnerPortalProfileToolsInput) {
  return requestJson<OwnerStorefrontProfileToolsDocument>('/owner-portal/profile-tools', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
}

export function createOwnerPortalPromotion(input: OwnerPortalPromotionInput) {
  return requestJson<OwnerStorefrontPromotionDocument>('/owner-portal/promotions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
}

export function updateOwnerPortalPromotion(
  promotionId: string,
  input: OwnerPortalPromotionInput
) {
  return requestJson<OwnerStorefrontPromotionDocument>(
    `/owner-portal/promotions/${encodeURIComponent(promotionId)}`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    }
  );
}

export function replyToOwnerPortalReview(reviewId: string, text: string) {
  return requestJson<OwnerPortalWorkspaceDocument['recentReviews'][number]>(
    `/owner-portal/reviews/${encodeURIComponent(reviewId)}/reply`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
      }),
    }
  );
}

export function syncOwnerPortalAlerts(devicePushToken?: string | null) {
  return requestJson<OwnerPortalWorkspaceDocument['ownerAlertStatus']>(
    '/owner-portal/alerts/sync',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        devicePushToken: devicePushToken ?? undefined,
      }),
    }
  );
}

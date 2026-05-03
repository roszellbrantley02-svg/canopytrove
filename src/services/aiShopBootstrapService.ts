/**
 * Frontend client for the AI Shop Bootstrap flow. Mirrors the four
 * backend endpoints documented in docs/AI_SHOP_BOOTSTRAP.md.
 */

import { requestJson } from './storefrontBackendHttp';

// Mirror the backend types — kept inline rather than imported to avoid
// pulling backend-only types into the RN bundle.
export type ShopBootstrapStatus = 'scraping' | 'parsing' | 'ready' | 'failed' | 'published';

export type AiShopBootstrapDraftPayload = {
  detectedName: string | null;
  detectedAddress: string | null;
  detectedCity: string | null;
  detectedState: string | null;
  detectedZip: string | null;
  detectedPhone: string | null;
  detectedWebsite: string | null;
  detectedMenuUrl: string | null;
  ocmMatch: {
    licenseNumber: string | null;
    matchConfidence: 'high' | 'medium' | 'low' | 'none';
    matchedDispensaryId: string | null;
  } | null;
  detectedHours: Array<{ day: string; hours: string }> | null;
  detectedBrands: string[] | null;
  detectedDeals: Array<{
    title: string;
    description: string;
    discountText?: string;
  }> | null;
  detectedAboutText: string | null;
  detectedPhotoUrls: string[] | null;
  detectedPaymentMethods: {
    acceptsCash: boolean | null;
    acceptsDebit: boolean | null;
    acceptsCredit: boolean | null;
    sourceText: string | null;
  } | null;
  extractionConfidence: 'high' | 'medium' | 'low';
  extractionNotes: string;
};

export type ShopBootstrapDraft = {
  draftId: string;
  ownerUid: string;
  websiteUrl: string;
  status: ShopBootstrapStatus;
  scrapedAt: string | null;
  parsedAt: string | null;
  publishedAt: string | null;
  failureReason: string | null;
  draft: AiShopBootstrapDraftPayload | null;
  ownerEdits: Partial<AiShopBootstrapDraftPayload> | null;
  publishedStorefrontId: string | null;
  createdAt: string;
  updatedAt: string;
};

type DraftEnvelope = { ok: true; draft: ShopBootstrapDraft };
type PublishEnvelope = { ok: true; storefrontId: string };

export function startShopBootstrap(input: { websiteUrl: string; claimedStorefrontId?: string }) {
  return requestJson<DraftEnvelope>('/owner-portal/shop-bootstrap/start', {
    method: 'POST',
    body: JSON.stringify(input),
    headers: { 'Content-Type': 'application/json' },
  });
}

export function getShopBootstrapDraft(draftId: string) {
  return requestJson<DraftEnvelope>(`/owner-portal/shop-bootstrap/${encodeURIComponent(draftId)}`, {
    method: 'GET',
  });
}

export function updateShopBootstrapDraft(input: {
  draftId: string;
  ownerEdits: Partial<AiShopBootstrapDraftPayload>;
}) {
  return requestJson<DraftEnvelope>(
    `/owner-portal/shop-bootstrap/${encodeURIComponent(input.draftId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ ownerEdits: input.ownerEdits }),
      headers: { 'Content-Type': 'application/json' },
    },
  );
}

export function publishShopBootstrapDraft(draftId: string) {
  return requestJson<PublishEnvelope>(
    `/owner-portal/shop-bootstrap/${encodeURIComponent(draftId)}/publish`,
    { method: 'POST' },
  );
}

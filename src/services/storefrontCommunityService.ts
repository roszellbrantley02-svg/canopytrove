import { storefrontSourceMode } from '../config/storefrontSourceConfig';
import { storefrontRepository } from '../repositories/storefrontRepository';
import {
  saveStorefrontDetailSnapshot,
} from './storefrontSummarySnapshotService';
import {
  addLocalStorefrontReport,
  addLocalStorefrontReview,
  markLocalStorefrontReviewHelpful,
} from './storefrontCommunityLocalService';
import {
  submitStorefrontBackendReport,
  submitStorefrontBackendReviewHelpful,
  submitStorefrontBackendReview,
} from './storefrontBackendService';
import {
  StorefrontReportSubmissionInput,
  StorefrontReportSubmissionResponse,
  StorefrontReviewHelpfulInput,
  StorefrontReviewHelpfulResponse,
  StorefrontReviewSubmissionInput,
  StorefrontReviewSubmissionResponse,
} from '../types/storefront';

export async function submitStorefrontReview(
  input: StorefrontReviewSubmissionInput
): Promise<StorefrontReviewSubmissionResponse> {
  if (storefrontSourceMode === 'api') {
    const response = await submitStorefrontBackendReview(input);
    storefrontRepository.primeStorefrontDetails(input.storefrontId, response.detail);
    await saveStorefrontDetailSnapshot(input.storefrontId, response.detail);
    return response;
  }

  await addLocalStorefrontReview(input);
  storefrontRepository.invalidateStorefrontDetails(input.storefrontId);
  const nextDetail = await storefrontRepository.getStorefrontDetails(input.storefrontId);
  if (!nextDetail) {
    throw new Error('Storefront detail is unavailable.');
  }
  await saveStorefrontDetailSnapshot(input.storefrontId, nextDetail);

  return {
    detail: nextDetail,
    rewardResult: null,
  };
}

export async function submitStorefrontReport(
  input: StorefrontReportSubmissionInput
): Promise<StorefrontReportSubmissionResponse> {
  if (storefrontSourceMode === 'api') {
    return submitStorefrontBackendReport(input);
  }

  await addLocalStorefrontReport(input);

  return {
    ok: true,
    rewardResult: null,
  };
}

export async function submitStorefrontReviewHelpful(
  input: StorefrontReviewHelpfulInput & { reviewAuthorProfileId?: string | null }
): Promise<StorefrontReviewHelpfulResponse> {
  if (storefrontSourceMode === 'api') {
    const response = await submitStorefrontBackendReviewHelpful(input);
    storefrontRepository.primeStorefrontDetails(input.storefrontId, response.detail);
    await saveStorefrontDetailSnapshot(input.storefrontId, response.detail);
    return response;
  }

  const helpfulResult = await markLocalStorefrontReviewHelpful(input);
  storefrontRepository.invalidateStorefrontDetails(input.storefrontId);
  const detail = await storefrontRepository.getStorefrontDetails(input.storefrontId);
  if (!detail) {
    throw new Error('Storefront detail is unavailable.');
  }

  await saveStorefrontDetailSnapshot(input.storefrontId, detail);

  return {
    detail,
    didApply: helpfulResult.didApply,
    reviewAuthorProfileId: helpfulResult.reviewAuthorProfileId,
  };
}

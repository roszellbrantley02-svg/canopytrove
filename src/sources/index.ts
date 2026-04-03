import { hasFirebaseConfig } from '../config/firebase';
import { storefrontApiBaseUrl, storefrontSourceMode } from '../config/storefrontSourceConfig';
import {
  applyStorefrontMemberDealAccessToDetail,
  applyStorefrontMemberDealAccessToSummaries,
} from '../services/storefrontMemberDealAccessService';
import { apiStorefrontSource } from './apiStorefrontSource';
import { firebaseStorefrontSource } from './firebaseStorefrontSource';
import { mockStorefrontSource } from './mockStorefrontSource';
import type { StorefrontSource } from './storefrontSource';

const canUseFirebaseSource = storefrontSourceMode === 'firebase' && hasFirebaseConfig;
const canUseApiSource = storefrontSourceMode === 'api' && Boolean(storefrontApiBaseUrl);

function createUnavailableSource(reason: string): StorefrontSource {
  const fail = async (): Promise<never> => {
    throw new Error(reason);
  };

  return {
    getAllSummaries: fail,
    getSummariesByIds: fail,
    getSummaryPage: fail,
    getSummaries: fail,
    getDetailsById: fail,
  };
}

function withMemberDealAccess(source: StorefrontSource): StorefrontSource {
  return {
    async getAllSummaries() {
      return applyStorefrontMemberDealAccessToSummaries(await source.getAllSummaries());
    },
    async getSummariesByIds(storefrontIds) {
      return applyStorefrontMemberDealAccessToSummaries(
        await source.getSummariesByIds(storefrontIds),
      );
    },
    async getSummaryPage(query) {
      const page = await source.getSummaryPage(query);
      return {
        ...page,
        items: applyStorefrontMemberDealAccessToSummaries(page.items),
      };
    },
    async getSummaries(query) {
      return applyStorefrontMemberDealAccessToSummaries(await source.getSummaries(query));
    },
    async getDetailsById(storefrontId) {
      return applyStorefrontMemberDealAccessToDetail(await source.getDetailsById(storefrontId));
    },
  };
}

const configuredSource =
  storefrontSourceMode === 'api'
    ? canUseApiSource
      ? apiStorefrontSource
      : createUnavailableSource('Storefront source is set to api, but the API base URL is missing.')
    : storefrontSourceMode === 'firebase'
      ? canUseFirebaseSource
        ? firebaseStorefrontSource
        : createUnavailableSource(
            'Storefront source is set to firebase, but Firebase client config is missing.',
          )
      : mockStorefrontSource;

export const storefrontSource = withMemberDealAccess(
  configuredSource === mockStorefrontSource ? mockStorefrontSource : configuredSource,
);

export const storefrontSourceStatus = {
  requestedMode: storefrontSourceMode,
  activeMode:
    storefrontSourceMode === 'api'
      ? canUseApiSource
        ? 'api'
        : 'unavailable'
      : storefrontSourceMode === 'firebase'
        ? canUseFirebaseSource
          ? 'firebase'
          : 'unavailable'
        : 'mock',
  fallbackReason:
    storefrontSourceMode === 'api' && !storefrontApiBaseUrl
      ? 'Missing storefront API base URL'
      : storefrontSourceMode === 'firebase' && !hasFirebaseConfig
        ? 'Missing Firebase environment config'
        : null,
} as const;

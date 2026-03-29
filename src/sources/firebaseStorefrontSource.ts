import { sortItems, paginate } from './firebaseStorefrontQueryUtils';
import {
  getAllFirebaseSummaries,
  getFilteredFirebaseSummaries,
  getFirebaseDetailsById,
  getFirebaseSummariesByIds,
} from './firebaseStorefrontReader';
import { StorefrontSource } from './storefrontSource';

export const firebaseStorefrontSource: StorefrontSource = {
  async getAllSummaries() {
    return getAllFirebaseSummaries();
  },

  async getSummariesByIds(storefrontIds) {
    return getFirebaseSummariesByIds(storefrontIds);
  },

  async getSummaryPage(sourceQuery) {
    const items = sortItems(await getFilteredFirebaseSummaries(sourceQuery), sourceQuery?.sortKey);
    return paginate(items, sourceQuery);
  },

  async getSummaries(sourceQuery) {
    return (await this.getSummaryPage(sourceQuery)).items;
  },

  async getDetailsById(storefrontId) {
    return getFirebaseDetailsById(storefrontId);
  },
};

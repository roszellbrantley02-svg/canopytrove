import { Router } from 'express';
import {
  getStorefrontDetail,
  getStorefrontSummaries,
  getStorefrontSummariesByIds,
} from '../storefrontService';
import {
  parseStorefrontIdParam,
  parseStorefrontSummariesQuery,
  parseStorefrontSummaryIdsQuery,
} from '../http/validation';
import { StorefrontSummariesApiResponse } from '../types';

export const storefrontRoutes = Router();

storefrontRoutes.get('/storefront-summaries', async (request, response) => {
  const payload: StorefrontSummariesApiResponse = await getStorefrontSummaries(
    parseStorefrontSummariesQuery(request.query as Record<string, unknown>)
  );

  response.json(payload);
});

storefrontRoutes.get('/storefront-summaries/by-ids', async (request, response) => {
  const ids = parseStorefrontSummaryIdsQuery(request.query as Record<string, unknown>);
  const items = await getStorefrontSummariesByIds(ids);

  const payload: StorefrontSummariesApiResponse = {
    items,
    total: items.length,
    limit: null,
    offset: 0,
  };

  response.json(payload);
});

storefrontRoutes.get('/storefront-details/:storefrontId', async (request, response) => {
  const storefrontId = parseStorefrontIdParam(request.params.storefrontId);
  const detail = await getStorefrontDetail(storefrontId);
  if (!detail) {
    response.status(404).json({
      error: 'Storefront detail not found.',
    });
    return;
  }

  response.json(detail);
});

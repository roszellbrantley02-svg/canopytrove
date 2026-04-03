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
import { resolveVerifiedRequestAccountId } from '../services/profileAccessService';
import { StorefrontSummariesApiResponse } from '../types';

export const storefrontRoutes = Router();

storefrontRoutes.get('/storefront-summaries', async (request, response) => {
  const accountId = await resolveVerifiedRequestAccountId(request, {
    allowTestHeader: true,
    invalidTokenBehavior: 'ignore',
  });
  const payload: StorefrontSummariesApiResponse = await getStorefrontSummaries(
    parseStorefrontSummariesQuery(request.query as Record<string, unknown>),
    {
      includeMemberDeals: Boolean(accountId),
    }
  );

  response.json(payload);
});

storefrontRoutes.get('/storefront-summaries/by-ids', async (request, response) => {
  const accountId = await resolveVerifiedRequestAccountId(request, {
    allowTestHeader: true,
    invalidTokenBehavior: 'ignore',
  });
  const ids = parseStorefrontSummaryIdsQuery(request.query as Record<string, unknown>);
  const items = await getStorefrontSummariesByIds(ids, {
    includeMemberDeals: Boolean(accountId),
  });

  const payload: StorefrontSummariesApiResponse = {
    items,
    total: items.length,
    limit: null,
    offset: 0,
  };

  response.json(payload);
});

storefrontRoutes.get('/storefront-details/:storefrontId', async (request, response) => {
  const accountId = await resolveVerifiedRequestAccountId(request, {
    allowTestHeader: true,
    invalidTokenBehavior: 'ignore',
  });
  const storefrontId = parseStorefrontIdParam(request.params.storefrontId);
  const detail = await getStorefrontDetail(storefrontId, {
    includeMemberDeals: Boolean(accountId),
  });
  if (!detail) {
    response.status(404).json({
      error: 'Storefront detail not found.',
    });
    return;
  }

  response.json(detail);
});

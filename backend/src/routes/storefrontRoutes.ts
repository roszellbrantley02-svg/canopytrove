import { Response, Router } from 'express';
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

function setCacheHeaders(
  response: Response,
  options: { authenticated: boolean; maxAge: number; swr: number },
) {
  if (options.authenticated) {
    response.setHeader('Cache-Control', `private, max-age=${options.maxAge}`);
  } else {
    response.setHeader(
      'Cache-Control',
      `public, max-age=${options.maxAge}, stale-while-revalidate=${options.swr}`,
    );
  }
}

type ClientPlatform = 'android' | 'ios' | 'web';

function getClientPlatform(request: {
  headers: Record<string, string | string[] | undefined>;
}): ClientPlatform {
  const header = request.headers['x-client-platform'];
  const value = Array.isArray(header) ? header[0] : header;
  if (value === 'android') return 'android';
  if (value === 'ios') return 'ios';
  return 'web';
}

export const storefrontRoutes = Router();

storefrontRoutes.get('/storefront-summaries', async (request, response) => {
  const accountId = await resolveVerifiedRequestAccountId(request, {
    allowTestHeader: true,
    invalidTokenBehavior: 'ignore',
  });
  const viewerContext = accountId ? { profileId: accountId } : null;
  const payload: StorefrontSummariesApiResponse = await getStorefrontSummaries(
    parseStorefrontSummariesQuery(request.query as Record<string, unknown>),
    {
      includeMemberDeals: Boolean(accountId),
      viewerContext,
      clientPlatform: getClientPlatform(request),
    },
  );

  setCacheHeaders(response, { authenticated: Boolean(accountId), maxAge: 60, swr: 120 });
  response.json(payload);
});

storefrontRoutes.get('/storefront-summaries/by-ids', async (request, response) => {
  const accountId = await resolveVerifiedRequestAccountId(request, {
    allowTestHeader: true,
    invalidTokenBehavior: 'ignore',
  });
  const viewerContext = accountId ? { profileId: accountId } : null;
  const ids = parseStorefrontSummaryIdsQuery(request.query as Record<string, unknown>);
  const items = await getStorefrontSummariesByIds(ids, {
    includeMemberDeals: Boolean(accountId),
    viewerContext,
    clientPlatform: getClientPlatform(request),
  });

  const payload: StorefrontSummariesApiResponse = {
    items,
    total: items.length,
    limit: null,
    offset: 0,
  };

  setCacheHeaders(response, { authenticated: Boolean(accountId), maxAge: 60, swr: 120 });
  response.json(payload);
});

storefrontRoutes.get('/storefront-details/:storefrontId', async (request, response) => {
  const accountId = await resolveVerifiedRequestAccountId(request, {
    allowTestHeader: true,
    invalidTokenBehavior: 'ignore',
  });
  const viewerContext = accountId ? { profileId: accountId } : null;
  const storefrontId = parseStorefrontIdParam(request.params.storefrontId);
  const detail = await getStorefrontDetail(storefrontId, {
    includeMemberDeals: Boolean(accountId),
    viewerContext,
    clientPlatform: getClientPlatform(request),
  });
  if (!detail) {
    response.status(404).json({
      error: 'Storefront detail not found.',
    });
    return;
  }

  setCacheHeaders(response, { authenticated: Boolean(accountId), maxAge: 120, swr: 300 });
  response.json(detail);
});

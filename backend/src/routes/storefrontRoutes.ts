import { Response, Router } from 'express';
import {
  getStorefrontDetail,
  getStorefrontSummaries,
  getStorefrontSummariesByIds,
  resolveStorefrontBySlug,
} from '../storefrontService';
import {
  parseStorefrontIdParam,
  parseStorefrontSummariesQuery,
  parseStorefrontSummaryIdsQuery,
} from '../http/validation';
import { resolveVerifiedRequestIdentity } from '../services/profileAccessService';
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

function getViewerProfileId(request: { headers: Record<string, string | string[] | undefined> }) {
  const header = request.headers['x-canopy-profile-id'];
  const value = Array.isArray(header) ? header[0] : header;
  const normalizedValue = typeof value === 'string' ? value.trim() : '';
  if (!normalizedValue || normalizedValue.length > 160) {
    return null;
  }

  return normalizedValue;
}

storefrontRoutes.get('/storefront-summaries', async (request, response) => {
  const identity = await resolveVerifiedRequestIdentity(request, {
    allowTestHeader: process.env.NODE_ENV === 'test' && !process.env.K_SERVICE,
    invalidTokenBehavior: 'ignore',
  });
  const memberAccountId = identity.role === 'member' ? identity.accountId : null;
  const viewerProfileId = getViewerProfileId(request);
  const viewerContext = memberAccountId && viewerProfileId ? { profileId: viewerProfileId } : null;
  const payload: StorefrontSummariesApiResponse = await getStorefrontSummaries(
    parseStorefrontSummariesQuery(request.query as Record<string, unknown>),
    {
      includeMemberDeals: Boolean(memberAccountId),
      viewerContext,
      clientPlatform: getClientPlatform(request),
    },
  );

  setCacheHeaders(response, { authenticated: Boolean(memberAccountId), maxAge: 60, swr: 120 });
  response.json(payload);
});

storefrontRoutes.get('/storefront-summaries/by-ids', async (request, response) => {
  const identity = await resolveVerifiedRequestIdentity(request, {
    allowTestHeader: process.env.NODE_ENV === 'test' && !process.env.K_SERVICE,
    invalidTokenBehavior: 'ignore',
  });
  const memberAccountId = identity.role === 'member' ? identity.accountId : null;
  const viewerProfileId = getViewerProfileId(request);
  const viewerContext = memberAccountId && viewerProfileId ? { profileId: viewerProfileId } : null;
  const ids = parseStorefrontSummaryIdsQuery(request.query as Record<string, unknown>);
  const items = await getStorefrontSummariesByIds(ids, {
    includeMemberDeals: Boolean(memberAccountId),
    viewerContext,
    clientPlatform: getClientPlatform(request),
  });

  const payload: StorefrontSummariesApiResponse = {
    items,
    total: items.length,
    limit: null,
    offset: 0,
  };

  setCacheHeaders(response, { authenticated: Boolean(memberAccountId), maxAge: 60, swr: 120 });
  response.json(payload);
});

storefrontRoutes.get('/storefront-summaries/resolve-slug/:slug', async (request, response) => {
  const slug = String(request.params.slug ?? '').trim();
  if (!slug) {
    response.status(400).json({ error: 'Missing slug parameter.' });
    return;
  }
  const resolvedId = await resolveStorefrontBySlug(slug);
  if (!resolvedId) {
    response.status(404).json({ error: 'No storefront matched this slug.' });
    return;
  }
  setCacheHeaders(response, { authenticated: false, maxAge: 300, swr: 600 });
  response.json({ storefrontId: resolvedId });
});

storefrontRoutes.get('/storefront-details/batch', async (request, response) => {
  const idsParam = request.query.ids;
  const rawIds = typeof idsParam === 'string' ? idsParam : '';
  const ids = rawIds
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
    .slice(0, 12); // cap at 12 to limit fan-out

  if (!ids.length) {
    response.status(400).json({ error: 'Missing or empty ids query parameter.' });
    return;
  }

  const identity = await resolveVerifiedRequestIdentity(request, {
    allowTestHeader: process.env.NODE_ENV === 'test' && !process.env.K_SERVICE,
    invalidTokenBehavior: 'ignore',
  });
  const memberAccountId = identity.role === 'member' ? identity.accountId : null;
  const viewerProfileId = getViewerProfileId(request);
  const viewerContext = memberAccountId && viewerProfileId ? { profileId: viewerProfileId } : null;
  const clientPlatform = getClientPlatform(request);

  const results = await Promise.allSettled(
    ids.map((id) =>
      getStorefrontDetail(id, {
        includeMemberDeals: Boolean(memberAccountId),
        viewerContext,
        clientPlatform,
      }),
    ),
  );

  const items: Record<string, unknown> = {};
  ids.forEach((id, index) => {
    const result = results[index];
    items[id] = result.status === 'fulfilled' ? result.value : null;
  });

  setCacheHeaders(response, { authenticated: Boolean(memberAccountId), maxAge: 120, swr: 300 });
  response.json({ items });
});

storefrontRoutes.get('/storefront-details/:storefrontId', async (request, response) => {
  const identity = await resolveVerifiedRequestIdentity(request, {
    allowTestHeader: process.env.NODE_ENV === 'test' && !process.env.K_SERVICE,
    invalidTokenBehavior: 'ignore',
  });
  const memberAccountId = identity.role === 'member' ? identity.accountId : null;
  const viewerProfileId = getViewerProfileId(request);
  const viewerContext = memberAccountId && viewerProfileId ? { profileId: viewerProfileId } : null;
  const storefrontId = parseStorefrontIdParam(request.params.storefrontId);
  const detail = await getStorefrontDetail(storefrontId, {
    includeMemberDeals: Boolean(memberAccountId),
    viewerContext,
    clientPlatform: getClientPlatform(request),
  });
  if (!detail) {
    response.status(404).json({
      error: 'Storefront detail not found.',
    });
    return;
  }

  setCacheHeaders(response, { authenticated: Boolean(memberAccountId), maxAge: 120, swr: 300 });
  response.json(detail);
});

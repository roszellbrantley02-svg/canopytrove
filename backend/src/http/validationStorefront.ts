import { StorefrontSummarySortKey } from '../types';
import type { OwnerPromotionPlacementSurface } from '../../../src/types/ownerPortal';
import {
  MAX_LEADERBOARD_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LOCATION_QUERY_LENGTH,
  MAX_OFFSET,
  MAX_SEARCH_QUERY_LENGTH,
  parseEnumValue,
  parseId,
  parseOptionalCoordinatesFromQuery,
  parseOptionalIntegerValue,
  parseOptionalNumberValue,
  parseOptionalTrimmedString,
  PlainObject,
} from './validationCore';
import { RequestValidationError } from './errors';

export function parseProfileIdParam(value: unknown) {
  return parseId(value, 'profileId');
}

export function parseStorefrontIdParam(value: unknown) {
  return parseId(value, 'storefrontId');
}

export function parseReviewIdParam(value: unknown) {
  return parseId(value, 'reviewId');
}

export function parseStorefrontSummariesQuery(query: PlainObject) {
  const areaId = parseOptionalTrimmedString(query.areaId, 'areaId', {
    maxLength: 64,
  });
  const searchQuery = parseOptionalTrimmedString(query.searchQuery, 'searchQuery', {
    maxLength: MAX_SEARCH_QUERY_LENGTH,
  });
  const radiusMiles = parseOptionalNumberValue(query.radiusMiles, 'radiusMiles', {
    min: 0,
    max: 250,
  });
  const limit = parseOptionalIntegerValue(query.limit, 'limit', {
    min: 1,
    max: MAX_LIST_LIMIT,
  });
  const offset = parseOptionalIntegerValue(query.offset, 'offset', {
    min: 0,
    max: MAX_OFFSET,
  });
  const origin = parseOptionalCoordinatesFromQuery(query);

  let sortKey: StorefrontSummarySortKey | undefined;
  let prioritySurface: OwnerPromotionPlacementSurface | undefined;
  if (query.sortKey !== undefined) {
    sortKey = parseEnumValue(query.sortKey, 'sortKey', [
      'distance',
      'rating',
      'reviews',
    ] as const);
  }

  if (query.prioritySurface !== undefined) {
    prioritySurface = parseEnumValue(query.prioritySurface, 'prioritySurface', [
      'nearby',
      'browse',
      'hot_deals',
    ] as const);
  }

  return {
    areaId,
    searchQuery,
    origin,
    radiusMiles,
    sortKey,
    limit,
    offset,
    prioritySurface,
  };
}

export function parseStorefrontSummaryIdsQuery(query: PlainObject) {
  const rawIds = parseOptionalTrimmedString(query.ids, 'ids', {
    maxLength: 4000,
    emptyAsUndefined: true,
  });

  if (!rawIds) {
    return [];
  }

  const ids = Array.from(
    new Set(
      rawIds
        .split(',')
        .map((id, index) => parseId(id, `ids[${index}]`))
    )
  );

  if (ids.length > 100) {
    throw new RequestValidationError('ids must contain at most 100 storefront ids.');
  }

  return ids;
}

export function parseLeaderboardQuery(query: PlainObject) {
  return {
    limit: parseOptionalIntegerValue(query.limit, 'limit', {
      min: 1,
      max: MAX_LEADERBOARD_LIMIT,
    }),
    offset: parseOptionalIntegerValue(query.offset, 'offset', {
      min: 0,
      max: MAX_OFFSET,
    }),
  };
}

export function parseLocationQuery(query: PlainObject) {
  return parseOptionalTrimmedString(query.query, 'query', {
    maxLength: MAX_LOCATION_QUERY_LENGTH,
    emptyAsUndefined: false,
  }) ?? '';
}

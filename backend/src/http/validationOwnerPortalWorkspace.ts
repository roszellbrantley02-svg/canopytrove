import {
  asObject,
  MAX_ID_LENGTH,
  parseEnumValue,
  parseId,
  parseIsoDateString,
  parseNullableTrimmedString,
  parseOptionalStringArray,
  parseOptionalTrimmedString,
  parseTrimmedString,
} from './validationCore';
import { RequestValidationError } from './errors';
import {
  OwnerPromotionPlacementScope,
  OwnerPromotionPlacementSurface,
  OwnerPortalProfileToolsInput,
  OwnerPortalPromotionInput,
} from '../../../src/types/ownerPortal';

const OWNER_PROMOTION_AUDIENCES = ['all_followers', 'frequent_visitors', 'new_customers'] as const;
const OWNER_PROMOTION_CARD_TONES = ['standard', 'owner_featured', 'hot_deal'] as const;
const OWNER_PROMOTION_PLACEMENT_SURFACES = ['nearby', 'browse', 'hot_deals'] as const;
const OWNER_PROMOTION_PLACEMENT_SCOPES = ['storefront_area', 'statewide'] as const;

function parseHttpUrl(value: string, field: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error();
    }

    return value;
  } catch {
    throw new RequestValidationError(`${field} must be a valid http or https URL.`);
  }
}

function parseOptionalHttpUrl(value: unknown, field: string) {
  const normalizedValue = parseNullableTrimmedString(value, field, {
    maxLength: 240,
  });

  if (!normalizedValue) {
    return normalizedValue;
  }

  return parseHttpUrl(normalizedValue, field);
}

function parseOptionalHttpUrlArray(value: unknown, field: string) {
  const urls = parseOptionalStringArray(value, field, {
    maxItems: 8,
    maxItemLength: 240,
  });

  if (!urls) {
    return urls;
  }

  return urls.map((url, index) => parseHttpUrl(url, `${field}[${index}]`));
}

export function parseOwnerPortalProfileToolsBody(body: unknown): OwnerPortalProfileToolsInput {
  const payload = asObject(body, 'body');

  return {
    menuUrl: parseOptionalHttpUrl(payload.menuUrl, 'body.menuUrl'),
    featuredPhotoUrls: parseOptionalHttpUrlArray(payload.featuredPhotoUrls, 'body.featuredPhotoUrls'),
    cardPhotoUrl: parseOptionalHttpUrl(payload.cardPhotoUrl, 'body.cardPhotoUrl'),
    verifiedBadgeLabel: parseNullableTrimmedString(
      payload.verifiedBadgeLabel,
      'body.verifiedBadgeLabel',
      {
        maxLength: 60,
      }
    ),
    featuredBadges: parseOptionalStringArray(payload.featuredBadges, 'body.featuredBadges', {
      maxItems: 5,
      maxItemLength: 36,
    }),
    cardSummary: parseNullableTrimmedString(payload.cardSummary, 'body.cardSummary', {
      maxLength: 160,
    }),
  };
}

export function parseOwnerPortalPromotionBody(body: unknown): OwnerPortalPromotionInput {
  const payload = asObject(body, 'body');
  const placementSurfaces =
    parseOptionalStringArray(payload.placementSurfaces, 'body.placementSurfaces', {
      maxItems: 3,
      maxItemLength: 24,
    }) ?? [];

  return {
    title: parseTrimmedString(payload.title, 'body.title', {
      maxLength: 80,
    }),
    description: parseTrimmedString(payload.description, 'body.description', {
      maxLength: 180,
    }),
    badges:
      parseOptionalStringArray(payload.badges, 'body.badges', {
        maxItems: 5,
        maxItemLength: 36,
      }) ?? [],
    startsAt: parseIsoDateString(payload.startsAt, 'body.startsAt'),
    endsAt: parseIsoDateString(payload.endsAt, 'body.endsAt'),
    audience: parseEnumValue(
      payload.audience,
      'body.audience',
      OWNER_PROMOTION_AUDIENCES
    ),
    alertFollowersOnStart: payload.alertFollowersOnStart === true,
    cardTone: parseEnumValue(payload.cardTone, 'body.cardTone', OWNER_PROMOTION_CARD_TONES),
    placementSurfaces: placementSurfaces.map((value, index) =>
      parseEnumValue(
        value,
        `body.placementSurfaces[${index}]`,
        OWNER_PROMOTION_PLACEMENT_SURFACES
      )
    ) as OwnerPromotionPlacementSurface[],
    placementScope:
      payload.placementScope === undefined
        ? 'storefront_area'
        : (parseEnumValue(
            payload.placementScope,
            'body.placementScope',
            OWNER_PROMOTION_PLACEMENT_SCOPES
          ) as OwnerPromotionPlacementScope),
  };
}

export function parseOwnerPortalPromotionIdParam(value: unknown) {
  return parseId(value, 'promotionId');
}

export function parseOwnerPortalReviewReplyBody(body: unknown) {
  const payload = asObject(body, 'body');
  return {
    text: parseTrimmedString(payload.text, 'body.text', {
      maxLength: 1000,
    }),
  };
}

export function parseOwnerPortalAlertSyncBody(body: unknown) {
  const payload = asObject(body, 'body');
  return {
    devicePushToken: parseOptionalTrimmedString(payload.devicePushToken, 'body.devicePushToken', {
      maxLength: MAX_ID_LENGTH * 4,
    }),
  };
}

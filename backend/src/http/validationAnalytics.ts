import { AnalyticsEventBatchRequest } from '../../../src/types/analytics';
import {
  MAX_ANALYTICS_EVENTS,
  MAX_ANALYTICS_METADATA_KEYS,
  MAX_ANALYTICS_STRING_LENGTH,
  MAX_ID_LENGTH,
  asObject,
  assertSingleValue,
  parseEnumValue,
  parseIsoDateString,
  parseNullableTrimmedString,
  parseOptionalTrimmedString,
  parseTrimmedString,
} from './validationCore';
import { RequestValidationError } from './errors';

function parseAnalyticsScalarValue(value: unknown, field: string) {
  const normalizedValue = assertSingleValue(value, field);
  if (
    normalizedValue === null ||
    typeof normalizedValue === 'boolean' ||
    (typeof normalizedValue === 'number' && Number.isFinite(normalizedValue))
  ) {
    return normalizedValue;
  }

  if (typeof normalizedValue === 'string') {
    return parseTrimmedString(normalizedValue, field, {
      maxLength: MAX_ANALYTICS_STRING_LENGTH,
      allowEmpty: true,
    });
  }

  throw new RequestValidationError(
    `${field} must be a string, number, boolean, or null.`
  );
}

function parseAnalyticsMetadata(value: unknown, field: string) {
  if (value === undefined) {
    return undefined;
  }

  const metadata = asObject(value, field);
  const entries = Object.entries(metadata);
  if (entries.length > MAX_ANALYTICS_METADATA_KEYS) {
    throw new RequestValidationError(
      `${field} must contain at most ${MAX_ANALYTICS_METADATA_KEYS} keys.`
    );
  }

  return Object.fromEntries(
    entries.map(([key, entryValue]) => [
      parseTrimmedString(key, `${field}.key`, {
        maxLength: 64,
      }),
      parseAnalyticsScalarValue(entryValue, `${field}.${key}`),
    ])
  );
}

function parseAnalyticsEventType(value: unknown, field: string) {
  return parseEnumValue(value, field, [
    'app_open',
    'session_start',
    'session_end',
    'screen_view',
    'signup_started',
    'signup_completed',
    'signin',
    'password_reset_requested',
    'location_prompt_shown',
    'location_granted',
    'location_denied',
    'location_changed',
    'search_submitted',
    'search_cleared',
    'browse_sort_changed',
    'hot_deals_toggled',
    'storefront_impression',
    'storefront_opened',
    'go_now_tapped',
    'website_tapped',
    'phone_tapped',
    'menu_tapped',
    'deal_impression',
    'deal_opened',
    'deal_saved',
    'deal_redeem_started',
    'deal_redeemed',
    'review_prompt_shown',
    'review_prompt_dismissed',
    'review_started',
    'review_submitted',
  ] as const);
}

function parseAnalyticsEvent(value: unknown, field: string) {
  const body = asObject(value, field);

  return {
    eventType: parseAnalyticsEventType(body.eventType, `${field}.eventType`),
    installId: parseTrimmedString(body.installId, `${field}.installId`, {
      maxLength: MAX_ID_LENGTH,
    }),
    sessionId: parseTrimmedString(body.sessionId, `${field}.sessionId`, {
      maxLength: MAX_ID_LENGTH,
    }),
    occurredAt: parseIsoDateString(body.occurredAt, `${field}.occurredAt`),
    profileId: parseNullableTrimmedString(body.profileId, `${field}.profileId`, {
      maxLength: MAX_ID_LENGTH,
    }),
    accountId: parseNullableTrimmedString(body.accountId, `${field}.accountId`, {
      maxLength: MAX_ID_LENGTH,
    }),
    profileKind:
      body.profileKind === undefined || body.profileKind === null
        ? null
        : parseEnumValue(body.profileKind, `${field}.profileKind`, [
            'anonymous',
            'authenticated',
          ] as const),
    screen: parseOptionalTrimmedString(body.screen, `${field}.screen`, {
      maxLength: 120,
    }),
    storefrontId: parseOptionalTrimmedString(body.storefrontId, `${field}.storefrontId`, {
      maxLength: MAX_ID_LENGTH,
    }),
    dealId: parseOptionalTrimmedString(body.dealId, `${field}.dealId`, {
      maxLength: MAX_ID_LENGTH,
    }),
    metadata: parseAnalyticsMetadata(body.metadata, `${field}.metadata`),
  };
}

export function parseAnalyticsEventBatchBody(value: unknown): AnalyticsEventBatchRequest {
  const body = asObject(value, 'body');
  if (!Array.isArray(body.events) || body.events.length === 0) {
    throw new RequestValidationError('body.events must be a non-empty array.');
  }

  if (body.events.length > MAX_ANALYTICS_EVENTS) {
    throw new RequestValidationError(
      `body.events must contain at most ${MAX_ANALYTICS_EVENTS} items.`
    );
  }

  return {
    platform: parseTrimmedString(body.platform, 'body.platform', {
      maxLength: 40,
    }),
    appVersion: parseOptionalTrimmedString(body.appVersion, 'body.appVersion', {
      maxLength: 40,
    }),
    events: body.events.map((event, index) =>
      parseAnalyticsEvent(event, `body.events[${index}]`)
    ),
  };
}

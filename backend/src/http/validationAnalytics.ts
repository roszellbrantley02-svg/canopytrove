import { ANALYTICS_EVENT_TYPES, AnalyticsEventBatchRequest } from '../../../src/types/analytics';
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

const MAX_ANALYTICS_EVENT_AGE_MS = 30 * 24 * 60 * 60_000;
const MAX_ANALYTICS_EVENT_FUTURE_SKEW_MS = 10 * 60_000;

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

  throw new RequestValidationError(`${field} must be a string, number, boolean, or null.`);
}

function parseAnalyticsMetadata(value: unknown, field: string) {
  if (value === undefined) {
    return undefined;
  }

  const metadata = asObject(value, field);
  const entries = Object.entries(metadata);
  if (entries.length > MAX_ANALYTICS_METADATA_KEYS) {
    throw new RequestValidationError(
      `${field} must contain at most ${MAX_ANALYTICS_METADATA_KEYS} keys.`,
    );
  }

  return Object.fromEntries(
    entries.map(([key, entryValue]) => [
      parseTrimmedString(key, `${field}.key`, {
        maxLength: 64,
      }),
      parseAnalyticsScalarValue(entryValue, `${field}.${key}`),
    ]),
  );
}

function parseAnalyticsEventType(value: unknown, field: string) {
  return parseEnumValue(value, field, ANALYTICS_EVENT_TYPES);
}

function parseAnalyticsOccurredAt(value: unknown, field: string) {
  const occurredAt = parseIsoDateString(value, field);
  const occurredAtMs = Date.parse(occurredAt);

  if (!Number.isFinite(occurredAtMs)) {
    throw new RequestValidationError(`${field} must be a valid ISO-8601 date string.`);
  }

  const now = Date.now();
  if (occurredAtMs < now - MAX_ANALYTICS_EVENT_AGE_MS) {
    throw new RequestValidationError(`${field} must be within the last 30 days.`);
  }

  if (occurredAtMs > now + MAX_ANALYTICS_EVENT_FUTURE_SKEW_MS) {
    throw new RequestValidationError(`${field} cannot be more than 10 minutes in the future.`);
  }

  return occurredAt;
}

function parseAnalyticsEvent(value: unknown, field: string) {
  const body = asObject(value, field);

  return {
    eventId: parseOptionalTrimmedString(body.eventId, `${field}.eventId`, {
      maxLength: MAX_ID_LENGTH,
    }),
    eventType: parseAnalyticsEventType(body.eventType, `${field}.eventType`),
    installId: parseTrimmedString(body.installId, `${field}.installId`, {
      maxLength: MAX_ID_LENGTH,
    }),
    sessionId: parseTrimmedString(body.sessionId, `${field}.sessionId`, {
      maxLength: MAX_ID_LENGTH,
    }),
    occurredAt: parseAnalyticsOccurredAt(body.occurredAt, `${field}.occurredAt`),
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
  const platform = parseTrimmedString(body.platform, 'body.platform', {
    maxLength: 40,
  });
  const appVersion = parseNullableTrimmedString(body.appVersion, 'body.appVersion', {
    maxLength: 40,
  });

  if (!Array.isArray(body.events)) {
    throw new RequestValidationError('body.events must be an array.');
  }
  if (body.events.length === 0) {
    throw new RequestValidationError('body.events must not be empty.');
  }
  if (body.events.length > MAX_ANALYTICS_EVENTS) {
    throw new RequestValidationError(`body.events may not exceed ${MAX_ANALYTICS_EVENTS} events.`);
  }

  const events = body.events.map((event, index) =>
    parseAnalyticsEvent(event, `body.events[${index}]`),
  );

  return { platform, appVersion, events };
}

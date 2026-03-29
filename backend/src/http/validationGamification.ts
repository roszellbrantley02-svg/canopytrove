import { GamificationEventRequest } from '../../../src/types/storefront';
import {
  MAX_REVIEW_TEXT_LENGTH,
  asObject,
  parseEnumValue,
  parseId,
  parseIsoDateString,
  parseNumberValue,
  parseOptionalIntegerValue,
} from './validationCore';

function parseOptionalOccurredAtPayload(
  value: unknown,
  field: string
): { occurredAt?: string } | undefined {
  if (value === undefined) {
    return undefined;
  }

  const body = asObject(value, field);
  return {
    occurredAt:
      body.occurredAt === undefined
        ? undefined
        : parseIsoDateString(body.occurredAt, `${field}.occurredAt`),
  };
}

export function parseGamificationEventBody(value: unknown): GamificationEventRequest {
  const body = asObject(value, 'body');
  const activityType = parseEnumValue(body.activityType, 'body.activityType', [
    'route_started',
    'review_submitted',
    'photo_uploaded',
    'helpful_vote_received',
    'report_submitted',
    'friend_invited',
    'followers_updated',
  ] as const);

  switch (activityType) {
    case 'route_started': {
      const payload = asObject(body.payload, 'body.payload');
      return {
        activityType,
        payload: {
          storefrontId: parseId(payload.storefrontId, 'body.payload.storefrontId'),
          routeMode: parseEnumValue(payload.routeMode, 'body.payload.routeMode', [
            'preview',
            'verified',
          ] as const),
          occurredAt:
            payload.occurredAt === undefined
              ? undefined
              : parseIsoDateString(payload.occurredAt, 'body.payload.occurredAt'),
        },
      };
    }
    case 'review_submitted': {
      const payload = asObject(body.payload, 'body.payload');
      return {
        activityType,
        payload: {
          rating: parseNumberValue(payload.rating, 'body.payload.rating', {
            integer: true,
            min: 1,
            max: 5,
          }),
          textLength: parseNumberValue(payload.textLength, 'body.payload.textLength', {
            integer: true,
            min: 0,
            max: MAX_REVIEW_TEXT_LENGTH,
          }),
          photoCount: parseOptionalIntegerValue(payload.photoCount, 'body.payload.photoCount', {
            min: 0,
            max: 12,
          }),
          occurredAt:
            payload.occurredAt === undefined
              ? undefined
              : parseIsoDateString(payload.occurredAt, 'body.payload.occurredAt'),
        },
      };
    }
    case 'photo_uploaded':
    case 'report_submitted':
      return {
        activityType,
        payload: parseOptionalOccurredAtPayload(body.payload, 'body.payload'),
      };
    case 'helpful_vote_received':
    case 'friend_invited': {
      const payload = body.payload === undefined ? undefined : asObject(body.payload, 'body.payload');
      return {
        activityType,
        payload: payload
          ? {
              count: parseOptionalIntegerValue(payload.count, 'body.payload.count', {
                min: 1,
                max: 1000,
              }),
              occurredAt:
                payload.occurredAt === undefined
                  ? undefined
                  : parseIsoDateString(payload.occurredAt, 'body.payload.occurredAt'),
            }
          : undefined,
      };
    }
    case 'followers_updated': {
      const payload = asObject(body.payload, 'body.payload');
      return {
        activityType,
        payload: {
          count: parseNumberValue(payload.count, 'body.payload.count', {
            integer: true,
            min: 0,
            max: 1_000_000,
          }),
          occurredAt:
            payload.occurredAt === undefined
              ? undefined
              : parseIsoDateString(payload.occurredAt, 'body.payload.occurredAt'),
        },
      };
    }
  }
}

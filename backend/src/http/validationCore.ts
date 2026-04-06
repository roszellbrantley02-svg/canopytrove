import { Coordinates } from '../types';
import { RequestValidationError } from './errors';

export type PlainObject = Record<string, unknown>;

/**
 * Check for dangerous keys that could enable prototype pollution attacks.
 * Throws if a dangerous key is detected.
 */
export function validatePrototypePollutionSafety(obj: PlainObject, context: string) {
  const dangerousKeys = ['__proto__', 'constructor', 'prototype'];
  for (const key of Object.keys(obj)) {
    if (dangerousKeys.includes(key)) {
      throw new RequestValidationError(
        `${context} contains illegal key: ${key}. Prototype pollution protection.`,
      );
    }
  }
}

export const MAX_ID_LENGTH = 128;
export const MAX_DISPLAY_NAME_LENGTH = 60;
export const MAX_SEARCH_QUERY_LENGTH = 120;
export const MAX_LOCATION_QUERY_LENGTH = 120;
export const MAX_REVIEW_TEXT_LENGTH = 2000;
export const MAX_REPORT_TEXT_LENGTH = 1200;
export const MAX_REASON_LENGTH = 120;
export const MAX_TAG_LENGTH = 30;
export const MAX_TAG_COUNT = 6;
export const MAX_LIST_LIMIT = 24;
export const MAX_LEADERBOARD_LIMIT = 100;
export const MAX_OFFSET = 5000;
export const MAX_STACK_LENGTH = 12_000;
export const MAX_ANALYTICS_EVENTS = 50;
export const MAX_ANALYTICS_METADATA_KEYS = 20;
export const MAX_ANALYTICS_STRING_LENGTH = 240;

function isPlainObject(value: unknown): value is PlainObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function asObject(value: unknown, field: string) {
  if (!isPlainObject(value)) {
    throw new RequestValidationError(`${field} must be an object.`);
  }

  return value;
}

export function assertSingleValue(value: unknown, field: string) {
  if (Array.isArray(value)) {
    throw new RequestValidationError(`${field} must not be provided multiple times.`);
  }

  return value;
}

export function parseTrimmedString(
  value: unknown,
  field: string,
  options?: {
    maxLength?: number;
    allowEmpty?: boolean;
  },
) {
  const normalizedValue = assertSingleValue(value, field);
  if (typeof normalizedValue !== 'string') {
    throw new RequestValidationError(`${field} must be a string.`);
  }

  const trimmed = normalizedValue.trim();
  if (!trimmed && !options?.allowEmpty) {
    throw new RequestValidationError(`${field} is required.`);
  }

  if (options?.maxLength && trimmed.length > options.maxLength) {
    throw new RequestValidationError(`${field} must be at most ${options.maxLength} characters.`);
  }

  return trimmed;
}

export function parseOptionalTrimmedString(
  value: unknown,
  field: string,
  options?: {
    maxLength?: number;
    emptyAsUndefined?: boolean;
  },
) {
  const normalizedValue = assertSingleValue(value, field);
  if (normalizedValue === undefined) {
    return undefined;
  }

  if (normalizedValue === null) {
    return undefined;
  }

  const trimmed = parseTrimmedString(normalizedValue, field, {
    maxLength: options?.maxLength,
    allowEmpty: true,
  });

  if (!trimmed && options?.emptyAsUndefined !== false) {
    return undefined;
  }

  return trimmed;
}

export function parseNullableTrimmedString(
  value: unknown,
  field: string,
  options?: {
    maxLength?: number;
  },
) {
  const normalizedValue = assertSingleValue(value, field);
  if (normalizedValue === undefined) {
    return undefined;
  }

  if (normalizedValue === null) {
    return null;
  }

  const trimmed = parseTrimmedString(normalizedValue, field, {
    maxLength: options?.maxLength,
    allowEmpty: true,
  });

  return trimmed || null;
}

export function parseNumberValue(
  value: unknown,
  field: string,
  options?: {
    integer?: boolean;
    min?: number;
    max?: number;
  },
) {
  const normalizedValue = assertSingleValue(value, field);
  if (typeof normalizedValue !== 'number' || !Number.isFinite(normalizedValue)) {
    throw new RequestValidationError(`${field} must be a valid number.`);
  }

  if (options?.integer && !Number.isInteger(normalizedValue)) {
    throw new RequestValidationError(`${field} must be an integer.`);
  }

  if (typeof options?.min === 'number' && normalizedValue < options.min) {
    throw new RequestValidationError(`${field} must be at least ${options.min}.`);
  }

  if (typeof options?.max === 'number' && normalizedValue > options.max) {
    throw new RequestValidationError(`${field} must be at most ${options.max}.`);
  }

  return normalizedValue;
}

export function parseOptionalNumberValue(
  value: unknown,
  field: string,
  options?: {
    integer?: boolean;
    min?: number;
    max?: number;
  },
) {
  const normalizedValue = assertSingleValue(value, field);
  if (normalizedValue === undefined) {
    return undefined;
  }

  if (typeof normalizedValue === 'string' && !normalizedValue.trim()) {
    return undefined;
  }

  const candidate = typeof normalizedValue === 'string' ? Number(normalizedValue) : normalizedValue;
  return parseNumberValue(candidate, field, options);
}

export function parseOptionalIntegerValue(
  value: unknown,
  field: string,
  options?: {
    min?: number;
    max?: number;
  },
) {
  return parseOptionalNumberValue(value, field, {
    ...options,
    integer: true,
  });
}

export function parseIsoDateString(value: unknown, field: string) {
  const dateValue = parseTrimmedString(value, field, { maxLength: 64 });
  if (Number.isNaN(Date.parse(dateValue))) {
    throw new RequestValidationError(`${field} must be a valid ISO date string.`);
  }

  return dateValue;
}

export function parseOptionalIsoDateString(value: unknown, field: string) {
  const normalizedValue = assertSingleValue(value, field);
  if (normalizedValue === undefined) {
    return undefined;
  }

  return parseIsoDateString(normalizedValue, field);
}

export function parseNullableIsoDateString(value: unknown, field: string) {
  const normalizedValue = assertSingleValue(value, field);
  if (normalizedValue === undefined) {
    return undefined;
  }

  if (normalizedValue === null) {
    return null;
  }

  return parseIsoDateString(normalizedValue, field);
}

export function parseEnumValue<T extends string>(
  value: unknown,
  field: string,
  allowedValues: readonly T[],
) {
  const normalizedValue = parseTrimmedString(value, field);
  if (!allowedValues.includes(normalizedValue as T)) {
    throw new RequestValidationError(`${field} must be one of: ${allowedValues.join(', ')}.`);
  }

  return normalizedValue as T;
}

export function parseOptionalStringArray(
  value: unknown,
  field: string,
  options: {
    maxItems: number;
    maxItemLength?: number;
  },
) {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new RequestValidationError(`${field} must be an array.`);
  }

  const items = Array.from(
    new Set(
      value.map((item, index) =>
        parseTrimmedString(item, `${field}[${index}]`, {
          maxLength: options.maxItemLength ?? MAX_ID_LENGTH,
        }),
      ),
    ),
  );

  if (items.length > options.maxItems) {
    throw new RequestValidationError(`${field} must contain at most ${options.maxItems} items.`);
  }

  return items;
}

export function parseId(value: unknown, field: string) {
  return parseTrimmedString(value, field, {
    maxLength: MAX_ID_LENGTH,
  });
}

export function parseOptionalIdArray(value: unknown, field: string, maxItems: number) {
  return parseOptionalStringArray(value, field, {
    maxItems,
    maxItemLength: MAX_ID_LENGTH,
  });
}

export function parseRouteMode(value: unknown, field: string) {
  return parseEnumValue(value, field, ['preview', 'verified'] as const);
}

export function parseOptionalCoordinatesFromQuery(query: PlainObject) {
  let origin: Coordinates | undefined;
  const originLat = query.originLat;
  const originLng = query.originLng;
  if (originLat !== undefined || originLng !== undefined) {
    const latitude = parseNumberValue(
      typeof originLat === 'string' ? Number(originLat) : originLat,
      'originLat',
      { min: -90, max: 90 },
    );
    const longitude = parseNumberValue(
      typeof originLng === 'string' ? Number(originLng) : originLng,
      'originLng',
      { min: -180, max: 180 },
    );

    origin = {
      latitude,
      longitude,
    };
  }

  return origin;
}

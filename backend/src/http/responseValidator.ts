import { RequestHandler } from 'express';

/**
 * Fields that should NEVER appear in API responses to clients.
 * These could leak internal implementation details or secrets.
 */
const FORBIDDEN_RESPONSE_FIELDS = new Set([
  'password',
  'passwordHash',
  'secret',
  'apiKey',
  'token',
  'refreshToken',
  'internalId',
  '_firestore',
  '_ref',
]);

/**
 * Recursively strip forbidden fields from a JSON-serializable object.
 * Returns a new object (does not mutate the original).
 */
function stripForbiddenFields(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(stripForbiddenFields);
  }

  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (FORBIDDEN_RESPONSE_FIELDS.has(key)) continue;
    cleaned[key] = typeof value === 'object' ? stripForbiddenFields(value) : value;
  }
  return cleaned;
}

/**
 * Middleware that intercepts res.json() to strip forbidden fields
 * from outgoing JSON responses. Prevents accidental data leakage.
 */
export const responseValidatorMiddleware: RequestHandler = (_request, response, next) => {
  const originalJson = response.json.bind(response);

  response.json = function (body: unknown) {
    if (body && typeof body === 'object') {
      return originalJson(stripForbiddenFields(body));
    }
    return originalJson(body);
  } as typeof response.json;

  next();
};

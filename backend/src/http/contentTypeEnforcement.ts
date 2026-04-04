import { RequestHandler } from 'express';

/**
 * Rejects non-JSON Content-Type on write methods (POST, PUT, PATCH).
 * Webhook routes that use express.raw() must be mounted BEFORE this middleware.
 */
export const contentTypeEnforcementMiddleware: RequestHandler = (request, response, next) => {
  const method = request.method.toUpperCase();
  if (method !== 'POST' && method !== 'PUT' && method !== 'PATCH') {
    return next();
  }

  const contentType = request.headers['content-type'];
  if (!contentType) {
    // Allow empty-body requests (some POST endpoints may not need a body)
    if (
      !request.body ||
      (typeof request.body === 'object' && Object.keys(request.body).length === 0)
    ) {
      return next();
    }
    response.status(415).json({ error: 'Content-Type header is required for request body.' });
    return;
  }

  if (!contentType.includes('application/json')) {
    response.status(415).json({ error: 'Content-Type must be application/json.' });
    return;
  }

  next();
};

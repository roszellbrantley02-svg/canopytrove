import { createHash } from 'node:crypto';
import { RequestHandler } from 'express';

/**
 * Generates weak ETags for GET responses and returns 304 Not Modified
 * when the client's If-None-Match header matches.
 *
 * Only applies to GET requests with 200 status and JSON content type.
 */
export const etagMiddleware: RequestHandler = (request, response, next) => {
  if (request.method !== 'GET') {
    return next();
  }

  const originalJson = response.json.bind(response);

  response.json = function (body: unknown) {
    const serialized = typeof body === 'string' ? body : JSON.stringify(body);
    const hash = createHash('md5').update(serialized).digest('hex');
    const etag = `W/"${hash}"`;

    response.setHeader('ETag', etag);

    const ifNoneMatch = request.headers['if-none-match'];
    if (ifNoneMatch === etag) {
      response.status(304).end();
      return response;
    }

    return originalJson(body);
  } as typeof response.json;

  next();
};

import { RequestHandler } from 'express';
import { serverConfig } from '../config';
import { backendStorefrontSourceStatus } from '../sources';

function createRequestId() {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function getClientIpHeaderValue(ip: string | undefined) {
  return ip || 'unknown';
}

export const requestTelemetryMiddleware: RequestHandler = (request, response, next) => {
  const startedAt = process.hrtime.bigint();
  const requestId = createRequestId();
  const originalEnd = response.end.bind(response);

  response.setHeader('X-CanopyTrove-Request-Id', requestId);

  response.end = ((...args: Parameters<typeof response.end>) => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    response.setHeader('X-CanopyTrove-Response-Time-Ms', durationMs.toFixed(1));
    return originalEnd(...args);
  }) as typeof response.end;

  response.once('finish', () => {
    if (!serverConfig.requestLoggingEnabled) {
      return;
    }

    const responseTimeMs = response.getHeader('X-CanopyTrove-Response-Time-Ms');
    console.log(
      JSON.stringify({
        type: 'http_request',
        requestId,
        method: request.method,
        path: request.originalUrl,
        statusCode: response.statusCode,
        responseTimeMs:
          typeof responseTimeMs === 'string' ? Number(responseTimeMs) : responseTimeMs ?? null,
        ip: getClientIpHeaderValue(request.ip),
        sourceMode: backendStorefrontSourceStatus.activeMode,
      })
    );
  });

  next();
};

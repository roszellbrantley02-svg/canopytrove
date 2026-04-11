import { ErrorRequestHandler } from 'express';
import { logger } from '../observability/logger';
import { getProfileAccessErrorStatus } from '../services/profileAccessService';
import { recordRuntimeIncident } from '../services/runtimeOpsService';

type ValidationErrorDetails = Record<string, unknown> | undefined;

export class RequestValidationError extends Error {
  readonly statusCode = 400;
  readonly details: ValidationErrorDetails;

  constructor(message: string, details?: ValidationErrorDetails) {
    super(message);
    this.name = 'RequestValidationError';
    this.details = details;
  }
}

function isJsonSyntaxError(error: unknown) {
  return (
    error instanceof SyntaxError &&
    typeof error.message === 'string' &&
    error.message.toLowerCase().includes('json')
  );
}

/**
 * Sanitize error messages for client-facing responses.
 * For 4xx errors, returns the original message (expected to be user-safe).
 * For 5xx errors, returns a generic message and logs the actual error server-side.
 */
export function getSafeErrorMessage(
  error: unknown,
  statusCode: number,
  requestId?: string | null,
): string {
  if (statusCode < 500) {
    // For 4xx errors (and other non-5xx), the error message should already be user-safe
    return error instanceof Error ? error.message : 'Request error';
  }

  // For 5xx errors, log the actual error and return a generic message
  if (error instanceof Error) {
    logger.error('Unhandled server error', {
      message: error.message,
      stack: error.stack,
      statusCode,
      requestId,
    });
  }

  return 'Internal server error';
}

function getErrorStatus(error: unknown) {
  if (error instanceof RequestValidationError) {
    return error.statusCode;
  }

  const profileStatus = getProfileAccessErrorStatus(error);
  if (profileStatus !== 500) {
    return profileStatus;
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'statusCode' in error &&
    typeof (error as { statusCode?: unknown }).statusCode === 'number'
  ) {
    return (error as { statusCode: number }).statusCode;
  }

  return 500;
}

export const backendErrorHandler: ErrorRequestHandler = (error, request, response, _next) => {
  if (response.headersSent) {
    return;
  }

  const requestId = response.getHeader('X-CanopyTrove-Request-Id');
  const requestIdValue = typeof requestId === 'string' ? requestId : null;

  if (isJsonSyntaxError(error)) {
    response.status(400).json({
      error: 'Invalid JSON body.',
      ...(requestIdValue ? { requestId: requestIdValue } : {}),
    });
    return;
  }

  const status = getErrorStatus(error);
  const message = getSafeErrorMessage(error, status, requestIdValue);

  if (status >= 500) {
    logger.error('Backend request failed', {
      requestId: requestIdValue,
      method: request.method,
      path: request.originalUrl,
      error: error instanceof Error ? error.message : error,
    });

    void recordRuntimeIncident({
      kind: 'server',
      severity: 'critical',
      source: 'backend-error-handler',
      message: error instanceof Error ? error.message : 'Unknown backend failure',
      path: request.originalUrl,
      requestId: requestIdValue,
      metadata: {
        method: request.method,
        status,
      },
    });
  }

  response.status(status).json({
    error: message,
    ...(requestIdValue ? { requestId: requestIdValue } : {}),
    ...(error instanceof RequestValidationError && error.details ? { details: error.details } : {}),
  });
};

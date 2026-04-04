import { ErrorRequestHandler } from 'express';
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
  const message = status < 500 && error instanceof Error ? error.message : 'Internal server error';

  if (status >= 500) {
    console.error('Backend request failed', {
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

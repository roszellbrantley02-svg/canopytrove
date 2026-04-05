import { Request, Response } from 'express';
import {
  ensureOwnerPortalAccess,
  getOwnerPortalAccessErrorStatus,
} from '../services/ownerPortalAccessService';
import { TierAccessError } from '../services/ownerTierGatingService';

type OwnerPortalRouteHandler = (context: {
  ownerUid: string;
  ownerEmail: string | null;
  request: Request;
  response: Response;
}) => Promise<unknown>;

function getOwnerPortalRouteErrorMessage(error: unknown, fallbackMessage: string) {
  return error instanceof Error ? error.message : fallbackMessage;
}

function getOwnerPortalRouteErrorStatus(error: unknown) {
  if (error instanceof TierAccessError) {
    return error.statusCode;
  }
  return getOwnerPortalAccessErrorStatus(error);
}

function getOwnerPortalRouteErrorPayload(error: unknown, fallbackMessage: string) {
  if (error instanceof TierAccessError) {
    return {
      ok: false as const,
      error: error.message,
      code: 'TIER_ACCESS_DENIED' as const,
      requiredTier: error.requiredTier,
      currentTier: error.currentTier,
    };
  }
  return {
    ok: false as const,
    error: getOwnerPortalRouteErrorMessage(error, fallbackMessage),
  };
}

export function createOwnerPortalJsonRoute(
  fallbackMessage: string,
  handler: OwnerPortalRouteHandler,
) {
  return async (request: Request, response: Response) => {
    try {
      const { ownerUid, ownerEmail } = await ensureOwnerPortalAccess(request);
      response.json(await handler({ ownerUid, ownerEmail, request, response }));
    } catch (error) {
      response
        .status(getOwnerPortalRouteErrorStatus(error))
        .json(getOwnerPortalRouteErrorPayload(error, fallbackMessage));
    }
  };
}

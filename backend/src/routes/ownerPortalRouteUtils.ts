import { Request, Response } from 'express';
import {
  ensureOwnerPortalAccess,
  ensureOwnerPortalClaimSyncAccess,
  getOwnerPortalAccessErrorStatus,
} from '../services/ownerPortalAccessService';
import { TierAccessError } from '../services/ownerTierGatingService';

type OwnerPortalAccessContext = {
  ownerUid: string;
  ownerEmail: string | null;
};

type OwnerPortalRequest = Request & {
  verifiedUid?: string;
  ownerPortalAccess?: OwnerPortalAccessContext;
};

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
  if (
    typeof error === 'object' &&
    error &&
    'statusCode' in error &&
    typeof (error as { statusCode?: unknown }).statusCode === 'number'
  ) {
    return (error as { statusCode: number }).statusCode;
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
  if (
    typeof error === 'object' &&
    error &&
    'code' in error &&
    typeof (error as { code?: unknown }).code === 'string'
  ) {
    return {
      ok: false as const,
      error: getOwnerPortalRouteErrorMessage(error, fallbackMessage),
      code: (error as { code: string }).code,
    };
  }
  return {
    ok: false as const,
    error: getOwnerPortalRouteErrorMessage(error, fallbackMessage),
  };
}

export async function resolveOwnerPortalRequestAccess(request: Request) {
  const ownerRequest = request as OwnerPortalRequest;
  if (ownerRequest.ownerPortalAccess) {
    return ownerRequest.ownerPortalAccess;
  }

  const access = await ensureOwnerPortalAccess(request);
  ownerRequest.ownerPortalAccess = access;
  ownerRequest.verifiedUid = access.ownerUid;
  return access;
}

export function createOwnerPortalJsonRoute(
  fallbackMessage: string,
  handler: OwnerPortalRouteHandler,
) {
  return async (request: Request, response: Response) => {
    try {
      const { ownerUid, ownerEmail } = await resolveOwnerPortalRequestAccess(request);
      response.json(await handler({ ownerUid, ownerEmail, request, response }));
    } catch (error) {
      response
        .status(getOwnerPortalRouteErrorStatus(error))
        .json(getOwnerPortalRouteErrorPayload(error, fallbackMessage));
    }
  };
}

/**
 * Route creator for the sync-claims endpoint only.
 * This uses ensureOwnerPortalClaimSyncAccess instead of the standard access check
 * because sync-claims is the mechanism that GRANTS owner access. Requiring the
 * owner claim to already exist would be a chicken-and-egg problem.
 */
export function createOwnerPortalClaimSyncRoute(
  fallbackMessage: string,
  handler: OwnerPortalRouteHandler,
) {
  return async (request: Request, response: Response) => {
    try {
      const { ownerUid, ownerEmail } = await ensureOwnerPortalClaimSyncAccess(request);
      response.json(await handler({ ownerUid, ownerEmail, request, response }));
    } catch (error) {
      response
        .status(getOwnerPortalRouteErrorStatus(error))
        .json(getOwnerPortalRouteErrorPayload(error, fallbackMessage));
    }
  };
}

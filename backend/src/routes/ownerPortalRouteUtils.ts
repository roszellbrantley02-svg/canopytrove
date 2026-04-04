import { Request, Response } from 'express';
import {
  ensureOwnerPortalAccess,
  getOwnerPortalAccessErrorStatus,
} from '../services/ownerPortalAccessService';

type OwnerPortalRouteHandler = (context: {
  ownerUid: string;
  ownerEmail: string | null;
  request: Request;
  response: Response;
}) => Promise<unknown>;

function getOwnerPortalRouteErrorMessage(error: unknown, fallbackMessage: string) {
  return error instanceof Error ? error.message : fallbackMessage;
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
      response.status(getOwnerPortalAccessErrorStatus(error)).json({
        ok: false,
        error: getOwnerPortalRouteErrorMessage(error, fallbackMessage),
      });
    }
  };
}

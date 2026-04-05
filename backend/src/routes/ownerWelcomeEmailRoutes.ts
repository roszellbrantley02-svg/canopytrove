import { Request, Router } from 'express';
import { getBackendFirebaseAuth, hasBackendFirebaseConfig } from '../firebase';
import { RequestValidationError } from '../http/errors';
import { createRateLimitMiddleware } from '../http/rateLimit';
import { serverConfig } from '../config';
import { getOwnerProfileCollection } from '../services/ownerPortalWorkspaceCollections';
import { sendOwnerWelcomeEmailIfNeeded } from '../services/ownerWelcomeEmailService';

export const ownerWelcomeEmailRoutes = Router();
ownerWelcomeEmailRoutes.use(
  createRateLimitMiddleware({
    name: 'write',
    windowMs: 60_000,
    max: serverConfig.writeRateLimitPerMinute,
    methods: ['POST'],
  }),
);

function getBearerToken(authorizationHeader: string | undefined) {
  const trimmedHeader = authorizationHeader?.trim();
  if (!trimmedHeader) {
    return null;
  }

  const [scheme, token] = trimmedHeader.split(/\s+/, 2);
  if (!token || scheme.toLowerCase() !== 'bearer') {
    return null;
  }

  return token;
}

function getTestAuthenticatedOwner(request: Request) {
  if (process.env.NODE_ENV !== 'test' || process.env.K_SERVICE) {
    return null;
  }

  const ownerUid = request.header('x-canopy-test-account-id')?.trim();
  if (!ownerUid) {
    return null;
  }

  return {
    ownerUid,
    email:
      request.header('x-canopy-test-email')?.trim() ||
      `${ownerUid.replaceAll(/[^a-z0-9_-]/gi, '')}@example.com`,
    displayName: request.header('x-canopy-test-display-name')?.trim() || null,
    companyName: request.header('x-canopy-test-company-name')?.trim() || null,
    claimRole: request.header('x-canopy-test-claim-role')?.trim().toLowerCase() || '',
  };
}

ownerWelcomeEmailRoutes.post('/owner-welcome-email', async (request, response) => {
  try {
    const testOwner = getTestAuthenticatedOwner(request);
    if (testOwner) {
      if (
        !testOwner.companyName &&
        testOwner.claimRole !== 'owner' &&
        testOwner.claimRole !== 'admin'
      ) {
        throw new OwnerWelcomeEmailAccessError(
          'Owner welcome email is only available for owner accounts.',
          403,
        );
      }

      response.json(
        await sendOwnerWelcomeEmailIfNeeded({
          ownerUid: testOwner.ownerUid,
          email: testOwner.email,
          displayName: testOwner.displayName,
          companyName: testOwner.companyName,
        }),
      );
      return;
    }

    const token = getBearerToken(request.header('authorization'));
    if (!token) {
      throw new OwnerWelcomeEmailAccessError('Owner authentication is required.', 401);
    }

    if (!hasBackendFirebaseConfig) {
      throw new OwnerWelcomeEmailAccessError('Owner welcome email auth is not configured.', 503);
    }

    const auth = getBackendFirebaseAuth();
    if (!auth) {
      throw new OwnerWelcomeEmailAccessError('Owner welcome email auth is not configured.', 503);
    }

    let decodedToken;
    try {
      decodedToken = await auth.verifyIdToken(token);
    } catch {
      throw new OwnerWelcomeEmailAccessError('Invalid owner authentication token.', 401);
    }

    const userRecord = await auth.getUser(decodedToken.uid);
    const email = userRecord.email?.trim() || null;
    if (!email) {
      throw new RequestValidationError(
        'The signed-in owner account does not have an email address.',
      );
    }

    const ownerProfileCollection = getOwnerProfileCollection();
    let companyName: string | null = null;
    if (ownerProfileCollection) {
      const snapshot = await ownerProfileCollection.doc(decodedToken.uid).get();
      if (snapshot.exists) {
        const ownerProfile = snapshot.data();
        companyName =
          typeof ownerProfile?.companyName === 'string' && ownerProfile.companyName.trim()
            ? ownerProfile.companyName.trim()
            : null;
      }
    }

    const claimRole =
      typeof decodedToken.claimRole === 'string' ? decodedToken.claimRole.trim().toLowerCase() : '';
    if (!companyName && claimRole !== 'owner' && claimRole !== 'admin') {
      throw new OwnerWelcomeEmailAccessError(
        'Owner welcome email is only available for owner accounts.',
        403,
      );
    }

    response.json(
      await sendOwnerWelcomeEmailIfNeeded({
        ownerUid: decodedToken.uid,
        email,
        displayName: userRecord.displayName?.trim() || null,
        companyName,
      }),
    );
  } catch (error) {
    const statusCode =
      error instanceof OwnerWelcomeEmailAccessError
        ? error.statusCode
        : error instanceof RequestValidationError
          ? 400
          : 500;
    response.status(statusCode).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown owner welcome email failure.',
    });
  }
});

class OwnerWelcomeEmailAccessError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
  }
}

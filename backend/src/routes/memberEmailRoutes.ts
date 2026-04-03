import { Request, Router } from 'express';
import { serverConfig } from '../config';
import { createRateLimitMiddleware } from '../http/rateLimit';
import { RequestValidationError } from '../http/errors';
import { getBackendFirebaseAuth, hasBackendFirebaseConfig } from '../firebase';
import {
  MemberEmailSubscriptionSource,
  getMemberEmailSubscriptionStatus,
  syncMemberEmailSubscription,
} from '../services/memberEmailSubscriptionService';

export const memberEmailRoutes = Router();
memberEmailRoutes.use(
  createRateLimitMiddleware({
    name: 'write',
    windowMs: 60_000,
    max: serverConfig.writeRateLimitPerMinute,
    methods: ['PUT'],
  })
);

function parseMemberEmailSubscriptionBody(value: unknown) {
  if (typeof value !== 'object' || !value || Array.isArray(value)) {
    throw new RequestValidationError('body must be an object.');
  }

  const body = value as Record<string, unknown>;
  if (typeof body.subscribed !== 'boolean') {
    throw new RequestValidationError('body.subscribed must be a boolean.');
  }

  const sourceValue = body.source;
  const source: MemberEmailSubscriptionSource =
    sourceValue === 'profile' ? 'profile' : 'member_signup';

  return {
    subscribed: body.subscribed,
    source,
  };
}

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

function getTestAuthenticatedMember(request: Request) {
  if (process.env.NODE_ENV !== 'test') {
    return null;
  }

  const accountId = request.header('x-canopy-test-account-id')?.trim();
  if (!accountId) {
    return null;
  }

  return {
    accountId,
    email:
      request.header('x-canopy-test-email')?.trim() || `${accountId.replaceAll(/[^a-z0-9_-]/gi, '')}@example.com`,
    displayName: request.header('x-canopy-test-display-name')?.trim() || null,
  };
}

async function getAuthenticatedMember(request: Request) {
  const testMember = getTestAuthenticatedMember(request);
  if (testMember) {
    return testMember;
  }

  const token = getBearerToken(request.header('authorization'));
  if (!token) {
    throw new MemberEmailSubscriptionAccessError('Member authentication is required.', 401);
  }

  if (!hasBackendFirebaseConfig) {
    throw new MemberEmailSubscriptionAccessError(
      'Member email subscription auth is not configured.',
      503
    );
  }

  const auth = getBackendFirebaseAuth();
  if (!auth) {
    throw new MemberEmailSubscriptionAccessError(
      'Member email subscription auth is not configured.',
      503
    );
  }

  let decodedToken;
  try {
    decodedToken = await auth.verifyIdToken(token);
  } catch {
    throw new MemberEmailSubscriptionAccessError('Invalid member authentication token.', 401);
  }

  const userRecord = await auth.getUser(decodedToken.uid);
  const email = userRecord.email?.trim() || null;
  if (!email) {
    throw new RequestValidationError('The signed-in account does not have an email address.');
  }

  return {
    accountId: decodedToken.uid,
    email,
    displayName: userRecord.displayName?.trim() || null,
  };
}

memberEmailRoutes.get('/member-email-subscription', async (request, response) => {
  try {
    const member = await getAuthenticatedMember(request);
    response.json(await getMemberEmailSubscriptionStatus(member));
  } catch (error) {
    const statusCode =
      error instanceof MemberEmailSubscriptionAccessError
        ? error.statusCode
        : error instanceof RequestValidationError
          ? 400
          : 500;
    response.status(statusCode).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown email subscription failure.',
    });
  }
});

memberEmailRoutes.put('/member-email-subscription', async (request, response) => {
  try {
    const member = await getAuthenticatedMember(request);
    const body = parseMemberEmailSubscriptionBody(request.body);
    response.json(
      await syncMemberEmailSubscription({
        ...member,
        subscribed: body.subscribed,
        source: body.source,
      })
    );
  } catch (error) {
    const statusCode =
      error instanceof MemberEmailSubscriptionAccessError
        ? error.statusCode
        : error instanceof RequestValidationError
          ? 400
          : 500;
    response.status(statusCode).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown email subscription failure.',
    });
  }
});
class MemberEmailSubscriptionAccessError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
  }
}

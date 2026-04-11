import {
  ActiveRouteSessionApiDocument,
  AppProfileApiDocument,
  BlockedCommunityAuthorApiDocument,
  StorefrontGamificationStateApiDocument,
  StorefrontCommunitySafetyStateApiDocument,
  StorefrontRouteStateApiDocument,
} from '../types';
import {
  MAX_DISPLAY_NAME_LENGTH,
  asObject,
  parseId,
  parseIsoDateString,
  parseNullableIsoDateString,
  parseNullableTrimmedString,
  parseNumberValue,
  parseOptionalIdArray,
  parseOptionalStringArray,
  parseRouteMode,
} from './validationCore';
import { RequestValidationError } from './errors';

function parseActiveRouteSession(value: unknown, field: string): ActiveRouteSessionApiDocument {
  const body = asObject(value, field);
  return {
    storefrontId: parseId(body.storefrontId, `${field}.storefrontId`),
    routeMode: parseRouteMode(body.routeMode, `${field}.routeMode`),
    startedAt: parseIsoDateString(body.startedAt, `${field}.startedAt`),
  };
}

function parseOptionalActiveRouteSession(
  value: unknown,
  field: string,
): ActiveRouteSessionApiDocument | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  return parseActiveRouteSession(value, field);
}

function parsePartialProfileDocument(
  value: unknown,
  field: string,
  profileId: string,
): Partial<AppProfileApiDocument> {
  const body = asObject(value, field);
  const nextProfile: Partial<AppProfileApiDocument> = {
    id: profileId,
  };

  if ('displayName' in body) {
    nextProfile.displayName = parseNullableTrimmedString(body.displayName, `${field}.displayName`, {
      maxLength: MAX_DISPLAY_NAME_LENGTH,
    });
  }

  if ('createdAt' in body) {
    nextProfile.createdAt = parseIsoDateString(body.createdAt, `${field}.createdAt`);
  }

  return nextProfile;
}

/**
 * Parse gamification state fields. NOTE: This function is retained for
 * internal server-side use (e.g. launch program). Client requests MUST
 * NOT pass gamification state — it is stripped in profileStateRoutes.
 */
function parsePartialGamificationState(
  value: unknown,
  field: string,
  profileId: string,
): Partial<StorefrontGamificationStateApiDocument> {
  const body = asObject(value, field);
  const nextState: Partial<StorefrontGamificationStateApiDocument> = {
    profileId,
  };

  const integerFields = [
    'totalPoints',
    'totalReviews',
    'totalPhotos',
    'totalHelpfulVotes',
    'currentStreak',
    'longestStreak',
    'dispensariesVisited',
    'level',
    'nextLevelPoints',
    'reviewsWithPhotos',
    'detailedReviews',
    'fiveStarReviews',
    'oneStarReviews',
    'commentsWritten',
    'reportsSubmitted',
    'friendsInvited',
    'followersCount',
    'totalRoutesStarted',
  ] as const;

  for (const property of integerFields) {
    if (property in body) {
      nextState[property] = parseNumberValue(body[property], `${field}.${property}`, {
        integer: true,
        min: 0,
      }) as never;
    }
  }

  if ('visitedStorefrontIds' in body) {
    nextState.visitedStorefrontIds = parseOptionalIdArray(
      body.visitedStorefrontIds,
      `${field}.visitedStorefrontIds`,
      256,
    );
  }

  if ('badges' in body) {
    nextState.badges = parseOptionalStringArray(body.badges, `${field}.badges`, {
      maxItems: 128,
      maxItemLength: 64,
    });
  }

  if ('joinedDate' in body) {
    nextState.joinedDate = parseIsoDateString(body.joinedDate, `${field}.joinedDate`);
  }

  if ('lastReviewDate' in body) {
    nextState.lastReviewDate = parseNullableIsoDateString(
      body.lastReviewDate,
      `${field}.lastReviewDate`,
    );
  }

  if ('lastActiveDate' in body) {
    nextState.lastActiveDate = parseNullableIsoDateString(
      body.lastActiveDate,
      `${field}.lastActiveDate`,
    );
  }

  return nextState;
}

function parseBlockedCommunityAuthor(
  value: unknown,
  field: string,
): BlockedCommunityAuthorApiDocument {
  const body = asObject(value, field);
  return {
    storefrontId: parseId(body.storefrontId, `${field}.storefrontId`),
    storefrontName:
      parseNullableTrimmedString(body.storefrontName, `${field}.storefrontName`, {
        maxLength: 120,
      }) ?? null,
    authorId: parseId(body.authorId, `${field}.authorId`),
  };
}

export function parseProfileUpdateBody(value: unknown, profileId: string) {
  return parsePartialProfileDocument(value, 'body', profileId);
}

export function parseRouteStateBody(
  value: unknown,
  profileId: string,
): StorefrontRouteStateApiDocument {
  const body = asObject(value, 'body');

  const activeRouteSession = parseOptionalActiveRouteSession(
    body.activeRouteSession,
    'body.activeRouteSession',
  );

  const routeSessionsValue = body.routeSessions;
  let routeSessions: ActiveRouteSessionApiDocument[] = [];
  if (routeSessionsValue !== undefined) {
    if (!Array.isArray(routeSessionsValue)) {
      throw new RequestValidationError('body.routeSessions must be an array.');
    }

    routeSessions = routeSessionsValue.map((session, index) =>
      parseActiveRouteSession(session, `body.routeSessions[${index}]`),
    );

    if (routeSessions.length > 12) {
      throw new RequestValidationError('body.routeSessions must contain at most 12 items.');
    }
  }

  return {
    profileId,
    savedStorefrontIds:
      parseOptionalIdArray(body.savedStorefrontIds, 'body.savedStorefrontIds', 64) ?? [],
    recentStorefrontIds:
      parseOptionalIdArray(body.recentStorefrontIds, 'body.recentStorefrontIds', 24) ?? [],
    activeRouteSession: activeRouteSession ?? null,
    routeSessions,
    plannedRouteStorefrontIds:
      parseOptionalIdArray(body.plannedRouteStorefrontIds, 'body.plannedRouteStorefrontIds', 12) ??
      [],
  };
}

export function parseProfileStateBody(value: unknown, profileId: string) {
  const body = asObject(value, 'body');

  return {
    profile: body.profile
      ? parsePartialProfileDocument(body.profile, 'body.profile', profileId)
      : undefined,
    routeState: body.routeState ? parseRouteStateBody(body.routeState, profileId) : undefined,
    gamificationState: body.gamificationState
      ? parsePartialGamificationState(body.gamificationState, 'body.gamificationState', profileId)
      : undefined,
  };
}

export function parseCommunitySafetyStateBody(
  value: unknown,
  profileId: string,
): StorefrontCommunitySafetyStateApiDocument {
  const body = asObject(value, 'body');
  const blockedReviewAuthorsValue = body.blockedReviewAuthors;
  let blockedReviewAuthors: BlockedCommunityAuthorApiDocument[] = [];

  if (blockedReviewAuthorsValue !== undefined) {
    if (!Array.isArray(blockedReviewAuthorsValue)) {
      throw new RequestValidationError('body.blockedReviewAuthors must be an array.');
    }

    blockedReviewAuthors = blockedReviewAuthorsValue.map((entry, index) =>
      parseBlockedCommunityAuthor(entry, `body.blockedReviewAuthors[${index}]`),
    );

    if (blockedReviewAuthors.length > 64) {
      throw new RequestValidationError('body.blockedReviewAuthors must contain at most 64 items.');
    }
  }

  return {
    profileId,
    acceptedGuidelinesVersion:
      parseNullableTrimmedString(body.acceptedGuidelinesVersion, 'body.acceptedGuidelinesVersion', {
        maxLength: 32,
      }) ?? null,
    blockedReviewAuthors,
    updatedAt: new Date().toISOString(),
  };
}

import {
  MAX_DISPLAY_NAME_LENGTH,
  MAX_REASON_LENGTH,
  MAX_REPORT_TEXT_LENGTH,
  MAX_REVIEW_TEXT_LENGTH,
  MAX_STACK_LENGTH,
  MAX_TAG_COUNT,
  MAX_TAG_LENGTH,
  asObject,
  parseId,
  parseNumberValue,
  parseOptionalIntegerValue,
  parseOptionalStringArray,
  parseOptionalTrimmedString,
  parseOptionalIsoDateString,
  parseTrimmedString,
} from './validationCore';
import { RequestValidationError } from './errors';

function parseOptionalGifUrl(value: unknown, field: string) {
  const gifUrl = parseOptionalTrimmedString(value, field, {
    maxLength: MAX_REVIEW_TEXT_LENGTH,
  });
  if (!gifUrl) {
    return undefined;
  }

  try {
    const candidate = new URL(gifUrl);
    if (candidate.protocol !== 'http:' && candidate.protocol !== 'https:') {
      throw new RequestValidationError(`${field} must be a valid http or https URL.`);
    }

    return candidate.toString();
  } catch {
    throw new RequestValidationError(`${field} must be a valid http or https URL.`);
  }
}

export function parseReviewSubmissionBody(value: unknown) {
  const body = asObject(value, 'body');

  return {
    profileId: parseId(body.profileId, 'body.profileId'),
    authorName: parseOptionalTrimmedString(body.authorName, 'body.authorName', {
      maxLength: MAX_DISPLAY_NAME_LENGTH,
    }),
    rating: parseNumberValue(body.rating, 'body.rating', {
      integer: true,
      min: 1,
      max: 5,
    }),
    text: parseTrimmedString(body.text, 'body.text', {
      maxLength: MAX_REVIEW_TEXT_LENGTH,
    }),
    gifUrl: parseOptionalGifUrl(body.gifUrl, 'body.gifUrl'),
    tags:
      parseOptionalStringArray(body.tags, 'body.tags', {
        maxItems: MAX_TAG_COUNT,
        maxItemLength: MAX_TAG_LENGTH,
      }) ?? [],
    photoCount:
      parseOptionalIntegerValue(body.photoCount, 'body.photoCount', {
        min: 0,
        max: 12,
      }) ?? 0,
  };
}

export function parseReportSubmissionBody(value: unknown) {
  const body = asObject(value, 'body');

  return {
    profileId: parseId(body.profileId, 'body.profileId'),
    authorName: parseOptionalTrimmedString(body.authorName, 'body.authorName', {
      maxLength: MAX_DISPLAY_NAME_LENGTH,
    }),
    reason: parseTrimmedString(body.reason, 'body.reason', {
      maxLength: MAX_REASON_LENGTH,
    }),
    description: parseTrimmedString(body.description, 'body.description', {
      maxLength: MAX_REPORT_TEXT_LENGTH,
    }),
  };
}

export function parseHelpfulVoteBody(value: unknown) {
  const body = asObject(value, 'body');
  return {
    profileId: parseId(body.profileId, 'body.profileId'),
  };
}

export function parseClientRuntimeErrorBody(value: unknown) {
  const body = asObject(value, 'body');

  return {
    name: parseOptionalTrimmedString(body.name, 'body.name', {
      maxLength: 120,
    }),
    message: parseTrimmedString(body.message, 'body.message', {
      maxLength: MAX_REPORT_TEXT_LENGTH,
    }),
    stack: parseOptionalTrimmedString(body.stack, 'body.stack', {
      maxLength: MAX_STACK_LENGTH,
    }),
    isFatal: typeof body.isFatal === 'boolean' ? body.isFatal : false,
    source: parseOptionalTrimmedString(body.source, 'body.source', {
      maxLength: 120,
    }),
    screen: parseOptionalTrimmedString(body.screen, 'body.screen', {
      maxLength: 120,
    }),
    platform: parseOptionalTrimmedString(body.platform, 'body.platform', {
      maxLength: 40,
    }),
    reportedAt: parseOptionalIsoDateString(body.reportedAt, 'body.reportedAt'),
  };
}

import { asObject, parseOptionalIdArray, parseTrimmedString } from './validationCore';
import { RequestValidationError } from './errors';

export function parseFavoriteDealAlertSyncBody(value: unknown) {
  const body = asObject(value, 'body');

  let allowNotifications = true;
  if ('allowNotifications' in body) {
    if (typeof body.allowNotifications !== 'boolean') {
      throw new RequestValidationError('body.allowNotifications must be a boolean.');
    }

    allowNotifications = body.allowNotifications;
  }

  return {
    savedStorefrontIds: parseOptionalIdArray(
      body.savedStorefrontIds,
      'body.savedStorefrontIds',
      64
    ),
    allowNotifications,
    devicePushToken:
      body.devicePushToken === undefined
        ? undefined
        : parseTrimmedString(body.devicePushToken, 'body.devicePushToken', {
            maxLength: 512,
            allowEmpty: false,
          }),
  };
}

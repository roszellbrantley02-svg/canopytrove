import {
  asObject,
  parseOptionalTrimmedString,
  parseTrimmedString,
} from './validationCore';
import { RequestValidationError } from './errors';

const runtimePolicyTriggerValues = ['automatic', 'manual', 'normal'] as const;

function parseOptionalBoolean(value: unknown, field: string) {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'boolean') {
    throw new RequestValidationError(`${field} must be a boolean.`);
  }

  return value;
}

function parseOptionalTrigger(value: unknown, field: string) {
  const normalizedValue = parseOptionalTrimmedString(value, field, {
    maxLength: 32,
  });
  if (!normalizedValue) {
    return undefined;
  }

  if (!runtimePolicyTriggerValues.includes(normalizedValue as (typeof runtimePolicyTriggerValues)[number])) {
    throw new RequestValidationError(
      `${field} must be one of: ${runtimePolicyTriggerValues.join(', ')}.`
    );
  }

  return normalizedValue as (typeof runtimePolicyTriggerValues)[number];
}

export function parseRuntimePolicyBody(value: unknown) {
  const body = asObject(value, 'body');
  return {
    safeModeEnabled: parseOptionalBoolean(body.safeModeEnabled, 'body.safeModeEnabled'),
    ownerPortalWritesEnabled: parseOptionalBoolean(
      body.ownerPortalWritesEnabled,
      'body.ownerPortalWritesEnabled'
    ),
    promotionWritesEnabled: parseOptionalBoolean(
      body.promotionWritesEnabled,
      'body.promotionWritesEnabled'
    ),
    reviewRepliesEnabled: parseOptionalBoolean(
      body.reviewRepliesEnabled,
      'body.reviewRepliesEnabled'
    ),
    profileToolsWritesEnabled: parseOptionalBoolean(
      body.profileToolsWritesEnabled,
      'body.profileToolsWritesEnabled'
    ),
    reason: parseOptionalTrimmedString(body.reason, 'body.reason', {
      maxLength: 240,
    }),
    trigger: parseOptionalTrigger(body.trigger, 'body.trigger'),
  };
}

export function parseOwnerAiDraftBody(value: unknown) {
  const body = asObject(value, 'body');
  return {
    goal: parseOptionalTrimmedString(body.goal, 'body.goal', {
      maxLength: 300,
    }),
    tone: parseOptionalTrimmedString(body.tone, 'body.tone', {
      maxLength: 80,
    }),
    focus: parseOptionalTrimmedString(body.focus, 'body.focus', {
      maxLength: 120,
    }),
  };
}

export function parseRuntimeAlertSyncBody(value: unknown) {
  const body = asObject(value, 'body');
  return {
    devicePushToken: parseOptionalTrimmedString(body.devicePushToken, 'body.devicePushToken', {
      maxLength: 512,
    }),
  };
}

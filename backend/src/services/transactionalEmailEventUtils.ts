export type TransactionalEmailDeliveryState =
  | 'not_requested'
  | 'pending_provider'
  | 'sent'
  | 'delivered'
  | 'delivery_delayed'
  | 'bounced'
  | 'complained'
  | 'failed'
  | 'suppressed';

function trimValue(value: string | null | undefined) {
  return value?.trim() || null;
}

function truncateValue(value: string | null | undefined, maxLength = 240) {
  const trimmed = trimValue(value);
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

function readMessageFromObject(value: unknown) {
  if (typeof value !== 'object' || !value || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const messageCandidateKeys = ['message', 'reason', 'description', 'code', 'type'] as const;
  const pieces = messageCandidateKeys
    .map((key) => record[key])
    .filter(
      (candidate): candidate is string =>
        typeof candidate === 'string' && Boolean(candidate.trim())
    )
    .map((candidate) => candidate.trim());

  if (pieces.length === 0) {
    return null;
  }

  return truncateValue(Array.from(new Set(pieces)).join(' | '));
}

export function getDeliveryStateForResendEventType(
  eventType: string | null | undefined
): Exclude<TransactionalEmailDeliveryState, 'not_requested' | 'pending_provider' | 'sent'> | null {
  switch (trimValue(eventType)) {
    case 'email.delivered':
      return 'delivered';
    case 'email.delivery_delayed':
      return 'delivery_delayed';
    case 'email.bounced':
      return 'bounced';
    case 'email.complained':
      return 'complained';
    case 'email.failed':
      return 'failed';
    case 'email.suppressed':
      return 'suppressed';
    default:
      return null;
  }
}

export function getResendWebhookEventSummary(data: unknown) {
  if (typeof data !== 'object' || !data || Array.isArray(data)) {
    return null;
  }

  const payload = data as Record<string, unknown>;
  const nestedKeys = ['bounce', 'complaint', 'failed', 'suppressed'] as const;
  for (const nestedKey of nestedKeys) {
    const message = readMessageFromObject(payload[nestedKey]);
    if (message) {
      return message;
    }
  }

  return null;
}

export function normalizeDeliveryEventType(value: string | null | undefined) {
  return trimValue(value);
}

export function normalizeDeliveryEventSummary(value: string | null | undefined) {
  return truncateValue(value);
}

export function normalizeProviderMessageId(value: string | null | undefined) {
  return trimValue(value);
}

export function normalizeProviderEventId(value: string | null | undefined) {
  return trimValue(value);
}

import {
  getTransactionalEmailRuntimeConfig,
  type TransactionalEmailRuntimeConfig,
} from '../config';

type TransactionalEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey?: string | null;
  replyTo?: string | null;
  tags?: Array<{
    name: string;
    value: string;
  }>;
};

type TransactionalEmailResult =
  | {
      ok: true;
      provider: 'resend';
      id: string | null;
    }
  | {
      ok: false;
      provider: 'none' | 'resend';
      code: 'not_configured' | 'request_failed';
      message: string;
    };

function trimConfiguredValue(value: string | null | undefined) {
  return value?.trim() || null;
}

export function getTransactionalEmailDeliveryStatus() {
  return getTransactionalEmailDeliveryStatusForConfig(getTransactionalEmailRuntimeConfig());
}

function getTransactionalEmailDeliveryStatusForConfig(
  emailRuntimeConfig: TransactionalEmailRuntimeConfig
) {
  if (!emailRuntimeConfig.welcomeEmailsEnabled) {
    return {
      enabled: false,
      provider: 'none' as const,
      reason: 'Welcome emails are disabled.',
    };
  }

  if (emailRuntimeConfig.emailDeliveryProvider === 'resend') {
    if (!emailRuntimeConfig.resendApiKey || !emailRuntimeConfig.emailFromAddress) {
      return {
        enabled: false,
        provider: 'resend' as const,
        reason: 'Resend is selected but RESEND_API_KEY or EMAIL_FROM_ADDRESS is missing.',
      };
    }

    return {
      enabled: true,
      provider: 'resend' as const,
      reason: null,
    };
  }

  return {
    enabled: false,
    provider: 'none' as const,
    reason: 'No supported transactional email provider is configured.',
  };
}

export async function sendTransactionalEmail(
  input: TransactionalEmailInput
): Promise<TransactionalEmailResult> {
  const emailRuntimeConfig = getTransactionalEmailRuntimeConfig();
  const deliveryStatus = getTransactionalEmailDeliveryStatusForConfig(emailRuntimeConfig);
  if (!deliveryStatus.enabled || deliveryStatus.provider !== 'resend') {
    return {
      ok: false,
      provider: deliveryStatus.provider,
      code: 'not_configured',
      message: deliveryStatus.reason ?? 'Transactional email delivery is not configured.',
    };
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${emailRuntimeConfig.resendApiKey}`,
    'Content-Type': 'application/json',
  };

  const idempotencyKey = trimConfiguredValue(input.idempotencyKey);
  if (idempotencyKey) {
    headers['Idempotency-Key'] = idempotencyKey;
  }

  let response: Response;
  try {
    response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        from: emailRuntimeConfig.emailFromAddress,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
        reply_to:
          trimConfiguredValue(input.replyTo) ??
          emailRuntimeConfig.emailReplyToAddress ??
          undefined,
        tags: input.tags?.length ? input.tags : undefined,
      }),
    });
  } catch (error) {
    return {
      ok: false,
      provider: 'resend',
      code: 'request_failed',
      message: error instanceof Error ? error.message : 'Resend request failed.',
    };
  }

  if (!response.ok) {
    let message = `Resend request failed with ${response.status}.`;
    try {
      const payload = (await response.json()) as {
        message?: unknown;
        error?: unknown;
      };
      if (typeof payload.message === 'string' && payload.message.trim()) {
        message = payload.message.trim();
      } else if (typeof payload.error === 'string' && payload.error.trim()) {
        message = payload.error.trim();
      }
    } catch {
      // Keep the fallback message.
    }

    return {
      ok: false,
      provider: 'resend',
      code: 'request_failed',
      message,
    };
  }

  const payload = (await response.json()) as {
    id?: unknown;
  };

  return {
    ok: true,
    provider: 'resend',
    id: typeof payload.id === 'string' && payload.id.trim() ? payload.id.trim() : null,
  };
}

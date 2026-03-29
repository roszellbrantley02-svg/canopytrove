import { serverConfig } from '../config';

type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default';
  priority?: 'high';
  channelId?: string;
};

type ExpoPushTicket = {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: {
    error?: string;
  };
};

type ExpoPushResponse = {
  data?: ExpoPushTicket[];
  errors?: Array<{
    code?: string;
    message?: string;
  }>;
};

function isExpoPushToken(token: string | null | undefined) {
  return typeof token === 'string' && /^(Expo|Exponent)PushToken\[[^\]]+\]$/.test(token.trim());
}

export async function sendExpoPushMessages(messages: ExpoPushMessage[]) {
  const deliverableMessages = messages.filter((message) => isExpoPushToken(message.to));
  if (!deliverableMessages.length) {
    return [];
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  if (serverConfig.expoAccessToken) {
    headers.Authorization = `Bearer ${serverConfig.expoAccessToken}`;
  }

  const response = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers,
    body: JSON.stringify(deliverableMessages),
  });

  if (!response.ok) {
    throw new Error(`Expo push request failed with ${response.status}`);
  }

  const payload = (await response.json()) as ExpoPushResponse;
  return payload.data ?? [];
}

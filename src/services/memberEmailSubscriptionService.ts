import { requestJson } from './storefrontBackendHttp';

export type MemberEmailSubscriptionStatus = {
  accountId: string;
  email: string | null;
  displayName: string | null;
  subscribed: boolean;
  source: 'member_signup' | 'profile';
  updatedAt: string | null;
  consentedAt: string | null;
  unsubscribedAt: string | null;
  welcomeEmailSentAt: string | null;
  welcomeEmailState: 'not_requested' | 'pending_provider' | 'sent' | 'failed';
  welcomeEmailError: string | null;
};

function requestMemberEmailSubscriptionJson<T>(
  pathname: string,
  init?: Omit<RequestInit, 'body'> & { body?: unknown },
) {
  const body =
    init && Object.prototype.hasOwnProperty.call(init, 'body')
      ? JSON.stringify(init.body)
      : undefined;
  const headers = new Headers(init?.headers);
  if (body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }

  return requestJson<T>(pathname, {
    ...init,
    headers: body === undefined ? init?.headers : headers,
    body,
  });
}

export function getMemberEmailSubscription() {
  return requestMemberEmailSubscriptionJson<MemberEmailSubscriptionStatus>(
    '/member-email-subscription',
    {
      method: 'GET',
    },
  );
}

export function syncMemberEmailSubscription(input: {
  subscribed: boolean;
  source: 'member_signup' | 'profile';
}) {
  return requestMemberEmailSubscriptionJson<MemberEmailSubscriptionStatus>(
    '/member-email-subscription',
    {
      method: 'PUT',
      body: input,
    },
  );
}

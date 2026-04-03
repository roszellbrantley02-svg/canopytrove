import { requestJson } from './storefrontBackendHttp';

type OwnerWelcomeEmailStatus = {
  ownerUid: string;
  email: string | null;
  displayName: string | null;
  companyName: string | null;
  welcomeEmailSentAt: string | null;
  welcomeEmailState: 'pending_provider' | 'sent' | 'failed';
  welcomeEmailError: string | null;
};

export function sendOwnerWelcomeEmailIfNeeded() {
  return requestJson<OwnerWelcomeEmailStatus>('/owner-welcome-email', {
    method: 'POST',
  });
}

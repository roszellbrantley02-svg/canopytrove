import React from 'react';
import { reportRuntimeError } from '../services/runtimeReportingService';
import type { MemberEmailSubscriptionStatus } from '../services/memberEmailSubscriptionService';
import {
  getMemberEmailSubscription,
  syncMemberEmailSubscription,
} from '../services/memberEmailSubscriptionService';
import type { CanopyTroveAuthSession } from '../types/identity';

const SUBSCRIPTION_TIMEOUT_MS = 8000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_resolve, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms),
    ),
  ]);
}

function createSignedOutStatus(email: string | null): MemberEmailSubscriptionStatus {
  return {
    accountId: '',
    email,
    displayName: null,
    subscribed: false,
    source: 'member_signup',
    updatedAt: null,
    consentedAt: null,
    unsubscribedAt: null,
    welcomeEmailSentAt: null,
    welcomeEmailState: 'not_requested',
    welcomeEmailError: null,
  };
}

export function useMemberEmailSubscription(authSession: CanopyTroveAuthSession) {
  const [status, setStatus] = React.useState<MemberEmailSubscriptionStatus>(() =>
    createSignedOutStatus(authSession.email),
  );
  const [isLoading, setIsLoading] = React.useState(authSession.status === 'authenticated');
  const [isSaving, setIsSaving] = React.useState(false);
  const [actionStatus, setActionStatus] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (authSession.status !== 'authenticated') {
      setStatus(createSignedOutStatus(authSession.email));
      setIsLoading(false);
      setIsSaving(false);
      setActionStatus(null);
      return;
    }

    let alive = true;
    setIsLoading(true);
    setActionStatus(null);

    void (async () => {
      try {
        const nextStatus = await withTimeout(
          getMemberEmailSubscription(),
          SUBSCRIPTION_TIMEOUT_MS,
          'getMemberEmailSubscription',
        );
        if (!alive) {
          return;
        }

        setStatus(nextStatus);
      } catch (error) {
        reportRuntimeError(error, {
          source: 'member-email-subscription-load',
        });

        if (alive) {
          setActionStatus('Email update status could not be loaded right now.');
        }
      } finally {
        if (alive) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, [authSession.email, authSession.status, authSession.uid]);

  const setSubscribed = React.useCallback(
    async (subscribed: boolean) => {
      if (authSession.status !== 'authenticated') {
        return false;
      }

      setIsSaving(true);
      setActionStatus(null);

      try {
        const nextStatus = await withTimeout(
          syncMemberEmailSubscription({ subscribed, source: 'profile' }),
          SUBSCRIPTION_TIMEOUT_MS,
          'syncMemberEmailSubscription',
        );
        setStatus(nextStatus);
        setActionStatus(
          subscribed
            ? nextStatus.welcomeEmailState === 'sent'
              ? 'Email updates enabled. Welcome email sent.'
              : 'Email updates enabled.'
            : 'Email updates turned off.',
        );
        return true;
      } catch (error) {
        reportRuntimeError(error, {
          source: 'member-email-subscription-save',
        });
        setActionStatus(
          subscribed
            ? 'Could not enable email updates right now.'
            : 'Could not turn off email updates right now.',
        );
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [authSession.status],
  );

  return {
    status,
    isLoading,
    isSaving,
    actionStatus,
    subscribe: () => setSubscribed(true),
    unsubscribe: () => setSubscribed(false),
  };
}

/**
 * Payment methods community report service.
 *
 * Wraps `POST /payment-methods/reports` so shoppers can crowdsource the
 * "does this shop accept X?" signal. The backend aggregates votes and
 * drives the community tier of the 3-tier merge (owner > community >
 * google).
 *
 * Anonymous by default — we send the install ID only, never PII.
 * Fail-soft: the UI shows a toast on success but never blocks interaction.
 */

import { requestJson } from './storefrontBackendHttp';
import { trackAnalyticsEvent } from './analyticsService';
import type { PaymentMethodId } from '../types/storefrontBaseTypes';

export type PaymentMethodsReportRequest = {
  storefrontId: string;
  methodId: PaymentMethodId;
  accepted: boolean;
  installId: string;
};

export async function submitPaymentMethodsReport(
  request: PaymentMethodsReportRequest,
): Promise<void> {
  await requestJson<void>('/payment-methods/reports', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      storefrontId: request.storefrontId,
      methodId: request.methodId,
      accepted: request.accepted,
      installId: request.installId,
    }),
  });

  trackAnalyticsEvent(
    'payment_methods_community_report_submitted',
    {
      methodId: request.methodId,
      accepted: request.accepted,
    },
    { storefrontId: request.storefrontId },
  );
}

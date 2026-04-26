import type { Purchase, PurchaseIOS } from 'expo-iap';
import {
  getAppleOwnerIapTierFromProductId,
  isAppleOwnerIapProductId,
} from '../config/ownerBilling';
import type { OwnerSubscriptionTier } from '../types/ownerTiers';
import { requestJson } from './storefrontBackendHttp';

type OwnerAppleSubscriptionSyncPayload = {
  productId: string;
  transactionId: string;
  originalTransactionId: string | null;
  purchaseToken: string | null;
  currentPlanId: string | null;
  environmentIOS: string | null;
  expirationDateMs: number | null;
  transactionDateMs: number;
  isAutoRenewing: boolean;
  purchaseState: string;
  renewalInfoIOS: {
    pendingUpgradeProductId: string | null;
    gracePeriodExpirationDateMs: number | null;
    isInBillingRetry: boolean;
    expirationReason: string | null;
  } | null;
};

export type OwnerAppleSubscriptionSyncResponse = {
  ok: true;
  ownerUid: string;
  status: string;
  tier: OwnerSubscriptionTier;
  billingCycle: 'monthly';
  planId: string;
  provider: 'apple_iap';
};

export function getOwnerApplePurchaseTier(purchase: Pick<Purchase, 'productId' | 'currentPlanId'>) {
  return (
    getAppleOwnerIapTierFromProductId(purchase.currentPlanId) ??
    getAppleOwnerIapTierFromProductId(purchase.productId)
  );
}

export function isOwnerAppleSubscriptionPurchase(
  purchase: Pick<Purchase, 'productId' | 'currentPlanId'>,
) {
  return (
    isAppleOwnerIapProductId(purchase.productId) || isAppleOwnerIapProductId(purchase.currentPlanId)
  );
}

function isIosPurchase(purchase: Purchase): purchase is PurchaseIOS {
  return purchase.platform === 'ios';
}

function toSyncPayload(purchase: PurchaseIOS): OwnerAppleSubscriptionSyncPayload {
  return {
    productId: purchase.productId,
    transactionId: purchase.transactionId ?? purchase.id,
    originalTransactionId: purchase.originalTransactionIdentifierIOS ?? null,
    purchaseToken: purchase.purchaseToken ?? null,
    currentPlanId: purchase.currentPlanId ?? null,
    environmentIOS: purchase.environmentIOS ?? null,
    expirationDateMs: purchase.expirationDateIOS ?? null,
    transactionDateMs: purchase.transactionDate,
    isAutoRenewing: purchase.isAutoRenewing,
    purchaseState: purchase.purchaseState,
    renewalInfoIOS: purchase.renewalInfoIOS
      ? {
          pendingUpgradeProductId: purchase.renewalInfoIOS.pendingUpgradeProductId ?? null,
          gracePeriodExpirationDateMs: purchase.renewalInfoIOS.gracePeriodExpirationDate ?? null,
          isInBillingRetry: purchase.renewalInfoIOS.isInBillingRetry === true,
          expirationReason: purchase.renewalInfoIOS.expirationReason ?? null,
        }
      : null,
  };
}

export async function syncOwnerAppleSubscriptionPurchase(purchase: Purchase) {
  if (!isOwnerAppleSubscriptionPurchase(purchase)) {
    throw new Error('This Apple purchase does not map to a Canopy Trove owner plan.');
  }
  if (!isIosPurchase(purchase)) {
    throw new Error('Apple owner subscription sync only accepts iOS StoreKit purchases.');
  }

  return requestJson<OwnerAppleSubscriptionSyncResponse>('/owner-billing/apple/subscription-sync', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(toSyncPayload(purchase)),
  });
}

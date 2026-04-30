import React from 'react';
import type { RouteProp } from '@react-navigation/native';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import {
  deepLinkToSubscriptions,
  endConnection as endAppleBillingConnection,
  fetchProducts as fetchAppleProducts,
  finishTransaction as finishAppleTransaction,
  getAvailablePurchases as getAvailableApplePurchases,
  initConnection as initAppleBillingConnection,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestPurchase as requestApplePurchase,
  restorePurchases as restoreApplePurchases,
  type ProductSubscription,
  type Purchase,
  type PurchaseIOS,
} from 'expo-iap';
import { Linking, Platform, Pressable, Text, View } from 'react-native';
import { withScreenErrorBoundary } from '../components/withScreenErrorBoundary';
import { MotionInView } from '../components/MotionInView';
import { ScreenShell } from '../components/ScreenShell';
import { SectionCard } from '../components/SectionCard';
import {
  getAppleOwnerIapProductIds,
  hasConfiguredAppleOwnerBillingProducts,
} from '../config/ownerBilling';
import { useStorefrontProfileController } from '../context/StorefrontController';
import { useSavedSummaries } from '../hooks/useStorefrontSummaryData';
import type { RootStackParamList } from '../navigation/RootNavigator';

import {
  createOwnerBillingCheckoutSession,
  createOwnerBillingPortalSession,
  hasConfiguredOwnerBillingFlow,
} from '../services/ownerPortalBillingService';
import {
  getOwnerApplePurchaseTier,
  isOwnerAppleSubscriptionPurchase,
  prepareOwnerApplePurchase,
  syncOwnerAppleSubscriptionPurchase,
} from '../services/ownerPortalAppleBillingService';
import { getOwnerProfile, getOwnerSubscription } from '../services/ownerPortalService';
import { getRuntimeOpsStatus } from '../services/runtimeOpsService';
import type { OwnerProfileDocument, OwnerPortalSubscriptionDocument } from '../types/ownerPortal';
import type { OwnerSubscriptionTier } from '../types/ownerTiers';
import type { OwnerTierBillingCycle } from '../types/ownerTiers';
import type { RuntimeOpsPublicStatus } from '../types/runtimeOps';
import { ownerPortalStyles as styles } from './ownerPortal/ownerPortalStyles';
import {
  PREMIUM_FEATURE_COUNT,
  OwnerPortalSubscriptionIntroNotes,
  OwnerPortalSubscriptionPlanDetails,
  OwnerPortalSubscriptionReadinessList,
  OwnerPortalTierCards,
  PremiumFeatureList,
  formatPlanValue,
  isVerifiedStatus,
} from './ownerPortal/ownerPortalSubscriptionSections';

type OwnerPortalSubscriptionRoute = RouteProp<RootStackParamList, 'OwnerPortalSubscription'>;

function isIosPurchase(purchase: Purchase): purchase is PurchaseIOS {
  return purchase.platform === 'ios';
}

function getIosPurchaseExpirationMs(purchase: Purchase) {
  if (!isIosPurchase(purchase)) {
    return purchase.transactionDate;
  }

  return purchase.expirationDateIOS ?? purchase.transactionDate;
}

function OwnerPortalSubscriptionScreenInner() {
  const route = useRoute<OwnerPortalSubscriptionRoute>();
  const { authSession } = useStorefrontProfileController();
  const isAndroid = Platform.OS === 'android';
  const isWeb = Platform.OS === 'web';
  const isAppleNative = Platform.OS === 'ios';
  const appleOwnerProductIds = React.useMemo(() => getAppleOwnerIapProductIds(), []);
  const preview = route.params?.preview ?? false;
  const [ownerProfile, setOwnerProfile] = React.useState<OwnerProfileDocument | null>(null);
  const [subscription, setSubscription] = React.useState<OwnerPortalSubscriptionDocument | null>(
    null,
  );
  const [runtimeStatus, setRuntimeStatus] = React.useState<RuntimeOpsPublicStatus | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState<null | OwnerSubscriptionTier | 'manage'>(
    null,
  );
  const [statusText, setStatusText] = React.useState<string | null>(null);
  const [billingCycle, setBillingCycle] = React.useState<OwnerTierBillingCycle>('monthly');
  const [appleStoreReady, setAppleStoreReady] = React.useState(false);
  const [appleProductsByTier, setAppleProductsByTier] = React.useState<
    Partial<Record<OwnerSubscriptionTier, ProductSubscription>>
  >({});
  const syncedAppleTransactionIdsRef = React.useRef(new Set<string>());

  const loadBillingState = React.useCallback(async () => {
    if (preview) {
      setIsLoading(false);
      return;
    }

    const ownerUid = authSession.uid;
    if (!ownerUid) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const [nextOwnerProfile, nextSubscription, nextRuntimeStatus] = await Promise.all([
        getOwnerProfile(ownerUid),
        getOwnerSubscription(ownerUid),
        getRuntimeOpsStatus(),
      ]);
      setOwnerProfile(nextOwnerProfile);
      setSubscription(nextSubscription);
      setRuntimeStatus(nextRuntimeStatus);
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : 'Unable to load owner billing.');
    } finally {
      setIsLoading(false);
    }
  }, [authSession.uid, preview]);

  React.useEffect(() => {
    void loadBillingState();
  }, [loadBillingState]);

  useFocusEffect(
    React.useCallback(() => {
      void loadBillingState();
    }, [loadBillingState]),
  );

  const claimedStorefrontIds = ownerProfile?.dispensaryId ? [ownerProfile.dispensaryId] : [];
  const { data: claimedStorefronts } = useSavedSummaries(claimedStorefrontIds);
  const claimedStorefront = claimedStorefronts?.[0] ?? null;

  const effectiveStatus = subscription?.status ?? ownerProfile?.subscriptionStatus ?? 'inactive';
  const hasAccess = effectiveStatus === 'trial' || effectiveStatus === 'active';
  const isBillingEligible =
    Boolean(ownerProfile?.dispensaryId) &&
    isVerifiedStatus(ownerProfile?.businessVerificationStatus) &&
    isVerifiedStatus(ownerProfile?.identityVerificationStatus);
  const billingConfigured = hasConfiguredOwnerBillingFlow();
  const appleBillingConfigured = hasConfiguredAppleOwnerBillingProducts();
  const billingEnabledInThisBuild =
    (billingConfigured && isWeb) || (appleBillingConfigured && isAppleNative && appleStoreReady);
  const billingTemporarilyPaused =
    runtimeStatus?.policy.safeModeEnabled === true ||
    runtimeStatus?.policy.ownerPortalWritesEnabled === false;

  const syncApplePurchaseToOwnerPlan = React.useCallback(
    async (purchase: Purchase, options?: { finishTransactionAfterSync?: boolean }) => {
      if (!isOwnerAppleSubscriptionPurchase(purchase)) {
        return false;
      }

      const transactionId = purchase.transactionId ?? purchase.id;

      if (syncedAppleTransactionIdsRef.current.has(transactionId)) {
        return true;
      }

      const nextTier = getOwnerApplePurchaseTier(purchase);
      if (!nextTier) {
        throw new Error('The purchased Apple plan does not map to an owner tier.');
      }

      setIsSubmitting(nextTier);
      setStatusText('Syncing your Apple owner plan...');

      await syncOwnerAppleSubscriptionPurchase(purchase);
      syncedAppleTransactionIdsRef.current.add(transactionId);

      if (options?.finishTransactionAfterSync !== false) {
        await finishAppleTransaction({
          purchase: {
            id: purchase.id,
            ids: purchase.ids ?? undefined,
            isAutoRenewing: purchase.isAutoRenewing,
            platform: purchase.platform,
            productId: purchase.productId,
            purchaseState: purchase.purchaseState,
            purchaseToken: purchase.purchaseToken ?? null,
            quantity: purchase.quantity,
            store: purchase.store,
            transactionDate: purchase.transactionDate,
            transactionId,
          },
          isConsumable: false,
        });
      }

      await loadBillingState();
      setStatusText('Apple subscription synced. Your owner plan is active.');
      setIsSubmitting(null);
      return true;
    },
    [loadBillingState],
  );

  const refreshAppleProducts = React.useCallback(async () => {
    if (!isAppleNative || preview) {
      return;
    }

    const connected = await initAppleBillingConnection();
    setAppleStoreReady(Boolean(connected));
    if (!connected) {
      throw new Error('Apple billing is not available on this device yet.');
    }

    const storeSubscriptions = (await fetchAppleProducts({
      skus: appleOwnerProductIds,
      type: 'subs',
    })) as ProductSubscription[] | null;

    const nextProductsByTier: Partial<Record<OwnerSubscriptionTier, ProductSubscription>> = {};
    (storeSubscriptions ?? []).forEach((product) => {
      const tier = getOwnerApplePurchaseTier({
        productId: product.id,
        currentPlanId: product.id,
      });
      if (tier) {
        nextProductsByTier[tier] = product;
      }
    });

    setAppleProductsByTier(nextProductsByTier);

    const availablePurchases = await getAvailableApplePurchases({
      onlyIncludeActiveItemsIOS: true,
      alsoPublishToEventListenerIOS: false,
    });
    const matchingPurchase = availablePurchases
      .filter(isOwnerAppleSubscriptionPurchase)
      .sort((left, right) => {
        const leftExpires = getIosPurchaseExpirationMs(left);
        const rightExpires = getIosPurchaseExpirationMs(right);
        return rightExpires - leftExpires;
      })[0];

    if (matchingPurchase) {
      await syncApplePurchaseToOwnerPlan(matchingPurchase, {
        finishTransactionAfterSync: false,
      });
    }
  }, [appleOwnerProductIds, isAppleNative, preview, syncApplePurchaseToOwnerPlan]);

  React.useEffect(() => {
    if (!isAppleNative || preview) {
      return;
    }

    const purchaseUpdateSubscription = purchaseUpdatedListener((purchase) => {
      void syncApplePurchaseToOwnerPlan(purchase);
    });
    const purchaseErrorSubscription = purchaseErrorListener((error) => {
      setIsSubmitting(null);
      setStatusText(error.message || 'Apple purchase was not completed.');
    });

    void refreshAppleProducts().catch((error: unknown) => {
      setAppleStoreReady(false);
      setStatusText(error instanceof Error ? error.message : 'Unable to load Apple billing.');
    });

    return () => {
      purchaseUpdateSubscription.remove();
      purchaseErrorSubscription.remove();
      void endAppleBillingConnection();
    };
  }, [isAppleNative, preview, refreshAppleProducts, syncApplePurchaseToOwnerPlan]);

  const billingReadinessItems = [
    {
      label: 'Claimed storefront linked',
      body: ownerProfile?.dispensaryId
        ? 'The owner profile is linked to a storefront and is ready for paid-owner gating.'
        : 'Billing should stay blocked until a storefront claim exists.',
      tone: ownerProfile?.dispensaryId ? ('complete' as const) : ('pending' as const),
    },
    {
      label: 'Business verification',
      body: isVerifiedStatus(ownerProfile?.businessVerificationStatus)
        ? 'Business review is complete.'
        : 'Business verification must be approved before checkout should be treated as live.',
      tone: isVerifiedStatus(ownerProfile?.businessVerificationStatus)
        ? ('complete' as const)
        : ('current' as const),
    },
    {
      label: 'Identity verification',
      body: isVerifiedStatus(ownerProfile?.identityVerificationStatus)
        ? 'Identity review is complete.'
        : 'Identity verification must be approved before premium access should be granted.',
      tone: isVerifiedStatus(ownerProfile?.identityVerificationStatus)
        ? ('complete' as const)
        : ('current' as const),
    },
    {
      label: 'Billing backend configured',
      body: isWeb
        ? billingConfigured
          ? 'This build can open the configured billing path.'
          : 'Billing env or fallback checkout links are still incomplete for this build.'
        : isAppleNative
          ? appleBillingConfigured
            ? 'Apple owner plans are loaded from App Store Connect and synced back into the owner workspace.'
            : 'Apple owner product IDs are missing for this build.'
          : billingConfigured
            ? 'Android shows billing status only. Checkout and billing management stay outside the Android app.'
            : 'Billing env or fallback checkout links are still incomplete for this build.',
      tone:
        isAppleNative && !appleBillingConfigured
          ? ('attention' as const)
          : !isWeb
            ? ('complete' as const)
            : billingConfigured
              ? ('complete' as const)
              : ('attention' as const),
    },
    {
      label: 'Billing safety',
      body: billingTemporarilyPaused
        ? (runtimeStatus?.policy.reason ??
          'Protected mode is active, so live billing changes should wait until the system stabilizes.')
        : 'No billing pause is active right now.',
      tone: billingTemporarilyPaused ? ('attention' as const) : ('complete' as const),
    },
  ];

  const handleOpenCheckout = async (tier: OwnerSubscriptionTier) => {
    if (isAppleNative) {
      const product = appleProductsByTier[tier];
      if (!product) {
        setStatusText('That Apple owner plan is not available yet. Refresh and try again.');
        return;
      }
      if (!isBillingEligible) {
        setStatusText('Sign in, claim your storefront, and finish verification first.');
        return;
      }
      if (isSubmitting || billingTemporarilyPaused) {
        return;
      }

      setIsSubmitting(tier);
      setStatusText('Opening Apple purchase...');
      try {
        // Reserve a backend-side appAccountToken so the App Store Server
        // Notifications webhook can recover the owner identity even if the
        // post-purchase sync never lands (app crash, network drop).
        let appAccountToken: string | null = null;
        try {
          const prepared = await prepareOwnerApplePurchase();
          appAccountToken = prepared.appAccountToken;
        } catch {
          // Non-fatal: fall through with the legacy frontend-sync-only path.
        }
        await requestApplePurchase({
          request: {
            apple: {
              sku: product.id,
              quantity: 1,
              ...(appAccountToken ? { appAccountToken } : {}),
            },
          },
          type: 'subs',
        });
      } catch (error) {
        setIsSubmitting(null);
        setStatusText(
          error instanceof Error ? error.message : 'Unable to open Apple purchase flow.',
        );
      }
      return;
    }

    if (!isWeb) {
      setStatusText(
        isAppleNative
          ? 'Owner plan purchases stay on the web in the iPhone and iPad builds.'
          : 'Android shows owner plan status only. Checkout stays outside the Android app.',
      );
      return;
    }
    if (!authSession.uid || !ownerProfile?.dispensaryId) {
      setStatusText('Sign in and claim a listing before starting a subscription.');
      return;
    }
    if (isSubmitting || billingTemporarilyPaused) {
      return;
    }

    setIsSubmitting(tier);
    setStatusText(null);
    try {
      const session = await createOwnerBillingCheckoutSession(billingCycle, tier);
      if (isWeb) {
        window.open(session.url, '_blank', 'noopener,noreferrer');
      } else {
        await Linking.openURL(session.url);
      }
      setStatusText(
        'Checkout opened. Complete billing, then return here and tap Refresh Billing Status.',
      );
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : 'Unable to open owner checkout.');
    } finally {
      setIsSubmitting(null);
    }
  };

  const handleOpenBillingPortal = async () => {
    if (isAppleNative) {
      if (billingTemporarilyPaused || isSubmitting) {
        return;
      }
      setIsSubmitting('manage');
      setStatusText('Opening Apple subscription management...');
      try {
        await deepLinkToSubscriptions({});
        setStatusText('Apple subscription management opened.');
      } catch (error) {
        setStatusText(
          error instanceof Error ? error.message : 'Unable to open Apple subscription management.',
        );
      } finally {
        setIsSubmitting(null);
      }
      return;
    }

    if (!isWeb) {
      setStatusText(
        isAppleNative
          ? 'Owner billing management stays on the web in the iPhone and iPad builds.'
          : 'Android keeps billing management outside the app. Use a non-Android channel to manage owner billing.',
      );
      return;
    }
    if (isSubmitting || billingTemporarilyPaused) {
      return;
    }
    if (!subscription?.externalCustomerId) {
      setStatusText('No billing account found. Start a subscription first.');
      return;
    }

    setIsSubmitting('manage');
    setStatusText(null);
    try {
      const session = await createOwnerBillingPortalSession();
      if (isWeb) {
        window.open(session.url, '_blank', 'noopener,noreferrer');
      } else {
        await Linking.openURL(session.url);
      }
      setStatusText('Billing management opened in your browser.');
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : 'Unable to open billing management.');
    } finally {
      setIsSubmitting(null);
    }
  };

  return (
    <ScreenShell
      eyebrow="Owner Portal"
      title="Business plan."
      subtitle={
        isWeb
          ? 'Choose your plan, complete checkout, and manage billing.'
          : isAppleNative
            ? 'Review owner plan status and billing readiness for Apple builds.'
            : 'Review owner plan status and billing readiness for the Android build.'
      }
      headerPill="Owner"
    >
      <MotionInView delay={70}>
        <View style={styles.portalHeroCard}>
          <View style={styles.portalHeroGlow} />
          <Text style={styles.portalHeroKicker}>Licensed storefront tools</Text>
          <Text style={styles.portalHeroTitle}>
            Activate the private business plan for your claimed dispensary workspace.
          </Text>
          <Text style={styles.portalHeroBody}>
            Private business plan for licensed dispensary operators managing claimed storefronts.
          </Text>
          <View style={styles.portalHeroMetricRow}>
            <View style={styles.portalHeroMetricCard}>
              <Text style={styles.portalHeroMetricValue}>{formatPlanValue(effectiveStatus)}</Text>
              <Text style={styles.portalHeroMetricLabel}>Plan Status</Text>
            </View>
            <View style={styles.portalHeroMetricCard}>
              <Text style={styles.portalHeroMetricValue}>
                {isAppleNative
                  ? appleBillingConfigured && appleStoreReady
                    ? 'Ready'
                    : 'Setup'
                  : !isWeb
                    ? 'Outside App'
                    : billingConfigured
                      ? 'Ready'
                      : 'Setup'}
              </Text>
              <Text style={styles.portalHeroMetricLabel}>Billing Flow</Text>
            </View>
            <View style={styles.portalHeroMetricCard}>
              <Text style={styles.portalHeroMetricValue}>{PREMIUM_FEATURE_COUNT}</Text>
              <Text style={styles.portalHeroMetricLabel}>Premium Tools</Text>
            </View>
          </View>
        </View>
      </MotionInView>

      {billingTemporarilyPaused ? (
        <MotionInView delay={100}>
          <SectionCard title="Protected mode" body="Billing paused while system stabilizes.">
            <View style={[styles.statusPanel, styles.statusPanelWarm]}>
              <Text style={styles.helperText}>
                {runtimeStatus?.policy.reason ??
                  'Protected mode is active, so live checkout and billing management are temporarily paused.'}
              </Text>
            </View>
          </SectionCard>
        </MotionInView>
      ) : null}

      <MotionInView delay={120}>
        <SectionCard
          title="Business service scope"
          body="Private storefront-management service for licensed dispensary teams."
        >
          <OwnerPortalSubscriptionIntroNotes />
        </SectionCard>
      </MotionInView>

      <MotionInView delay={150}>
        <SectionCard
          title="Current plan status"
          body="Access controls your available business tools."
        >
          <OwnerPortalSubscriptionPlanDetails
            billingTemporarilyPaused={billingTemporarilyPaused}
            hasAccess={hasAccess}
            isBillingEligible={isBillingEligible}
            ownerProfile={ownerProfile}
            storefrontLabel={
              claimedStorefront?.displayName ?? ownerProfile?.dispensaryId ?? 'No claimed listing'
            }
            subscription={subscription}
          />
        </SectionCard>
      </MotionInView>

      <MotionInView delay={210}>
        <SectionCard title="Premium owner tools" body="Included with premium plan.">
          <View style={styles.planTile}>
            <Text style={styles.sectionEyebrow}>Included with premium</Text>
            <PremiumFeatureList />
          </View>
        </SectionCard>
      </MotionInView>

      <MotionInView delay={240}>
        <SectionCard title="Before billing can start" body="Complete these verification steps.">
          <OwnerPortalSubscriptionReadinessList items={billingReadinessItems} />
        </SectionCard>
      </MotionInView>

      <MotionInView delay={270}>
        <SectionCard
          title="Choose your plan"
          body={
            !isWeb
              ? isAppleNative
                ? 'Review the live Apple plans and purchase your monthly owner tier in-app.'
                : 'Review available tiers and the Android billing posture.'
              : 'Select your tier and billing cycle, then proceed to checkout.'
          }
        >
          <View style={styles.sectionStack}>
            {statusText ? <Text style={styles.errorText}>{statusText}</Text> : null}
            {!billingConfigured && isWeb ? (
              <Text style={styles.errorText}>
                Billing is not configured for this build yet. Add the hosted backend billing env or
                the fallback hosted checkout URLs before release.
              </Text>
            ) : null}
            {!isWeb && !isAppleNative ? (
              <Text style={styles.helperText}>
                Android keeps owner billing read-only inside the app. Checkout and subscription
                management are intentionally unavailable in this build.
              </Text>
            ) : null}
            {isAppleNative && !appleStoreReady ? (
              <Text style={styles.helperText}>
                Apple billing is still connecting to the App Store on this device.
              </Text>
            ) : null}
            {!isBillingEligible ? (
              <Text style={styles.helperText}>
                Complete storefront claim, business verification, and identity verification before
                starting billing.
              </Text>
            ) : null}
            {hasAccess ? (
              <Text style={styles.successText}>
                Plan access is active. Use billing management to update or cancel this subscription.
              </Text>
            ) : null}
            <OwnerPortalTierCards
              billingCycle={billingCycle}
              currentTier={subscription?.tier ?? (hasAccess ? null : 'free')}
              disableButtons={
                isLoading ||
                !billingEnabledInThisBuild ||
                !isBillingEligible ||
                billingTemporarilyPaused ||
                Boolean(isSubmitting)
              }
              isSubmitting={
                typeof isSubmitting === 'string' && isSubmitting !== 'manage'
                  ? (isSubmitting as OwnerSubscriptionTier)
                  : null
              }
              billingTemporarilyPaused={billingTemporarilyPaused}
              showBillingCycleToggle={!isAppleNative}
              onSelectTier={(tier) => {
                void handleOpenCheckout(tier);
              }}
              onToggleBillingCycle={() => {
                setBillingCycle((prev) => (prev === 'monthly' ? 'annual' : 'monthly'));
              }}
            />
          </View>
        </SectionCard>
      </MotionInView>

      {isAppleNative ? (
        <MotionInView delay={300}>
          <SectionCard
            title="Subscription terms"
            body="Auto-renewable monthly subscription details and policies."
          >
            <View style={styles.sectionStack}>
              <Text style={styles.helperText}>
                Owner subscriptions on iPhone are auto-renewable monthly subscriptions billed
                through your Apple ID. Plans available: Verified, Growth, and Pro. Each plan renews
                monthly at the price shown above until you cancel.
              </Text>
              <Text style={styles.helperText}>
                Payment will be charged to your Apple ID account at confirmation of purchase.
                Subscriptions automatically renew unless canceled at least 24 hours before the end
                of the current period. Your account will be charged for renewal within 24 hours
                prior to the end of the current period. You can manage and cancel your subscriptions
                by going to your Apple ID account settings on the App Store after purchase.
              </Text>
              <View style={styles.buttonRow}>
                <Pressable
                  accessibilityRole="link"
                  onPress={() => {
                    void Linking.openURL('https://canopytrove.com/terms');
                  }}
                  style={styles.secondaryButton}
                >
                  <Text style={styles.secondaryButtonText}>Terms of Use (EULA)</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="link"
                  onPress={() => {
                    void Linking.openURL('https://canopytrove.com/privacy');
                  }}
                  style={styles.secondaryButton}
                >
                  <Text style={styles.secondaryButtonText}>Privacy Policy</Text>
                </Pressable>
              </View>
            </View>
          </SectionCard>
        </MotionInView>
      ) : null}

      <MotionInView delay={330}>
        <SectionCard
          title="Manage billing"
          body={
            !isWeb
              ? isAppleNative
                ? 'Refresh your synced owner status, restore purchases, or open Apple subscription management.'
                : 'Refresh status only. Billing management stays outside the Android build.'
              : 'Refresh status or manage your active subscription.'
          }
        >
          <View style={[styles.ctaPanel, styles.statusPanelSuccess]}>
            <Text style={styles.helperText}>
              {!isWeb
                ? isAppleNative
                  ? 'Use refresh after purchase, restore if you already subscribed on this Apple ID, or open Apple subscription settings to manage renewal.'
                  : 'Refresh to see the latest synced subscription state. Billing management is intentionally unavailable in the Android build.'
                : 'Refresh after checkout if you need the latest synced state, or open billing management once a live customer record exists.'}
            </Text>
            <View style={styles.buttonRow}>
              <Pressable
                onPress={() => {
                  void loadBillingState();
                }}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonText}>Refresh Billing Status</Text>
              </Pressable>
              {isAppleNative ? (
                <Pressable
                  disabled={billingTemporarilyPaused || Boolean(isSubmitting)}
                  onPress={() => {
                    setStatusText('Restoring Apple purchases...');
                    void restoreApplePurchases()
                      .then(async () => {
                        const availablePurchases = await getAvailableApplePurchases({
                          onlyIncludeActiveItemsIOS: true,
                          alsoPublishToEventListenerIOS: false,
                        });
                        const matchingPurchase = availablePurchases
                          .filter(isOwnerAppleSubscriptionPurchase)
                          .sort((left, right) => {
                            const leftExpires = getIosPurchaseExpirationMs(left);
                            const rightExpires = getIosPurchaseExpirationMs(right);
                            return rightExpires - leftExpires;
                          })[0];

                        if (!matchingPurchase) {
                          setStatusText(
                            'No active Apple owner subscription was found for this Apple ID.',
                          );
                          return;
                        }

                        await syncApplePurchaseToOwnerPlan(matchingPurchase, {
                          finishTransactionAfterSync: false,
                        });
                      })
                      .catch((error: unknown) => {
                        setStatusText(
                          error instanceof Error
                            ? error.message
                            : 'Unable to restore Apple purchases.',
                        );
                      });
                  }}
                  style={[
                    styles.secondaryButton,
                    (billingTemporarilyPaused || Boolean(isSubmitting)) && styles.buttonDisabled,
                  ]}
                >
                  <Text style={styles.secondaryButtonText}>Restore Purchases</Text>
                </Pressable>
              ) : null}
              <Pressable
                disabled={
                  isAndroid ||
                  (!isAppleNative && (!isWeb || !subscription?.externalCustomerId)) ||
                  billingTemporarilyPaused ||
                  Boolean(isSubmitting)
                }
                onPress={() => {
                  void handleOpenBillingPortal();
                }}
                style={[
                  styles.primaryButton,
                  (isAndroid ||
                    (!isAppleNative && (!isWeb || !subscription?.externalCustomerId)) ||
                    billingTemporarilyPaused ||
                    Boolean(isSubmitting)) &&
                    styles.buttonDisabled,
                ]}
              >
                <Text style={styles.primaryButtonText}>
                  {!isWeb && !isAppleNative
                    ? 'Unavailable On Android'
                    : isAppleNative
                      ? isSubmitting === 'manage'
                        ? 'Opening...'
                        : 'Open Apple Subscriptions'
                      : billingTemporarilyPaused
                        ? 'Billing Paused'
                        : isSubmitting === 'manage'
                          ? 'Opening...'
                          : 'Open Billing Management'}
                </Text>
              </Pressable>
            </View>
          </View>
        </SectionCard>
      </MotionInView>
    </ScreenShell>
  );
}

export const OwnerPortalSubscriptionScreen = withScreenErrorBoundary(
  OwnerPortalSubscriptionScreenInner,
  'owner-portal-subscription',
);

import React from 'react';
import {
  ActivityIndicator,
  AppState,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppUiIcon } from '../icons/AppUiIcon';
import { InlineFeedbackPanel } from '../components/InlineFeedbackPanel';
import { LicensedBadge } from '../components/LicensedBadge';
import { MotionInView } from '../components/MotionInView';
import { ScreenShell } from '../components/ScreenShell';
import { SectionCard } from '../components/SectionCard';
import { withScreenErrorBoundary } from '../components/withScreenErrorBoundary';
import { useStorefrontProfileController } from '../context/StorefrontController';
import { trackAnalyticsEvent } from '../services/analyticsService';
import { ensureAnalyticsInstallId } from '../services/analyticsStorage';
import { getCanopyTroveAuthIdToken } from '../services/canopyTroveAuthService';
import { addFavoriteBrand, isFavoriteBrand, removeFavoriteBrand } from '../services/brandService';
import { buildClientProductSlug } from '../services/productReviewService';
import {
  ingestScan,
  reportCoaOpened,
  submitProductContribution,
  type ScanResolutionResult,
} from '../services/scanResolutionService';
import { colors, fontFamilies, radii, spacing, textStyles, typography } from '../theme/tokens';
import type { RootStackParamList } from '../navigation/rootNavigatorConfig';

type ScanResultScreenProps = NativeStackScreenProps<RootStackParamList, 'ScanResult'>;

type ScanResultState =
  | { kind: 'loading' }
  | { kind: 'license'; result: ScanResolutionResult & { kind: 'license' } }
  | { kind: 'product'; result: ScanResolutionResult & { kind: 'product' } }
  | { kind: 'unknown'; result: ScanResolutionResult & { kind: 'unknown' } };

function ScanResultScreenInner({ route, navigation }: ScanResultScreenProps) {
  const { rawCode, mode } = route.params;
  const { authSession, profileId } = useStorefrontProfileController();
  const isAuthenticated = authSession.status === 'authenticated';
  const [state, setState] = React.useState<ScanResultState>({ kind: 'loading' });
  const [isBrandSaved, setIsBrandSaved] = React.useState(false);
  const [isSavingBrand, setIsSavingBrand] = React.useState(false);
  // Return-review prompt: we track when the user leaves the app via "View lab
  // results" and surface a rate-this-product card when they come back. Keeps us
  // off the hook legally — the user views the real lab site themselves, we
  // only ask for a review on their return.
  const pendingCoaReturnRef = React.useRef(false);
  const promptAnalyticsFiredRef = React.useRef(false);
  const [showReturnPrompt, setShowReturnPrompt] = React.useState(false);
  const [returnPromptDismissed, setReturnPromptDismissed] = React.useState(false);
  const [installId, setInstallId] = React.useState<string>('');

  // Resolve a stable anonymous install ID once. Used for scan ingestion +
  // COA-open reporting so the backend can de-dupe scans without us collecting
  // any personal data.
  React.useEffect(() => {
    let cancelled = false;
    void ensureAnalyticsInstallId('').then((id) => {
      if (!cancelled) setInstallId(id);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const productBrandId = state.kind === 'product' ? state.result.coa?.brandName : undefined;
  // Pull product identity from the parsed COA (if any) so review prompts,
  // sign-in resume, and the composer hand-off all read from one source.
  const productBrandName = state.kind === 'product' ? state.result.coa?.brandName : undefined;
  const productProductName = state.kind === 'product' ? state.result.coa?.productName : undefined;
  const productLabName = state.kind === 'product' ? state.result.coa?.labName : undefined;
  const hasReviewableProduct = Boolean(productBrandName && productProductName);
  const productReviewComposerParams = React.useMemo<
    RootStackParamList['ProductReviewComposer'] | null
  >(() => {
    if (!productBrandName || !productProductName) {
      return null;
    }

    const productSlug = buildClientProductSlug(productBrandName, productProductName);
    if (!productSlug) {
      return null;
    }

    return {
      productSlug,
      brandName: productBrandName,
      productName: productProductName,
    };
  }, [productBrandName, productProductName]);

  React.useEffect(() => {
    if (!productBrandId || !isAuthenticated || !profileId) {
      setIsBrandSaved(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const token = await getCanopyTroveAuthIdToken();
        const saved = await isFavoriteBrand(productBrandId, {
          profileId,
          token: token ?? undefined,
        });
        if (!cancelled) {
          setIsBrandSaved(saved);
        }
      } catch {
        // fail soft - default to not saved
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, productBrandId, profileId]);

  const handleToggleSaveBrand = React.useCallback(async () => {
    if (!productBrandId || isSavingBrand) {
      return;
    }

    if (!isAuthenticated || !profileId) {
      navigation.navigate('MemberSignIn', {
        redirectTo: { kind: 'goBack' },
      });
      return;
    }

    setIsSavingBrand(true);
    try {
      const token = await getCanopyTroveAuthIdToken();
      const authOptions = {
        profileId,
        token: token ?? undefined,
      };
      if (isBrandSaved) {
        const ok = await removeFavoriteBrand(productBrandId, authOptions);
        if (ok) {
          setIsBrandSaved(false);
          trackAnalyticsEvent('scan_result_brand_unsaved', { brandId: productBrandId });
        }
      } else {
        const ok = await addFavoriteBrand(productBrandId, authOptions);
        if (ok) {
          setIsBrandSaved(true);
          trackAnalyticsEvent('scan_result_brand_saved', { brandId: productBrandId });
        }
      }
    } catch {
      // fail soft - UI stays in prior state
    } finally {
      setIsSavingBrand(false);
    }
  }, [isAuthenticated, isBrandSaved, isSavingBrand, navigation, productBrandId, profileId]);

  // When the user taps "View lab results" we hand them to the lab's own site
  // (legally clean — they're viewing the page themselves, not us). We flip
  // pendingCoaReturnRef on so the AppState listener below knows to surface the
  // review prompt when they come back.
  const handleOpenCoaUrl = React.useCallback(
    (coaUrl: string) => {
      if (installId) {
        void reportCoaOpened({
          installId,
          profileId,
          brandId: productBrandName || 'Unknown',
          labName: productLabName || 'Unknown',
          batchId: state.kind === 'product' ? state.result.coa?.batchId : undefined,
        });
      }
      trackAnalyticsEvent('scan_coa_view_tapped');
      if (hasReviewableProduct && !returnPromptDismissed) {
        pendingCoaReturnRef.current = true;
      }
      void Linking.openURL(coaUrl);
    },
    [
      hasReviewableProduct,
      installId,
      productBrandName,
      productLabName,
      profileId,
      returnPromptDismissed,
      state,
    ],
  );

  React.useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') {
        return;
      }
      if (!pendingCoaReturnRef.current) {
        return;
      }
      pendingCoaReturnRef.current = false;
      if (!hasReviewableProduct || returnPromptDismissed) {
        return;
      }
      setShowReturnPrompt(true);
    });
    return () => {
      subscription.remove();
    };
  }, [hasReviewableProduct, returnPromptDismissed]);

  React.useEffect(() => {
    if (!showReturnPrompt || promptAnalyticsFiredRef.current) {
      return;
    }
    promptAnalyticsFiredRef.current = true;
    trackAnalyticsEvent('scan_coa_return_review_prompt_shown', {
      brandId: productBrandName ?? null,
      productName: productProductName ?? null,
      isAuthenticated,
    });
  }, [isAuthenticated, productBrandName, productProductName, showReturnPrompt]);

  const handleReturnPromptRate = React.useCallback(() => {
    if (!productReviewComposerParams) {
      return;
    }
    trackAnalyticsEvent('scan_coa_return_review_prompt_tapped', {
      brandId: productReviewComposerParams.brandName,
      productName: productReviewComposerParams.productName,
      isAuthenticated,
    });
    setShowReturnPrompt(false);
    if (!isAuthenticated) {
      navigation.navigate('MemberSignIn', {
        redirectTo: {
          kind: 'navigate',
          screen: 'ProductReviewComposer',
          params: productReviewComposerParams,
        },
      });
      return;
    }
    navigation.push('ProductReviewComposer', productReviewComposerParams);
  }, [isAuthenticated, navigation, productReviewComposerParams]);

  const handleReturnPromptDismiss = React.useCallback(() => {
    trackAnalyticsEvent('scan_coa_return_review_prompt_dismissed', {
      brandId: productBrandName ?? null,
      productName: productProductName ?? null,
    });
    setShowReturnPrompt(false);
    setReturnPromptDismissed(true);
  }, [productBrandName, productProductName]);

  React.useEffect(() => {
    if (!installId) return; // wait for anon install ID before hitting backend

    async function resolveScan() {
      try {
        const result = await ingestScan({
          rawCode,
          installId,
          profileId,
          location: undefined, // optional — wired in a later pass
          nearStorefrontId: undefined,
        });

        // The ScanResultState discriminated union needs the same `kind` on
        // both sides of the pair, but the inferred return type widens across
        // variants — narrow with a switch so TS accepts each branch.
        if (result.kind === 'license') {
          setState({ kind: 'license', result });
        } else if (result.kind === 'product') {
          setState({ kind: 'product', result });
        } else {
          setState({ kind: 'unknown', result });
        }

        trackAnalyticsEvent('scan_resolved', { kind: result.kind });

        if (result.kind === 'unknown') {
          trackAnalyticsEvent('scan_unrecognized');
        }
      } catch {
        setState({
          kind: 'unknown',
          result: {
            kind: 'unknown',
            error: 'Failed to resolve scan',
          },
        });
      }
    }

    void resolveScan();
  }, [installId, profileId, rawCode]);

  return (
    <ScreenShell
      eyebrow="Scan result"
      title="Here's what we found"
      subtitle=""
      headerPill={undefined}
      resetScrollOnFocus={false}
    >
      {state.kind === 'loading' && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Checking…</Text>
        </View>
      )}

      {state.kind === 'license' && (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <MotionInView delay={90}>
            <View style={styles.stack}>
              {state.result.verificationState === 'unverified' ? (
                <InlineFeedbackPanel
                  tone="warning"
                  label="Couldn't confirm"
                  title="This looks like a license number, but we couldn't find it in the OCM registry."
                  body="It may be a typo, a very new license, or not a NY OCM dispensary. Double-check the number and try again, or use manual entry."
                  iconName="warning-outline"
                />
              ) : null}
              <LicensedBadge
                verification={{
                  licensed: state.result.verificationState !== 'unverified',
                  confidence: state.result.verificationState === 'unverified' ? 'none' : 'exact',
                  source: 'ocm_public_records',
                  licenseNumber: state.result.license?.licenseNumber,
                  licenseType: state.result.license?.licenseType,
                }}
                variant="full"
              />
              {state.result.storefrontId && (
                <SectionCard title="Where to find it" eyebrow="Store location" tone="primary">
                  <Pressable
                    onPress={() => {
                      navigation.navigate('StorefrontDetail', {
                        storefrontId: state.result.storefrontId,
                      });
                    }}
                    style={({ pressed }) => [styles.storeLink, pressed && styles.storeLinkPressed]}
                  >
                    <Text style={styles.storeLinkText}>View storefront</Text>
                    <AppUiIcon name="arrow-forward" size={14} color={colors.primary} />
                  </Pressable>
                </SectionCard>
              )}
              <InlineFeedbackPanel
                tone="info"
                label="About this check"
                title="Sourced from OCM public dispensary registry."
                body="Information is updated hourly. Contact the store directly for current availability."
                iconName="information-circle-outline"
              />
            </View>
          </MotionInView>
        </ScrollView>
      )}

      {state.kind === 'product' && (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <MotionInView delay={90}>
            <View style={styles.stack}>
              {showReturnPrompt && productBrandName && productProductName ? (
                <ReturnReviewPrompt
                  brandName={productBrandName}
                  productName={productProductName}
                  labName={productLabName}
                  isAuthenticated={isAuthenticated}
                  onRate={handleReturnPromptRate}
                  onDismiss={handleReturnPromptDismiss}
                />
              ) : null}
              {state.result.catalogState && state.result.catalogState !== 'verified' ? (
                <ContributePrompt
                  rawCode={rawCode}
                  catalogState={state.result.catalogState}
                  upc={state.result.coa?.upc}
                  coaUrl={state.result.coa?.coaUrl}
                />
              ) : null}
              {state.result.coa && (
                <>
                  <SectionCard
                    title={state.result.coa.productName || 'Product'}
                    eyebrow={state.result.coa.brandName || 'COA'}
                    body={state.result.coa.batchId ? `Batch: ${state.result.coa.batchId}` : ''}
                    tone="primary"
                  />

                  {state.result.coa.brandName ? (
                    <Pressable
                      onPress={handleToggleSaveBrand}
                      disabled={isSavingBrand}
                      accessibilityRole="button"
                      accessibilityLabel={
                        !isAuthenticated
                          ? `Sign in to save ${state.result.coa.brandName}`
                          : isBrandSaved
                            ? `Remove ${state.result.coa.brandName} from favorites`
                            : `Save ${state.result.coa.brandName} to favorites`
                      }
                      style={({ pressed }) => [
                        styles.saveBrandButton,
                        isAuthenticated && isBrandSaved && styles.saveBrandButtonSaved,
                        pressed && styles.saveBrandButtonPressed,
                        isSavingBrand && styles.saveBrandButtonDisabled,
                      ]}
                    >
                      <AppUiIcon
                        name={
                          !isAuthenticated
                            ? 'lock-closed-outline'
                            : isBrandSaved
                              ? 'bookmark'
                              : 'bookmark-outline'
                        }
                        size={18}
                        color={isAuthenticated && isBrandSaved ? colors.primary : colors.text}
                      />
                      <Text
                        style={[
                          styles.saveBrandButtonText,
                          isAuthenticated && isBrandSaved && styles.saveBrandButtonTextSaved,
                        ]}
                      >
                        {!isAuthenticated
                          ? `Sign in to save ${state.result.coa.brandName}`
                          : isBrandSaved
                            ? 'Saved to My Brands'
                            : `Save ${state.result.coa.brandName}`}
                      </Text>
                    </Pressable>
                  ) : null}

                  {(state.result.coa.thcPercent !== undefined ||
                    state.result.coa.cbdPercent !== undefined) && (
                    <SectionCard title="Potency" eyebrow="Lab tested" tone="primary">
                      <View style={styles.potencyGrid}>
                        {state.result.coa.thcPercent !== undefined && (
                          <View style={styles.potencyItem}>
                            <Text style={styles.potencyLabel}>THC</Text>
                            <Text style={styles.potencyValue}>
                              {state.result.coa.thcPercent.toFixed(1)}%
                            </Text>
                          </View>
                        )}
                        {state.result.coa.cbdPercent !== undefined && (
                          <View style={styles.potencyItem}>
                            <Text style={styles.potencyLabel}>CBD</Text>
                            <Text style={styles.potencyValue}>
                              {state.result.coa.cbdPercent.toFixed(1)}%
                            </Text>
                          </View>
                        )}
                      </View>
                    </SectionCard>
                  )}

                  {state.result.coa.contaminants && (
                    <SectionCard title="Test results" eyebrow="Safety" tone="primary">
                      <View style={styles.contaminantsList}>
                        {Object.entries(state.result.coa.contaminants).map(([name, status]) => (
                          <View key={name} style={styles.contaminantRow}>
                            <Text style={styles.contaminantName}>
                              {name
                                .replace(/([A-Z])/g, ' $1')
                                .charAt(0)
                                .toUpperCase() + name.replace(/([A-Z])/g, ' $1').slice(1)}
                            </Text>
                            <View
                              style={[
                                styles.contaminantPill,
                                status === 'pass'
                                  ? styles.contaminantPillPass
                                  : styles.contaminantPillFail,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.contaminantPillText,
                                  status === 'pass'
                                    ? styles.contaminantPillTextPass
                                    : styles.contaminantPillTextFail,
                                ]}
                              >
                                {status}
                              </Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    </SectionCard>
                  )}

                  {state.result.coa.terpenes && state.result.coa.terpenes.length > 0 && (
                    <SectionCard title="Terpenes" eyebrow="Flavor & aroma" tone="primary">
                      <View style={styles.terpenesList}>
                        {state.result.coa.terpenes.map((terpene) => (
                          <View key={terpene} style={styles.terpenePill}>
                            <Text style={styles.terpenePillText}>{terpene}</Text>
                          </View>
                        ))}
                      </View>
                    </SectionCard>
                  )}

                  {(state.result.coa.coaUrl || state.result.coa.brandWebsiteUrl) && (
                    <View style={styles.actionPanel}>
                      {state.result.coa.coaUrl && (
                        <Pressable
                          onPress={() => {
                            handleOpenCoaUrl(state.result.coa!.coaUrl!);
                          }}
                          style={({ pressed }) => [
                            styles.actionButtonPrimary,
                            pressed && styles.actionButtonPressed,
                          ]}
                          accessibilityRole="button"
                          accessibilityLabel="View lab results"
                        >
                          <AppUiIcon
                            name="document-text-outline"
                            size={14}
                            color={colors.background}
                          />
                          <Text style={styles.actionButtonPrimaryText}>View lab results</Text>
                        </Pressable>
                      )}
                      {state.result.coa.brandWebsiteUrl && (
                        <Pressable
                          onPress={() => {
                            trackAnalyticsEvent('scan_brand_site_tapped', {
                              brandId: state.result.coa?.brandName ?? null,
                            });
                            void Linking.openURL(state.result.coa!.brandWebsiteUrl!);
                          }}
                          style={({ pressed }) => [
                            styles.actionButtonSecondary,
                            pressed && styles.actionButtonPressed,
                          ]}
                          accessibilityRole="button"
                          accessibilityLabel="Visit brand site"
                        >
                          <AppUiIcon name="open-outline" size={14} color={colors.primary} />
                          <Text style={styles.actionButtonSecondaryText}>Visit brand site</Text>
                        </Pressable>
                      )}
                    </View>
                  )}
                  {state.result.coa.brandName && state.result.coa.productName ? (
                    <Pressable
                      onPress={() => {
                        if (!productReviewComposerParams) return;
                        if (!isAuthenticated) {
                          navigation.navigate('MemberSignIn', {
                            redirectTo: {
                              kind: 'navigate',
                              screen: 'ProductReviewComposer',
                              params: productReviewComposerParams,
                            },
                          });
                          return;
                        }
                        navigation.push('ProductReviewComposer', productReviewComposerParams);
                      }}
                      style={({ pressed }) => [styles.ratePill, pressed && styles.ratePillPressed]}
                      accessibilityRole="button"
                      accessibilityLabel={
                        isAuthenticated ? 'Rate this product' : 'Sign in to rate this product'
                      }
                    >
                      <AppUiIcon
                        name={isAuthenticated ? 'star' : 'lock-closed-outline'}
                        size={13}
                        color={colors.primary}
                      />
                      <Text style={styles.ratePillText}>
                        {isAuthenticated ? 'Rate this product' : 'Sign in to rate'}
                      </Text>
                    </Pressable>
                  ) : null}
                </>
              )}

              {state.result.suggestedShops && state.result.suggestedShops.length > 0 && (
                <SectionCard title="Where to find it" eyebrow="Nearby" tone="primary">
                  <View style={styles.shopsList}>
                    {state.result.suggestedShops.map((shop) => (
                      <Pressable
                        key={shop.storefrontId}
                        onPress={() => {
                          navigation.navigate('StorefrontDetail', {
                            storefrontId: shop.storefrontId,
                          });
                        }}
                        style={({ pressed }) => [
                          styles.shopItem,
                          pressed && styles.shopItemPressed,
                        ]}
                      >
                        <View>
                          <Text style={styles.shopName}>{shop.name}</Text>
                          {shop.distance !== undefined && (
                            <Text style={styles.shopDistance}>
                              {shop.distance.toFixed(1)} mi away
                            </Text>
                          )}
                        </View>
                        <AppUiIcon name="arrow-forward" size={14} color={colors.textSoft} />
                      </Pressable>
                    ))}
                  </View>
                </SectionCard>
              )}

              {(!state.result.suggestedShops || state.result.suggestedShops.length === 0) && (
                <InlineFeedbackPanel
                  tone="info"
                  label="No matches"
                  title="We don't have nearby stores for this product yet."
                  body="Check back later or browse other products."
                  iconName="information-circle-outline"
                />
              )}

              <InlineFeedbackPanel
                tone="info"
                label="Educational info"
                title="Lab-tested values are batch averages only."
                body="This information is for educational purposes and is not medical advice. Consult a healthcare provider for personalized guidance."
                iconName="information-circle-outline"
              />
            </View>
          </MotionInView>
        </ScrollView>
      )}

      {state.kind === 'unknown' && (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <MotionInView delay={90}>
            <View style={styles.stack}>
              <InlineFeedbackPanel
                tone="warning"
                label="Not recognized"
                title="That scan didn't match a barcode, QR code, or license we know."
                body="Try scanning again with the barcode or QR centered and well-lit, or tap 'Enter manually' to look it up by name."
                iconName="information-circle-outline"
              />
              <Pressable
                onPress={() => {
                  navigation.replace('ScanCamera', { mode });
                }}
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && styles.primaryButtonPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Scan again"
              >
                <Text style={styles.primaryButtonText}>Scan again</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  navigation.navigate('VerifyManualEntry');
                }}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  pressed && styles.secondaryButtonPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Enter information manually"
              >
                <Text style={styles.secondaryButtonText}>Enter manually</Text>
              </Pressable>
            </View>
          </MotionInView>
        </ScrollView>
      )}
    </ScreenShell>
  );
}

/**
 * Return-review prompt shown when the user comes back from the lab's COA
 * site. The user read the real lab data themselves — we just catch them at
 * the highest-context moment (they're holding the product, they just saw
 * the results) and ask if they want to rate it for other shoppers.
 */
function ReturnReviewPrompt({
  brandName,
  productName,
  labName,
  isAuthenticated,
  onRate,
  onDismiss,
}: {
  brandName: string;
  productName: string;
  labName?: string;
  isAuthenticated: boolean;
  onRate: () => void;
  onDismiss: () => void;
}) {
  const sourceLine = labName ? `Back from ${labName}?` : 'Back from the lab site?';
  const rateLabel = isAuthenticated ? 'Rate it' : 'Sign in to rate';
  return (
    <View style={styles.returnPromptCard}>
      <Text style={styles.returnPromptEyebrow}>{sourceLine}</Text>
      <Text style={styles.returnPromptTitle}>
        Rate {productName} by {brandName}?
      </Text>
      <Text style={styles.returnPromptBody}>
        Other shoppers will see your take the next time they scan this product.
      </Text>
      <View style={styles.returnPromptActions}>
        <Pressable
          onPress={onRate}
          style={({ pressed }) => [
            styles.returnPromptPrimary,
            pressed && styles.returnPromptPrimaryPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={
            isAuthenticated ? `Rate ${productName}` : `Sign in to rate ${productName}`
          }
        >
          <AppUiIcon
            name={isAuthenticated ? 'star' : 'lock-closed-outline'}
            size={14}
            color={colors.background}
          />
          <Text style={styles.returnPromptPrimaryText}>{rateLabel}</Text>
        </Pressable>
        <Pressable
          onPress={onDismiss}
          style={({ pressed }) => [
            styles.returnPromptSecondary,
            pressed && styles.returnPromptSecondaryPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Not now"
        >
          <Text style={styles.returnPromptSecondaryText}>Not now</Text>
        </Pressable>
      </View>
    </View>
  );
}

/**
 * Soft-prompt that appears when a scan resolved to a product we don't yet
 * have in our catalog. Offers a two-tap contribute flow so the catalog
 * grows organically — never blocks the user.
 */
function ContributePrompt({
  rawCode,
  catalogState,
  upc,
  coaUrl,
}: {
  rawCode: string;
  catalogState: 'uncatalogued' | 'unrecognized_lab';
  upc?: string;
  coaUrl?: string;
}) {
  const [brandName, setBrandName] = React.useState('');
  const [productName, setProductName] = React.useState('');
  const [submitStatus, setSubmitStatus] = React.useState<
    'idle' | 'submitting' | 'submitted' | 'error'
  >('idle');
  const [errorText, setErrorText] = React.useState<string | null>(null);
  const [installId, setInstallId] = React.useState<string>('');

  React.useEffect(() => {
    let cancelled = false;
    void ensureAnalyticsInstallId('').then((id) => {
      if (!cancelled) setInstallId(id);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const promptTitle =
    catalogState === 'uncatalogued'
      ? "We don't have this product yet."
      : "We don't recognize this lab yet.";

  const promptBody =
    catalogState === 'uncatalogued'
      ? 'Help us fill it in so the next person gets the full lab report. Takes about 10 seconds.'
      : 'If you know the brand and product, add them below — it takes about 10 seconds and helps the next scanner.';

  const handleSubmit = React.useCallback(async () => {
    const trimmedBrand = brandName.trim();
    const trimmedProduct = productName.trim();
    if (!trimmedBrand && !trimmedProduct) {
      return;
    }
    if (!installId) {
      setSubmitStatus('error');
      setErrorText('Still getting ready — try again in a moment.');
      return;
    }
    setSubmitStatus('submitting');
    setErrorText(null);
    try {
      const result = await submitProductContribution({
        rawCode,
        installId,
        brandName: trimmedBrand || undefined,
        productName: trimmedProduct || undefined,
        upc,
        coaUrl,
      });
      if (result.accepted) {
        setSubmitStatus('submitted');
        trackAnalyticsEvent('scan_contribution_submitted', {
          catalogState,
          hasBrand: Boolean(trimmedBrand),
          hasProduct: Boolean(trimmedProduct),
        });
      } else {
        setSubmitStatus('error');
        setErrorText(result.error ?? 'Could not submit right now.');
      }
    } catch (err) {
      setSubmitStatus('error');
      setErrorText(err instanceof Error ? err.message : 'Could not submit right now.');
    }
  }, [brandName, productName, rawCode, upc, coaUrl, catalogState, installId]);

  if (submitStatus === 'submitted') {
    return (
      <InlineFeedbackPanel
        tone="info"
        label="Thanks"
        title="Thanks — we'll look into it."
        body="Your submission helps make the next scan smarter. You still have your scan result below."
        iconName="checkmark-circle-outline"
      />
    );
  }

  return (
    <View style={styles.contributeCard}>
      <Text style={styles.contributeEyebrow}>Help us add this</Text>
      <Text style={styles.contributeTitle}>{promptTitle}</Text>
      <Text style={styles.contributeBody}>{promptBody}</Text>
      <TextInput
        value={brandName}
        onChangeText={setBrandName}
        placeholder="Brand (optional)"
        placeholderTextColor={colors.textSoft}
        style={styles.contributeInput}
        autoCapitalize="words"
        editable={submitStatus !== 'submitting'}
        returnKeyType="next"
      />
      <TextInput
        value={productName}
        onChangeText={setProductName}
        placeholder="Product name (optional)"
        placeholderTextColor={colors.textSoft}
        style={styles.contributeInput}
        autoCapitalize="words"
        editable={submitStatus !== 'submitting'}
        returnKeyType="done"
        onSubmitEditing={() => {
          void handleSubmit();
        }}
      />
      {errorText ? <Text style={styles.contributeErrorText}>{errorText}</Text> : null}
      <Pressable
        onPress={() => {
          void handleSubmit();
        }}
        disabled={submitStatus === 'submitting' || (!brandName.trim() && !productName.trim())}
        style={({ pressed }) => [
          styles.contributeButton,
          (submitStatus === 'submitting' || (!brandName.trim() && !productName.trim())) &&
            styles.contributeButtonDisabled,
          pressed && styles.contributeButtonPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Submit product info"
      >
        <Text style={styles.contributeButtonText}>
          {submitStatus === 'submitting' ? 'Sending…' : 'Send it'}
        </Text>
      </Pressable>
    </View>
  );
}

export const ScanResultScreen = withScreenErrorBoundary(
  ScanResultScreenInner,
  'scan-result-screen',
);

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xl,
  },
  loadingText: {
    ...textStyles.body,
    color: colors.textSoft,
  },
  scrollContent: {
    paddingVertical: spacing.lg,
  },
  stack: {
    gap: spacing.lg,
  },
  storeLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: 'rgba(0, 245, 140, 0.06)',
    borderRadius: radii.md,
  },
  storeLinkPressed: {
    opacity: 0.7,
  },
  storeLinkText: {
    ...textStyles.button,
    color: colors.primary,
  },
  potencyGrid: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  potencyItem: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    backgroundColor: 'rgba(0, 245, 140, 0.06)',
  },
  potencyLabel: {
    ...textStyles.caption,
    color: colors.textSoft,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  potencyValue: {
    ...textStyles.section,
    color: colors.text,
    fontWeight: '900',
  },
  contaminantsList: {
    gap: spacing.md,
  },
  contaminantRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  contaminantName: {
    ...textStyles.body,
    color: colors.text,
    flex: 1,
  },
  contaminantPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    minWidth: 60,
    alignItems: 'center',
  },
  contaminantPillPass: {
    backgroundColor: 'rgba(0, 245, 140, 0.15)',
  },
  contaminantPillFail: {
    backgroundColor: 'rgba(255, 68, 68, 0.15)',
  },
  contaminantPillText: {
    ...textStyles.labelCaps,
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: 'capitalize',
  },
  contaminantPillTextPass: {
    color: colors.primary,
  },
  contaminantPillTextFail: {
    color: '#FF4444',
  },
  terpenesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  terpenePill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(0, 245, 140, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(0, 245, 140, 0.20)',
  },
  terpenePillText: {
    ...textStyles.caption,
    color: colors.primary,
    fontWeight: '600',
  },
  saveBrandButton: {
    minHeight: 48,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(0, 245, 140, 0.30)',
    backgroundColor: 'rgba(0, 245, 140, 0.06)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  saveBrandButtonSaved: {
    backgroundColor: 'rgba(0, 245, 140, 0.14)',
    borderColor: 'rgba(0, 245, 140, 0.55)',
  },
  saveBrandButtonPressed: {
    opacity: 0.82,
  },
  saveBrandButtonDisabled: {
    opacity: 0.6,
  },
  saveBrandButtonText: {
    ...textStyles.button,
    color: colors.text,
  },
  saveBrandButtonTextSaved: {
    color: colors.primary,
    fontWeight: '800',
  },
  actionPanel: {
    gap: spacing.sm,
  },
  actionButtonPrimary: {
    minHeight: 48,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  actionButtonSecondary: {
    minHeight: 48,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(0, 245, 140, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0, 245, 140, 0.35)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  actionButtonPressed: {
    opacity: 0.85,
  },
  actionButtonPrimaryText: {
    ...textStyles.button,
    color: colors.background,
    fontWeight: '900',
  },
  actionButtonSecondaryText: {
    ...textStyles.button,
    color: colors.primary,
    fontWeight: '800',
  },
  ratePill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(0, 245, 140, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0, 245, 140, 0.28)',
    marginTop: spacing.sm,
  },
  ratePillPressed: {
    opacity: 0.8,
  },
  ratePillText: {
    ...textStyles.caption,
    color: colors.primary,
    fontWeight: '700',
  },
  shopsList: {
    gap: spacing.md,
  },
  shopItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    backgroundColor: 'rgba(196, 184, 176, 0.08)',
  },
  shopItemPressed: {
    opacity: 0.75,
  },
  shopName: {
    ...textStyles.body,
    color: colors.text,
    fontWeight: '600',
  },
  shopDistance: {
    ...textStyles.caption,
    color: colors.textSoft,
    marginTop: spacing.xs,
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  primaryButtonPressed: {
    opacity: 0.85,
  },
  primaryButtonText: {
    ...textStyles.button,
    color: colors.background,
    fontWeight: '900',
  },
  secondaryButton: {
    minHeight: 48,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceGlass,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  secondaryButtonPressed: {
    opacity: 0.75,
  },
  secondaryButtonText: {
    ...textStyles.button,
    color: colors.text,
    fontWeight: '700',
  },
  contributeCard: {
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: 'rgba(232, 160, 0, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(232, 160, 0, 0.28)',
  },
  contributeEyebrow: {
    ...textStyles.caption,
    color: colors.accent ?? colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '800',
  },
  contributeTitle: {
    ...textStyles.bodyStrong,
    color: colors.text,
  },
  contributeBody: {
    ...textStyles.body,
    color: colors.textMuted,
    lineHeight: 20,
  },
  contributeInput: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    color: colors.text,
    fontFamily: fontFamilies.body,
    fontSize: typography.body,
  },
  contributeErrorText: {
    ...textStyles.caption,
    color: colors.danger,
  },
  contributeButton: {
    minHeight: 44,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  contributeButtonDisabled: {
    opacity: 0.45,
  },
  contributeButtonPressed: {
    opacity: 0.85,
  },
  contributeButtonText: {
    ...textStyles.button,
    color: colors.background,
    fontWeight: '800',
  },
  returnPromptCard: {
    marginTop: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: 'rgba(46, 204, 113, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(46, 204, 113, 0.28)',
    gap: spacing.sm,
  },
  returnPromptEyebrow: {
    ...textStyles.caption,
    color: colors.primary,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  returnPromptTitle: {
    ...textStyles.bodyStrong,
    color: colors.text,
    fontWeight: '800',
  },
  returnPromptBody: {
    ...textStyles.caption,
    color: colors.textSoft,
    lineHeight: 18,
  },
  returnPromptActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  returnPromptPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: 40,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
  },
  returnPromptPrimaryPressed: {
    opacity: 0.88,
  },
  returnPromptPrimaryText: {
    ...textStyles.button,
    color: colors.background,
    fontWeight: '800',
  },
  returnPromptSecondary: {
    minHeight: 40,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: 'transparent',
  },
  returnPromptSecondaryPressed: {
    opacity: 0.7,
  },
  returnPromptSecondaryText: {
    ...textStyles.button,
    color: colors.textSoft,
    fontWeight: '700',
  },
});
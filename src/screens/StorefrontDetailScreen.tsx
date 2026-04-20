import React, { useEffect, useState } from 'react';
import { ScrollView } from 'react-native';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { CustomerStateCard } from '../components/CustomerStateCard';
import { LicensedBadge } from '../components/LicensedBadge';
import { PaymentMethodsBadge } from '../components/PaymentMethodsBadge';
import { MotionInView } from '../components/MotionInView';
import { supportsStorefrontPromotionUi } from '../config/playStorePolicy';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { resolveStorefrontSlug } from '../sources/apiStorefrontSource';
import { MapGridPreview } from '../components/MapGridPreview';
import { withScreenErrorBoundary } from '../components/withScreenErrorBoundary';
import { useStorefrontSummariesByIds } from '../hooks/useStorefrontSummaryData';
import { colors } from '../theme/tokens';
import { trackAnalyticsEvent } from '../services/analyticsService';
import type { StorefrontSummary } from '../types/storefront';
import { styles } from './storefrontDetail/storefrontDetailStyles';
import {
  DetailComplianceWarningSection,
  DetailHero,
  DetailHoursSection,
  DetailLockedLiveDealsSection,
  DetailLockedPhotosSection,
  DetailLiveDealsSection,
  DetailLiveUpdateUnavailableCard,
  DetailLoadingCard,
  DetailOfficialRecordCard,
  DetailOperationalSection,
  DetailPhotosSection,
  DetailPrimaryActions,
  DetailReviewsEmptyCard,
  DetailReviewsSection,
  DetailSecondaryActions,
  DetailStoreSummarySection,
  DetailTopBar,
} from './storefrontDetail/StorefrontDetailSections';
import { useStorefrontDetailScreenModel } from './storefrontDetail/useStorefrontDetailScreenModel';

type DetailRoute = RouteProp<RootStackParamList, 'StorefrontDetail'>;

/**
 * Validate that the storefront param is a real StorefrontSummary object,
 * not a string artifact from URL serialization (e.g. "[object Object]").
 * React Navigation serializes non-primitive route params to query strings
 * on web, which deserialize back as plain strings — causing crashes when
 * the code tries to access nested properties like .coordinates.latitude.
 */
function isValidStorefrontParam(value: unknown): value is StorefrontSummary {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as StorefrontSummary).id === 'string' &&
    typeof (value as StorefrontSummary).displayName === 'string'
  );
}

type StorefrontDetailContentProps = {
  navigation: NativeStackNavigationProp<RootStackParamList>;
  storefront: StorefrontSummary;
};

function StorefrontDetailContent({ navigation, storefront }: StorefrontDetailContentProps) {
  const model = useStorefrontDetailScreenModel(storefront, navigation);
  const canViewMemberLockedContent = model.authSession.status === 'authenticated';
  const visibleLiveDealCount = storefront.activePromotionCount ?? 0;
  const paymentMethods = model.detailData.paymentMethods ?? storefront.paymentMethods ?? null;
  const paymentMethodsKey = paymentMethods
    ? `${paymentMethods.storefrontId}:${paymentMethods.asOf}`
    : null;
  const lastTrackedPaymentsKeyRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!paymentMethods || !paymentMethodsKey) return;
    if (lastTrackedPaymentsKeyRef.current === paymentMethodsKey) return;
    lastTrackedPaymentsKeyRef.current = paymentMethodsKey;
    const acceptedCount = paymentMethods.methods.filter((record) => record.accepted).length;
    trackAnalyticsEvent(
      'payment_methods_section_viewed',
      {
        hasOwnerDeclaration: paymentMethods.hasOwnerDeclaration,
        acceptedCount,
      },
      { storefrontId: paymentMethods.storefrontId },
    );
  }, [paymentMethods, paymentMethodsKey]);

  return (
    <LinearGradient
      colors={[colors.background, colors.backgroundAlt, colors.background]}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <MotionInView delay={0} distance={12}>
            <DetailTopBar
              onBack={model.goBack}
              verifiedOwnerBadgeLabel={
                model.detailData.verifiedOwnerBadgeLabel ??
                (model.detailData.hasOwnerClaim ? 'Verified Owner' : null)
              }
            />
          </MotionInView>

          <MotionInView delay={70}>
            <MapGridPreview
              statusLabel={model.previewStatusLabel}
              statusTone={model.previewStatusTone}
              tone={model.previewTone}
              headline={storefront.addressLine1}
              supportingText={`${storefront.city}, ${storefront.state} ${storefront.zip}`}
              height={220}
              imageUrl={storefront.thumbnailUrl}
            />
          </MotionInView>

          <MotionInView delay={120}>
            <DetailHero
              storefront={{
                ...storefront,
                favoriteFollowerCount: model.detailData.favoriteFollowerCount,
                ownerFeaturedBadges: model.detailData.ownerFeaturedBadges,
                ownerCardSummary: storefront.ownerCardSummary,
              }}
              ratingDisplay={model.ratingDisplay}
            />
          </MotionInView>

          {(model.detailData.ocmVerification ?? storefront.ocmVerification)?.licensed ? (
            <MotionInView delay={140}>
              <LicensedBadge
                verification={model.detailData.ocmVerification ?? storefront.ocmVerification}
                variant="full"
              />
            </MotionInView>
          ) : null}

          {(model.detailData.paymentMethods ?? storefront.paymentMethods) ? (
            <MotionInView delay={150}>
              <PaymentMethodsBadge
                paymentMethods={
                  model.detailData.paymentMethods ?? storefront.paymentMethods ?? null
                }
                variant="detail"
              />
            </MotionInView>
          ) : null}

          {supportsStorefrontPromotionUi && model.detailData.activePromotions?.length ? (
            <MotionInView delay={120}>
              <DetailLiveDealsSection promotions={model.detailData.activePromotions} />
            </MotionInView>
          ) : supportsStorefrontPromotionUi &&
            !canViewMemberLockedContent &&
            visibleLiveDealCount > 0 ? (
            <MotionInView delay={120}>
              <DetailLockedLiveDealsSection
                liveDealCount={visibleLiveDealCount}
                onOpenMemberSignIn={() => navigation.navigate('CanopyTroveSignIn')}
                onOpenMemberSignUp={() => navigation.navigate('CanopyTroveSignUp')}
              />
            </MotionInView>
          ) : null}

          <MotionInView delay={180}>
            <DetailOperationalSection
              body={model.operationalCardBody}
              rows={model.operationalRows}
            />
          </MotionInView>

          <MotionInView delay={180}>
            <DetailPrimaryActions
              onGoNow={model.goNow}
              hasWebsite={model.hasWebsite}
              hasMenu={model.hasMenu}
              hasPhone={model.hasPhone}
              onOpenWebsite={model.openWebsite}
              onOpenMenu={model.openMenu}
              onCall={model.callStore}
            />
          </MotionInView>

          <MotionInView delay={220}>
            <DetailSecondaryActions
              storefront={storefront}
              isSaved={model.isSaved}
              onToggleSaved={model.toggleSavedStorefront}
              onWriteReview={model.writeReview}
              writeReviewLabel={model.writeReviewLabel}
              onSuggestEdit={model.suggestStorefrontEdit}
              onReportClosed={model.reportStorefrontClosed}
            />
          </MotionInView>

          {(model.isLoading || model.isOperationalDataPending) &&
          !model.hasAnySupplementalDetail ? (
            <MotionInView delay={320}>
              <DetailLoadingCard />
            </MotionInView>
          ) : null}

          {!model.isLoading &&
          !model.isOperationalDataPending &&
          !model.hasAnySupplementalDetail ? (
            <MotionInView delay={350}>
              <DetailOfficialRecordCard error={model.error} />
            </MotionInView>
          ) : null}

          {model.error && model.hasAnySupplementalDetail ? (
            <MotionInView delay={350}>
              <DetailLiveUpdateUnavailableCard />
            </MotionInView>
          ) : null}

          {model.hasStoreSummarySection ? (
            <MotionInView delay={350}>
              <DetailStoreSummarySection
                editorialSummary={model.editorialSummary}
                displayAmenities={model.displayAmenities}
              />
            </MotionInView>
          ) : null}

          {model.hasHours ? (
            <MotionInView delay={410}>
              <DetailHoursSection hours={model.detailData.hours} />
            </MotionInView>
          ) : null}

          {model.detailData.hasOwnerClaim ? (
            <MotionInView delay={440}>
              <DetailComplianceWarningSection storefrontId={storefront.id} />
            </MotionInView>
          ) : null}

          {model.hasAppReviews ? (
            <MotionInView delay={470}>
              <DetailReviewsSection
                appReviews={model.detailData.appReviews}
                hiddenReviewCount={model.hiddenReviewCount}
                pendingHelpfulReviewId={model.pendingHelpfulReviewId}
                pendingReviewReportId={model.pendingReviewReportId}
                reviewModerationStatusText={model.reviewModerationStatusText}
                onShowHiddenReviews={model.showHiddenReviews}
                onMarkHelpful={model.markReviewHelpful}
                onBlockAuthor={model.blockReviewAuthor}
                onReportReview={model.reportReview}
              />
            </MotionInView>
          ) : (
            <MotionInView delay={470}>
              <DetailReviewsEmptyCard />
            </MotionInView>
          )}

          {model.hasPhotos ? (
            <MotionInView delay={530}>
              <DetailPhotosSection
                photoUrls={model.detailData.photoUrls}
                storefrontId={storefront.id}
              />
            </MotionInView>
          ) : null}

          {!canViewMemberLockedContent && model.hasLockedPhotos ? (
            <MotionInView delay={530}>
              <DetailLockedPhotosSection
                photoCount={model.lockedPhotoCount}
                visiblePhotoCount={model.visiblePhotoCount}
                onOpenMemberSignIn={() => navigation.navigate('CanopyTroveSignIn')}
                onOpenMemberSignUp={() => navigation.navigate('CanopyTroveSignUp')}
              />
            </MotionInView>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

function StorefrontDetailScreenInner() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<DetailRoute>();
  const routeParams =
    (route.params as Partial<RootStackParamList['StorefrontDetail']> | undefined) ?? undefined;
  const storefrontFromRoute = isValidStorefrontParam(routeParams?.storefront)
    ? routeParams.storefront
    : null;
  const rawStorefrontId = routeParams?.storefrontId ?? storefrontFromRoute?.id ?? null;

  // Slug resolution: if the raw ID doesn't match a Firestore doc, try resolving it as a slug.
  const [resolvedSlug, setResolvedSlug] = useState<{ rawId: string; resolvedId: string } | null>(
    null,
  );
  const [resolvingSlugFor, setResolvingSlugFor] = useState<string | null>(null);
  const currentStorefrontIdRef = React.useRef<string | null>(null);
  const storefrontId =
    resolvedSlug?.rawId === rawStorefrontId ? resolvedSlug.resolvedId : rawStorefrontId;
  const isResolvingSlug = resolvingSlugFor === rawStorefrontId;

  const storefrontLookup = useStorefrontSummariesByIds(
    storefrontFromRoute || !storefrontId ? [] : [storefrontId],
  );

  // If direct lookup returned nothing and we haven't tried slug resolution yet, try it.
  const needsSlugResolution =
    !storefrontFromRoute &&
    rawStorefrontId &&
    resolvedSlug?.rawId !== rawStorefrontId &&
    !isResolvingSlug &&
    !storefrontLookup.isLoading &&
    storefrontLookup.data.length === 0;

  useEffect(() => {
    if (!needsSlugResolution || !rawStorefrontId) return;
    let alive = true;
    currentStorefrontIdRef.current = rawStorefrontId;
    setResolvingSlugFor(rawStorefrontId);
    resolveStorefrontSlug(rawStorefrontId)
      .then((id) => {
        if (!alive || currentStorefrontIdRef.current !== rawStorefrontId) return;
        if (id && id !== rawStorefrontId) {
          setResolvedSlug({
            rawId: rawStorefrontId,
            resolvedId: id,
          });
        }
      })
      .catch(() => {
        // Slug resolution is best-effort — if the network call fails, fall
        // back to the "Storefront unavailable" empty state rather than
        // stranding the screen in a perpetual resolving spinner.
      })
      .finally(() => {
        if (!alive) return;
        setResolvingSlugFor((current) => (current === rawStorefrontId ? null : current));
      });
    return () => {
      alive = false;
    };
  }, [needsSlugResolution, rawStorefrontId]);

  const storefront = storefrontFromRoute ?? storefrontLookup.data[0] ?? null;
  const isLinkHydrating =
    !storefrontFromRoute &&
    Boolean(storefrontId) &&
    (storefrontLookup.isLoading || isResolvingSlug) &&
    !storefront;
  const storefrontLookupError = storefrontLookup.error;

  if (isLinkHydrating) {
    return (
      <LinearGradient
        colors={[colors.background, colors.backgroundAlt, colors.background]}
        style={styles.gradient}
      >
        <SafeAreaView style={styles.safeArea}>
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <DetailLoadingCard />
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  if (!storefront) {
    return (
      <LinearGradient
        colors={[colors.background, colors.backgroundAlt, colors.background]}
        style={styles.gradient}
      >
        <SafeAreaView style={styles.safeArea}>
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <CustomerStateCard
              title="Storefront unavailable"
              body={
                storefrontId
                  ? (storefrontLookupError ??
                    'This storefront link is not working right now. It may be unavailable or no longer listed.')
                  : 'This storefront could not be opened from the current page. Head back to Browse and try again.'
              }
              iconName="compass-outline"
              tone="warm"
              eyebrow={storefrontId ? 'Deep link' : 'Navigation'}
              centered={true}
            />
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return <StorefrontDetailContent navigation={navigation} storefront={storefront} />;
}

export const StorefrontDetailScreen = withScreenErrorBoundary(
  StorefrontDetailScreenInner,
  'storefront-detail-screen',
);

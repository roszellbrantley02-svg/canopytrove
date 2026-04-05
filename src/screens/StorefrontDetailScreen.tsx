import React from 'react';
import { ScrollView } from 'react-native';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { CustomerStateCard } from '../components/CustomerStateCard';
import { MotionInView } from '../components/MotionInView';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { MapGridPreview } from '../components/MapGridPreview';
import { withScreenErrorBoundary } from '../components/withScreenErrorBoundary';
import { useStorefrontSummariesByIds } from '../hooks/useStorefrontSummaryData';
import { colors } from '../theme/tokens';
import type { StorefrontSummary } from '../types/storefront';
import { styles } from './storefrontDetail/storefrontDetailStyles';
import {
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

type StorefrontDetailContentProps = {
  navigation: NativeStackNavigationProp<RootStackParamList>;
  storefront: StorefrontSummary;
};

function StorefrontDetailContent({ navigation, storefront }: StorefrontDetailContentProps) {
  const model = useStorefrontDetailScreenModel(storefront, navigation);
  const canViewMemberLockedContent = model.authSession.status === 'authenticated';
  const visibleLiveDealCount = storefront.activePromotionCount ?? 0;

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

          {model.detailData.activePromotions?.length ? (
            <MotionInView delay={280}>
              <DetailLiveDealsSection promotions={model.detailData.activePromotions} />
            </MotionInView>
          ) : !canViewMemberLockedContent && visibleLiveDealCount > 0 ? (
            <MotionInView delay={280}>
              <DetailLockedLiveDealsSection
                liveDealCount={visibleLiveDealCount}
                onOpenMemberSignIn={() => navigation.navigate('CanopyTroveSignIn')}
                onOpenMemberSignUp={() => navigation.navigate('CanopyTroveSignUp')}
              />
            </MotionInView>
          ) : null}

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

          {model.hasAppReviews ? (
            <MotionInView delay={470}>
              <DetailReviewsSection
                appReviews={model.detailData.appReviews}
                hiddenReviewCount={model.hiddenReviewCount}
                pendingHelpfulReviewId={model.pendingHelpfulReviewId}
                pendingReviewReportId={model.pendingReviewReportId}
                profileId={model.profileId}
                reviewModerationStatusText={model.reviewModerationStatusText}
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
  const storefrontFromRoute = routeParams?.storefront ?? null;
  const storefrontId = routeParams?.storefrontId ?? storefrontFromRoute?.id ?? null;
  const storefrontLookup = useStorefrontSummariesByIds(
    storefrontFromRoute || !storefrontId ? [] : [storefrontId],
  );
  const storefront = storefrontFromRoute ?? storefrontLookup.data[0] ?? null;
  const isLinkHydrating =
    !storefrontFromRoute && Boolean(storefrontId) && storefrontLookup.isLoading && !storefront;
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
                    'This storefront link could not be resolved. It may be unavailable, unpublished, or no longer part of the current Canopy Trove listing set.')
                  : 'This storefront could not be opened because the navigation data was incomplete. Return to browse and try again.'
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

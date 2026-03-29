import React from 'react';
import { ScrollView } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MotionInView } from '../components/MotionInView';
import { RootStackParamList } from '../navigation/RootNavigator';
import { MapGridPreview } from '../components/MapGridPreview';
import { colors } from '../theme/tokens';
import { styles } from './storefrontDetail/storefrontDetailStyles';
import {
  DetailHero,
  DetailHoursSection,
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

export function StorefrontDetailScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<DetailRoute>();
  const { storefront } = route.params;
  const model = useStorefrontDetailScreenModel(storefront, navigation);

  return (
    <LinearGradient colors={[colors.background, colors.backgroundAlt, colors.background]} style={styles.gradient}>
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
            <DetailOperationalSection body={model.operationalCardBody} rows={model.operationalRows} />
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
              onReport={model.reportStorefront}
            />
          </MotionInView>

          {(model.isLoading || model.isOperationalDataPending) && !model.hasAnySupplementalDetail ? (
            <MotionInView delay={320}>
              <DetailLoadingCard />
            </MotionInView>
          ) : null}

          {!model.isLoading && !model.isOperationalDataPending && !model.hasAnySupplementalDetail ? (
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
                profileId={model.profileId}
                onMarkHelpful={model.markReviewHelpful}
                onBlockAuthor={model.blockReviewAuthor}
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
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

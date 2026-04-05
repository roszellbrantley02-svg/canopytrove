import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
// TODO: Replace with `import { Image } from 'expo-image'` after running `npx expo install expo-image`
import { Image } from 'react-native';
import { AppUiIcon } from '../../icons/AppUiIcon';
import { CustomerStateCard } from '../../components/CustomerStateCard';
import { SectionCard } from '../../components/SectionCard';
import { colors } from '../../theme/tokens';
import type { StorefrontDetails } from '../../types/storefront';
import { styles } from './storefrontDetailStyles';

export function DetailReviewsSection({
  appReviews,
  hiddenReviewCount,
  pendingHelpfulReviewId,
  pendingReviewReportId,
  profileId,
  reviewModerationStatusText,
  onMarkHelpful,
  onBlockAuthor,
  onReportReview,
}: {
  appReviews: StorefrontDetails['appReviews'];
  hiddenReviewCount: number;
  pendingHelpfulReviewId: string | null;
  pendingReviewReportId: string | null;
  profileId: string;
  reviewModerationStatusText: string | null;
  onMarkHelpful: (reviewId: string, reviewAuthorProfileId: string | null) => void;
  onBlockAuthor: (reviewAuthorProfileId: string | null) => void;
  onReportReview: (review: StorefrontDetails['appReviews'][number]) => void;
}) {
  return (
    <SectionCard
      title="Customer reviews"
      body="Verified customer reviews from Canopy Trove users. Report abusive content or hide an author on this device from Privacy and safety."
    >
      <View style={styles.reviewList}>
        <View style={[styles.infoNoticeCard, styles.infoNoticeCardCyan]}>
          <View style={styles.infoNoticeHeader}>
            <View style={styles.infoNoticeIconWrap}>
              <AppUiIcon name="shield-checkmark-outline" size={18} color={colors.cyan} />
            </View>
            <View style={styles.infoNoticeCopy}>
              <Text style={styles.infoNoticeTitle}>Moderation controls</Text>
              <Text style={styles.infoNoticeBody}>
                Report flags abusive review content for moderation. Hide only affects this device
                and can be managed later in Privacy and safety.
              </Text>
            </View>
          </View>
        </View>

        {reviewModerationStatusText ? (
          <View style={[styles.infoNoticeCard, styles.infoNoticeCardWarm]}>
            <View style={styles.infoNoticeHeader}>
              <View style={styles.infoNoticeIconWrap}>
                <AppUiIcon name="information-circle-outline" size={18} color={colors.goldSoft} />
              </View>
              <View style={styles.infoNoticeCopy}>
                <Text style={styles.infoNoticeTitle}>Review moderation status</Text>
                <Text style={styles.infoNoticeBody}>{reviewModerationStatusText}</Text>
              </View>
            </View>
          </View>
        ) : null}

        {hiddenReviewCount > 0 ? (
          <View style={[styles.infoNoticeCard, styles.infoNoticeCardWarm]}>
            <View style={styles.infoNoticeHeader}>
              <View style={styles.infoNoticeIconWrap}>
                <AppUiIcon name="eye-off-outline" size={18} color={colors.goldSoft} />
              </View>
              <View style={styles.infoNoticeCopy}>
                <Text style={styles.infoNoticeTitle}>Hidden authors</Text>
                <Text style={styles.infoNoticeBody}>
                  {`${hiddenReviewCount} review${hiddenReviewCount === 1 ? '' : 's'} hidden from blocked authors. Manage your block list in Privacy and safety.`}
                </Text>
              </View>
            </View>
          </View>
        ) : null}

        {appReviews.map((review) => (
          <View key={review.id} style={styles.reviewCard}>
            <View style={styles.reviewHeader}>
              <View style={styles.reviewHeaderMain}>
                <Text style={styles.reviewAuthor}>{review.authorName}</Text>
                <Text style={styles.reviewMeta}>{review.relativeTime}</Text>
              </View>
              <View style={styles.reviewRatingPill}>
                <AppUiIcon name="star" size={12} color={colors.gold} />
                <Text style={styles.reviewRatingText}>{review.rating.toFixed(1)}</Text>
              </View>
            </View>

            {review.tags.length ? (
              <View style={styles.reviewTagRow}>
                {review.tags.map((tag) => (
                  <View key={tag} style={styles.reviewTag}>
                    <Text style={styles.reviewTagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            <Text style={styles.reviewText}>{review.text}</Text>

            {review.gifUrl ? (
              <Image source={{ uri: review.gifUrl }} style={styles.reviewGif} />
            ) : null}

            {review.photoUrls?.length ? (
              <ScrollView
                horizontal
                contentContainerStyle={styles.reviewPhotoRow}
                showsHorizontalScrollIndicator={false}
              >
                {review.photoUrls.map((photoUrl, index) => (
                  <Image
                    key={`${review.id}-review-photo-${index}`}
                    source={{ uri: photoUrl }}
                    style={styles.reviewPhotoCard}
                  />
                ))}
              </ScrollView>
            ) : null}

            {review.ownerReply?.text ? (
              <View style={styles.reviewOwnerReplyCard}>
                <Text style={styles.reviewOwnerReplyLabel}>Owner response</Text>
                <Text style={styles.reviewOwnerReplyMeta}>
                  {(review.ownerReply.ownerDisplayName ?? 'Canopy Trove owner') +
                    ' | ' +
                    new Date(review.ownerReply.respondedAt).toLocaleDateString()}
                </Text>
                <Text style={styles.reviewOwnerReplyText}>{review.ownerReply.text}</Text>
              </View>
            ) : null}

            <View style={styles.reviewDivider} />

            <View style={styles.reviewActionRow}>
              <View style={styles.reviewActionMeta}>
                <AppUiIcon name="thumbs-up-outline" size={12} color={colors.cyan} />
                <Text style={styles.reviewActionMetaText}>{review.helpfulCount} helpful</Text>
              </View>
              <View style={styles.reviewActionButtons}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    review.authorProfileId === profileId
                      ? 'Your own review cannot be marked helpful'
                      : `Mark review by ${review.authorName} as helpful`
                  }
                  accessibilityHint="Adds your helpful vote to this review."
                  disabled={
                    pendingHelpfulReviewId === review.id || review.authorProfileId === profileId
                  }
                  onPress={() => {
                    onMarkHelpful(review.id, review.authorProfileId);
                  }}
                  style={[
                    styles.reviewHelpfulButton,
                    (pendingHelpfulReviewId === review.id ||
                      review.authorProfileId === profileId) &&
                      styles.reviewHelpfulButtonDisabled,
                  ]}
                >
                  {pendingHelpfulReviewId === review.id ? (
                    <ActivityIndicator size="small" color={colors.background} />
                  ) : (
                    <>
                      <AppUiIcon name="thumbs-up-outline" size={14} color={colors.background} />
                      <Text style={styles.reviewHelpfulButtonText}>
                        {review.authorProfileId === profileId ? 'Your review' : 'Mark helpful'}
                      </Text>
                    </>
                  )}
                </Pressable>
                {review.authorProfileId && review.authorProfileId !== profileId ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Report review by ${review.authorName}`}
                    accessibilityHint="Flags this review for moderation."
                    disabled={pendingReviewReportId === review.id}
                    onPress={() => {
                      onReportReview(review);
                    }}
                    style={[
                      styles.reviewReportButton,
                      pendingReviewReportId === review.id && styles.reviewHelpfulButtonDisabled,
                    ]}
                  >
                    <Text style={styles.reviewReportButtonText}>
                      {pendingReviewReportId === review.id ? 'Reporting...' : 'Report'}
                    </Text>
                  </Pressable>
                ) : null}
                {review.authorProfileId && review.authorProfileId !== profileId ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Block reviews from ${review.authorName}`}
                    accessibilityHint="Hides future reviews from this author on this device."
                    onPress={() => {
                      onBlockAuthor(review.authorProfileId);
                    }}
                    style={styles.reviewBlockButton}
                  >
                    <Text style={styles.reviewBlockButtonText}>Block</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          </View>
        ))}
      </View>
    </SectionCard>
  );
}

export function DetailReviewsEmptyCard() {
  return (
    <SectionCard
      title="Customer reviews"
      body="No customer reviews are available yet. The first review becomes the initial trust signal for this storefront."
    >
      <CustomerStateCard
        title="No reviews yet"
        body="This storefront is still waiting for its first customer review. A clear first post helps the next visitor judge the storefront more confidently."
        tone="warm"
        iconName="chatbubble-ellipses-outline"
        eyebrow="Review state"
        note="If your visit was recent, a clear first review helps set the baseline for later visitors."
      />
    </SectionCard>
  );
}

export function DetailPhotosSection({
  photoUrls,
  storefrontId,
}: {
  photoUrls: string[];
  storefrontId: string;
}) {
  return (
    <SectionCard
      title="Photos"
      body="Photos stay on the detail screen so they do not crowd the listing view."
    >
      <ScrollView
        horizontal
        contentContainerStyle={styles.photoRow}
        showsHorizontalScrollIndicator={false}
      >
        {photoUrls.map((photoUrl, index) => (
          <Image
            key={`${storefrontId}-photo-${index}`}
            source={{ uri: photoUrl }}
            style={styles.photoCard}
          />
        ))}
      </ScrollView>
    </SectionCard>
  );
}

export function DetailLockedPhotosSection({
  photoCount,
  visiblePhotoCount,
  onOpenMemberSignIn,
  onOpenMemberSignUp,
}: {
  photoCount: number;
  visiblePhotoCount: number;
  onOpenMemberSignIn: () => void;
  onOpenMemberSignUp: () => void;
}) {
  const body =
    visiblePhotoCount > 0
      ? photoCount === 1
        ? `You are previewing ${visiblePhotoCount} storefront photo${visiblePhotoCount === 1 ? '' : 's'}. Sign in to unlock one more photo.`
        : `You are previewing ${visiblePhotoCount} storefront photo${visiblePhotoCount === 1 ? '' : 's'}. Sign in to unlock ${photoCount} more photos.`
      : photoCount === 1
        ? 'This storefront has a photo available, but photo viewing is reserved for members.'
        : `${photoCount} storefront photos are available, but photo viewing is reserved for members.`;

  return (
    <SectionCard title="Photos" body={body}>
      <CustomerStateCard
        title={
          visiblePhotoCount > 0
            ? photoCount === 1
              ? 'One more photo is locked.'
              : `${photoCount} more photos are locked.`
            : photoCount === 1
              ? 'One photo is locked.'
              : `${photoCount} photos are locked.`
        }
        body="Create an account or sign in to unlock the full storefront gallery and other member-only media."
        tone="warm"
        iconName="images-outline"
        eyebrow="Members only"
        note="Guest browsing stays open, and preview photos are visible when available. Full gallery access is limited to members."
      >
        <View style={styles.ctaRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sign in to unlock storefront photos"
            onPress={onOpenMemberSignIn}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>Sign In</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Create an account to unlock storefront photos"
            onPress={onOpenMemberSignUp}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>Create Account</Text>
          </Pressable>
        </View>
      </CustomerStateCard>
    </SectionCard>
  );
}

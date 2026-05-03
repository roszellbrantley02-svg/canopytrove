import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { AppUiIcon } from '../../icons/AppUiIcon';
import { CustomerStateCard } from '../../components/CustomerStateCard';
import { SectionCard } from '../../components/SectionCard';
import { colors } from '../../theme/tokens';
import type { StorefrontDetails } from '../../types/storefront';
import { getSafePublicDisplayName } from '../../utils/publicIdentity';
import { styles } from './storefrontDetailStyles';

export function DetailReviewsSection({
  appReviews,
  hiddenReviewCount,
  pendingHelpfulReviewId,
  pendingReviewReportId,
  reviewModerationStatusText,
  markedHelpfulReviewIds,
  onShowHiddenReviews,
  onMarkHelpful,
  onBlockAuthor,
  onReportReview,
}: {
  appReviews: StorefrontDetails['appReviews'];
  hiddenReviewCount: number;
  pendingHelpfulReviewId: string | null;
  pendingReviewReportId: string | null;
  reviewModerationStatusText: string | null;
  /**
   * Set of review IDs the current user has marked helpful in this session.
   * Drives the optimistic "Helpful ✓" button state + count bump so the user
   * sees instant feedback without waiting for the API round-trip + cache
   * invalidation. Cache eventually catches up via primeStorefrontDetails.
   */
  markedHelpfulReviewIds: Set<string>;
  onShowHiddenReviews: () => void;
  onMarkHelpful: (reviewId: string, isOwnReview?: boolean) => void;
  onBlockAuthor: (reviewAuthorProfileId: string | null) => void;
  onReportReview: (review: StorefrontDetails['appReviews'][number]) => void;
}) {
  return (
    <SectionCard
      title="Customer reviews"
      body="Reviews from Canopy Trove customers. You can report abusive content or hide an author's reviews on this storefront from Privacy and safety."
    >
      <View style={styles.reviewList}>
        <View style={[styles.infoNoticeCard, styles.infoNoticeCardCyan]}>
          <View style={styles.infoNoticeHeader}>
            <View style={styles.infoNoticeIconWrap}>
              <AppUiIcon name="shield-checkmark-outline" size={18} color={colors.cyan} />
            </View>
            <View style={styles.infoNoticeCopy}>
              <Text style={styles.infoNoticeTitle}>Report or hide reviews</Text>
              <Text style={styles.infoNoticeBody}>
                Report sends a review to our team. Hide affects this storefront for your account and
                can be managed later in Privacy and safety.
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
                <Text style={styles.infoNoticeTitle}>Review update</Text>
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
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Show hidden reviews for this storefront"
              accessibilityHint="Unblocks hidden review authors for this storefront so their reviews are visible again."
              onPress={onShowHiddenReviews}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>Show Hidden Reviews</Text>
            </Pressable>
          </View>
        ) : null}

        {hiddenReviewCount > 0 && appReviews.length === 0 ? (
          <CustomerStateCard
            title="Reviews are hidden by your safety settings"
            body="This storefront still has customer reviews, but they are hidden on this account because the reviewer is blocked."
            tone="warm"
            iconName="eye-off-outline"
            eyebrow="Hidden reviews"
            note="Use Show Hidden Reviews to restore them on this storefront."
          />
        ) : null}

        {appReviews.map((review) => {
          const reviewAuthorName = getSafePublicDisplayName(
            review.authorName,
            'Canopy Trove member',
          );

          return (
            <View key={review.id} style={styles.reviewCard}>
              <View style={styles.reviewHeader}>
                <View style={styles.reviewHeaderMain}>
                  <Text style={styles.reviewAuthor}>{reviewAuthorName}</Text>
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
                <Image
                  source={{ uri: review.gifUrl }}
                  style={styles.reviewGif}
                  accessibilityLabel="Reaction GIF from review"
                  cachePolicy="disk"
                  transition={200}
                />
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
                      accessibilityLabel={`Review photo ${index + 1}`}
                      cachePolicy="disk"
                      transition={200}
                      recyclingKey={photoUrl}
                    />
                  ))}
                </ScrollView>
              ) : null}

              {review.ownerReply?.text ? (
                <View style={styles.reviewOwnerReplyCard}>
                  <Text style={styles.reviewOwnerReplyLabel}>Owner response</Text>
                  <Text style={styles.reviewOwnerReplyMeta}>
                    {(review.ownerReply.ownerDisplayName ?? 'Store owner') +
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
                  <Text style={styles.reviewActionMetaText}>
                    {/*
                     * Optimistic count: bump by 1 if the user marked it
                     * helpful in this session AND the server hasn't yet
                     * reflected the increment in helpfulCount. Math.max
                     * handles the in-between window where the cache has
                     * already updated (count already includes the +1) and
                     * we don't want to double-count.
                     */}
                    {Math.max(
                      review.helpfulCount,
                      markedHelpfulReviewIds.has(review.id)
                        ? review.helpfulCount + 1
                        : review.helpfulCount,
                    )}{' '}
                    helpful
                  </Text>
                </View>
                <View style={styles.reviewActionButtons}>
                  {(() => {
                    const hasMarked = markedHelpfulReviewIds.has(review.id);
                    const isPending = pendingHelpfulReviewId === review.id;
                    const isDisabled = isPending || review.isOwnReview || hasMarked;
                    const buttonLabel = review.isOwnReview
                      ? 'Your review'
                      : hasMarked
                        ? 'Helpful ✓'
                        : 'Mark helpful';
                    return (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={
                          review.isOwnReview
                            ? 'Your own review cannot be marked helpful'
                            : hasMarked
                              ? `You marked review by ${reviewAuthorName} as helpful`
                              : `Mark review by ${reviewAuthorName} as helpful`
                        }
                        accessibilityHint={
                          hasMarked
                            ? 'You have already marked this review as helpful.'
                            : 'Adds your helpful vote to this review.'
                        }
                        accessibilityState={{ disabled: isDisabled, selected: hasMarked }}
                        disabled={isDisabled}
                        onPress={() => {
                          onMarkHelpful(review.id, review.isOwnReview);
                        }}
                        style={[
                          styles.reviewHelpfulButton,
                          isDisabled && styles.reviewHelpfulButtonDisabled,
                        ]}
                      >
                        {isPending ? (
                          <ActivityIndicator size="small" color={colors.background} />
                        ) : (
                          <>
                            <AppUiIcon
                              name="thumbs-up-outline"
                              size={14}
                              color={colors.background}
                            />
                            <Text style={styles.reviewHelpfulButtonText}>{buttonLabel}</Text>
                          </>
                        )}
                      </Pressable>
                    );
                  })()}
                  {review.authorProfileId && !review.isOwnReview ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Report review by ${reviewAuthorName}`}
                      accessibilityHint="Sends this review to our team for review."
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
                  {review.authorProfileId && !review.isOwnReview ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Block reviews from ${reviewAuthorName}`}
                      accessibilityHint="Hides future reviews from this author on this storefront for your account."
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
          );
        })}
      </View>
    </SectionCard>
  );
}

export function DetailReviewsEmptyCard() {
  return (
    <SectionCard title="Customer reviews" body="No customer reviews are available yet.">
      <CustomerStateCard
        title="No reviews yet"
        body="This storefront is still waiting for its first customer review."
        tone="warm"
        iconName="chatbubble-ellipses-outline"
        eyebrow="Reviews"
        note="If you have been here recently, your review can help the next customer know what to expect."
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
      body="Photos are shown here so the main listing stays easy to scan."
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
            accessibilityLabel={`Storefront photo ${index + 1}`}
            cachePolicy="disk"
            transition={200}
            recyclingKey={photoUrl}
            priority={index === 0 ? 'high' : 'low'}
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

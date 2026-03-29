import React from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CustomerStateCard } from '../../components/CustomerStateCard';
import { SectionCard } from '../../components/SectionCard';
import { colors } from '../../theme/tokens';
import { StorefrontDetails } from '../../types/storefront';
import { styles } from './storefrontDetailStyles';

export function DetailReviewsSection({
  appReviews,
  hiddenReviewCount,
  pendingHelpfulReviewId,
  profileId,
  onMarkHelpful,
  onBlockAuthor,
}: {
  appReviews: StorefrontDetails['appReviews'];
  hiddenReviewCount: number;
  pendingHelpfulReviewId: string | null;
  profileId: string;
  onMarkHelpful: (reviewId: string, reviewAuthorProfileId: string | null) => void;
  onBlockAuthor: (reviewAuthorProfileId: string | null) => void;
}) {
  return (
    <SectionCard title="App Reviews" body="Community reviews from Canopy Trove users.">
      <View style={styles.reviewList}>
        {hiddenReviewCount > 0 ? (
          <View style={[styles.infoNoticeCard, styles.infoNoticeCardWarm]}>
            <View style={styles.infoNoticeHeader}>
              <View style={styles.infoNoticeIconWrap}>
                <Ionicons name="eye-off-outline" size={18} color={colors.goldSoft} />
              </View>
              <View style={styles.infoNoticeCopy}>
                <Text style={styles.infoNoticeTitle}>Blocked-author reviews hidden</Text>
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
                <Ionicons name="star" size={12} color={colors.gold} />
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

            {review.ownerReply?.text ? (
              <View style={styles.reviewOwnerReplyCard}>
                <Text style={styles.reviewOwnerReplyLabel}>Owner Reply</Text>
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
                <Ionicons name="thumbs-up-outline" size={12} color={colors.cyan} />
                <Text style={styles.reviewActionMetaText}>{review.helpfulCount} helpful</Text>
              </View>
              <View style={styles.reviewActionButtons}>
                <Pressable
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
                      <Ionicons name="thumbs-up-outline" size={14} color={colors.background} />
                      <Text style={styles.reviewHelpfulButtonText}>
                        {review.authorProfileId === profileId ? 'Your review' : 'Helpful'}
                      </Text>
                    </>
                  )}
                </Pressable>
                {review.authorProfileId && review.authorProfileId !== profileId ? (
                  <Pressable
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
      title="Canopy Trove reviews"
      body="No one has reviewed this storefront in Canopy Trove yet. The first review helps set the quality signal for everyone else."
    >
      <CustomerStateCard
        title="No reviews yet"
        body="This storefront is still waiting for its first community review. A thoughtful first post becomes the initial quality signal for future customers."
        tone="warm"
        iconName="chatbubble-ellipses-outline"
        eyebrow="Community state"
        note="If your visit was recent, a clear first review will set the tone for the next customer who lands here."
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
    <SectionCard title="Photos" body="Photos stay reserved for the detail screen in Canopy Trove.">
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

import React from 'react';
import { Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { CustomerStateCard } from '../../components/CustomerStateCard';
import { HapticPressable } from '../../components/HapticPressable';
import { MotionInView } from '../../components/MotionInView';
import { SectionCard } from '../../components/SectionCard';
import { AppUiIcon } from '../../icons/AppUiIcon';
import { colors } from '../../theme/tokens';
import { styles } from './writeReviewStyles';
import type { useWriteReviewScreenModel } from './useWriteReviewScreenModel';

type WriteReviewScreenModel = ReturnType<typeof useWriteReviewScreenModel>;

export function getRatingSummary(rating: number) {
  if (rating >= 5) {
    return 'Strong recommend';
  }

  if (rating >= 4) {
    return 'Positive visit';
  }

  if (rating >= 3) {
    return 'Mixed experience';
  }

  if (rating >= 2) {
    return 'Needs work';
  }

  return 'Very weak visit';
}

export function WriteReviewSnapshotSection({ model }: { model: WriteReviewScreenModel }) {
  const visiblePhotoCount = model.isEditingReview
    ? model.existingReviewPhotoUrls.length
    : model.reviewPhotos.length;

  return (
    <MotionInView delay={80}>
      <SectionCard
        title="Review overview"
        body={
          model.isEditingReview
            ? 'Give everything one last look before saving changes to your review.'
            : 'Give everything one last look before posting your review.'
        }
      >
        <View style={styles.summaryStrip}>
          <View style={styles.summaryTile}>
            <Text style={styles.summaryTileValue}>{model.rating}/5</Text>
            <Text style={styles.summaryTileLabel}>Rating</Text>
            <Text style={styles.summaryTileBody}>{getRatingSummary(model.rating)}</Text>
          </View>
          <View style={styles.summaryTile}>
            <Text style={styles.summaryTileValue}>{model.textLength}</Text>
            <Text style={styles.summaryTileLabel}>Characters</Text>
            <Text style={styles.summaryTileBody}>
              Enough detail helps the review read as more useful and credible.
            </Text>
          </View>
          <View style={styles.summaryTile}>
            <Text style={styles.summaryTileValue}>
              {model.hasAcceptedGuidelines ? 'Ready' : 'Pending'}
            </Text>
            <Text style={styles.summaryTileLabel}>Guidelines</Text>
            <Text style={styles.summaryTileBody}>
              Accept the community guidelines before you submit.
            </Text>
          </View>
          <View style={styles.summaryTile}>
            <Text style={styles.summaryTileValue}>{visiblePhotoCount}</Text>
            <Text style={styles.summaryTileLabel}>Photos</Text>
            <Text style={styles.summaryTileBody}>
              {model.isEditingReview
                ? visiblePhotoCount > 0
                  ? `${visiblePhotoCount} approved photo${visiblePhotoCount === 1 ? '' : 's'} stay attached while you edit text, tags, and rating.`
                  : 'No approved photos are attached to this review.'
                : model.reviewPhotos.length > 0
                  ? `${model.approvedReviewPhotoCount} approved now, ${model.pendingManualReviewPhotoCount} still being checked.`
                  : `You can attach up to ${model.reviewPhotoLimit} review photos.`}
            </Text>
          </View>
        </View>
      </SectionCard>
    </MotionInView>
  );
}

export function WriteReviewRatingSection({ model }: { model: WriteReviewScreenModel }) {
  return (
    <MotionInView delay={120}>
      <SectionCard
        title="Rating"
        body="Start with your rating so people can quickly understand how the visit felt."
      >
        <View style={styles.ratingRow}>
          {[1, 2, 3, 4, 5].map((value) => (
            <HapticPressable
              key={value}
              accessibilityRole="button"
              accessibilityLabel={`Set ${value} star rating`}
              accessibilityHint="Updates the storefront rating for this review."
              accessibilityState={model.rating === value ? { selected: true } : {}}
              hapticType="selection"
              onPress={() => model.setRating(value)}
              style={[styles.ratingButton, model.rating === value && styles.ratingButtonActive]}
            >
              <AppUiIcon
                name={model.rating >= value ? 'star' : 'star-outline'}
                size={22}
                color={model.rating >= value ? colors.warning : colors.textMuted}
              />
            </HapticPressable>
          ))}
        </View>
        <Text style={styles.helperText}>{getRatingSummary(model.rating)}</Text>
      </SectionCard>
    </MotionInView>
  );
}

export function WriteReviewBodySection({ model }: { model: WriteReviewScreenModel }) {
  return (
    <MotionInView delay={180}>
      <SectionCard
        title="Review"
        body={
          model.isEditingReview
            ? `Keep at least ${model.minimumReviewTextLength} characters. Updating the rating, text, tags, or GIF saves changes to this review.`
            : `Write at least ${model.minimumReviewTextLength} characters. More detail makes the review more useful and easier to trust.`
        }
      >
        <TextInput
          accessibilityLabel="Review text"
          accessibilityHint={`Describe your storefront visit in at least ${model.minimumReviewTextLength} characters.`}
          multiline
          value={model.text}
          onChangeText={model.setText}
          placeholder="What stood out about the storefront?"
          placeholderTextColor={colors.textSoft}
          style={styles.input}
          textAlignVertical="top"
        />
        <Text style={styles.caption}>{model.textLength} characters</Text>
        <Text style={model.validationError ? styles.validationText : styles.helperText}>
          {model.validationError ??
            'Specific details about service, wait time, pricing, or atmosphere help other customers most.'}
        </Text>
        <View style={styles.emojiRow}>
          {model.REVIEW_EMOJIS.map((emoji) => (
            <HapticPressable
              key={emoji}
              accessibilityRole="button"
              accessibilityLabel={`Insert ${emoji} emoji`}
              accessibilityHint="Adds this emoji to the review text."
              hapticType="selection"
              onPress={() => model.insertEmoji(emoji)}
              style={styles.emojiChip}
            >
              <Text style={styles.emojiChipText}>{emoji}</Text>
            </HapticPressable>
          ))}
        </View>
      </SectionCard>
    </MotionInView>
  );
}

export function WriteReviewPhotosSection({ model }: { model: WriteReviewScreenModel }) {
  return (
    <MotionInView delay={220}>
      <SectionCard
        title="Photos"
        body={
          model.isEditingReview
            ? 'Your current photos stay attached. You can edit the words and rating here, but not swap photos yet.'
            : 'Add up to four photos. They stay private until they are approved.'
        }
      >
        {model.isEditingReview ? (
          <>
            <CustomerStateCard
              title="Photos cannot be changed here yet"
              body="You can update the rating, text, tags, and GIF without making a second review. Existing approved photos stay attached as they are."
              tone="info"
              iconName="camera-outline"
              eyebrow="Edit mode"
              note="If you want to replace photos later, that should be its own simple flow."
            />
            {model.existingReviewPhotoUrls.length ? (
              <View style={styles.reviewPhotoGrid}>
                {model.existingReviewPhotoUrls.map((photoUrl, index) => (
                  <View key={`${photoUrl}-${index}`} style={styles.reviewPhotoTile}>
                    <Image
                      source={{ uri: photoUrl }}
                      style={styles.reviewPhotoImage}
                      accessibilityLabel={`Review photo ${index + 1}`}
                    />
                    <View style={styles.reviewPhotoTileOverlay}>
                      <Text style={styles.reviewPhotoStatusText}>Attached</Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}
          </>
        ) : model.canAttachReviewPhotos ? (
          <>
            <View style={styles.gifPickerActions}>
              <HapticPressable
                accessibilityRole="button"
                accessibilityLabel="Take a review photo"
                accessibilityHint="Opens the camera to attach a review photo."
                hapticType="selection"
                onPress={model.takeReviewPhoto}
                style={styles.gifPickerButton}
              >
                <AppUiIcon name="camera-outline" size={16} color={colors.background} />
                <Text style={styles.gifPickerButtonText}>Take Photo</Text>
              </HapticPressable>
              <HapticPressable
                accessibilityRole="button"
                accessibilityLabel="Choose review photos from library"
                accessibilityHint="Opens the photo library to attach review photos."
                hapticType="selection"
                onPress={model.pickReviewPhotosFromLibrary}
                style={styles.gifPickerClearButton}
              >
                <AppUiIcon name="images-outline" size={16} color={colors.text} />
                <Text style={styles.gifPickerClearButtonText}>Choose Library</Text>
              </HapticPressable>
              {model.reviewPhotos.length ? (
                <HapticPressable
                  accessibilityRole="button"
                  accessibilityLabel="Clear all review photos"
                  accessibilityHint="Removes all staged review photos from this draft."
                  hapticType="selection"
                  onPress={model.clearReviewPhotos}
                  disabled={model.isUploadingReviewPhotos}
                  style={styles.gifPickerClearButton}
                >
                  <Text style={styles.gifPickerClearButtonText}>Clear All</Text>
                </HapticPressable>
              ) : null}
            </View>
            <Text style={styles.helperText}>{model.reviewPhotoSummaryText}</Text>
            {model.reviewPhotoError ? (
              <Text style={styles.validationText}>{model.reviewPhotoError}</Text>
            ) : null}
            {model.reviewPhotos.length ? (
              <View style={styles.reviewPhotoGrid}>
                {model.reviewPhotos.map((photo) => (
                  <View key={photo.id} style={styles.reviewPhotoTile}>
                    <Image
                      source={{ uri: photo.previewUri }}
                      style={styles.reviewPhotoImage}
                      accessibilityLabel={`Review photo, ${photo.uploadStatus === 'uploading' ? 'uploading' : photo.moderationStatus}`}
                    />
                    <View style={styles.reviewPhotoTileOverlay}>
                      <Text style={styles.reviewPhotoStatusText}>
                        {photo.uploadStatus === 'uploading'
                          ? 'Uploading'
                          : photo.moderationStatus === 'approved'
                            ? 'Approved'
                            : photo.moderationStatus === 'needs_manual_review'
                              ? 'Being checked'
                              : photo.moderationStatus === 'rejected'
                                ? 'Rejected'
                                : 'Needs retry'}
                      </Text>
                      {photo.moderationStatus !== 'approved' &&
                      (photo.errorMessage || photo.moderationReason) ? (
                        <Text style={styles.reviewPhotoReasonText}>
                          {photo.errorMessage ?? photo.moderationReason}
                        </Text>
                      ) : null}
                      <View style={styles.reviewPhotoTileActions}>
                        {photo.uploadStatus === 'failed' &&
                        photo.moderationStatus !== 'rejected' ? (
                          <HapticPressable
                            accessibilityRole="button"
                            accessibilityLabel="Retry review photo upload"
                            accessibilityHint="Attempts this failed photo upload again."
                            hapticType="selection"
                            onPress={() => model.retryReviewPhotoUpload(photo.id)}
                            style={styles.reviewPhotoActionButton}
                          >
                            <Text style={styles.reviewPhotoActionText}>Retry</Text>
                          </HapticPressable>
                        ) : null}
                        <HapticPressable
                          accessibilityRole="button"
                          accessibilityLabel="Remove review photo"
                          accessibilityHint="Removes this photo from the review draft."
                          hapticType="selection"
                          onPress={() => model.removeReviewPhoto(photo.id)}
                          disabled={photo.uploadStatus === 'uploading'}
                          style={styles.reviewPhotoActionButton}
                        >
                          <Text style={styles.reviewPhotoActionText}>Remove</Text>
                        </HapticPressable>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}
            <Text style={styles.attributionText}>
              Approved photos appear with the review. Anything uncertain stays hidden until it is
              checked.
            </Text>
          </>
        ) : (
          <CustomerStateCard
            title="Sign in to add photos"
            body="You need a member account before you can attach review photos. Photos stay private until they are approved."
            tone="warm"
            iconName="camera-outline"
            eyebrow="Photos"
            note="You can still post a text review without photos."
          />
        )}
      </SectionCard>
    </MotionInView>
  );
}

export function WriteReviewGifSection({ model }: { model: WriteReviewScreenModel }) {
  return (
    <MotionInView delay={240}>
      <SectionCard
        title="GIF"
        body="Add a reaction GIF only if it supports the tone of the review."
      >
        <View style={styles.gifPickerActions}>
          <HapticPressable
            accessibilityRole="button"
            accessibilityLabel={model.gifUrl ? 'Change reaction GIF' : 'Choose reaction GIF'}
            accessibilityHint="Opens the GIF picker for this review."
            hapticType="selection"
            onPress={model.openGifPicker}
            style={styles.gifPickerButton}
          >
            <AppUiIcon name="images-outline" size={16} color={colors.background} />
            <Text style={styles.gifPickerButtonText}>
              {model.gifUrl
                ? 'Change GIF'
                : model.hasGiphyConfig
                  ? 'Choose from GIPHY'
                  : 'Choose Reaction GIF'}
            </Text>
          </HapticPressable>
          {model.gifUrl ? (
            <HapticPressable
              accessibilityRole="button"
              accessibilityLabel="Remove reaction GIF"
              accessibilityHint="Removes the selected GIF from the review."
              hapticType="selection"
              onPress={model.clearSelectedGif}
              style={styles.gifPickerClearButton}
            >
              <Text style={styles.gifPickerClearButtonText}>Remove</Text>
            </HapticPressable>
          ) : null}
        </View>
        {!model.hasGiphyConfig ? (
          <CustomerStateCard
            title="Using built-in reaction GIFs"
            body="Live GIPHY search is not available in this version, so you are seeing the built-in reaction GIFs instead."
            tone="warm"
            iconName="images-outline"
            eyebrow="GIFs"
            note="You can still add a reaction GIF and finish the review normally."
          />
        ) : null}
        {model.gifUrl ? (
          <Image
            source={{ uri: model.gifUrl }}
            style={styles.gifPreview}
            accessibilityLabel="Selected reaction GIF"
          />
        ) : null}
        <Text style={styles.attributionText}>{model.gifPickerProviderText}</Text>
      </SectionCard>
    </MotionInView>
  );
}

export function WriteReviewTagsSection({ model }: { model: WriteReviewScreenModel }) {
  return (
    <MotionInView delay={280}>
      <SectionCard title="Tags" body="Optional tags help structure community reviews.">
        <View style={styles.tagRow}>
          {model.REVIEW_TAGS.map((tag) => {
            const selected = model.selectedTags.includes(tag);
            return (
              <HapticPressable
                key={tag}
                accessibilityRole="button"
                accessibilityLabel={`${selected ? 'Remove' : 'Add'} tag ${tag}`}
                accessibilityHint="Toggles this review tag."
                accessibilityState={selected ? { selected: true } : {}}
                hapticType="selection"
                onPress={() => model.toggleTag(tag)}
                style={[styles.tagChip, selected && styles.tagChipSelected]}
              >
                <Text style={[styles.tagChipText, selected && styles.tagChipTextSelected]}>
                  {tag}
                </Text>
              </HapticPressable>
            );
          })}
        </View>
        <Text style={styles.helperText}>
          {model.selectedTags.length
            ? `${model.selectedTags.length} tag${model.selectedTags.length === 1 ? '' : 's'} selected.`
            : 'No tags selected.'}
        </Text>
      </SectionCard>
    </MotionInView>
  );
}

export function WriteReviewGuidelinesSection({ model }: { model: WriteReviewScreenModel }) {
  return (
    <MotionInView delay={320}>
      <SectionCard
        title="Community guidelines"
        body="Before posting, confirm that your review follows the Canopy Trove community standards."
      >
        <View style={styles.gifPickerActions}>
          <HapticPressable
            accessibilityRole="button"
            accessibilityLabel="Review community guidelines"
            accessibilityHint="Opens the legal center to read the community guidelines."
            hapticType="selection"
            onPress={model.openLegalCenter}
            style={styles.gifPickerClearButton}
          >
            <Text style={styles.gifPickerClearButtonText}>Review Guidelines</Text>
          </HapticPressable>
          <HapticPressable
            accessibilityRole="button"
            accessibilityLabel={
              model.hasAcceptedGuidelines
                ? 'Community guidelines accepted'
                : 'Accept community guidelines'
            }
            accessibilityHint="Confirms that your review follows the community guidelines."
            hapticType="selection"
            onPress={model.acceptGuidelines}
            style={styles.gifPickerButton}
          >
            <Text style={styles.gifPickerButtonText}>
              {model.hasAcceptedGuidelines ? 'Accepted' : 'I Agree'}
            </Text>
          </HapticPressable>
        </View>
        <Text style={model.hasAcceptedGuidelines ? styles.helperText : styles.validationText}>
          {model.hasAcceptedGuidelines
            ? 'Community guidelines accepted for this device.'
            : 'You need to accept the guidelines before submitting a review.'}
        </Text>
      </SectionCard>
    </MotionInView>
  );
}

export function WriteReviewSubmitSection({ model }: { model: WriteReviewScreenModel }) {
  return (
    <MotionInView delay={380}>
      <SectionCard
        title="Ready to submit?"
        body={
          model.isEditingReview
            ? 'Saving here updates your existing review instead of creating a second one.'
            : 'Your review will appear on the storefront and help other people decide where to go.'
        }
      >
        <View style={styles.ctaPanel}>
          <View style={styles.summaryStrip}>
            <View style={styles.summaryTile}>
              <Text style={styles.summaryTileValue}>{model.rating}/5</Text>
              <Text style={styles.summaryTileLabel}>Current rating</Text>
              <Text style={styles.summaryTileBody}>{getRatingSummary(model.rating)}</Text>
            </View>
            <View style={styles.summaryTile}>
              <Text style={styles.summaryTileValue}>{model.gifUrl ? 'Attached' : 'Optional'}</Text>
              <Text style={styles.summaryTileLabel}>GIF</Text>
              <Text style={styles.summaryTileBody}>
                {model.gifUrl
                  ? 'A reaction GIF is included with this review.'
                  : 'No GIF selected for this review.'}
              </Text>
            </View>
            <View style={styles.summaryTile}>
              <Text style={styles.summaryTileValue}>
                {model.reviewPhotoCount > 0 ? `${model.reviewPhotoCount} ready` : 'Optional'}
              </Text>
              <Text style={styles.summaryTileLabel}>Photos</Text>
              <Text style={styles.summaryTileBody}>
                {model.reviewPhotoCount > 0
                  ? 'Your photos are uploaded and waiting to be checked.'
                  : 'No review photos selected for this review.'}
              </Text>
            </View>
            <View style={styles.summaryTile}>
              <Text style={styles.summaryTileValue}>
                {model.canSubmit ? 'Ready' : 'Needs attention'}
              </Text>
              <Text style={styles.summaryTileLabel}>Submit state</Text>
              <Text style={styles.summaryTileBody}>
                {model.validationError ?? model.validationHint}
              </Text>
            </View>
          </View>
          {model.submitError ? (
            <CustomerStateCard
              title="Your review did not post"
              body={model.submitError}
              tone="danger"
              iconName="alert-circle-outline"
              eyebrow="Review"
            />
          ) : null}
          <Text style={model.validationError ? styles.validationText : styles.helperText}>
            {model.validationError ?? model.validationHint}
          </Text>
          <HapticPressable
            accessibilityRole="button"
            accessibilityLabel={model.submitButtonLabel}
            accessibilityHint={
              model.isEditingReview
                ? 'Saves changes to your existing review.'
                : 'Publishes this review to the storefront record.'
            }
            disabled={!model.canSubmit}
            onPress={model.submit}
            style={[styles.submitButton, !model.canSubmit && styles.submitButtonDisabled]}
          >
            <AppUiIcon name="send-outline" size={16} color={colors.backgroundDeep} />
            <Text style={styles.submitButtonText}>
              {model.isSubmitting ? 'Saving...' : model.submitButtonLabel}
            </Text>
          </HapticPressable>
        </View>
      </SectionCard>
    </MotionInView>
  );
}

import React from 'react';
import { Image, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CustomerStateCard } from '../components/CustomerStateCard';
import { GifPickerModal } from '../components/GifPickerModal';
import { HapticPressable } from '../components/HapticPressable';
import { MotionInView } from '../components/MotionInView';
import { ScreenShell } from '../components/ScreenShell';
import { SectionCard } from '../components/SectionCard';
import { colors } from '../theme/tokens';
import { styles } from './writeReview/writeReviewStyles';
import { useWriteReviewScreenModel } from './writeReview/useWriteReviewScreenModel';

function getRatingSummary(rating: number) {
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

export function WriteReviewScreen() {
  const model = useWriteReviewScreenModel();

  return (
    <ScreenShell
      eyebrow="Review"
      title={`Review ${model.storefront.displayName}`}
      subtitle="App reviews feed Canopy Trove's community layer and the rewards system."
      headerPill="Write Review"
    >
      <MotionInView delay={80}>
        <SectionCard
          title="Review snapshot"
            body="Use this as a quick readiness check before you publish into the Canopy Trove community layer."
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
                Community-guideline acceptance is required before submission.
              </Text>
            </View>
          </View>
        </SectionCard>
      </MotionInView>

      <MotionInView delay={120}>
        <SectionCard
          title="Rating"
          body="Leave a clear rating first. Review rewards use this together with detail length."
        >
          <View style={styles.ratingRow}>
            {[1, 2, 3, 4, 5].map((value) => (
              <HapticPressable
                key={value}
                hapticType="selection"
                onPress={() => model.setRating(value)}
                style={[styles.ratingButton, model.rating === value && styles.ratingButtonActive]}
              >
                <Ionicons
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

      <MotionInView delay={180}>
        <SectionCard
          title="Review"
          body="Write at least 20 characters. Detailed reviews earn more progression."
        >
          <TextInput
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
            {model.validationError ?? 'Emoji in review text can help capture the storefront vibe.'}
          </Text>
          <View style={styles.emojiRow}>
            {model.REVIEW_EMOJIS.map((emoji) => (
              <HapticPressable
                key={emoji}
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

      <MotionInView delay={240}>
        <SectionCard title="GIF" body="Add a reaction GIF when you want the review to feel more alive.">
          <View style={styles.gifPickerActions}>
            <HapticPressable
              hapticType="selection"
              onPress={model.openGifPicker}
              style={styles.gifPickerButton}
            >
              <Ionicons name="images-outline" size={16} color={colors.background} />
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
                body="This build does not have a live GIPHY key configured, so Canopy Trove is falling back to the built-in reaction GIF set."
              tone="warm"
              iconName="images-outline"
              eyebrow="Fallback state"
              note="You can still attach a reaction GIF and finish the review normally."
            />
          ) : null}
          {model.gifUrl ? <Image source={{ uri: model.gifUrl }} style={styles.gifPreview} /> : null}
          <Text style={styles.attributionText}>{model.gifPickerProviderText}</Text>
        </SectionCard>
      </MotionInView>

      <MotionInView delay={280}>
        <SectionCard title="Tags" body="Optional tags help structure community reviews.">
          <View style={styles.tagRow}>
            {model.REVIEW_TAGS.map((tag) => {
              const selected = model.selectedTags.includes(tag);
              return (
                <HapticPressable
                  key={tag}
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
              : 'No tags selected yet.'}
          </Text>
        </SectionCard>
      </MotionInView>

      <MotionInView delay={320}>
        <SectionCard
          title="Community guidelines"
            body="Before posting, confirm that your review follows the Canopy Trove community standards."
        >
          <View style={styles.gifPickerActions}>
            <HapticPressable
              hapticType="selection"
              onPress={model.openLegalCenter}
              style={styles.gifPickerClearButton}
            >
              <Text style={styles.gifPickerClearButtonText}>Review Guidelines</Text>
            </HapticPressable>
            <HapticPressable
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

      <MotionInView delay={380}>
        <SectionCard
          title="Ready to submit?"
            body="Reviews publish into the Canopy Trove community layer and help shape storefront quality signals."
        >
          <View style={styles.ctaPanel}>
            <View style={styles.summaryStrip}>
              <View style={styles.summaryTile}>
                <Text style={styles.summaryTileValue}>{model.rating}/5</Text>
                <Text style={styles.summaryTileLabel}>Current rating</Text>
                <Text style={styles.summaryTileBody}>{getRatingSummary(model.rating)}</Text>
              </View>
              <View style={styles.summaryTile}>
                <Text style={styles.summaryTileValue}>
                  {model.gifUrl ? 'Attached' : 'Optional'}
                </Text>
                <Text style={styles.summaryTileLabel}>GIF</Text>
                <Text style={styles.summaryTileBody}>
                  {model.gifUrl
                    ? 'A reaction GIF is included with this review.'
                    : 'No GIF selected for this review.'}
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
                title="Review submission did not go through"
                body={model.submitError}
                tone="danger"
                iconName="alert-circle-outline"
                eyebrow="Submit state"
              />
            ) : null}
            <Text style={model.validationError ? styles.validationText : styles.helperText}>
              {model.validationError ?? model.validationHint}
            </Text>
            <HapticPressable
              disabled={!model.canSubmit}
              onPress={model.submit}
              style={[styles.submitButton, !model.canSubmit && styles.submitButtonDisabled]}
            >
              <Ionicons name="send-outline" size={16} color={colors.background} />
              <Text style={styles.submitButtonText}>
                {model.isSubmitting ? 'Submitting...' : 'Submit Review'}
              </Text>
            </HapticPressable>
          </View>
        </SectionCard>
      </MotionInView>

      <GifPickerModal
        visible={model.gifPickerVisible}
        query={model.gifSearchQuery}
        results={model.gifResults}
        isLoading={model.isLoadingGifs}
        error={model.gifPickerError}
        emptyText={model.gifPickerEmptyText}
        providerText={model.gifPickerProviderText}
        onChangeQuery={model.setGifSearchQuery}
        onClose={model.closeGifPicker}
        onSelectGif={model.selectGif}
      />
    </ScreenShell>
  );
}

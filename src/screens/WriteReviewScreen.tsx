import React from 'react';
import type { RouteProp } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import { CustomerStateCard } from '../components/CustomerStateCard';
import { GifPickerModal } from '../components/GifPickerModal';
import { ScreenShell } from '../components/ScreenShell';
import { withScreenErrorBoundary } from '../components/withScreenErrorBoundary';
import type { RootStackParamList } from '../navigation/RootNavigator';
import {
  WriteReviewBodySection,
  WriteReviewGifSection,
  WriteReviewGuidelinesSection,
  WriteReviewPhotosSection,
  WriteReviewRatingSection,
  WriteReviewSnapshotSection,
  WriteReviewSubmitSection,
  WriteReviewTagsSection,
} from './writeReview/WriteReviewSections';
import { useWriteReviewScreenModel } from './writeReview/useWriteReviewScreenModel';

type WriteReviewRoute = RouteProp<RootStackParamList, 'WriteReview'>;

function WriteReviewContent({
  storefront,
  existingReview,
}: {
  storefront: RootStackParamList['WriteReview']['storefront'];
  existingReview: RootStackParamList['WriteReview']['existingReview'] | null;
}) {
  const model = useWriteReviewScreenModel({
    storefront,
    existingReview,
  });

  return (
    <ScreenShell
      eyebrow="Review"
      title={`${model.isEditingReview ? 'Edit' : 'Review'} ${model.storefront.displayName}`}
      subtitle={
        model.isEditingReview
          ? 'Update your existing review without creating a duplicate post for this storefront.'
          : 'Your review helps other customers know what to expect from this storefront.'
      }
      headerPill={model.isEditingReview ? 'Edit Review' : 'Write Review'}
    >
      <WriteReviewSnapshotSection model={model} />
      <WriteReviewRatingSection model={model} />
      <WriteReviewBodySection model={model} />
      <WriteReviewPhotosSection model={model} />
      <WriteReviewGifSection model={model} />
      <WriteReviewTagsSection model={model} />
      <WriteReviewGuidelinesSection model={model} />
      <WriteReviewSubmitSection model={model} />

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

function WriteReviewScreenInner() {
  const route = useRoute<WriteReviewRoute>();
  const params = route.params as Partial<RootStackParamList['WriteReview']> | undefined;
  const storefront = params?.storefront ?? null;
  const existingReview = params?.existingReview ?? null;

  if (!storefront) {
    return (
      <ScreenShell
        eyebrow="Review"
        title="Storefront unavailable"
        subtitle="This review screen needs a storefront before you can post or edit a review."
        headerPill="Review"
      >
        <CustomerStateCard
          title="Review could not open"
          body="This screen opened without a storefront. Head back to the storefront page and try again."
          tone="warm"
          iconName="chatbubble-outline"
          eyebrow="Navigation"
        />
      </ScreenShell>
    );
  }

  return <WriteReviewContent storefront={storefront} existingReview={existingReview} />;
}

export const WriteReviewScreen = withScreenErrorBoundary(
  WriteReviewScreenInner,
  'write-review-screen',
);

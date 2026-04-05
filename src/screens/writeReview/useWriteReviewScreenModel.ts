import React from 'react';
import { crossPlatformAlert } from '../../utils/crossPlatformAlert';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { hasGiphyConfig } from '../../config/giphy';
import {
  acceptCommunityGuidelines,
  hasAcceptedCommunityGuidelines,
  initializeCommunitySafetyState,
} from '../../services/communitySafetyService';
import {
  useStorefrontProfileController,
  useStorefrontRewardsController,
} from '../../context/StorefrontController';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { trackAnalyticsEvent } from '../../services/analyticsService';
import { getTrendingGifs, searchGifs } from '../../services/giphyService';
import { markStorefrontReviewed } from '../../services/postVisitPromptService';
import {
  submitStorefrontReview,
  updateStorefrontReview,
} from '../../services/storefrontCommunityService';
import {
  discardPendingReviewPhoto,
  MAX_REVIEW_PHOTOS,
  uploadPendingReviewPhoto,
} from '../../services/storefrontReviewPhotoService';
import type { AppReview, StorefrontSummary } from '../../types/storefront';
import {
  getReviewSubmitErrorMessage,
  getReviewValidationError,
  getReviewValidationHint,
  parseGifUrl,
  REVIEW_EMOJIS,
  REVIEW_TAGS,
} from './reviewComposerShared';

export function useWriteReviewScreenModel(input: {
  storefront: StorefrontSummary;
  existingReview?: AppReview | null;
}) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { storefront, existingReview = null } = input;
  const isEditingReview = Boolean(existingReview);
  const { appProfile, profileId } = useStorefrontProfileController();
  const { applyRewardResult, trackReviewSubmittedReward } = useStorefrontRewardsController();
  const [rating, setRating] = React.useState(existingReview?.rating ?? 5);
  const [text, setText] = React.useState(existingReview?.text ?? '');
  const [selectedTags, setSelectedTags] = React.useState<string[]>(existingReview?.tags ?? []);
  const [gifUrl, setGifUrl] = React.useState<string | null>(existingReview?.gifUrl ?? null);
  const [gifUrlInput, setGifUrlInputState] = React.useState(existingReview?.gifUrl ?? '');
  const [gifPickerVisible, setGifPickerVisible] = React.useState(false);
  const [gifSearchQuery, setGifSearchQueryState] = React.useState('');
  const [gifResults, setGifResults] = React.useState<Awaited<ReturnType<typeof getTrendingGifs>>>(
    [],
  );
  const [isLoadingGifs, setIsLoadingGifs] = React.useState(false);
  const [gifPickerError, setGifPickerError] = React.useState<string | null>(null);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [hasAcceptedGuidelines, setHasAcceptedGuidelines] = React.useState(
    hasAcceptedCommunityGuidelines(),
  );
  const [reviewPhotos, setReviewPhotos] = React.useState<
    Array<{
      id: string;
      previewUri: string;
      fileName: string;
      mimeType: string | null;
      size: number | null;
      photoUploadId: string | null;
      uploadStatus: 'uploading' | 'ready' | 'failed';
      moderationStatus: 'uploading' | 'approved' | 'needs_manual_review' | 'rejected' | 'failed';
      moderationReason: string | null;
      publicUrl: string | null;
      errorMessage: string | null;
    }>
  >([]);
  const [reviewPhotoError, setReviewPhotoError] = React.useState<string | null>(null);
  const existingReviewPhotoUrls = existingReview?.photoUrls ?? [];
  const textLength = text.trim().length;
  const readyReviewPhotoCount = reviewPhotos.filter(
    (photo) => photo.uploadStatus === 'ready',
  ).length;
  const approvedReviewPhotoCount = reviewPhotos.filter(
    (photo) => photo.uploadStatus === 'ready' && photo.moderationStatus === 'approved',
  ).length;
  const pendingManualReviewPhotoCount = reviewPhotos.filter(
    (photo) => photo.uploadStatus === 'ready' && photo.moderationStatus === 'needs_manual_review',
  ).length;
  const hasPendingReviewPhotoUpload = reviewPhotos.some(
    (photo) => photo.uploadStatus === 'uploading',
  );
  const hasFailedReviewPhotoUpload = reviewPhotos.some((photo) => photo.uploadStatus === 'failed');
  const canAttachReviewPhotos =
    appProfile?.kind === 'authenticated' && Boolean(appProfile.accountId) && !isEditingReview;
  const reviewPhotoValidationError =
    !canAttachReviewPhotos && reviewPhotos.length > 0
      ? 'Photo uploads require a signed-in member account.'
      : hasFailedReviewPhotoUpload
        ? 'Remove any rejected photos and retry any failed uploads before submitting.'
        : hasPendingReviewPhotoUpload
          ? 'Wait for photo uploads to finish before submitting.'
          : null;
  const validationError =
    getReviewValidationError(textLength, gifUrlInput, readyReviewPhotoCount) ??
    reviewPhotoValidationError;
  const validationHint = hasAcceptedGuidelines
    ? getReviewValidationHint(textLength, readyReviewPhotoCount)
    : 'Review and accept the Canopy Trove community guidelines before posting a review.';
  const canSubmit =
    !isSubmitting && !validationError && hasAcceptedGuidelines && !hasPendingReviewPhotoUpload;
  const gifRequestVersionRef = React.useRef(0);

  React.useEffect(() => {
    trackAnalyticsEvent(
      'review_started',
      {
        sourceScreen: 'WriteReview',
        mode: isEditingReview ? 'edit' : 'create',
      },
      {
        screen: 'WriteReview',
        storefrontId: storefront.id,
      },
    );
  }, [isEditingReview, storefront.id]);

  React.useEffect(() => {
    let alive = true;

    void initializeCommunitySafetyState().then(() => {
      if (alive) {
        setHasAcceptedGuidelines(hasAcceptedCommunityGuidelines());
      }
    });

    return () => {
      alive = false;
    };
  }, []);

  React.useEffect(() => {
    if (!gifPickerVisible) {
      return;
    }

    const requestVersion = gifRequestVersionRef.current + 1;
    gifRequestVersionRef.current = requestVersion;

    const timeoutId = setTimeout(() => {
      void (async () => {
        setIsLoadingGifs(true);
        setGifPickerError(null);

        try {
          const nextResults = gifSearchQuery.trim()
            ? await searchGifs(gifSearchQuery)
            : await getTrendingGifs();

          if (gifRequestVersionRef.current !== requestVersion) {
            return;
          }

          setGifResults(nextResults);
        } catch {
          if (gifRequestVersionRef.current !== requestVersion) {
            return;
          }

          setGifPickerError('Could not load GIFs right now.');
          setGifResults([]);
        } finally {
          if (gifRequestVersionRef.current === requestVersion) {
            setIsLoadingGifs(false);
          }
        }
      })();
    }, 300);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [gifPickerVisible, gifSearchQuery]);

  const toggleTag = React.useCallback((tag: string) => {
    setSubmitError(null);
    setSelectedTags((current) =>
      current.includes(tag) ? current.filter((value) => value !== tag) : [...current, tag],
    );
  }, []);

  const setGifUrlInput = React.useCallback((value: string) => {
    const normalizedValue = value.trim();
    setGifUrlInputState(normalizedValue);
    setGifUrl(parseGifUrl(normalizedValue));
    setSubmitError(null);
  }, []);

  const setGifSearchQuery = React.useCallback((value: string) => {
    setGifPickerError(null);
    setGifSearchQueryState(value);
  }, []);

  const insertEmoji = React.useCallback((emoji: string) => {
    setSubmitError(null);
    setText((current) => {
      const trimmedCurrent = current.trim();
      return trimmedCurrent ? `${trimmedCurrent} ${emoji}` : emoji;
    });
  }, []);

  const openGifPicker = React.useCallback(() => {
    setGifPickerError(null);
    setGifSearchQueryState('');
    setGifPickerVisible(true);
  }, []);

  const closeGifPicker = React.useCallback(() => {
    setGifPickerVisible(false);
  }, []);

  const selectGif = React.useCallback(
    (gifId: string) => {
      const selectedGif = gifResults.find((result) => result.id === gifId);
      if (!selectedGif) {
        return;
      }

      setGifPickerError(null);
      setGifUrl(selectedGif.mediaUrl);
      setGifUrlInputState('');
      setGifPickerVisible(false);
      setSubmitError(null);
    },
    [gifResults],
  );

  const clearSelectedGif = React.useCallback(() => {
    setGifPickerError(null);
    setGifUrl(null);
    setGifUrlInputState('');
    setSubmitError(null);
  }, []);

  const createReviewPhotoAttachmentId = React.useCallback(
    () => `review-photo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
    [],
  );

  const upsertReviewPhotoUpload = React.useCallback(
    (
      id: string,
      nextState:
        | Partial<{
            previewUri: string;
            fileName: string;
            mimeType: string | null;
            size: number | null;
            photoUploadId: string | null;
            uploadStatus: 'uploading' | 'ready' | 'failed';
            moderationStatus:
              | 'uploading'
              | 'approved'
              | 'needs_manual_review'
              | 'rejected'
              | 'failed';
            moderationReason: string | null;
            publicUrl: string | null;
            errorMessage: string | null;
          }>
        | ((current: {
            id: string;
            previewUri: string;
            fileName: string;
            mimeType: string | null;
            size: number | null;
            photoUploadId: string | null;
            uploadStatus: 'uploading' | 'ready' | 'failed';
            moderationStatus:
              | 'uploading'
              | 'approved'
              | 'needs_manual_review'
              | 'rejected'
              | 'failed';
            moderationReason: string | null;
            publicUrl: string | null;
            errorMessage: string | null;
          }) => Partial<{
            previewUri: string;
            fileName: string;
            mimeType: string | null;
            size: number | null;
            photoUploadId: string | null;
            uploadStatus: 'uploading' | 'ready' | 'failed';
            moderationStatus:
              | 'uploading'
              | 'approved'
              | 'needs_manual_review'
              | 'rejected'
              | 'failed';
            moderationReason: string | null;
            publicUrl: string | null;
            errorMessage: string | null;
          }>),
    ) => {
      setReviewPhotos((current) =>
        current.map((photo) => {
          if (photo.id !== id) {
            return photo;
          }

          const patch = typeof nextState === 'function' ? nextState(photo) : nextState;
          return {
            ...photo,
            ...patch,
          };
        }),
      );
    },
    [],
  );

  const uploadReviewPhotoAssets = React.useCallback(
    async (assets: ImagePicker.ImagePickerAsset[]) => {
      if (!canAttachReviewPhotos || !appProfile?.accountId) {
        setReviewPhotoError('Photo uploads require a signed-in member account.');
        return;
      }

      if (!assets.length) {
        return;
      }

      setReviewPhotoError(null);
      setSubmitError(null);

      const remainingSlots = Math.max(0, MAX_REVIEW_PHOTOS - reviewPhotos.length);
      const selectedAssets = assets.slice(0, remainingSlots);
      if (!selectedAssets.length) {
        setReviewPhotoError(`You can attach up to ${MAX_REVIEW_PHOTOS} photos per review.`);
        return;
      }

      const queuedPhotos = selectedAssets.map((asset) => ({
        id: createReviewPhotoAttachmentId(),
        previewUri: asset.uri,
        fileName: asset.fileName ?? `review-photo-${Date.now().toString(36)}.jpg`,
        mimeType: asset.mimeType ?? 'image/jpeg',
        size: typeof asset.fileSize === 'number' ? asset.fileSize : null,
        photoUploadId: null,
        uploadStatus: 'uploading' as const,
        moderationStatus: 'uploading' as const,
        moderationReason: null,
        publicUrl: null,
        errorMessage: null,
      }));

      setReviewPhotos((current) => [...current, ...queuedPhotos]);

      for (const queuedPhoto of queuedPhotos) {
        const asset = selectedAssets.find((candidate) => candidate.uri === queuedPhoto.previewUri);
        if (!asset) {
          upsertReviewPhotoUpload(queuedPhoto.id, {
            uploadStatus: 'failed',
            moderationStatus: 'failed',
            moderationReason: null,
            publicUrl: null,
            errorMessage: 'Could not prepare the selected photo.',
          });
          continue;
        }

        try {
          const uploaded = await uploadPendingReviewPhoto({
            storefrontId: storefront.id,
            profileId,
            file: {
              uri: asset.uri,
              name: asset.fileName ?? queuedPhoto.fileName,
              mimeType: asset.mimeType ?? queuedPhoto.mimeType,
              size: typeof asset.fileSize === 'number' ? asset.fileSize : queuedPhoto.size,
            },
          });

          const moderationStatus =
            uploaded.moderationStatus === 'approved' ||
            uploaded.moderationStatus === 'needs_manual_review'
              ? uploaded.moderationStatus
              : uploaded.moderationStatus === 'rejected'
                ? 'rejected'
                : 'failed';

          upsertReviewPhotoUpload(queuedPhoto.id, {
            photoUploadId: uploaded.photoUploadId,
            fileName: asset.fileName ?? queuedPhoto.fileName,
            mimeType: asset.mimeType ?? queuedPhoto.mimeType,
            size: typeof asset.fileSize === 'number' ? asset.fileSize : queuedPhoto.size,
            uploadStatus:
              moderationStatus === 'approved' || moderationStatus === 'needs_manual_review'
                ? 'ready'
                : 'failed',
            moderationStatus,
            moderationReason: uploaded.moderationReason,
            publicUrl: uploaded.publicUrl,
            errorMessage:
              moderationStatus === 'rejected'
                ? (uploaded.moderationReason ?? 'This photo was rejected by strict moderation.')
                : null,
          });
        } catch (error) {
          upsertReviewPhotoUpload(queuedPhoto.id, {
            uploadStatus: 'failed',
            moderationStatus: 'failed',
            moderationReason: null,
            publicUrl: null,
            errorMessage:
              error instanceof Error ? error.message : 'Unable to upload this review photo.',
          });
        }
      }
    },
    [
      appProfile?.accountId,
      canAttachReviewPhotos,
      createReviewPhotoAttachmentId,
      profileId,
      reviewPhotos.length,
      storefront.id,
      upsertReviewPhotoUpload,
    ],
  );

  const pickReviewPhotosFromLibrary = React.useCallback(async () => {
    if (!canAttachReviewPhotos) {
      setReviewPhotoError('Photo uploads require a signed-in member account.');
      return;
    }

    const remainingSlots = Math.max(0, MAX_REVIEW_PHOTOS - reviewPhotos.length);
    if (!remainingSlots) {
      setReviewPhotoError(`You can attach up to ${MAX_REVIEW_PHOTOS} photos per review.`);
      return;
    }

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setReviewPhotoError('Media library permission is required to add review photos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        allowsMultipleSelection: true,
        selectionLimit: remainingSlots,
        quality: 0.84,
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      await uploadReviewPhotoAssets(result.assets.slice(0, remainingSlots));
    } catch (error) {
      setReviewPhotoError(
        error instanceof Error ? error.message : 'Could not open the photo library.',
      );
    }
  }, [canAttachReviewPhotos, reviewPhotos.length, uploadReviewPhotoAssets]);

  const takeReviewPhoto = React.useCallback(async () => {
    if (!canAttachReviewPhotos) {
      setReviewPhotoError('Photo uploads require a signed-in member account.');
      return;
    }

    if (reviewPhotos.length >= MAX_REVIEW_PHOTOS) {
      setReviewPhotoError(`You can attach up to ${MAX_REVIEW_PHOTOS} photos per review.`);
      return;
    }

    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setReviewPhotoError('Camera permission is required to take review photos.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.84,
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      await uploadReviewPhotoAssets(result.assets.slice(0, 1));
    } catch (error) {
      setReviewPhotoError(error instanceof Error ? error.message : 'Could not open the camera.');
    }
  }, [canAttachReviewPhotos, reviewPhotos.length, uploadReviewPhotoAssets]);

  const removeReviewPhoto = React.useCallback(
    async (attachmentId: string) => {
      const attachment = reviewPhotos.find((photo) => photo.id === attachmentId);
      if (!attachment || attachment.uploadStatus === 'uploading') {
        return;
      }

      setSubmitError(null);
      setReviewPhotoError(null);
      setReviewPhotos((current) => current.filter((photo) => photo.id !== attachmentId));

      if (attachment.photoUploadId) {
        await discardPendingReviewPhoto({
          storefrontId: storefront.id,
          photoUploadId: attachment.photoUploadId,
        });
      }
    },
    [reviewPhotos, storefront.id],
  );

  const clearReviewPhotos = React.useCallback(async () => {
    if (hasPendingReviewPhotoUpload) {
      setReviewPhotoError('Wait for uploads to finish before clearing all review photos.');
      return;
    }

    setSubmitError(null);
    setReviewPhotoError(null);

    const removablePhotos = reviewPhotos.filter(
      (photo) => photo.uploadStatus !== 'uploading' && Boolean(photo.photoUploadId),
    );

    setReviewPhotos([]);

    await Promise.all(
      removablePhotos.map((photo) =>
        discardPendingReviewPhoto({
          storefrontId: storefront.id,
          photoUploadId: photo.photoUploadId ?? '',
        }),
      ),
    );
  }, [hasPendingReviewPhotoUpload, reviewPhotos, storefront.id]);

  const retryReviewPhotoUpload = React.useCallback(
    async (attachmentId: string) => {
      const attachment = reviewPhotos.find((photo) => photo.id === attachmentId);
      if (
        !attachment ||
        attachment.uploadStatus !== 'failed' ||
        attachment.moderationStatus === 'rejected'
      ) {
        return;
      }

      setReviewPhotoError(null);
      setSubmitError(null);

      if (attachment.photoUploadId) {
        await discardPendingReviewPhoto({
          storefrontId: storefront.id,
          photoUploadId: attachment.photoUploadId,
        });
      }

      upsertReviewPhotoUpload(attachmentId, {
        uploadStatus: 'uploading',
        moderationStatus: 'uploading',
        moderationReason: null,
        publicUrl: null,
        errorMessage: null,
      });

      try {
        const uploaded = await uploadPendingReviewPhoto({
          storefrontId: storefront.id,
          profileId,
          file: {
            uri: attachment.previewUri,
            name: attachment.fileName,
            mimeType: attachment.mimeType,
            size: attachment.size,
          },
        });

        const moderationStatus =
          uploaded.moderationStatus === 'approved' ||
          uploaded.moderationStatus === 'needs_manual_review'
            ? uploaded.moderationStatus
            : uploaded.moderationStatus === 'rejected'
              ? 'rejected'
              : 'failed';

        upsertReviewPhotoUpload(attachmentId, {
          photoUploadId: uploaded.photoUploadId,
          uploadStatus:
            moderationStatus === 'approved' || moderationStatus === 'needs_manual_review'
              ? 'ready'
              : 'failed',
          moderationStatus,
          moderationReason: uploaded.moderationReason,
          publicUrl: uploaded.publicUrl,
          errorMessage:
            moderationStatus === 'rejected'
              ? (uploaded.moderationReason ?? 'This photo was rejected by strict moderation.')
              : null,
        });
      } catch (error) {
        upsertReviewPhotoUpload(attachmentId, {
          uploadStatus: 'failed',
          moderationStatus: 'failed',
          moderationReason: null,
          publicUrl: null,
          errorMessage:
            error instanceof Error ? error.message : 'Unable to upload this review photo.',
        });
      }
    },
    [profileId, reviewPhotos, storefront.id, upsertReviewPhotoUpload],
  );

  const submit = React.useCallback(async () => {
    if (isSubmitting || validationError || !hasAcceptedGuidelines || hasPendingReviewPhotoUpload) {
      return;
    }

    setSubmitError(null);
    setIsSubmitting(true);
    try {
      const reviewInput = {
        storefrontId: storefront.id,
        profileId,
        authorName:
          appProfile?.displayName ||
          (appProfile?.kind === 'authenticated' ? 'Canopy Trove member' : 'Canopy Trove user'),
        rating,
        text: text.trim(),
        tags: selectedTags,
        gifUrl: gifUrl ?? undefined,
        photoCount: readyReviewPhotoCount,
        photoUploadIds: reviewPhotos
          .filter((photo) => photo.uploadStatus === 'ready' && photo.photoUploadId)
          .map((photo) => photo.photoUploadId as string),
      };

      const response =
        isEditingReview && existingReview
          ? await updateStorefrontReview({
              ...reviewInput,
              reviewId: existingReview.id,
            })
          : await submitStorefrontReview(reviewInput);

      if (!isEditingReview && response.rewardResult) {
        applyRewardResult(response.rewardResult);
      } else if (!isEditingReview) {
        trackReviewSubmittedReward({
          rating,
          textLength,
          photoCount: readyReviewPhotoCount,
        });
      }

      trackAnalyticsEvent(
        'review_submitted',
        {
          rating,
          textLength,
          tagCount: selectedTags.length,
          photoCount: readyReviewPhotoCount,
          mode: isEditingReview ? 'edit' : 'create',
        },
        {
          screen: 'WriteReview',
          storefrontId: storefront.id,
        },
      );

      await markStorefrontReviewed(
        profileId,
        storefront.id,
        appProfile?.kind === 'authenticated' ? appProfile.accountId : null,
      );

      if (response.photoModeration?.message) {
        crossPlatformAlert(
          isEditingReview ? 'Review updated' : 'Review submitted',
          response.photoModeration.message,
        );
      }
      navigation.goBack();
    } catch (error) {
      setSubmitError(getReviewSubmitErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }, [
    appProfile?.displayName,
    appProfile?.accountId,
    appProfile?.kind,
    applyRewardResult,
    existingReview,
    gifUrl,
    isEditingReview,
    isSubmitting,
    navigation,
    profileId,
    rating,
    selectedTags,
    readyReviewPhotoCount,
    reviewPhotos,
    storefront.id,
    text,
    textLength,
    trackReviewSubmittedReward,
    hasAcceptedGuidelines,
    hasPendingReviewPhotoUpload,
    validationError,
  ]);

  return {
    acceptGuidelines: () => {
      void acceptCommunityGuidelines().then(() => {
        setHasAcceptedGuidelines(true);
        setSubmitError(null);
      });
    },
    canAttachReviewPhotos,
    clearSelectedGif,
    clearReviewPhotos: () => {
      void clearReviewPhotos();
    },
    canSubmit,
    closeGifPicker,
    gifPickerEmptyText: hasGiphyConfig
      ? 'No GIFs matched that search. Try another term.'
      : 'No built-in reaction GIFs matched that search. Try another keyword.',
    gifPickerError,
    gifPickerProviderText: hasGiphyConfig ? 'Powered by GIPHY' : 'Built-in reaction GIFs',
    gifPickerVisible,
    gifResults,
    gifSearchQuery,
    gifUrl,
    gifUrlInput,
    hasGiphyConfig,
    hasAcceptedGuidelines,
    insertEmoji,
    isLoadingGifs,
    isEditingReview,
    isSubmitting,
    existingReviewPhotoUrls,
    openLegalCenter: () => navigation.navigate('LegalCenter'),
    pickReviewPhotosFromLibrary: () => {
      void pickReviewPhotosFromLibrary();
    },
    takeReviewPhoto: () => {
      void takeReviewPhoto();
    },
    removeReviewPhoto: (attachmentId: string) => {
      void removeReviewPhoto(attachmentId);
    },
    retryReviewPhotoUpload: (attachmentId: string) => {
      void retryReviewPhotoUpload(attachmentId);
    },
    rating,
    REVIEW_EMOJIS,
    REVIEW_TAGS,
    selectGif,
    selectedTags,
    setGifSearchQuery,
    setGifUrlInput,
    setRating: (value: number) => {
      setSubmitError(null);
      setRating(value);
    },
    setText: (value: string) => {
      setSubmitError(null);
      setText(value);
    },
    storefront,
    submitButtonLabel: isEditingReview ? 'Save Changes' : 'Submit Review',
    submitError,
    submit: () => {
      void submit();
    },
    text,
    textLength,
    toggleTag,
    reviewPhotoError,
    reviewPhotos,
    reviewPhotoCount: readyReviewPhotoCount,
    approvedReviewPhotoCount,
    pendingManualReviewPhotoCount,
    reviewPhotoLimit: MAX_REVIEW_PHOTOS,
    reviewPhotoLimitReached: reviewPhotos.length >= MAX_REVIEW_PHOTOS,
    reviewPhotoSummaryText: reviewPhotos.length
      ? [
          `${approvedReviewPhotoCount} approved now`,
          `${pendingManualReviewPhotoCount} waiting manual review`,
          (() => {
            const blockedCount = reviewPhotos.filter(
              (photo) => photo.uploadStatus === 'failed',
            ).length;
            return blockedCount ? `${blockedCount} blocked` : null;
          })(),
        ]
          .filter((value): value is string => Boolean(value))
          .join(', ') + '.'
      : `You can attach up to ${MAX_REVIEW_PHOTOS} photos. They stay private until moderation approves them.`,
    isUploadingReviewPhotos: hasPendingReviewPhotoUpload,
    validationError,
    validationHint,
    openGifPicker,
  };
}

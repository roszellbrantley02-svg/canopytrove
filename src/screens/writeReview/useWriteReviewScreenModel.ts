import React from 'react';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
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
import { RootStackParamList } from '../../navigation/RootNavigator';
import { trackAnalyticsEvent } from '../../services/analyticsService';
import { getTrendingGifs, searchGifs } from '../../services/giphyService';
import { markStorefrontReviewed } from '../../services/postVisitPromptService';
import { submitStorefrontReview } from '../../services/storefrontCommunityService';
import {
  getReviewSubmitErrorMessage,
  getReviewValidationError,
  getReviewValidationHint,
  parseGifUrl,
  REVIEW_EMOJIS,
  REVIEW_TAGS,
} from './reviewComposerShared';

type WriteReviewRoute = RouteProp<RootStackParamList, 'WriteReview'>;

export function useWriteReviewScreenModel() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<WriteReviewRoute>();
  const { storefront } = route.params;
  const { appProfile, profileId } = useStorefrontProfileController();
  const {
    applyRewardResult,
    trackReviewSubmittedReward,
  } = useStorefrontRewardsController();
  const [rating, setRating] = React.useState(5);
  const [text, setText] = React.useState('');
  const [selectedTags, setSelectedTags] = React.useState<string[]>([]);
  const [gifUrl, setGifUrl] = React.useState<string | null>(null);
  const [gifUrlInput, setGifUrlInputState] = React.useState('');
  const [gifPickerVisible, setGifPickerVisible] = React.useState(false);
  const [gifSearchQuery, setGifSearchQueryState] = React.useState('');
  const [gifResults, setGifResults] = React.useState<Awaited<ReturnType<typeof getTrendingGifs>>>([]);
  const [isLoadingGifs, setIsLoadingGifs] = React.useState(false);
  const [gifPickerError, setGifPickerError] = React.useState<string | null>(null);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [hasAcceptedGuidelines, setHasAcceptedGuidelines] = React.useState(
    hasAcceptedCommunityGuidelines()
  );
  const textLength = text.trim().length;
  const validationError = getReviewValidationError(textLength, gifUrlInput);
  const validationHint = hasAcceptedGuidelines
    ? getReviewValidationHint(textLength)
    : 'Review and accept the Canopy Trove community guidelines before posting a review.';
  const canSubmit = !isSubmitting && !validationError && hasAcceptedGuidelines;
  const gifRequestVersionRef = React.useRef(0);

  React.useEffect(() => {
    trackAnalyticsEvent(
      'review_started',
      {
        sourceScreen: 'WriteReview',
      },
      {
        screen: 'WriteReview',
        storefrontId: storefront.id,
      }
    );
  }, [storefront.id]);

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
      current.includes(tag)
        ? current.filter((value) => value !== tag)
        : [...current, tag]
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
    [gifResults]
  );

  const clearSelectedGif = React.useCallback(() => {
    setGifPickerError(null);
    setGifUrl(null);
    setGifUrlInputState('');
    setSubmitError(null);
  }, []);

  const submit = React.useCallback(async () => {
    if (isSubmitting || validationError || !hasAcceptedGuidelines) {
      return;
    }

    setSubmitError(null);
    setIsSubmitting(true);
    try {
      const response = await submitStorefrontReview({
        storefrontId: storefront.id,
        profileId,
        authorName:
          appProfile?.displayName ||
          (appProfile?.kind === 'authenticated' ? 'Canopy Trove member' : 'Canopy Trove user'),
        rating,
        text: text.trim(),
        tags: selectedTags,
        gifUrl: gifUrl ?? undefined,
        photoCount: 0,
      });

      if (response.rewardResult) {
        applyRewardResult(response.rewardResult);
      } else {
        trackReviewSubmittedReward({
          rating,
          textLength,
          photoCount: 0,
        });
      }

      trackAnalyticsEvent(
        'review_submitted',
        {
          rating,
          textLength,
          tagCount: selectedTags.length,
        },
        {
          screen: 'WriteReview',
          storefrontId: storefront.id,
        }
      );

      await markStorefrontReviewed(
        profileId,
        storefront.id,
        appProfile?.kind === 'authenticated' ? appProfile.accountId : null
      );
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
    gifUrl,
    isSubmitting,
    navigation,
    profileId,
    rating,
    selectedTags,
    storefront.id,
    text,
    textLength,
    trackReviewSubmittedReward,
    hasAcceptedGuidelines,
    validationError,
  ]);

  return {
    acceptGuidelines: () => {
      void acceptCommunityGuidelines().then(() => {
        setHasAcceptedGuidelines(true);
        setSubmitError(null);
      });
    },
    clearSelectedGif,
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
    isSubmitting,
    openLegalCenter: () => navigation.navigate('LegalCenter'),
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
    submitError,
    submit: () => {
      void submit();
    },
    text,
    textLength,
    toggleTag,
    validationError,
    validationHint,
    openGifPicker,
  };
}

import { colors } from '../theme/tokens';
import React from 'react';
import type { RouteProp } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { Platform, Pressable, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { withScreenErrorBoundary } from '../components/withScreenErrorBoundary';
import { InlineFeedbackPanel } from '../components/InlineFeedbackPanel';
import { MotionInView } from '../components/MotionInView';
import { ScreenShell } from '../components/ScreenShell';
import { SectionCard } from '../components/SectionCard';
import { useStorefrontProfileController } from '../context/StorefrontController';
import { AppUiIcon } from '../icons/AppUiIcon';

import type { RootStackParamList } from '../navigation/RootNavigator';
import { uploadOwnerApprovedStorefrontMediaFile } from '../services/ownerPortalStorageService';
import { mergeUploadedStorefrontMediaIntoProfileTools } from '../services/ownerPortalProfileToolsMediaService';
import { ownerPortalStyles as styles } from './ownerPortal/ownerPortalStyles';
import { useOwnerPortalWorkspace } from './ownerPortal/useOwnerPortalWorkspace';
import type { OwnerPortalUploadedFile } from '../types/ownerPortal';

type OwnerPortalProfileToolsRoute = RouteProp<RootStackParamList, 'OwnerPortalProfileTools'>;
type MediaStatusNotice = {
  tone: 'info' | 'warning' | 'danger' | 'success';
  title: string;
  body: string;
};
function logSilentError(label: string) {
  return (error: unknown) => {
    if (__DEV__) {
      console.warn(`[OwnerPortalProfileTools] ${label}:`, error);
    }
  };
}

function parseHttpUrl(value: string) {
  const normalizedValue = value.trim();
  if (!normalizedValue) {
    return null;
  }

  try {
    const candidate = new URL(normalizedValue);
    if (candidate.protocol !== 'http:' && candidate.protocol !== 'https:') {
      return null;
    }

    return candidate.toString();
  } catch {
    return null;
  }
}

function extractHttpUrls(value: string) {
  const directUrl = parseHttpUrl(value);
  if (directUrl) {
    return [directUrl];
  }

  return Array.from(
    new Set(
      (value.match(/https?:\/\/[^\s,]+/gi) ?? [])
        .map((candidate) => candidate.replace(/[),.;]+$/g, ''))
        .map((candidate) => parseHttpUrl(candidate))
        .filter((candidate): candidate is string => Boolean(candidate)),
    ),
  );
}

function createOwnerUploadedFileFromWebFile(file: File) {
  const previewUri = URL.createObjectURL(file);
  return {
    uri: previewUri,
    name: file.name || `storefront-photo-${Date.now()}.jpg`,
    mimeType: file.type || 'image/jpeg',
    size: Number.isFinite(file.size) ? file.size : null,
    blob: file,
    previewUri,
  } satisfies OwnerPortalUploadedFile;
}

async function pickOwnerMediaImageFromWeb(source: 'library' | 'camera') {
  if (typeof document === 'undefined') {
    return null;
  }

  return await new Promise<OwnerPortalUploadedFile | null>((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (source === 'camera') {
      input.setAttribute('capture', 'environment');
    }

    input.style.position = 'fixed';
    input.style.left = '-9999px';
    input.style.opacity = '0';

    let settled = false;
    const finalize = (file: File | null) => {
      if (settled) {
        return;
      }
      settled = true;
      window.removeEventListener('focus', handleWindowFocus);
      input.onchange = null;
      input.remove();
      resolve(file ? createOwnerUploadedFileFromWebFile(file) : null);
    };

    const handleWindowFocus = () => {
      window.setTimeout(() => {
        finalize(input.files?.[0] ?? null);
      }, 250);
    };

    input.onchange = () => {
      finalize(input.files?.[0] ?? null);
    };

    document.body.appendChild(input);
    window.addEventListener('focus', handleWindowFocus, { once: true });
    input.click();
  });
}

async function pickOwnerMediaImage(source: 'library' | 'camera' = 'library') {
  if (Platform.OS === 'web') {
    return pickOwnerMediaImageFromWeb(source);
  }

  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      throw new Error('Camera permission is required to take storefront photos.');
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.92,
    });

    if (result.canceled || !result.assets?.length) {
      return null;
    }

    const asset = result.assets[0];
    return {
      uri: asset.uri,
      name: asset.fileName ?? `storefront-media-${Date.now()}.jpg`,
      mimeType: asset.mimeType ?? 'image/jpeg',
      size: asset.fileSize ?? null,
      blob: null,
    } satisfies OwnerPortalUploadedFile;
  }

  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Media library permission is required to upload storefront images.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    quality: 0.92,
  });

  if (result.canceled || !result.assets?.length) {
    return null;
  }

  const asset = result.assets[0];
  return {
    uri: asset.uri,
    name: asset.fileName ?? `storefront-media-${Date.now()}.jpg`,
    mimeType: asset.mimeType ?? 'image/jpeg',
    size: asset.fileSize ?? null,
    blob: null,
  } satisfies OwnerPortalUploadedFile;
}

function buildNormalizedProfileToolsInput(input: {
  menuUrl: string;
  cardPhotoUrl: string;
  featuredPhotoUrlsInput: string;
  cardPhotoPath: string | null;
  featuredPhotoPaths: string[];
  verifiedBadgeLabel: string;
  featuredBadgesInput: string;
  cardSummary: string;
}) {
  const menuUrlCandidates = extractHttpUrls(input.menuUrl);
  const cardPhotoCandidates = extractHttpUrls(input.cardPhotoUrl);
  const featuredPhotoCandidates = extractHttpUrls(input.featuredPhotoUrlsInput);
  const normalizedCardPhotoUrl = cardPhotoCandidates[0] ?? null;
  const normalizedFeaturedPhotoUrls = Array.from(
    new Set(
      [normalizedCardPhotoUrl, ...cardPhotoCandidates.slice(1), ...featuredPhotoCandidates].filter(
        (candidate): candidate is string => Boolean(candidate),
      ),
    ),
  ).slice(0, 8);

  return {
    menuUrl: menuUrlCandidates[0] ?? null,
    cardPhotoUrl: normalizedCardPhotoUrl,
    featuredPhotoUrls: normalizedFeaturedPhotoUrls,
    cardPhotoPath: input.cardPhotoPath,
    featuredPhotoPaths: Array.from(
      new Set(
        [input.cardPhotoPath, ...(input.featuredPhotoPaths ?? [])].filter(
          (candidate): candidate is string => Boolean(candidate?.trim()),
        ),
      ),
    ).slice(0, 8),
    verifiedBadgeLabel: input.verifiedBadgeLabel.trim() || null,
    featuredBadges: input.featuredBadgesInput
      .split(',')
      .map((badge) => badge.trim())
      .filter(Boolean),
    cardSummary: input.cardSummary.trim() || null,
  };
}

function isPhoneSizedViewport(width: number) {
  return width < 760;
}

function getProfileToolsRuntimeMessage(
  profileToolsWritesEnabled: boolean,
  safeModeEnabled: boolean,
) {
  if (!profileToolsWritesEnabled) {
    return 'Storefront updates are temporarily paused while the system stabilizes.';
  }

  if (safeModeEnabled) {
    return 'Protected mode is active. You can review the storefront profile, but live updates are monitored more closely.';
  }

  return null;
}

function OwnerPortalProfileToolsScreenInner() {
  const _route = useRoute<OwnerPortalProfileToolsRoute>();
  const { authSession } = useStorefrontProfileController();
  const { width } = useWindowDimensions();
  const isAndroid = Platform.OS === 'android';
  const preview = false;
  const {
    workspace,
    runtimeStatus,
    isLoading,
    isSaving,
    isAiLoading,
    errorText,
    aiErrorText,
    saveProfileTools,
    suggestProfileToolsWithAi,
  } = useOwnerPortalWorkspace(preview);
  const [menuUrl, setMenuUrl] = React.useState('');
  const [cardPhotoUrl, setCardPhotoUrl] = React.useState('');
  const [verifiedBadgeLabel, setVerifiedBadgeLabel] = React.useState('');
  const [featuredBadgesInput, setFeaturedBadgesInput] = React.useState('');
  const [cardSummary, setCardSummary] = React.useState('');
  const [featuredPhotoUrlsInput, setFeaturedPhotoUrlsInput] = React.useState('');
  const [cardPhotoPath, setCardPhotoPath] = React.useState<string | null>(null);
  const [featuredPhotoPaths, setFeaturedPhotoPaths] = React.useState<string[]>([]);
  const [isUploadingMedia, setIsUploadingMedia] = React.useState<null | 'card' | 'gallery'>(null);
  const [mediaStatusNotice, setMediaStatusNotice] = React.useState<MediaStatusNotice | null>(null);
  const [showManualHeroPhotoLink, setShowManualHeroPhotoLink] = React.useState(false);
  const [showManualGalleryPhotoLinks, setShowManualGalleryPhotoLinks] = React.useState(false);
  const [draftHeroPreviewUri, setDraftHeroPreviewUri] = React.useState<string | null>(null);
  const [draftGalleryPreviewUris, setDraftGalleryPreviewUris] = React.useState<string[]>([]);
  const isPhoneViewport = Platform.OS !== 'web' || isPhoneSizedViewport(width);
  const canUseCameraCapture = Platform.OS !== 'web' || isPhoneViewport;

  const profileToolsKey = React.useMemo(() => {
    const pt = workspace?.profileTools;
    if (!pt) return '';
    return [
      pt.menuUrl,
      pt.cardPhotoUrl,
      pt.cardPhotoPath,
      pt.verifiedBadgeLabel,
      pt.cardSummary,
      pt.featuredBadges.join(','),
      pt.featuredPhotoUrls.join(','),
      (pt.featuredPhotoPaths ?? []).join(','),
    ].join('|');
  }, [workspace?.profileTools]);

  React.useEffect(() => {
    const profileTools = workspace?.profileTools;
    if (!profileTools) {
      return;
    }

    setMenuUrl(profileTools.menuUrl ?? '');
    setCardPhotoUrl(profileTools.cardPhotoUrl ?? '');
    setCardPhotoPath(profileTools.cardPhotoPath ?? null);
    setVerifiedBadgeLabel(profileTools.verifiedBadgeLabel ?? '');
    setFeaturedBadgesInput(profileTools.featuredBadges.join(', '));
    setCardSummary(profileTools.cardSummary ?? '');
    setFeaturedPhotoUrlsInput(profileTools.featuredPhotoUrls.join('\n'));
    setFeaturedPhotoPaths([...(profileTools.featuredPhotoPaths ?? [])]);
    setShowManualHeroPhotoLink(Boolean(profileTools.cardPhotoUrl?.trim()));
    setShowManualGalleryPhotoLinks(profileTools.featuredPhotoUrls.length > 0);
    setDraftHeroPreviewUri(null);
    setDraftGalleryPreviewUris([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset local editor state only when the serialized payload changes.
  }, [profileToolsKey]);

  const normalizedInput = React.useMemo(
    () =>
      buildNormalizedProfileToolsInput({
        menuUrl,
        cardPhotoUrl,
        featuredPhotoUrlsInput,
        cardPhotoPath,
        featuredPhotoPaths,
        verifiedBadgeLabel,
        featuredBadgesInput,
        cardSummary,
      }),
    [
      cardPhotoPath,
      cardPhotoUrl,
      cardSummary,
      featuredBadgesInput,
      featuredPhotoPaths,
      featuredPhotoUrlsInput,
      menuUrl,
      verifiedBadgeLabel,
    ],
  );

  const validationError =
    menuUrl.trim() && !normalizedInput.menuUrl
      ? 'Menu or website link must be a valid http or https URL.'
      : cardPhotoUrl.trim() && !normalizedInput.cardPhotoUrl && !normalizedInput.cardPhotoPath
        ? 'Hero photo link must be a valid http or https URL.'
        : featuredPhotoUrlsInput.trim() &&
            normalizedInput.featuredPhotoUrls.length === 0 &&
            normalizedInput.featuredPhotoPaths.length === 0
          ? 'Gallery photo links must contain valid http or https URLs.'
          : null;
  const profileToolsWritesEnabled = runtimeStatus?.policy.profileToolsWritesEnabled !== false;
  const storefrontId = workspace?.activeLocationId ?? workspace?.storefrontSummary?.id ?? null;
  const runtimeMessage = getProfileToolsRuntimeMessage(
    profileToolsWritesEnabled,
    runtimeStatus?.policy.safeModeEnabled === true,
  );
  const draftGalleryPreviewUrls = Array.from(
    new Set([...draftGalleryPreviewUris, ...normalizedInput.featuredPhotoUrls]),
  ).slice(0, 4);
  const heroPreviewUri = draftHeroPreviewUri ?? cardPhotoUrl ?? null;
  const liveGalleryPreviewUrls = workspace?.profileTools?.featuredPhotoUrls.slice(0, 4) ?? [];

  const uploadStorefrontMedia = React.useCallback(
    async (mediaType: 'storefront-card' | 'storefront-gallery', source: 'library' | 'camera') => {
      if (!storefrontId) {
        setMediaStatusNotice({
          tone: 'warning',
          title: 'Connect a storefront first',
          body: 'Connect a claimed storefront before adding gallery photos.',
        });
        return;
      }

      setMediaStatusNotice(null);
      try {
        const file = await pickOwnerMediaImage(source);
        if (!file) {
          return;
        }

        setIsUploadingMedia(mediaType === 'storefront-card' ? 'card' : 'gallery');
        const upload =
          preview || !authSession.uid
            ? {
                filePath: `sandbox/${storefrontId}/${Date.now()}-${file.name}`,
                downloadUrl: file.uri,
              }
            : await uploadOwnerApprovedStorefrontMediaFile({
                ownerUid: authSession.uid,
                dispensaryId: storefrontId,
                mediaType,
                file,
              });

        const nextProfileToolsInput = mergeUploadedStorefrontMediaIntoProfileTools(
          normalizedInput,
          {
            mediaType,
            filePath: upload.filePath,
            downloadUrl: upload.downloadUrl,
          },
        );

        if (nextProfileToolsInput.cardPhotoUrl) {
          setCardPhotoUrl(nextProfileToolsInput.cardPhotoUrl);
        }
        if (nextProfileToolsInput.featuredPhotoUrls?.length) {
          setFeaturedPhotoUrlsInput((nextProfileToolsInput.featuredPhotoUrls ?? []).join('\n'));
        }
        setCardPhotoPath(nextProfileToolsInput.cardPhotoPath ?? null);
        setFeaturedPhotoPaths([...(nextProfileToolsInput.featuredPhotoPaths ?? [])]);
        if (mediaType === 'storefront-card') {
          setDraftHeroPreviewUri(file.previewUri ?? file.uri);
        } else {
          setDraftGalleryPreviewUris((current) =>
            Array.from(new Set([file.previewUri ?? file.uri, ...current])).slice(0, 4),
          );
        }
        setMediaStatusNotice({
          tone: 'success',
          title: mediaType === 'storefront-card' ? 'Hero photo ready' : 'Gallery photo ready',
          body: preview
            ? 'The image is attached to the preview draft and will save locally when you update the storefront.'
            : 'The image is attached to this draft. Save storefront changes to publish it live.',
        });
      } catch (error) {
        setMediaStatusNotice({
          tone: 'danger',
          title: 'Photo upload failed',
          body: error instanceof Error ? error.message : 'Unable to upload storefront media.',
        });
      } finally {
        setIsUploadingMedia(null);
      }
    },
    [authSession.uid, normalizedInput, preview, storefrontId],
  );

  return (
    <ScreenShell
      eyebrow="Owner Portal"
      title="Storefront studio"
      subtitle={
        isAndroid
          ? 'Gallery photos, website link, trust badges, and short copy for your live storefront.'
          : 'Gallery photos, menu link, trust badges, and short copy for your live storefront.'
      }
      headerPill={'Storefront'}
    >
      <MotionInView delay={70}>
        <View style={styles.portalHeroCard}>
          <View style={styles.portalHeroGlow} />
          <Text style={styles.portalHeroKicker}>Storefront gallery</Text>
          <Text numberOfLines={2} style={styles.portalHeroTitle}>
            Shape the first impression customers see before they ever tap in.
          </Text>
          <Text numberOfLines={2} style={styles.portalHeroBody}>
            Update the hero image, gallery, menu link, and short copy from one polished editor.
          </Text>
          <View style={styles.portalHeroMetricRow}>
            <View style={styles.portalHeroMetricCard}>
              <Text style={styles.portalHeroMetricValue}>
                {workspace?.metrics.followerCount ?? 0}
              </Text>
              <Text style={styles.portalHeroMetricLabel}>Saved Followers</Text>
            </View>
            <View style={styles.portalHeroMetricCard}>
              <Text style={styles.portalHeroMetricValue}>
                {workspace?.metrics.storefrontOpenCount7d ?? 0}
              </Text>
              <Text style={styles.portalHeroMetricLabel}>Opens This Week</Text>
            </View>
            <View style={styles.portalHeroMetricCard}>
              <Text style={styles.portalHeroMetricValue}>
                {workspace?.profileTools?.featuredPhotoUrls.length ?? 0}
              </Text>
              <Text style={styles.portalHeroMetricLabel}>Gallery Photos</Text>
            </View>
          </View>
        </View>
      </MotionInView>

      <MotionInView delay={120}>
        <SectionCard
          title="Storefront snapshot"
          body="How your listing currently reads on cards and detail pages."
        >
          {runtimeMessage ? (
            <InlineFeedbackPanel
              tone={runtimeStatus?.policy.safeModeEnabled ? 'warning' : 'success'}
              iconName={
                runtimeStatus?.policy.safeModeEnabled
                  ? 'shield-outline'
                  : 'shield-checkmark-outline'
              }
              label="Update status"
              title={
                runtimeStatus?.policy.safeModeEnabled
                  ? 'Protected mode is active'
                  : 'Storefront updates are live'
              }
              body={runtimeMessage}
            />
          ) : null}
          {isLoading ? (
            <InlineFeedbackPanel
              tone="info"
              iconName="time-outline"
              label="Storefront profile"
              title="Loading storefront profile"
              body="Canopy Trove is syncing the current storefront presentation."
            />
          ) : null}
          {errorText ? (
            <InlineFeedbackPanel
              tone="danger"
              iconName="alert-circle-outline"
              label="Storefront profile"
              title="Storefront profile could not load"
              body={errorText}
            />
          ) : null}
          {aiErrorText ? (
            <InlineFeedbackPanel
              tone="danger"
              iconName="sparkles-outline"
              label="AI assistant"
              title="AI storefront guidance could not complete"
              body={aiErrorText}
            />
          ) : null}
          <View style={styles.metricGrid}>
            <View style={[styles.metricCard, styles.metricCardWarm]}>
              <Text style={styles.metricValue}>{workspace?.metrics.followerCount ?? 0}</Text>
              <Text style={styles.metricLabel}>Saved Followers</Text>
              <Text style={styles.metricHelper}>
                {Platform.OS === 'android'
                  ? 'Users waiting for a better listing or a fresh update.'
                  : 'Users waiting for a better listing or a fresh deal.'}
              </Text>
            </View>
            <View style={[styles.metricCard, styles.metricCardSuccess]}>
              <Text style={styles.metricValue}>
                {workspace?.metrics.storefrontOpenCount7d ?? 0}
              </Text>
              <Text style={styles.metricLabel}>Opens This Week</Text>
              <Text style={styles.metricHelper}>
                Storefront detail visits from the current card surface.
              </Text>
            </View>
          </View>
        </SectionCard>
      </MotionInView>

      <MotionInView delay={200}>
        <SectionCard
          title="Edit storefront profile"
          body="Add photos, refine the intro copy, and update the details customers see first."
        >
          <View style={styles.sectionStack}>
            <InlineFeedbackPanel
              tone="info"
              iconName="images-outline"
              label={isPhoneViewport ? 'Phone photo flow' : 'Desktop photo flow'}
              title={
                isPhoneViewport
                  ? 'Use your camera or your photo library'
                  : 'Upload photos from this device'
              }
              body={
                isPhoneViewport
                  ? 'Take Photo opens the camera on most phones. Choose From Photos opens your photo library. Photo links are optional and only for images that already live on your website or another hosted link.'
                  : 'Upload photos from this device. Photo links are optional and only for images that already live on your website or another hosted link.'
              }
            />
            <View style={styles.plannerPanel}>
              <View style={styles.splitHeaderRow}>
                <View style={styles.splitHeaderCopy}>
                  <Text style={styles.sectionEyebrow}>Front of house</Text>
                  <Text style={styles.splitHeaderTitle}>
                    {isAndroid ? 'Website link and hero image' : 'Menu link and hero image'}
                  </Text>
                  <Text numberOfLines={2} style={styles.splitHeaderBody}>
                    These are the first details people see on the storefront card.
                  </Text>
                </View>
                <AppUiIcon name="compass-outline" size={20} color="#F5C86A" />
              </View>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>
                  {isAndroid ? 'Website link' : 'Menu or website link'}
                </Text>
                <Text numberOfLines={2} style={styles.fieldHint}>
                  {isAndroid
                    ? 'Add the main website page customers should open from your storefront.'
                    : 'Use your menu if you have one. Otherwise add the best page on your website for customers.'}
                </Text>
                <TextInput
                  accessibilityLabel={isAndroid ? 'Website link' : 'Menu or website link'}
                  accessibilityHint={
                    isAndroid
                      ? 'Sets the main website link shown on the storefront.'
                      : 'Sets the main menu or website link shown on the storefront.'
                  }
                  value={menuUrl}
                  onChangeText={setMenuUrl}
                  placeholder={isAndroid ? 'Website link' : 'Menu or website link'}
                  placeholderTextColor={colors.textSoft}
                  style={styles.inputPremium}
                  editable={isUploadingMedia === null}
                />
              </View>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Hero photo</Text>
                <Text numberOfLines={2} style={styles.fieldHint}>
                  {isPhoneViewport
                    ? 'Take a fresh photo or pick one from your phone. Use a photo link only if the image already lives on your website.'
                    : 'Upload a hero image from this device. Use a photo link only if the image already lives on your website.'}
                </Text>
                <View style={styles.toolbarRow}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Choose hero photo from library"
                    accessibilityHint="Upload a hero photo from your library."
                    disabled={
                      preview ||
                      !profileToolsWritesEnabled ||
                      isUploadingMedia !== null ||
                      !storefrontId
                    }
                    onPress={() => {
                      void uploadStorefrontMedia('storefront-card', 'library');
                    }}
                    style={[
                      styles.uploadButton,
                      styles.mediaActionButton,
                      isPhoneViewport && styles.mediaActionButtonCompact,
                      (preview ||
                        !profileToolsWritesEnabled ||
                        isUploadingMedia !== null ||
                        !storefrontId) &&
                        styles.buttonDisabled,
                    ]}
                  >
                    <AppUiIcon name="images-outline" size={18} color="#00F58C" />
                    <Text style={styles.uploadButtonText}>
                      {isUploadingMedia === 'card'
                        ? 'Adding Hero Photo...'
                        : isPhoneViewport
                          ? 'Choose From Photos'
                          : 'Upload Hero Photo'}
                    </Text>
                  </Pressable>
                  {canUseCameraCapture ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Take hero photo"
                      accessibilityHint="Use your camera for a new hero photo."
                      disabled={
                        preview ||
                        !profileToolsWritesEnabled ||
                        isUploadingMedia !== null ||
                        !storefrontId
                      }
                      onPress={() => {
                        void uploadStorefrontMedia('storefront-card', 'camera');
                      }}
                      style={[
                        styles.secondaryButton,
                        styles.mediaActionButton,
                        isPhoneViewport && styles.mediaActionButtonCompact,
                        (preview ||
                          !profileToolsWritesEnabled ||
                          isUploadingMedia !== null ||
                          !storefrontId) &&
                          styles.buttonDisabled,
                      ]}
                    >
                      <Text style={styles.secondaryButtonText}>Take Photo</Text>
                    </Pressable>
                  ) : null}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      showManualHeroPhotoLink
                        ? 'Hide manual hero photo link'
                        : 'Use manual hero photo link'
                    }
                    accessibilityHint="Shows or hides the optional manual hero photo link field."
                    disabled={isUploadingMedia !== null}
                    onPress={() => {
                      setShowManualHeroPhotoLink((current) => !current);
                    }}
                    style={[
                      styles.secondaryButton,
                      styles.mediaLinkToggleButton,
                      isUploadingMedia !== null && styles.buttonDisabled,
                    ]}
                  >
                    <Text style={styles.secondaryButtonText}>
                      {showManualHeroPhotoLink ? 'Hide Web Photo Link' : 'Use Web Photo Link'}
                    </Text>
                  </Pressable>
                </View>
                {showManualHeroPhotoLink ? (
                  <>
                    <Text style={styles.fieldLabel}>Hero photo link (advanced)</Text>
                    <Text numberOfLines={2} style={styles.fieldHint}>
                      Only use this if the hero image already has its own direct web link.
                    </Text>
                    <TextInput
                      accessibilityLabel="Hero photo link"
                      accessibilityHint="Sets the main storefront card image using a direct image link."
                      value={cardPhotoUrl}
                      onChangeText={(value) => {
                        setCardPhotoUrl(value);
                        setDraftHeroPreviewUri(null);
                      }}
                      placeholder="Hero photo link"
                      placeholderTextColor={colors.textSoft}
                      style={styles.inputPremium}
                      editable={isUploadingMedia === null}
                    />
                  </>
                ) : null}
                {heroPreviewUri ? (
                  <Image
                    source={{ uri: heroPreviewUri }}
                    style={styles.uploadPreview}
                    accessibilityLabel="Hero photo preview"
                  />
                ) : null}
              </View>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Storefront intro</Text>
                <Text numberOfLines={1} style={styles.fieldHint}>
                  A short sentence that tells people what makes the storefront worth opening.
                </Text>
                <TextInput
                  accessibilityLabel="Storefront intro"
                  accessibilityHint="Sets the short summary shown on the storefront card."
                  value={cardSummary}
                  onChangeText={setCardSummary}
                  placeholder="Short storefront intro"
                  placeholderTextColor={colors.textSoft}
                  multiline={true}
                  style={[styles.inputPremium, styles.textAreaPremium]}
                  editable={isUploadingMedia === null}
                />
              </View>
            </View>

            <View style={styles.plannerPanel}>
              <View style={styles.splitHeaderRow}>
                <View style={styles.splitHeaderCopy}>
                  <Text style={styles.sectionEyebrow}>Trust signals</Text>
                  <Text style={styles.splitHeaderTitle}>Verified label and featured badges</Text>
                  <Text numberOfLines={2} style={styles.splitHeaderBody}>
                    Keep these short and clean so the storefront feels credible at a glance.
                  </Text>
                </View>
                <AppUiIcon name="ribbon-outline" size={20} color="#F5C86A" />
              </View>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Verified badge label</Text>
                <TextInput
                  accessibilityLabel="Verified badge label"
                  accessibilityHint="Sets the verified-owner badge text shown on the storefront."
                  value={verifiedBadgeLabel}
                  onChangeText={setVerifiedBadgeLabel}
                  placeholder="Verified badge label"
                  placeholderTextColor={colors.textSoft}
                  style={styles.inputPremium}
                  editable={isUploadingMedia === null}
                />
              </View>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Featured badges</Text>
                <TextInput
                  accessibilityLabel="Featured badges"
                  accessibilityHint="Enter comma-separated featured badges for the storefront."
                  value={featuredBadgesInput}
                  onChangeText={setFeaturedBadgesInput}
                  placeholder="Featured badges, comma separated"
                  placeholderTextColor={colors.textSoft}
                  style={styles.inputPremium}
                  editable={isUploadingMedia === null}
                />
              </View>
            </View>

            <View style={styles.plannerPanel}>
              <View style={styles.splitHeaderRow}>
                <View style={styles.splitHeaderCopy}>
                  <Text style={styles.sectionEyebrow}>Gallery</Text>
                  <Text style={styles.splitHeaderTitle}>Storefront and product photos</Text>
                  <Text numberOfLines={2} style={styles.splitHeaderBody}>
                    Add interior shots, product close-ups, or any image that sells the storefront.
                  </Text>
                </View>
                <AppUiIcon name="images-outline" size={20} color="#8EDCFF" />
              </View>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Gallery photos</Text>
                <Text numberOfLines={2} style={styles.fieldHint}>
                  {isPhoneViewport
                    ? 'Use your phone camera or photo library for most gallery photos. Add web photo links only if those images already live online.'
                    : 'Upload gallery photos from this device. Add web photo links only if those images already live online.'}
                </Text>
                <View style={styles.toolbarRow}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Choose gallery photo from library"
                    accessibilityHint="Upload a gallery photo from your library."
                    disabled={
                      preview ||
                      !profileToolsWritesEnabled ||
                      isUploadingMedia !== null ||
                      !storefrontId
                    }
                    onPress={() => {
                      void uploadStorefrontMedia('storefront-gallery', 'library');
                    }}
                    style={[
                      styles.uploadButton,
                      styles.mediaActionButton,
                      isPhoneViewport && styles.mediaActionButtonCompact,
                      (preview ||
                        !profileToolsWritesEnabled ||
                        isUploadingMedia !== null ||
                        !storefrontId) &&
                        styles.buttonDisabled,
                    ]}
                  >
                    <AppUiIcon name="images-outline" size={18} color="#00F58C" />
                    <Text style={styles.uploadButtonText}>
                      {isUploadingMedia === 'gallery'
                        ? 'Adding Gallery Photo...'
                        : isPhoneViewport
                          ? 'Choose From Photos'
                          : 'Upload Gallery Photo'}
                    </Text>
                  </Pressable>
                  {canUseCameraCapture ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Take gallery photo"
                      accessibilityHint="Use your camera for a new gallery photo."
                      disabled={
                        preview ||
                        !profileToolsWritesEnabled ||
                        isUploadingMedia !== null ||
                        !storefrontId
                      }
                      onPress={() => {
                        void uploadStorefrontMedia('storefront-gallery', 'camera');
                      }}
                      style={[
                        styles.secondaryButton,
                        styles.mediaActionButton,
                        isPhoneViewport && styles.mediaActionButtonCompact,
                        (preview ||
                          !profileToolsWritesEnabled ||
                          isUploadingMedia !== null ||
                          !storefrontId) &&
                          styles.buttonDisabled,
                      ]}
                    >
                      <Text style={styles.secondaryButtonText}>Take Photo</Text>
                    </Pressable>
                  ) : null}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      showManualGalleryPhotoLinks
                        ? 'Hide manual gallery photo links'
                        : 'Use manual gallery photo links'
                    }
                    accessibilityHint="Shows or hides the optional manual gallery photo link field."
                    disabled={isUploadingMedia !== null}
                    onPress={() => {
                      setShowManualGalleryPhotoLinks((current) => !current);
                    }}
                    style={[
                      styles.secondaryButton,
                      styles.mediaLinkToggleButton,
                      isUploadingMedia !== null && styles.buttonDisabled,
                    ]}
                  >
                    <Text style={styles.secondaryButtonText}>
                      {showManualGalleryPhotoLinks ? 'Hide Web Photo Links' : 'Use Web Photo Links'}
                    </Text>
                  </Pressable>
                </View>
                {showManualGalleryPhotoLinks ? (
                  <>
                    <Text style={styles.fieldLabel}>Gallery photo links (advanced)</Text>
                    <Text numberOfLines={2} style={styles.fieldHint}>
                      Only use this if the gallery photos already have direct web links. Add one
                      image link per line.
                    </Text>
                    <TextInput
                      accessibilityLabel="Gallery photo links"
                      accessibilityHint="Enter one gallery photo link per line for the storefront."
                      value={featuredPhotoUrlsInput}
                      onChangeText={(value) => {
                        setFeaturedPhotoUrlsInput(value);
                        setDraftGalleryPreviewUris([]);
                      }}
                      placeholder="Gallery photo links, one per line"
                      placeholderTextColor={colors.textSoft}
                      multiline={true}
                      style={[styles.inputPremium, styles.textAreaPremium]}
                      editable={isUploadingMedia === null}
                    />
                  </>
                ) : null}
                <Text style={styles.helperText}>
                  Best results: mix one storefront-wide image with a few close, detail-rich shots.
                </Text>
                {draftGalleryPreviewUrls.length ? (
                  <View style={styles.uploadPreviewRow}>
                    {draftGalleryPreviewUrls.map((photoUrl) => (
                      <Image
                        key={photoUrl}
                        source={{ uri: photoUrl }}
                        style={styles.uploadPreviewThumb}
                        accessibilityLabel="Gallery photo preview"
                      />
                    ))}
                  </View>
                ) : null}
              </View>
            </View>

            <View style={styles.ctaPanel}>
              <View style={styles.splitHeaderRow}>
                <View style={styles.splitHeaderCopy}>
                  <Text style={styles.sectionEyebrow}>Publish changes</Text>
                  <Text style={styles.splitHeaderTitle}>
                    Save the storefront customers will see
                  </Text>
                  <Text numberOfLines={2} style={styles.splitHeaderBody}>
                    {isAndroid
                      ? 'Save the current photos, intro copy, website link, and trust details to the live listing.'
                      : 'Save the current photos, intro copy, menu link, and trust details to the live listing.'}
                  </Text>
                </View>
                <AppUiIcon name={'save-outline'} size={20} color={'#F5C86A'} />
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Polish storefront copy with AI"
                accessibilityHint="Generates suggested storefront summary and badge content."
                disabled={preview || isAiLoading || isUploadingMedia !== null}
                onPress={() => {
                  void suggestProfileToolsWithAi({
                    focus: 'summary-and-badges',
                  })
                    .then((suggestion) => {
                      setCardSummary(suggestion.cardSummary);
                      setVerifiedBadgeLabel(suggestion.verifiedBadgeLabel ?? '');
                      setFeaturedBadgesInput(suggestion.featuredBadges.join(', '));
                    })
                    .catch(logSilentError('suggestProfileTools'));
                }}
                style={[
                  styles.secondaryButton,
                  (preview || isAiLoading || isUploadingMedia !== null) && styles.buttonDisabled,
                ]}
              >
                <Text style={styles.secondaryButtonText}>
                  {preview ? 'Preview Only' : isAiLoading ? 'Polishing...' : 'Polish the Copy'}
                </Text>
              </Pressable>
              {validationError ? (
                <InlineFeedbackPanel
                  tone="danger"
                  iconName="alert-circle-outline"
                  label="Validation"
                  title="Storefront profile needs one more fix"
                  body={validationError}
                />
              ) : null}
              {mediaStatusNotice ? (
                <InlineFeedbackPanel
                  tone={mediaStatusNotice.tone}
                  iconName={
                    mediaStatusNotice.tone === 'success'
                      ? 'images-outline'
                      : mediaStatusNotice.tone === 'info'
                        ? 'time-outline'
                        : 'alert-circle-outline'
                  }
                  label="Media publish"
                  title={mediaStatusNotice.title}
                  body={mediaStatusNotice.body}
                />
              ) : null}
              <Text numberOfLines={2} style={styles.helperText}>
                The hero photo becomes the storefront thumbnail, and gallery photos appear on the
                detail page.
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Save storefront profile"
                accessibilityHint={
                  isAndroid
                    ? 'Publishes the current website, media, and storefront presentation changes.'
                    : 'Publishes the current menu, media, and storefront presentation changes.'
                }
                disabled={
                  preview ||
                  isSaving ||
                  isUploadingMedia !== null ||
                  !profileToolsWritesEnabled ||
                  Boolean(validationError)
                }
                onPress={() => {
                  void saveProfileTools(normalizedInput).catch(logSilentError('saveProfileTools'));
                }}
                style={[
                  styles.primaryButton,
                  (preview ||
                    isSaving ||
                    isUploadingMedia !== null ||
                    !profileToolsWritesEnabled ||
                    Boolean(validationError)) &&
                    styles.buttonDisabled,
                ]}
              >
                <Text style={styles.primaryButtonText}>
                  {preview
                    ? 'Preview Only'
                    : !profileToolsWritesEnabled
                      ? 'Storefront Updates Paused'
                      : isSaving
                        ? 'Saving...'
                        : 'Save Storefront Changes'}
                </Text>
              </Pressable>
            </View>
          </View>
        </SectionCard>
      </MotionInView>

      <MotionInView delay={280}>
        <SectionCard title="Live storefront snapshot" body="What customers see right now.">
          <View style={styles.cardStack}>
            <View style={styles.actionTile}>
              <View style={styles.splitHeaderRow}>
                <View style={styles.splitHeaderCopy}>
                  <Text style={styles.actionTileMeta}>
                    {isAndroid ? 'Website + intro copy' : 'Menu + intro copy'}
                  </Text>
                  <Text style={styles.actionTileTitle}>Headline details</Text>
                  <Text numberOfLines={2} style={styles.actionTileBody}>
                    The first text customers see before they open the storefront.
                  </Text>
                </View>
                <AppUiIcon name="compass-outline" size={20} color="#F5C86A" />
              </View>
              <Text style={styles.resultMeta}>{isAndroid ? 'Website Link' : 'Menu Link'}</Text>
              <Text numberOfLines={1} style={styles.helperText}>
                {workspace?.profileTools?.menuUrl ?? 'Not set'}
              </Text>
              <Text style={styles.resultMeta}>Card Summary</Text>
              <Text numberOfLines={2} style={styles.helperText}>
                {workspace?.profileTools?.cardSummary ?? 'Not set'}
              </Text>
            </View>

            <View style={[styles.actionTile, styles.metricCardWarm]}>
              <View style={styles.splitHeaderRow}>
                <View style={styles.splitHeaderCopy}>
                  <Text style={styles.actionTileMeta}>Trust + badges</Text>
                  <Text style={styles.actionTileTitle}>Confidence details</Text>
                  <Text numberOfLines={2} style={styles.actionTileBody}>
                    Verified language and featured tags that support the storefront at a glance.
                  </Text>
                </View>
                <AppUiIcon name="ribbon-outline" size={20} color="#F5C86A" />
              </View>
              <View style={styles.tagRow}>
                {(workspace?.profileTools?.featuredBadges.length
                  ? workspace.profileTools.featuredBadges
                  : ['Not set']
                ).map((badge) => (
                  <View key={badge} style={styles.tag}>
                    <Text numberOfLines={1} style={styles.tagText}>
                      {badge}
                    </Text>
                  </View>
                ))}
              </View>
              <Text style={styles.resultMeta}>
                Verified badge label: {workspace?.profileTools?.verifiedBadgeLabel ?? 'Not set'}
              </Text>
            </View>

            <View style={[styles.actionTile, styles.metricCardCyan]}>
              <View style={styles.splitHeaderRow}>
                <View style={styles.splitHeaderCopy}>
                  <Text style={styles.actionTileMeta}>Gallery</Text>
                  <Text style={styles.actionTileTitle}>Storefront photo lineup</Text>
                  <Text numberOfLines={2} style={styles.actionTileBody}>
                    The hero image and gallery photos customers can browse today.
                  </Text>
                </View>
                <AppUiIcon name="images-outline" size={20} color="#8EDCFF" />
              </View>
              <Text style={styles.helperText}>
                {workspace?.profileTools?.featuredPhotoUrls.length ?? 0} gallery photos ready
              </Text>
              <Text style={styles.resultMeta}>
                Hero photo:{' '}
                {workspace?.profileTools?.cardPhotoUrl || workspace?.profileTools?.cardPhotoPath
                  ? 'Ready'
                  : 'Not set'}
              </Text>
              <Text style={styles.resultMeta}>
                Gallery photos: {workspace?.profileTools?.featuredPhotoUrls.length ?? 0}
              </Text>
              <Text style={styles.resultMeta}>
                Photo source:{' '}
                {workspace?.profileTools?.cardPhotoPath ||
                (workspace?.profileTools?.featuredPhotoPaths?.length ?? 0) > 0
                  ? 'uploaded from your device'
                  : (workspace?.profileTools?.featuredPhotoUrls.length ?? 0) > 0 ||
                      workspace?.profileTools?.cardPhotoUrl
                    ? 'saved from web photo links'
                    : 'none yet'}
              </Text>
              {liveGalleryPreviewUrls.length ? (
                <View style={styles.uploadPreviewRow}>
                  {liveGalleryPreviewUrls.map((photoUrl) => (
                    <Image
                      key={photoUrl}
                      source={{ uri: photoUrl }}
                      style={styles.uploadPreviewThumb}
                      accessibilityLabel="Live gallery photo preview"
                    />
                  ))}
                </View>
              ) : null}
            </View>
          </View>
        </SectionCard>
      </MotionInView>
    </ScreenShell>
  );
}

export const OwnerPortalProfileToolsScreen = withScreenErrorBoundary(
  OwnerPortalProfileToolsScreenInner,
  'owner-portal-profile-tools',
);

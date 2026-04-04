import React from 'react';
import type { RouteProp } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { Image, Pressable, Text, TextInput, View } from 'react-native';
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
const ignoreAsyncError = () => undefined;

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

async function pickOwnerMediaImage() {
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

function getProfileToolsRuntimeMessage(
  profileToolsWritesEnabled: boolean,
  safeModeEnabled: boolean,
) {
  if (!profileToolsWritesEnabled) {
    return 'Profile tool updates are temporarily paused while the system stabilizes.';
  }

  if (safeModeEnabled) {
    return 'Protected mode is active. You can review the profile surface, but live updates are monitored more closely.';
  }

  return null;
}

export function OwnerPortalProfileToolsScreen() {
  const _route = useRoute<OwnerPortalProfileToolsRoute>();
  const { authSession } = useStorefrontProfileController();
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
      ? 'Menu link must be a valid http or https URL.'
      : cardPhotoUrl.trim() && !normalizedInput.cardPhotoUrl && !normalizedInput.cardPhotoPath
        ? 'Card photo needs at least one valid http or https URL.'
        : featuredPhotoUrlsInput.trim() &&
            normalizedInput.featuredPhotoUrls.length === 0 &&
            normalizedInput.featuredPhotoPaths.length === 0
          ? 'Feature photo list must contain valid http or https URLs.'
          : null;
  const profileToolsWritesEnabled = runtimeStatus?.policy.profileToolsWritesEnabled !== false;
  const storefrontId = workspace?.storefrontSummary?.id ?? null;
  const runtimeMessage = getProfileToolsRuntimeMessage(
    profileToolsWritesEnabled,
    runtimeStatus?.policy.safeModeEnabled === true,
  );

  const uploadStorefrontMedia = React.useCallback(
    async (mediaType: 'storefront-card' | 'storefront-gallery') => {
      if (!storefrontId) {
        setMediaStatusNotice({
          tone: 'warning',
          title: 'Connect a claimed storefront first',
          body: 'Connect a claimed storefront before uploading premium media.',
        });
        return;
      }

      setMediaStatusNotice(null);
      try {
        const file = await pickOwnerMediaImage();
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
        setMediaStatusNotice({
          tone: 'success',
          title: 'Storefront media staged',
          body: preview
            ? 'The image is attached to the preview storefront draft and will save locally when you update profile tools.'
            : 'The uploaded image is attached to this draft. Save profile tools to publish it live.',
        });
      } catch (error) {
        setMediaStatusNotice({
          tone: 'danger',
          title: 'Storefront media upload failed',
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
      title="Storefront profile tools"
      subtitle="Photos, menu link, badges, and copy for the storefront card."
      headerPill={'Profile'}
    >
      <MotionInView delay={70}>
        <View style={styles.portalHeroCard}>
          <View style={styles.portalHeroGlow} />
          <Text style={styles.portalHeroKicker}>Premium profile surface</Text>
          <Text numberOfLines={2} style={styles.portalHeroTitle}>
            Make the storefront feel curated, verified, and worth opening.
          </Text>
          <Text numberOfLines={2} style={styles.portalHeroBody}>
            Card photo, gallery, menu link, badges, and the copy customers see first.
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
              <Text style={styles.portalHeroMetricLabel}>Premium Photos</Text>
            </View>
          </View>
        </View>
      </MotionInView>

      <MotionInView delay={120}>
        <SectionCard
          title="Conversion snapshot"
          body="How the storefront reads on cards and detail pages."
        >
          {runtimeMessage ? (
            <InlineFeedbackPanel
              tone={runtimeStatus?.policy.safeModeEnabled ? 'warning' : 'success'}
              iconName={
                runtimeStatus?.policy.safeModeEnabled
                  ? 'shield-outline'
                  : 'shield-checkmark-outline'
              }
              label="Runtime state"
              title={
                runtimeStatus?.policy.safeModeEnabled
                  ? 'Protected mode is active'
                  : 'Profile tools are live'
              }
              body={runtimeMessage}
            />
          ) : null}
          {isLoading ? (
            <InlineFeedbackPanel
              tone="info"
              iconName="time-outline"
              label="Workspace state"
              title="Loading profile tools"
              body="Canopy Trove is syncing the current premium storefront presentation."
            />
          ) : null}
          {errorText ? (
            <InlineFeedbackPanel
              tone="danger"
              iconName="alert-circle-outline"
              label="Workspace issue"
              title="Profile tools could not load"
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
                Users waiting for a better listing or a fresh deal.
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
          title="Edit premium listing tools"
          body="Upload media or paste URLs. These feed the card and detail page."
        >
          <View style={styles.sectionStack}>
            <View style={styles.plannerPanel}>
              <View style={styles.splitHeaderRow}>
                <View style={styles.splitHeaderCopy}>
                  <Text style={styles.sectionEyebrow}>Storefront essentials</Text>
                  <Text style={styles.splitHeaderTitle}>Primary link and headline image</Text>
                  <Text numberOfLines={2} style={styles.splitHeaderBody}>
                    The first impression on the storefront card.
                  </Text>
                </View>
                <AppUiIcon name="compass-outline" size={20} color="#F5C86A" />
              </View>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Menu link</Text>
                <Text numberOfLines={2} style={styles.fieldHint}>
                  First valid URL is used as the live menu link.
                </Text>
                <TextInput
                  accessibilityLabel="Menu link"
                  accessibilityHint="Sets the menu URL shown on the storefront."
                  value={menuUrl}
                  onChangeText={setMenuUrl}
                  placeholder="Menu link"
                  placeholderTextColor="#738680"
                  style={styles.inputPremium}
                  editable={isUploadingMedia === null}
                />
              </View>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Card photo URL</Text>
                <Text numberOfLines={2} style={styles.fieldHint}>
                  Paste a public image URL or upload one below.
                </Text>
                <TextInput
                  accessibilityLabel="Card photo URL"
                  accessibilityHint="Sets the main storefront card image URL."
                  value={cardPhotoUrl}
                  onChangeText={setCardPhotoUrl}
                  placeholder="Card photo URL"
                  placeholderTextColor="#738680"
                  style={styles.inputPremium}
                  editable={isUploadingMedia === null}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Upload storefront card image"
                  accessibilityHint="Upload a card photo from your library."
                  disabled={
                    preview ||
                    !profileToolsWritesEnabled ||
                    isUploadingMedia !== null ||
                    !storefrontId
                  }
                  onPress={() => {
                    void uploadStorefrontMedia('storefront-card');
                  }}
                  style={[
                    styles.uploadButton,
                    (preview ||
                      !profileToolsWritesEnabled ||
                      isUploadingMedia !== null ||
                      !storefrontId) &&
                      styles.buttonDisabled,
                  ]}
                >
                  <AppUiIcon name="camera-outline" size={18} color="#00F58C" />
                  <Text style={styles.uploadButtonText}>
                    {isUploadingMedia === 'card' ? 'Uploading Card Photo...' : 'Upload Card Photo'}
                  </Text>
                </Pressable>
                {cardPhotoUrl ? (
                  <Image
                    source={{ uri: cardPhotoUrl }}
                    style={styles.uploadPreview}
                    accessibilityLabel="Card photo preview"
                  />
                ) : null}
              </View>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Card summary</Text>
                <Text numberOfLines={1} style={styles.fieldHint}>
                  Short copy shown on the storefront card.
                </Text>
                <TextInput
                  accessibilityLabel="Card summary"
                  accessibilityHint="Sets the short summary shown on the storefront card."
                  value={cardSummary}
                  onChangeText={setCardSummary}
                  placeholder="Card summary"
                  placeholderTextColor="#738680"
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
                  <Text style={styles.splitHeaderTitle}>Verified language and featured badges</Text>
                  <Text numberOfLines={2} style={styles.splitHeaderBody}>
                    Short labels that build trust on the card.
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
                  placeholderTextColor="#738680"
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
                  placeholderTextColor="#738680"
                  style={styles.inputPremium}
                  editable={isUploadingMedia === null}
                />
              </View>
            </View>

            <View style={styles.plannerPanel}>
              <View style={styles.splitHeaderRow}>
                <View style={styles.splitHeaderCopy}>
                  <Text style={styles.sectionEyebrow}>Media library</Text>
                  <Text style={styles.splitHeaderTitle}>Feature photo stack</Text>
                  <Text numberOfLines={2} style={styles.splitHeaderBody}>
                    One URL per line, or upload below.
                  </Text>
                </View>
                <AppUiIcon name="images-outline" size={20} color="#8EDCFF" />
              </View>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Feature photo URLs</Text>
                <Text numberOfLines={2} style={styles.fieldHint}>
                  One URL per line, or upload and the link is added for you.
                </Text>
                <TextInput
                  accessibilityLabel="Feature photo URLs"
                  accessibilityHint="Enter one feature photo URL per line for the storefront gallery."
                  value={featuredPhotoUrlsInput}
                  onChangeText={setFeaturedPhotoUrlsInput}
                  placeholder="Feature photo URLs, one per line"
                  placeholderTextColor="#738680"
                  multiline={true}
                  style={[styles.inputPremium, styles.textAreaPremium]}
                  editable={isUploadingMedia === null}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Upload storefront gallery image"
                  accessibilityHint="Upload a gallery photo from your library."
                  disabled={
                    preview ||
                    !profileToolsWritesEnabled ||
                    isUploadingMedia !== null ||
                    !storefrontId
                  }
                  onPress={() => {
                    void uploadStorefrontMedia('storefront-gallery');
                  }}
                  style={[
                    styles.uploadButton,
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
                      ? 'Uploading Gallery Photo...'
                      : 'Add Gallery Photo'}
                  </Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.ctaPanel}>
              <View style={styles.splitHeaderRow}>
                <View style={styles.splitHeaderCopy}>
                  <Text style={styles.sectionEyebrow}>Save changes</Text>
                  <Text style={styles.splitHeaderTitle}>Commit the current premium surface</Text>
                  <Text numberOfLines={2} style={styles.splitHeaderBody}>
                    Publish current edits to the live storefront.
                  </Text>
                </View>
                <AppUiIcon name={'save-outline'} size={20} color={'#F5C86A'} />
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Draft profile tools with AI"
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
                    .catch(ignoreAsyncError);
                }}
                style={[
                  styles.secondaryButton,
                  (preview || isAiLoading || isUploadingMedia !== null) && styles.buttonDisabled,
                ]}
              >
                <Text style={styles.secondaryButtonText}>
                  {preview ? 'Preview Only' : isAiLoading ? 'Improving...' : 'Improve With AI'}
                </Text>
              </Pressable>
              {validationError ? (
                <InlineFeedbackPanel
                  tone="danger"
                  iconName="alert-circle-outline"
                  label="Validation"
                  title="Profile tools need one more fix"
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
                Card photo becomes the thumbnail; gallery photos flow to the detail page.
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Save storefront profile tools"
                accessibilityHint="Publishes the current menu, media, and storefront presentation changes."
                disabled={
                  preview ||
                  isSaving ||
                  isUploadingMedia !== null ||
                  !profileToolsWritesEnabled ||
                  Boolean(validationError)
                }
                onPress={() => {
                  void saveProfileTools(normalizedInput).catch(ignoreAsyncError);
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
                      ? 'Profile Tools Paused'
                      : isSaving
                        ? 'Saving...'
                        : 'Save Profile Tools'}
                </Text>
              </Pressable>
            </View>
          </View>
        </SectionCard>
      </MotionInView>

      <MotionInView delay={280}>
        <SectionCard title="Current premium surface" body="What customers see right now.">
          <View style={styles.cardStack}>
            <View style={styles.actionTile}>
              <View style={styles.splitHeaderRow}>
                <View style={styles.splitHeaderCopy}>
                  <Text style={styles.actionTileMeta}>Menu + card copy</Text>
                  <Text style={styles.actionTileTitle}>Primary storefront presentation</Text>
                  <Text numberOfLines={2} style={styles.actionTileBody}>
                    Menu link and card summary shown to customers.
                  </Text>
                </View>
                <AppUiIcon name="compass-outline" size={20} color="#F5C86A" />
              </View>
              <Text style={styles.resultMeta}>Menu Link</Text>
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
                  <Text style={styles.actionTileMeta}>Badges + trust</Text>
                  <Text style={styles.actionTileTitle}>Verified storefront accents</Text>
                  <Text numberOfLines={2} style={styles.actionTileBody}>
                    Verified label and featured tags on the card.
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
                  <Text style={styles.actionTileMeta}>Photo library</Text>
                  <Text style={styles.actionTileTitle}>Premium photo readiness</Text>
                  <Text numberOfLines={2} style={styles.actionTileBody}>
                    Photos available for the storefront gallery.
                  </Text>
                </View>
                <AppUiIcon name="images-outline" size={20} color="#8EDCFF" />
              </View>
              <Text style={styles.helperText}>
                {workspace?.profileTools?.featuredPhotoUrls.length ?? 0} premium photos ready
              </Text>
              <Text style={styles.resultMeta}>
                Card photo URL: {workspace?.profileTools?.cardPhotoUrl ?? 'Not set'}
              </Text>
              <Text style={styles.resultMeta}>
                Gallery attachments: {workspace?.profileTools?.featuredPhotoUrls.length ?? 0}
              </Text>
            </View>
          </View>
        </SectionCard>
      </MotionInView>
    </ScreenShell>
  );
}

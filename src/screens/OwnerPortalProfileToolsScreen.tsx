import React from 'react';
import { RouteProp, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, TextInput, View } from 'react-native';
import { MotionInView } from '../components/MotionInView';
import { ScreenShell } from '../components/ScreenShell';
import { SectionCard } from '../components/SectionCard';
import { ownerPortalPreviewEnabled } from '../config/ownerPortalConfig';
import { RootStackParamList } from '../navigation/RootNavigator';
import { ownerPortalStyles as styles } from './ownerPortal/ownerPortalStyles';
import { useOwnerPortalWorkspace } from './ownerPortal/useOwnerPortalWorkspace';

type OwnerPortalProfileToolsRoute = RouteProp<RootStackParamList, 'OwnerPortalProfileTools'>;

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
        .filter((candidate): candidate is string => Boolean(candidate))
    )
  );
}

function buildNormalizedProfileToolsInput(input: {
  menuUrl: string;
  cardPhotoUrl: string;
  featuredPhotoUrlsInput: string;
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
      [
        normalizedCardPhotoUrl,
        ...cardPhotoCandidates.slice(1),
        ...featuredPhotoCandidates,
      ].filter((candidate): candidate is string => Boolean(candidate))
    )
  ).slice(0, 8);

  return {
    menuUrl: menuUrlCandidates[0] ?? null,
    cardPhotoUrl: normalizedCardPhotoUrl,
    featuredPhotoUrls: normalizedFeaturedPhotoUrls,
    verifiedBadgeLabel: input.verifiedBadgeLabel.trim() || null,
    featuredBadges: input.featuredBadgesInput
      .split(',')
      .map((badge) => badge.trim())
      .filter(Boolean),
    cardSummary: input.cardSummary.trim() || null,
  };
}

export function OwnerPortalProfileToolsScreen() {
  const route = useRoute<OwnerPortalProfileToolsRoute>();
  const preview = ownerPortalPreviewEnabled && Boolean(route.params?.preview);
  const { workspace, isLoading, isSaving, errorText, saveProfileTools } =
    useOwnerPortalWorkspace(preview);
  const [menuUrl, setMenuUrl] = React.useState('');
  const [cardPhotoUrl, setCardPhotoUrl] = React.useState('');
  const [verifiedBadgeLabel, setVerifiedBadgeLabel] = React.useState('');
  const [featuredBadgesInput, setFeaturedBadgesInput] = React.useState('');
  const [cardSummary, setCardSummary] = React.useState('');
  const [featuredPhotoUrlsInput, setFeaturedPhotoUrlsInput] = React.useState('');

  React.useEffect(() => {
    const profileTools = workspace?.profileTools;
    if (!profileTools) {
      return;
    }

    setMenuUrl(profileTools.menuUrl ?? '');
    setCardPhotoUrl(profileTools.cardPhotoUrl ?? '');
    setVerifiedBadgeLabel(profileTools.verifiedBadgeLabel ?? '');
    setFeaturedBadgesInput(profileTools.featuredBadges.join(', '));
    setCardSummary(profileTools.cardSummary ?? '');
    setFeaturedPhotoUrlsInput(profileTools.featuredPhotoUrls.join('\n'));
  }, [workspace?.profileTools]);

  const normalizedInput = React.useMemo(
    () =>
      buildNormalizedProfileToolsInput({
        menuUrl,
        cardPhotoUrl,
        featuredPhotoUrlsInput,
        verifiedBadgeLabel,
        featuredBadgesInput,
        cardSummary,
      }),
    [
      cardPhotoUrl,
      cardSummary,
      featuredBadgesInput,
      featuredPhotoUrlsInput,
      menuUrl,
      verifiedBadgeLabel,
    ]
  );

  const validationError =
    menuUrl.trim() && !normalizedInput.menuUrl
      ? 'Menu link must be a valid http or https URL.'
      : cardPhotoUrl.trim() && !normalizedInput.cardPhotoUrl
        ? 'Card photo needs at least one valid http or https URL.'
        : featuredPhotoUrlsInput.trim() && normalizedInput.featuredPhotoUrls.length === 0
          ? 'Feature photo list must contain valid http or https URLs.'
          : null;

  return (
    <ScreenShell
      eyebrow="Owner Portal"
      title="Profile conversion tools."
      subtitle="Add richer photos, a menu link, verified-owner presentation, and stronger card copy that converts better than the free listing."
      headerPill={preview ? 'Demo' : 'Profile'}
    >
      <MotionInView delay={70}>
        <View style={styles.portalHeroCard}>
          <View style={styles.portalHeroGlow} />
          <Text style={styles.portalHeroKicker}>Premium profile surface</Text>
          <Text style={styles.portalHeroTitle}>
            Shape the storefront card into something that feels curated, verified, and worth
            opening.
          </Text>
          <Text style={styles.portalHeroBody}>
            This screen keeps the exact save behavior but gives the owner clearer editing sections
            and a more premium read on what will improve storefront conversion.
          </Text>
          <View style={styles.portalHeroMetricRow}>
            <View style={styles.portalHeroMetricCard}>
              <Text style={styles.portalHeroMetricValue}>{workspace?.metrics.followerCount ?? 0}</Text>
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
          body="These upgrades shape how the storefront appears on cards and detail pages across Canopy Trove."
        >
          {isLoading ? <Text style={styles.helperText}>Loading profile tools...</Text> : null}
          {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}
          <View style={styles.metricGrid}>
            <View style={[styles.metricCard, styles.metricCardWarm]}>
              <Text style={styles.metricValue}>{workspace?.metrics.followerCount ?? 0}</Text>
              <Text style={styles.metricLabel}>Saved Followers</Text>
              <Text style={styles.metricHelper}>
                Users waiting for a better listing or a fresh deal.
              </Text>
            </View>
            <View style={[styles.metricCard, styles.metricCardSuccess]}>
              <Text style={styles.metricValue}>{workspace?.metrics.storefrontOpenCount7d ?? 0}</Text>
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
          body="Paste public image URLs for now. These values feed both the owner workspace and the customer-facing storefront surfaces."
        >
          <View style={styles.sectionStack}>
            <View style={styles.plannerPanel}>
              <View style={styles.splitHeaderRow}>
                <View style={styles.splitHeaderCopy}>
                  <Text style={styles.sectionEyebrow}>Storefront essentials</Text>
                  <Text style={styles.splitHeaderTitle}>Primary link and headline image</Text>
                  <Text style={styles.splitHeaderBody}>
                    These fields shape the first premium impression on the storefront card.
                  </Text>
                </View>
                <Ionicons name="compass-outline" size={20} color="#F5C86A" />
              </View>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Menu link</Text>
                <Text style={styles.fieldHint}>
                  Only the first valid http or https URL is saved as the live menu destination.
                </Text>
                <TextInput
                  value={menuUrl}
                  onChangeText={setMenuUrl}
                  placeholder="Menu link"
                  placeholderTextColor="#738680"
                  style={styles.inputPremium}
                />
              </View>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Card photo URL</Text>
                <Text style={styles.fieldHint}>
                  If multiple photo links are pasted here, the first becomes the card image and the
                  rest move into the gallery stack.
                </Text>
                <TextInput
                  value={cardPhotoUrl}
                  onChangeText={setCardPhotoUrl}
                  placeholder="Card photo URL"
                  placeholderTextColor="#738680"
                  style={styles.inputPremium}
                />
              </View>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Card summary</Text>
                <Text style={styles.fieldHint}>
                  Keep the summary tight enough to read as premium storefront copy.
                </Text>
                <TextInput
                  value={cardSummary}
                  onChangeText={setCardSummary}
                  placeholder="Card summary"
                  placeholderTextColor="#738680"
                  multiline={true}
                  style={[styles.inputPremium, styles.textAreaPremium]}
                />
              </View>
            </View>

            <View style={styles.plannerPanel}>
              <View style={styles.splitHeaderRow}>
                <View style={styles.splitHeaderCopy}>
                  <Text style={styles.sectionEyebrow}>Trust signals</Text>
                  <Text style={styles.splitHeaderTitle}>Verified language and featured badges</Text>
                  <Text style={styles.splitHeaderBody}>
                    Badge language should feel deliberate, short, and visibly premium.
                  </Text>
                </View>
                <Ionicons name="ribbon-outline" size={20} color="#F5C86A" />
              </View>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Verified badge label</Text>
                <TextInput
                  value={verifiedBadgeLabel}
                  onChangeText={setVerifiedBadgeLabel}
                  placeholder="Verified badge label"
                  placeholderTextColor="#738680"
                  style={styles.inputPremium}
                />
              </View>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Featured badges</Text>
                <TextInput
                  value={featuredBadgesInput}
                  onChangeText={setFeaturedBadgesInput}
                  placeholder="Featured badges, comma separated"
                  placeholderTextColor="#738680"
                  style={styles.inputPremium}
                />
              </View>
            </View>

            <View style={styles.plannerPanel}>
              <View style={styles.splitHeaderRow}>
                <View style={styles.splitHeaderCopy}>
                  <Text style={styles.sectionEyebrow}>Media library</Text>
                  <Text style={styles.splitHeaderTitle}>Feature photo stack</Text>
                  <Text style={styles.splitHeaderBody}>
                    Add one public image URL per line for the premium storefront gallery.
                  </Text>
                </View>
                <Ionicons name="images-outline" size={20} color="#8EDCFF" />
              </View>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Feature photo URLs</Text>
                <Text style={styles.fieldHint}>
                  Use one public image URL per line, or paste multiple links and the form will sort
                  them into the gallery automatically.
                </Text>
                <TextInput
                  value={featuredPhotoUrlsInput}
                  onChangeText={setFeaturedPhotoUrlsInput}
                  placeholder="Feature photo URLs, one per line"
                  placeholderTextColor="#738680"
                  multiline={true}
                  style={[styles.inputPremium, styles.textAreaPremium]}
                />
              </View>
            </View>

            <View style={styles.ctaPanel}>
              <View style={styles.splitHeaderRow}>
                <View style={styles.splitHeaderCopy}>
                  <Text style={styles.sectionEyebrow}>Save changes</Text>
                  <Text style={styles.splitHeaderTitle}>Commit the current premium surface</Text>
                  <Text style={styles.splitHeaderBody}>
                    Save the profile tools exactly as entered, without changing any underlying
                    behavior or pipeline wiring.
                  </Text>
                </View>
                <Ionicons
                  name={preview ? 'eye-outline' : 'save-outline'}
                  size={20}
                  color={preview ? '#9CC5B4' : '#F5C86A'}
                />
              </View>
              {validationError ? <Text style={styles.errorText}>{validationError}</Text> : null}
              <Text style={styles.helperText}>
                Saving now maps the card photo into the storefront thumbnail and carries the full
                photo stack into the detail gallery.
              </Text>
              <Pressable
                disabled={preview || isSaving || Boolean(validationError)}
                onPress={() => {
                  void saveProfileTools(normalizedInput);
                }}
                style={[
                  styles.primaryButton,
                  (preview || isSaving || Boolean(validationError)) && styles.buttonDisabled,
                ]}
              >
                <Text style={styles.primaryButtonText}>
                  {preview ? 'Preview Only' : isSaving ? 'Saving...' : 'Save Profile Tools'}
                </Text>
              </Pressable>
            </View>
          </View>
        </SectionCard>
      </MotionInView>

      <MotionInView delay={280}>
        <SectionCard
          title="Current premium surface"
          body="This is the content currently ready to flow into the storefront card and detail page."
        >
          <View style={styles.cardStack}>
            <View style={styles.actionTile}>
              <View style={styles.splitHeaderRow}>
                <View style={styles.splitHeaderCopy}>
                  <Text style={styles.actionTileMeta}>Menu + card copy</Text>
                  <Text style={styles.actionTileTitle}>Primary storefront presentation</Text>
                  <Text style={styles.actionTileBody}>
                    These values shape the headline customer-facing conversion surface.
                  </Text>
                </View>
                <Ionicons name="compass-outline" size={20} color="#F5C86A" />
              </View>
              <Text style={styles.resultMeta}>Menu Link</Text>
              <Text style={styles.helperText}>{workspace?.profileTools?.menuUrl ?? 'Not set'}</Text>
              <Text style={styles.resultMeta}>Card Summary</Text>
              <Text style={styles.helperText}>
                {workspace?.profileTools?.cardSummary ?? 'Not set'}
              </Text>
            </View>

            <View style={[styles.actionTile, styles.metricCardWarm]}>
              <View style={styles.splitHeaderRow}>
                <View style={styles.splitHeaderCopy}>
                  <Text style={styles.actionTileMeta}>Badges + trust</Text>
                  <Text style={styles.actionTileTitle}>Verified storefront accents</Text>
                  <Text style={styles.actionTileBody}>
                    Badge language and featured tags that make the listing feel stronger.
                  </Text>
                </View>
                <Ionicons name="ribbon-outline" size={20} color="#F5C86A" />
              </View>
              <View style={styles.tagRow}>
                {(workspace?.profileTools?.featuredBadges.length
                  ? workspace.profileTools.featuredBadges
                  : ['Not set']
                ).map((badge) => (
                  <View key={badge} style={styles.tag}>
                    <Text style={styles.tagText}>{badge}</Text>
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
                  <Text style={styles.actionTileBody}>
                    The current photo count available for upgraded storefront presentation.
                  </Text>
                </View>
                <Ionicons name="images-outline" size={20} color="#8EDCFF" />
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

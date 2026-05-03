import React from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MotionInView } from '../components/MotionInView';
import { ScreenShell } from '../components/ScreenShell';
import { SectionCard } from '../components/SectionCard';
import { withScreenErrorBoundary } from '../components/withScreenErrorBoundary';
import { AppUiIcon } from '../icons/AppUiIcon';
import type { RootStackParamList } from '../navigation/RootNavigator';
import {
  getShopBootstrapDraft,
  publishShopBootstrapDraft,
  startShopBootstrap,
  type AiShopBootstrapDraftPayload,
  type ShopBootstrapDraft,
} from '../services/aiShopBootstrapService';
import { reportRuntimeError } from '../services/runtimeReportingService';
import { colors } from '../theme/tokens';
import { ownerPortalStyles as styles } from './ownerPortal/ownerPortalStyles';

const POLL_INTERVAL_MS = 3_000;
const POLL_MAX_ATTEMPTS = 40; // ~2 minutes total

/**
 * AI Shop Bootstrap — owner pastes their existing dispensary website URL,
 * AI scrapes it + extracts a complete Canopy Trove listing draft, owner
 * reviews + publishes. See docs/AI_SHOP_BOOTSTRAP.md for the architecture.
 *
 * Three-step wizard:
 *   1. URL input → kick off the scrape + AI parse
 *   2. Review draft (side-by-side: AI suggestion / editable field)
 *   3. Confirmation + link to live storefront
 */
function OwnerPortalShopBootstrapScreenInner() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [step, setStep] = React.useState<'url' | 'waiting' | 'review' | 'published'>('url');
  const [websiteUrl, setWebsiteUrl] = React.useState('');
  const [draft, setDraft] = React.useState<ShopBootstrapDraft | null>(null);
  const [errorText, setErrorText] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  // Synchronous in-flight guard to prevent rapid-tap submission. Same
  // pattern as the May 3 owner-portal signup fix.
  const isSubmittingRef = React.useRef(false);

  const beginBootstrap = React.useCallback(async () => {
    if (isSubmittingRef.current) return;
    const trimmed = websiteUrl.trim();
    if (!trimmed) {
      setErrorText('Paste your dispensary website URL to begin.');
      return;
    }
    // Auto-prepend https:// if the user typed "www.example.com" or
    // "example.com" without a scheme. URL parsing requires it; auto-fix
    // is friendlier than asking the owner to type it themselves.
    const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setErrorText(null);
    try {
      const result = await startShopBootstrap({ websiteUrl: normalized });
      setDraft(result.draft);
      setStep('waiting');
    } catch (error) {
      reportRuntimeError(error, {
        source: 'shop-bootstrap-start',
        screen: 'OwnerPortalShopBootstrap',
      });
      setErrorText(error instanceof Error ? error.message : "We couldn't start the bootstrap.");
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  }, [websiteUrl]);

  // Poll the draft while it's scraping or parsing. Stop on terminal
  // status or after POLL_MAX_ATTEMPTS.
  React.useEffect(() => {
    if (step !== 'waiting' || !draft) return;
    let cancelled = false;
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts += 1;
      try {
        const result = await getShopBootstrapDraft(draft.draftId);
        if (cancelled) return;
        setDraft(result.draft);
        if (result.draft.status === 'ready') {
          setStep('review');
          clearInterval(interval);
        } else if (result.draft.status === 'failed') {
          setErrorText(result.draft.failureReason ?? "We couldn't read that website.");
          setStep('url');
          clearInterval(interval);
        } else if (attempts >= POLL_MAX_ATTEMPTS) {
          setErrorText('Taking longer than expected. Try again in a moment.');
          setStep('url');
          clearInterval(interval);
        }
      } catch (error) {
        reportRuntimeError(error, {
          source: 'shop-bootstrap-poll',
          screen: 'OwnerPortalShopBootstrap',
        });
        // Don't surface poll errors immediately — the next tick may succeed.
        if (attempts >= POLL_MAX_ATTEMPTS) {
          setErrorText('Lost connection while reading your website.');
          setStep('url');
          clearInterval(interval);
        }
      }
    }, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [step, draft]);

  const publish = React.useCallback(async () => {
    if (!draft || isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setErrorText(null);
    try {
      const result = await publishShopBootstrapDraft(draft.draftId);
      setStep('published');
      // Refresh draft so the published status reflects.
      try {
        const refreshed = await getShopBootstrapDraft(draft.draftId);
        setDraft(refreshed.draft);
      } catch {
        // Non-fatal; we already showed success.
      }
      // Result.storefrontId can be used in the success view.
      void result;
    } catch (error) {
      reportRuntimeError(error, {
        source: 'shop-bootstrap-publish',
        screen: 'OwnerPortalShopBootstrap',
      });
      setErrorText(error instanceof Error ? error.message : "We couldn't publish the listing.");
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  }, [draft]);

  return (
    <ScreenShell
      eyebrow="Owner Portal"
      title="Set up your shop in 60 seconds"
      subtitle="Paste your existing dispensary website. Our AI fills out everything for you."
      headerPill="Bootstrap"
    >
      {step === 'url' ? (
        <UrlStep
          websiteUrl={websiteUrl}
          setWebsiteUrl={setWebsiteUrl}
          onSubmit={beginBootstrap}
          isSubmitting={isSubmitting}
          errorText={errorText}
        />
      ) : null}

      {step === 'waiting' ? <WaitingStep websiteUrl={websiteUrl} /> : null}

      {step === 'review' && draft ? (
        <ReviewStep
          draft={draft}
          onPublish={publish}
          isPublishing={isSubmitting}
          errorText={errorText}
        />
      ) : null}

      {step === 'published' && draft ? (
        <PublishedStep draft={draft} onDone={() => navigation.goBack()} />
      ) : null}
    </ScreenShell>
  );
}

function UrlStep({
  websiteUrl,
  setWebsiteUrl,
  onSubmit,
  isSubmitting,
  errorText,
}: {
  websiteUrl: string;
  setWebsiteUrl: (v: string) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  errorText: string | null;
}) {
  return (
    <MotionInView delay={120}>
      <SectionCard
        title="Your website"
        body="Already have a website? Paste the URL below. Our AI reads your existing menu, hours, photos, and deals — then fills out your Canopy Trove listing automatically. Free for verified shops."
      >
        <View style={styles.sectionStack}>
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Website URL</Text>
            <TextInput
              value={websiteUrl}
              onChangeText={setWebsiteUrl}
              placeholder="https://your-dispensary.com"
              autoCapitalize="none"
              keyboardType="url"
              placeholderTextColor={colors.textSoft}
              style={styles.inputPremium}
              accessibilityLabel="Your dispensary website URL"
              autoComplete="url"
            />
            <Text style={styles.fieldHint}>
              We'll read whatever is on your site — Dutchie or Jane embeds work too.
            </Text>
          </View>
          {errorText ? (
            <Text style={styles.errorText} accessibilityLiveRegion="polite">
              {errorText}
            </Text>
          ) : null}
          <Pressable
            disabled={isSubmitting || !websiteUrl.trim()}
            onPress={onSubmit}
            style={[
              styles.primaryButton,
              (isSubmitting || !websiteUrl.trim()) && styles.buttonDisabled,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Start bootstrap"
          >
            <Text style={styles.primaryButtonText}>
              {isSubmitting ? 'Starting…' : 'Build my listing'}
            </Text>
          </Pressable>
        </View>
      </SectionCard>
    </MotionInView>
  );
}

function WaitingStep({ websiteUrl }: { websiteUrl: string }) {
  return (
    <MotionInView delay={120}>
      <SectionCard
        title="Reading your website"
        body={`Reading ${websiteUrl}. This usually takes 30–60 seconds. We're rendering the page, capturing your menu and photos, and extracting everything our AI can find.`}
      >
        <View style={styles.sectionStack}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.fieldHint}>
            Don't navigate away — we'll show your listing in a moment.
          </Text>
        </View>
      </SectionCard>
    </MotionInView>
  );
}

function ReviewStep({
  draft,
  onPublish,
  isPublishing,
  errorText,
}: {
  draft: ShopBootstrapDraft;
  onPublish: () => void;
  isPublishing: boolean;
  errorText: string | null;
}) {
  // The AI's draft + any owner edits already applied. Phase 1 review is
  // read-only with confidence indicators; the inline-edit UI lands in
  // a follow-up commit after we get the round-trip working.
  const payload = (draft.draft ?? {}) as AiShopBootstrapDraftPayload;
  const editable = (draft.ownerEdits ?? {}) as Partial<AiShopBootstrapDraftPayload>;
  const merged: AiShopBootstrapDraftPayload = { ...payload, ...editable };

  return (
    <MotionInView delay={120}>
      <SectionCard
        title="Review your listing"
        body={`Here's what our AI found on your website. Confidence: ${merged.extractionConfidence}. ${merged.extractionNotes}`}
      >
        <View style={styles.sectionStack}>
          <DraftField label="Name" value={merged.detectedName} />
          <DraftField
            label="Address"
            value={
              [
                merged.detectedAddress,
                merged.detectedCity,
                merged.detectedState,
                merged.detectedZip,
              ]
                .filter(Boolean)
                .join(', ') || null
            }
          />
          <DraftField label="Phone" value={merged.detectedPhone} />
          <DraftField label="Menu URL" value={merged.detectedMenuUrl} />
          <DraftField
            label="Hours"
            value={
              merged.detectedHours
                ? merged.detectedHours.map((h) => `${h.day}: ${h.hours}`).join(' · ')
                : null
            }
          />
          <DraftField label="Brands seen" value={merged.detectedBrands?.join(', ') ?? null} />
          <DraftField
            label="Active deals"
            value={
              merged.detectedDeals ? merged.detectedDeals.map((d) => d.title).join(' · ') : null
            }
          />
          <DraftField label="About" value={merged.detectedAboutText} />
          {merged.ocmMatch ? (
            <DraftField
              label="OCM cross-check"
              value={`${merged.ocmMatch.matchConfidence} match${merged.ocmMatch.licenseNumber ? ` · ${merged.ocmMatch.licenseNumber}` : ''}`}
            />
          ) : null}

          {errorText ? (
            <Text style={styles.errorText} accessibilityLiveRegion="polite">
              {errorText}
            </Text>
          ) : null}

          <Pressable
            disabled={isPublishing}
            onPress={onPublish}
            style={[styles.primaryButton, isPublishing && styles.buttonDisabled]}
            accessibilityRole="button"
            accessibilityLabel="Publish my listing"
          >
            <AppUiIcon name="checkmark-circle" size={16} color={colors.backgroundDeep} />
            <Text style={styles.primaryButtonText}>
              {isPublishing ? 'Publishing…' : 'Looks good — publish'}
            </Text>
          </Pressable>
          <Text style={styles.fieldHint}>
            You can edit anything later from your owner dashboard. Inline editing in this screen is
            coming in a follow-up update.
          </Text>
        </View>
      </SectionCard>
    </MotionInView>
  );
}

function DraftField({ label, value }: { label: string; value: string | null }) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldHint}>
        {value ?? "We couldn't find this — please add manually after publishing."}
      </Text>
    </View>
  );
}

function PublishedStep({ draft, onDone }: { draft: ShopBootstrapDraft; onDone: () => void }) {
  return (
    <MotionInView delay={120}>
      <SectionCard
        title="Published"
        body={`Your listing is live on Canopy Trove. ${draft.publishedStorefrontId ? `Storefront ID: ${draft.publishedStorefrontId}.` : ''}`}
      >
        <View style={styles.sectionStack}>
          <Text style={styles.fieldHint}>
            Members can now find your store in Canopy Trove. We'll re-check your website weekly and
            ask you to approve any changes we spot.
          </Text>
          <Pressable
            onPress={onDone}
            style={styles.primaryButton}
            accessibilityRole="button"
            accessibilityLabel="Done"
          >
            <Text style={styles.primaryButtonText}>Done</Text>
          </Pressable>
        </View>
      </SectionCard>
    </MotionInView>
  );
}

export const OwnerPortalShopBootstrapScreen = withScreenErrorBoundary(
  OwnerPortalShopBootstrapScreenInner,
  'owner-portal-shop-bootstrap',
);

import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MotionInView } from '../components/MotionInView';
import { ScreenShell } from '../components/ScreenShell';
import { SectionCard } from '../components/SectionCard';
import { withScreenErrorBoundary } from '../components/withScreenErrorBoundary';
import type { RootStackParamList } from '../navigation/RootNavigator';
import {
  applyReconcileReceiptDraft,
  getReconcileReceiptDraft,
  startReconcileReceipt,
  type ReceiptReconcileDraft,
  type ReceiptSaleLine,
} from '../services/aiInventoryService';
import { reportRuntimeError } from '../services/runtimeReportingService';
import { colors } from '../theme/tokens';
import { ownerPortalStyles as styles } from './ownerPortal/ownerPortalStyles';

const POLL_INTERVAL_MS = 3_000;
const POLL_MAX_ATTEMPTS = 40; // ~2 minutes total

/**
 * AI Inventory — sub-flow C: end-of-day reconcile.
 *
 * Owner uploads N photos (POS summary, stack of receipts, screenshots).
 * Backend AI parses sale lines + fuzzy-matches against owner's menu.
 * Owner reviews + approves; apply step decrements stockLevel + writes
 * adjustments. Sold-out items auto-flip the public-facing badge.
 *
 * Spec: docs/AI_INVENTORY.md.
 *
 * Phase 1.8 status: SCAFFOLD — UI is wired with a comma-separated
 * gs:// URL field standing in for the camera multi-shot. Real wire-up
 * lands tomorrow.
 */
function OwnerPortalReconcileReceiptScreenInner() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [step, setStep] = React.useState<'upload' | 'parsing' | 'review' | 'applied'>('upload');
  const [imageUrlsText, setImageUrlsText] = React.useState('');
  const [draft, setDraft] = React.useState<ReceiptReconcileDraft | null>(null);
  const [errorText, setErrorText] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const isSubmittingRef = React.useRef(false);

  const beginReconcile = React.useCallback(async () => {
    if (isSubmittingRef.current) return;
    const urls = imageUrlsText
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (urls.length === 0) {
      setErrorText('Paste at least one gs:// URL.');
      return;
    }
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setErrorText(null);
    try {
      const envelope = await startReconcileReceipt({ imageGcsUrls: urls });
      setDraft(envelope.draft);
      setStep(envelope.draft.status === 'ready' ? 'review' : 'parsing');
    } catch (error) {
      reportRuntimeError(error, {
        source: 'inventory-reconcile-start',
        screen: 'OwnerPortalReconcileReceipt',
      });
      setErrorText(error instanceof Error ? error.message : "We couldn't start the reconcile.");
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  }, [imageUrlsText]);

  // Poll while parsing.
  React.useEffect(() => {
    if (step !== 'parsing' || !draft) return;
    let cancelled = false;
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts += 1;
      try {
        const envelope = await getReconcileReceiptDraft(draft.draftId);
        if (cancelled) return;
        setDraft(envelope.draft);
        if (envelope.draft.status === 'ready') {
          setStep('review');
          clearInterval(interval);
        } else if (envelope.draft.status === 'failed') {
          setErrorText(envelope.draft.failureReason ?? "We couldn't read those photos.");
          setStep('upload');
          clearInterval(interval);
        } else if (attempts >= POLL_MAX_ATTEMPTS) {
          setErrorText('Taking longer than expected. Try again in a moment.');
          setStep('upload');
          clearInterval(interval);
        }
      } catch (error) {
        reportRuntimeError(error, {
          source: 'inventory-reconcile-poll',
          screen: 'OwnerPortalReconcileReceipt',
        });
        if (attempts >= POLL_MAX_ATTEMPTS) {
          setErrorText('Lost connection while parsing your receipt.');
          setStep('upload');
          clearInterval(interval);
        }
      }
    }, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [step, draft]);

  const applyDraft = React.useCallback(async () => {
    if (!draft || isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setErrorText(null);
    try {
      const envelope = await applyReconcileReceiptDraft(draft.draftId);
      setDraft(envelope.draft);
      setStep('applied');
    } catch (error) {
      reportRuntimeError(error, {
        source: 'inventory-reconcile-apply',
        screen: 'OwnerPortalReconcileReceipt',
      });
      setErrorText(error instanceof Error ? error.message : "We couldn't apply the reconcile.");
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  }, [draft]);

  return (
    <ScreenShell
      eyebrow="Owner Portal · Inventory"
      title="End-of-day reconcile"
      subtitle="One photo of your POS summary or receipts. We do the inventory math."
      headerPill="Reconcile"
    >
      {step === 'upload' ? (
        <MotionInView delay={120}>
          <SectionCard
            title="Upload your photos"
            body="Phase 1.8 SCAFFOLD: paste comma-separated gs:// URLs. Real camera multi-shot lands tomorrow."
          >
            <View style={styles.sectionStack}>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Photo URLs (comma-separated)</Text>
                <TextInput
                  value={imageUrlsText}
                  onChangeText={setImageUrlsText}
                  placeholder="gs://..., gs://..."
                  placeholderTextColor={colors.textSoft}
                  autoCapitalize="none"
                  multiline
                  style={[styles.inputPremium, localStyles.multilineInput]}
                  accessibilityLabel="Cloud Storage URLs of receipt photos"
                />
              </View>
              {errorText ? (
                <Text style={styles.errorText} accessibilityLiveRegion="polite">
                  {errorText}
                </Text>
              ) : null}
              <Pressable
                disabled={isSubmitting || !imageUrlsText.trim()}
                onPress={beginReconcile}
                style={[
                  styles.primaryButton,
                  (isSubmitting || !imageUrlsText.trim()) && styles.buttonDisabled,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Start reconcile"
              >
                <Text style={styles.primaryButtonText}>
                  {isSubmitting ? 'Starting…' : 'Reconcile sales'}
                </Text>
              </Pressable>
            </View>
          </SectionCard>
        </MotionInView>
      ) : null}

      {step === 'parsing' ? (
        <MotionInView delay={120}>
          <SectionCard
            title="Reading your receipts"
            body="Our AI is parsing the sale lines and matching them to your menu items. Usually 30–60 seconds."
          >
            <View style={styles.sectionStack}>
              <ActivityIndicator size="large" color={colors.accent} />
              <Text style={styles.fieldHint}>Don't navigate away.</Text>
            </View>
          </SectionCard>
        </MotionInView>
      ) : null}

      {step === 'review' && draft ? (
        <MotionInView delay={120}>
          <SectionCard
            title="Review the matches"
            body="Tap a line to confirm or correct. Approved lines decrement your stock when you tap Apply."
          >
            <View style={styles.sectionStack}>
              {draft.saleLines.length === 0 ? (
                <Text style={styles.fieldHint}>No sale lines parsed. Try a clearer photo.</Text>
              ) : (
                draft.saleLines.map((line, idx) => <SaleLineRow key={idx} line={line} />)
              )}
              {errorText ? (
                <Text style={styles.errorText} accessibilityLiveRegion="polite">
                  {errorText}
                </Text>
              ) : null}
              <Pressable
                disabled={isSubmitting || draft.saleLines.length === 0}
                onPress={applyDraft}
                style={[
                  styles.primaryButton,
                  (isSubmitting || draft.saleLines.length === 0) && styles.buttonDisabled,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Apply the reconcile"
              >
                <Text style={styles.primaryButtonText}>
                  {isSubmitting ? 'Applying…' : 'Apply reconcile'}
                </Text>
              </Pressable>
            </View>
          </SectionCard>
        </MotionInView>
      ) : null}

      {step === 'applied' && draft ? (
        <MotionInView delay={120}>
          <SectionCard
            title="Reconcile applied"
            body={`Decremented ${draft.totalUnitsDecremented} units across your menu. Sold-out items now show the badge to consumers.`}
          >
            <View style={styles.sectionStack}>
              <Pressable
                onPress={() => navigation.goBack()}
                style={styles.secondaryButton}
                accessibilityRole="button"
                accessibilityLabel="Done — back to inventory"
              >
                <Text style={styles.primaryButtonText}>Back to inventory</Text>
              </Pressable>
            </View>
          </SectionCard>
        </MotionInView>
      ) : null}
    </ScreenShell>
  );
}

function SaleLineRow({ line }: { line: ReceiptSaleLine }) {
  const confidenceLabel: Record<ReceiptSaleLine['matchConfidence'], string> = {
    high: '✓ matched',
    medium: '⚠ verify',
    low: 'tap to confirm',
    none: 'no match',
  };
  return (
    <View style={localStyles.lineRow}>
      <View style={localStyles.lineCopy}>
        <Text style={localStyles.lineTitle}>{line.parsedItemDescription}</Text>
        <Text style={localStyles.lineMeta}>
          qty {line.parsedQuantity}
          {line.parsedTotal !== null ? ` · $${line.parsedTotal.toFixed(2)}` : ''}
        </Text>
        <Text style={localStyles.lineMeta}>"{line.rawText}"</Text>
      </View>
      <View
        style={[
          localStyles.lineBadge,
          line.matchConfidence === 'high'
            ? localStyles.lineBadgeHigh
            : line.matchConfidence === 'medium'
              ? localStyles.lineBadgeMedium
              : line.matchConfidence === 'low'
                ? localStyles.lineBadgeLow
                : localStyles.lineBadgeNone,
        ]}
      >
        <Text style={localStyles.lineBadgeText}>{confidenceLabel[line.matchConfidence]}</Text>
      </View>
    </View>
  );
}

const localStyles = StyleSheet.create({
  multilineInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  lineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    gap: 12,
  },
  lineCopy: {
    flex: 1,
    gap: 2,
  },
  lineTitle: {
    color: '#FFFBF7',
    fontSize: 14,
    fontWeight: '500',
  },
  lineMeta: {
    color: '#C4B8B0',
    fontSize: 12,
  },
  lineBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  lineBadgeHigh: { backgroundColor: 'rgba(46, 204, 113, 0.18)' },
  lineBadgeMedium: { backgroundColor: 'rgba(245, 200, 106, 0.18)' },
  lineBadgeLow: { backgroundColor: 'rgba(232, 160, 0, 0.18)' },
  lineBadgeNone: { backgroundColor: 'rgba(196, 184, 176, 0.18)' },
  lineBadgeText: {
    color: '#FFFBF7',
    fontSize: 11,
    fontWeight: '600',
  },
});

const OwnerPortalReconcileReceiptScreen = withScreenErrorBoundary(
  OwnerPortalReconcileReceiptScreenInner,
  'owner-portal-reconcile-receipt',
);
export default OwnerPortalReconcileReceiptScreen;

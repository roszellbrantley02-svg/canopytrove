import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MotionInView } from '../components/MotionInView';
import { ScreenShell } from '../components/ScreenShell';
import { SectionCard } from '../components/SectionCard';
import { withScreenErrorBoundary } from '../components/withScreenErrorBoundary';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { scanProduct, type ProductCatalogEntry } from '../services/aiInventoryService';
import { reportRuntimeError } from '../services/runtimeReportingService';
import { colors } from '../theme/tokens';
import { ownerPortalStyles as styles } from './ownerPortal/ownerPortalStyles';

/**
 * AI Inventory — sub-flow A: scan a single product.
 *
 *   1. Owner taps "Open camera" → existing ScanCameraScreen captures + uploads
 *   2. Camera returns gs:// URL on this screen via a navigation callback
 *      (Phase 1.7 fill-in: today's scaffold uses a hand-entered URL field)
 *   3. POST /owner-portal/inventory/scan-product { imageGcsUrl, retailPrice }
 *   4. AI returns brand/product/strain/category + suggested price range
 *   5. Owner confirms retail price → item lands on their menu
 *
 * Spec: docs/AI_INVENTORY.md.
 *
 * Phase 1.7 status: SCAFFOLD — UI is wired, real camera handoff +
 * backend AI call land tomorrow. URL field is a placeholder so
 * the route can round-trip end-to-end during local testing.
 */
function OwnerPortalScanProductScreenInner() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [imageGcsUrl, setImageGcsUrl] = React.useState('');
  const [retailPriceText, setRetailPriceText] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorText, setErrorText] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<{
    catalogEntry: ProductCatalogEntry;
    isNew: boolean;
    confidence: 'high' | 'medium' | 'low';
    notes: string;
    suggestedRetailLow: number | null;
    suggestedRetailHigh: number | null;
  } | null>(null);
  // Synchronous in-flight guard to prevent rapid-tap submission.
  const isSubmittingRef = React.useRef(false);

  const submitScan = React.useCallback(async () => {
    if (isSubmittingRef.current) return;
    const trimmedUrl = imageGcsUrl.trim();
    if (!trimmedUrl) {
      setErrorText('Capture a photo first.');
      return;
    }
    const retailPrice = retailPriceText.trim() ? Number(retailPriceText) : undefined;
    if (retailPrice !== undefined && !Number.isFinite(retailPrice)) {
      setErrorText('Retail price must be a number (or leave blank).');
      return;
    }
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setErrorText(null);
    try {
      const envelope = await scanProduct({
        imageGcsUrl: trimmedUrl,
        ...(retailPrice !== undefined ? { retailPrice } : {}),
      });
      setResult({
        catalogEntry: envelope.catalogEntry,
        isNew: envelope.isNewCatalogEntry,
        confidence: envelope.extractionConfidence,
        notes: envelope.extractionNotes,
        suggestedRetailLow: envelope.suggestedRetailPriceLow,
        suggestedRetailHigh: envelope.suggestedRetailPriceHigh,
      });
    } catch (error) {
      reportRuntimeError(error, {
        source: 'inventory-scan-product',
        screen: 'OwnerPortalScanProduct',
      });
      setErrorText(error instanceof Error ? error.message : "We couldn't read that product photo.");
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  }, [imageGcsUrl, retailPriceText]);

  return (
    <ScreenShell
      eyebrow="Owner Portal · Inventory"
      title="Add a product"
      subtitle="Snap a photo. Our AI reads the package and adds it to your menu."
      headerPill="Scan product"
    >
      <MotionInView delay={120}>
        <SectionCard
          title="Capture the product"
          body="Phase 1.7 SCAFFOLD: the camera handoff lands tomorrow. For now, paste a Cloud Storage gs:// URL the camera flow has already uploaded so we can validate the round-trip."
        >
          <View style={styles.sectionStack}>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Image gs:// URL</Text>
              <TextInput
                value={imageGcsUrl}
                onChangeText={setImageGcsUrl}
                placeholder="gs://canopy-trove.firebasestorage.app/inventory/.../front.jpg"
                placeholderTextColor={colors.textSoft}
                autoCapitalize="none"
                style={styles.inputPremium}
                accessibilityLabel="Cloud Storage URL of the captured product photo"
              />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Retail price (optional)</Text>
              <TextInput
                value={retailPriceText}
                onChangeText={setRetailPriceText}
                placeholder="49.99"
                placeholderTextColor={colors.textSoft}
                keyboardType="decimal-pad"
                style={styles.inputPremium}
                accessibilityLabel="Retail price you charge for this product"
              />
              <Text style={styles.fieldHint}>
                Leave blank to add to the catalog without putting it on your menu yet.
              </Text>
            </View>
            {errorText ? (
              <Text style={styles.errorText} accessibilityLiveRegion="polite">
                {errorText}
              </Text>
            ) : null}
            <Pressable
              disabled={isSubmitting || !imageGcsUrl.trim()}
              onPress={submitScan}
              style={[
                styles.primaryButton,
                (isSubmitting || !imageGcsUrl.trim()) && styles.buttonDisabled,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Scan the product"
            >
              <Text style={styles.primaryButtonText}>
                {isSubmitting ? 'Reading photo…' : 'Scan product'}
              </Text>
            </Pressable>
            {isSubmitting ? <ActivityIndicator size="small" color={colors.accent} /> : null}
          </View>
        </SectionCard>
      </MotionInView>

      {result ? (
        <MotionInView delay={160}>
          <SectionCard
            title={result.isNew ? 'New catalog entry' : 'Matched existing entry'}
            body={`Confidence: ${result.confidence}. ${result.notes}`}
          >
            <View style={styles.sectionStack}>
              <Text style={localStyles.previewTitle}>
                {result.catalogEntry.brand} — {result.catalogEntry.productName}
              </Text>
              <Text style={localStyles.previewMeta}>
                {result.catalogEntry.category} · {result.catalogEntry.strainType} ·{' '}
                {result.catalogEntry.packageWeight ?? '—'}
              </Text>
              {result.suggestedRetailLow !== null || result.suggestedRetailHigh !== null ? (
                <Text style={localStyles.previewMeta}>
                  Suggested retail: ${result.suggestedRetailLow ?? '—'}–$
                  {result.suggestedRetailHigh ?? '—'}
                </Text>
              ) : null}
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

const localStyles = StyleSheet.create({
  previewTitle: {
    color: '#FFFBF7',
    fontSize: 16,
    fontWeight: '600',
  },
  previewMeta: {
    color: '#C4B8B0',
    fontSize: 13,
    lineHeight: 18,
  },
});

const OwnerPortalScanProductScreen = withScreenErrorBoundary(
  OwnerPortalScanProductScreenInner,
  'owner-portal-scan-product',
);
export default OwnerPortalScanProductScreen;

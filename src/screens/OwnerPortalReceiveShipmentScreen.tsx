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
  scanShipmentBox,
  scanShipmentUnit,
  type BoxScanResult,
  type UnitScanResult,
} from '../services/aiInventoryService';
import { reportRuntimeError } from '../services/runtimeReportingService';
import { colors } from '../theme/tokens';
import { ownerPortalStyles as styles } from './ownerPortal/ownerPortalStyles';

/**
 * AI Inventory — sub-flow B: receive a shipment.
 *
 * Two-step:
 *   STEP 1 — scan the wholesale case → AI reads brand/lot/unitCount/distributor
 *   STEP 2 — scan one unit from inside → AI confirms match + grabs COA QR
 *
 * Per-unit scan kept separate so a "variety pack" can flow into a
 * loop where the owner scans each variant. (Multi-variant box flow
 * is Phase 1.7.5, not in this scaffold.)
 *
 * Spec: docs/AI_INVENTORY.md.
 *
 * Phase 1.7 status: SCAFFOLD — UI is wired; the camera handoff and
 * actual AI calls land tomorrow. URL fields stand in for the camera
 * for round-trip testing.
 */
function OwnerPortalReceiveShipmentScreenInner() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [step, setStep] = React.useState<'box' | 'unit' | 'done'>('box');
  const [boxImageUrl, setBoxImageUrl] = React.useState('');
  const [unitImageUrl, setUnitImageUrl] = React.useState('');
  const [boxResult, setBoxResult] = React.useState<BoxScanResult | null>(null);
  const [unitResult, setUnitResult] = React.useState<UnitScanResult | null>(null);
  const [errorText, setErrorText] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const isSubmittingRef = React.useRef(false);

  const submitBoxScan = React.useCallback(async () => {
    if (isSubmittingRef.current) return;
    const trimmed = boxImageUrl.trim();
    if (!trimmed) {
      setErrorText('Capture the case photo first.');
      return;
    }
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setErrorText(null);
    try {
      const envelope = await scanShipmentBox({ imageGcsUrl: trimmed });
      if (envelope.step !== 'box') {
        setErrorText('Backend returned the wrong step. Try again.');
        return;
      }
      setBoxResult(envelope.box);
      setStep('unit');
    } catch (error) {
      reportRuntimeError(error, {
        source: 'inventory-scan-shipment-box',
        screen: 'OwnerPortalReceiveShipment',
      });
      setErrorText(error instanceof Error ? error.message : "We couldn't read the case.");
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  }, [boxImageUrl]);

  const submitUnitScan = React.useCallback(async () => {
    if (isSubmittingRef.current) return;
    const trimmed = unitImageUrl.trim();
    if (!trimmed) {
      setErrorText('Capture the unit photo first.');
      return;
    }
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setErrorText(null);
    try {
      const envelope = await scanShipmentUnit({
        imageGcsUrl: trimmed,
        boxBrand: boxResult?.brand ?? null,
        boxProductLine: boxResult?.productLine ?? null,
      });
      if (envelope.step !== 'unit') {
        setErrorText('Backend returned the wrong step. Try again.');
        return;
      }
      setUnitResult(envelope.unit);
      setStep('done');
    } catch (error) {
      reportRuntimeError(error, {
        source: 'inventory-scan-shipment-unit',
        screen: 'OwnerPortalReceiveShipment',
      });
      setErrorText(error instanceof Error ? error.message : "We couldn't read the unit.");
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  }, [unitImageUrl, boxResult]);

  return (
    <ScreenShell
      eyebrow="Owner Portal · Inventory"
      title="Receive shipment"
      subtitle="Scan the case, then one unit. We add the count to your menu."
      headerPill="Two-step scan"
    >
      {step === 'box' ? (
        <MotionInView delay={120}>
          <SectionCard
            title="Step 1 — Scan the case"
            body="Snap a photo of the wholesale box. Our AI reads brand, product line, unit count, lot number, and distributor info."
          >
            <View style={styles.sectionStack}>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Case photo gs:// URL</Text>
                <TextInput
                  value={boxImageUrl}
                  onChangeText={setBoxImageUrl}
                  placeholder="gs://canopy-trove.firebasestorage.app/inventory/.../case.jpg"
                  placeholderTextColor={colors.textSoft}
                  autoCapitalize="none"
                  style={styles.inputPremium}
                  accessibilityLabel="Cloud Storage URL of the case photo"
                />
              </View>
              {errorText ? (
                <Text style={styles.errorText} accessibilityLiveRegion="polite">
                  {errorText}
                </Text>
              ) : null}
              <Pressable
                disabled={isSubmitting || !boxImageUrl.trim()}
                onPress={submitBoxScan}
                style={[
                  styles.primaryButton,
                  (isSubmitting || !boxImageUrl.trim()) && styles.buttonDisabled,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Scan the case"
              >
                <Text style={styles.primaryButtonText}>
                  {isSubmitting ? 'Reading case…' : 'Scan case'}
                </Text>
              </Pressable>
              {isSubmitting ? <ActivityIndicator size="small" color={colors.accent} /> : null}
            </View>
          </SectionCard>
        </MotionInView>
      ) : null}

      {step === 'unit' && boxResult ? (
        <MotionInView delay={120}>
          <SectionCard
            title="Step 2 — Scan one unit"
            body={`Case read as: ${boxResult.brand ?? '—'} · ${boxResult.productLine ?? '—'} · ${boxResult.unitCount ?? '?'} units. Now scan one of the units inside so we can grab the COA QR + product photo.`}
          >
            <View style={styles.sectionStack}>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Unit photo gs:// URL</Text>
                <TextInput
                  value={unitImageUrl}
                  onChangeText={setUnitImageUrl}
                  placeholder="gs://canopy-trove.firebasestorage.app/inventory/.../unit.jpg"
                  placeholderTextColor={colors.textSoft}
                  autoCapitalize="none"
                  style={styles.inputPremium}
                  accessibilityLabel="Cloud Storage URL of the unit photo"
                />
              </View>
              {errorText ? (
                <Text style={styles.errorText} accessibilityLiveRegion="polite">
                  {errorText}
                </Text>
              ) : null}
              <Pressable
                disabled={isSubmitting || !unitImageUrl.trim()}
                onPress={submitUnitScan}
                style={[
                  styles.primaryButton,
                  (isSubmitting || !unitImageUrl.trim()) && styles.buttonDisabled,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Scan the unit"
              >
                <Text style={styles.primaryButtonText}>
                  {isSubmitting ? 'Reading unit…' : 'Scan unit'}
                </Text>
              </Pressable>
              {isSubmitting ? <ActivityIndicator size="small" color={colors.accent} /> : null}
            </View>
          </SectionCard>
        </MotionInView>
      ) : null}

      {step === 'done' && unitResult && boxResult ? (
        <MotionInView delay={120}>
          <SectionCard
            title="Shipment ready"
            body={
              unitResult.matchesBox === false
                ? '⚠ Heads up — the unit did not match the case. Confirm before adding to inventory.'
                : `Adding ${boxResult.unitCount ?? '?'} units of ${unitResult.catalogEntry.brand} ${unitResult.catalogEntry.productName} to your menu.`
            }
          >
            <View style={styles.sectionStack}>
              <Text style={localStyles.previewTitle}>
                {unitResult.catalogEntry.brand} — {unitResult.catalogEntry.productName}
              </Text>
              <Text style={localStyles.previewMeta}>
                {unitResult.catalogEntry.category} · {unitResult.catalogEntry.strainType} ·{' '}
                {unitResult.catalogEntry.packageWeight ?? '—'}
              </Text>
              {unitResult.detectedCoaUrl ? (
                <Text style={localStyles.previewMeta}>COA: {unitResult.detectedCoaUrl}</Text>
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

const OwnerPortalReceiveShipmentScreen = withScreenErrorBoundary(
  OwnerPortalReceiveShipmentScreenInner,
  'owner-portal-receive-shipment',
);
export default OwnerPortalReceiveShipmentScreen;

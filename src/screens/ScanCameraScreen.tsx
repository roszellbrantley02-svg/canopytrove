/**
 * Scan Camera Screen
 *
 * Dedicated camera screen reached from the Verify menu. Hosts the
 * barcode scanner that was previously bolted into VerifyScreen.
 *
 * Accepts a `mode` param so we can customize the on-screen guidance
 * without forking the scan logic:
 *   - 'product' → scan a product QR, barcode, or lab COA
 *   - 'shop'    → scan a dispensary's shop QR (Google/Weedmaps/Leafly)
 *
 * Generic web URLs are routed to the browser via Linking.openURL.
 * UPC/EAN codes, OCM license strings, and known-lab COA URLs flow
 * through ScanResult where the backend resolves them.
 */

import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import type { CameraView } from 'expo-camera';
import { useCameraPermissions } from 'expo-camera';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppUiIcon } from '../icons/AppUiIcon';
import { InlineFeedbackPanel } from '../components/InlineFeedbackPanel';
import { withScreenErrorBoundary } from '../components/withScreenErrorBoundary';
import { trackAnalyticsEvent } from '../services/analyticsService';
import { classifyScannedCode } from '../services/scanCodeClassifier';
import { colors, radii, spacing, textStyles } from '../theme/tokens';
import type { RootStackParamList } from '../navigation/rootNavigatorConfig';

let CameraViewComponent: typeof CameraView | null = null;

/* ── Load CameraView dynamically to handle SDK 55 availability ── */
async function loadCameraView() {
  if (!CameraViewComponent) {
    try {
      const cameraModule = await import('expo-camera');
      CameraViewComponent = cameraModule.CameraView;
    } catch {
      // expo-camera not available
    }
  }
  return CameraViewComponent;
}

type ScanCameraScreenProps = NativeStackScreenProps<RootStackParamList, 'ScanCamera'>;

type CameraState =
  | { kind: 'requesting-permission' }
  | { kind: 'camera-denied' }
  | { kind: 'camera-ready' };

const MODE_COPY: Record<'product' | 'shop', { title: string; hint: string }> = {
  product: {
    title: 'Scan product',
    hint: 'Point at a product QR, UPC barcode, or lab COA QR.',
  },
  shop: {
    title: 'Scan shop QR',
    hint: "Point at the dispensary's Google, Weedmaps, Leafly, or website QR.",
  },
};

function ScanCameraScreenInner({ route, navigation }: ScanCameraScreenProps) {
  const mode = route.params?.mode ?? 'product';
  const copy = MODE_COPY[mode];

  const [permission, requestPermission] = useCameraPermissions();
  const [cameraState, setCameraState] = React.useState<CameraState>({
    kind: 'requesting-permission',
  });
  const lastScannedRef = React.useRef<{ code: string; timestamp: number } | null>(null);
  const scanOpenedRef = React.useRef(false);

  /* ── Request camera permission on mount ── */
  React.useEffect(() => {
    async function requestCameraPermission() {
      if (permission?.granted) {
        setCameraState({ kind: 'camera-ready' });
        return;
      }

      if (permission?.canAskAgain) {
        const result = await requestPermission();
        if (result.granted) {
          setCameraState({ kind: 'camera-ready' });
        } else {
          setCameraState({ kind: 'camera-denied' });
        }
      } else if (!permission?.granted) {
        setCameraState({ kind: 'camera-denied' });
      }
    }

    void requestCameraPermission();
  }, [permission, requestPermission]);

  /* ── Fire scan_opened event once on mount ── */
  React.useEffect(() => {
    if (!scanOpenedRef.current) {
      scanOpenedRef.current = true;
      trackAnalyticsEvent('scan_opened', { mode });
    }
  }, [mode]);

  const handleBarcodeScanned = React.useCallback(
    async (event: { data: string }) => {
      const rawCode = event.data;

      /* ── Debounce: ignore the same code within 1.5 seconds ── */
      const now = Date.now();
      if (
        lastScannedRef.current &&
        lastScannedRef.current.code === rawCode &&
        now - lastScannedRef.current.timestamp < 1500
      ) {
        return;
      }

      lastScannedRef.current = { code: rawCode, timestamp: now };

      trackAnalyticsEvent('scan_detected', { mode });

      /* ── Classify: generic web URLs go straight to the browser.
         UPC / COA URLs / OCM license strings keep the rich ScanResult flow. */
      const classification = classifyScannedCode(rawCode);
      if (classification.kind === 'external_url') {
        trackAnalyticsEvent('scan_external_url_opened', { url: classification.url, mode });
        try {
          await Linking.openURL(classification.url);
          /* Pop back to the Verify menu so the user isn't stranded on a
             camera screen after the browser hands control back. */
          if (navigation.canGoBack()) {
            navigation.goBack();
          }
        } catch {
          // Linking refused (malformed URL, no browser) — fall through to
          // the backend resolver so the user still sees *something*.
          navigation.replace('ScanResult', { rawCode, mode });
        }
        return;
      }

      /* ── Replace this screen with the result so "back" returns to the
         Verify menu instead of re-opening the camera. */
      navigation.replace('ScanResult', { rawCode, mode });
    },
    [mode, navigation],
  );

  const handleManualEntryTapped = React.useCallback(() => {
    trackAnalyticsEvent('scan_manual_fallback_tapped', { mode });
    navigation.replace('VerifyManualEntry');
  }, [mode, navigation]);

  const handleClose = React.useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [navigation]);

  return (
    <View style={styles.container}>
      {cameraState.kind === 'camera-ready' && (
        <CameraViewerComponent onBarcodeScanned={handleBarcodeScanned} />
      )}

      {cameraState.kind === 'camera-denied' && (
        <View style={styles.deniedContainer}>
          <InlineFeedbackPanel
            tone="warning"
            label="Camera access needed"
            title="Camera is required to scan."
            body="Enable camera access in Settings to scan QR codes and barcodes. Or use manual entry instead."
            iconName="camera-outline"
          />
          <Pressable
            onPress={handleManualEntryTapped}
            style={({ pressed }) => [
              styles.fallbackButton,
              pressed && styles.fallbackButtonPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Enter information manually"
          >
            <Text style={styles.fallbackButtonText}>Enter manually</Text>
          </Pressable>
          <Pressable
            onPress={handleClose}
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.secondaryButtonPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Back to Verify menu"
          >
            <Text style={styles.secondaryButtonText}>Back to menu</Text>
          </Pressable>
        </View>
      )}

      {cameraState.kind === 'requesting-permission' && (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Initializing camera…</Text>
        </View>
      )}

      {/* ── Top-left: Close / back to menu ── */}
      <Pressable
        onPress={handleClose}
        style={({ pressed }) => [styles.topLeftPill, pressed && styles.topLeftPillPressed]}
        accessibilityRole="button"
        accessibilityLabel="Close scanner and return to Verify menu"
      >
        <AppUiIcon name="arrow-back" size={14} color={colors.text} />
        <Text style={styles.topLeftPillText}>Menu</Text>
      </Pressable>

      {/* ── Top-right: Mode pill so users know what kind of scan they picked ── */}
      <View style={styles.topRightPill}>
        <Text style={styles.topRightPillText}>{copy.title}</Text>
      </View>

      {/* ── Bottom: Mode-specific guidance + manual fallback ── */}
      <View style={styles.bottomGuidance}>
        <Text style={styles.bottomGuidanceText}>{copy.hint}</Text>
        <Pressable
          onPress={handleManualEntryTapped}
          style={({ pressed }) => [styles.manualPill, pressed && styles.manualPillPressed]}
          accessibilityRole="button"
          accessibilityLabel="Can't scan? Enter info manually"
        >
          <Text style={styles.manualPillText}>Can't scan? Enter info</Text>
        </Pressable>
      </View>
    </View>
  );
}

/* ── Separate component that loads expo-camera dynamically ── */
function CameraViewerComponent({
  onBarcodeScanned,
}: {
  onBarcodeScanned: (event: { data: string }) => void;
}) {
  const [CameraView, setCameraView] = React.useState<typeof CameraViewComponent | null>(null);

  React.useEffect(() => {
    loadCameraView().then((view) => {
      // Wrap in updater function so React stores the class component itself
      // instead of treating the class (a function) as a state updater.
      setCameraView(() => view);
    });
  }, []);

  if (!CameraView) {
    return (
      <View style={styles.cameraPlaceholder}>
        <Text style={styles.cameraPlaceholderText}>Loading camera…</Text>
      </View>
    );
  }

  return (
    <CameraView
      style={styles.camera}
      barcodeScannerSettings={{
        barcodeTypes: [
          'qr',
          'code128',
          'code39',
          'code93',
          'ean13',
          'ean8',
          'upc_e',
          'upc_a',
          'pdf417',
          'datamatrix',
          'aztec',
        ],
      }}
      onBarcodeScanned={onBarcodeScanned}
    />
  );
}

export const ScanCameraScreen = withScreenErrorBoundary(
  ScanCameraScreenInner,
  'scan-camera-screen',
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  camera: {
    flex: 1,
  },
  cameraPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  cameraPlaceholderText: {
    ...textStyles.body,
    color: colors.textSoft,
  },
  deniedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    backgroundColor: colors.background,
    gap: spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    ...textStyles.body,
    color: colors.textSoft,
  },
  topLeftPill: {
    position: 'absolute',
    top: spacing.lg,
    left: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(18, 22, 20, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(196, 184, 176, 0.20)',
  },
  topLeftPillPressed: {
    opacity: 0.75,
  },
  topLeftPillText: {
    ...textStyles.caption,
    color: colors.text,
    fontWeight: '600',
    fontSize: 12,
  },
  topRightPill: {
    position: 'absolute',
    top: spacing.lg,
    right: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(18, 22, 20, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(46, 204, 113, 0.20)',
  },
  topRightPillText: {
    ...textStyles.caption,
    color: colors.primary,
    fontWeight: '700',
    fontSize: 12,
  },
  bottomGuidance: {
    position: 'absolute',
    bottom: spacing.xl,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  bottomGuidanceText: {
    ...textStyles.caption,
    color: colors.textMuted,
    opacity: 0.85,
    fontSize: 12,
    textAlign: 'center',
  },
  manualPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(18, 22, 20, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(196, 184, 176, 0.20)',
  },
  manualPillPressed: {
    opacity: 0.75,
  },
  manualPillText: {
    ...textStyles.caption,
    color: colors.text,
    fontWeight: '600',
    fontSize: 12,
  },
  fallbackButton: {
    minHeight: 48,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    width: '100%',
  },
  fallbackButtonPressed: {
    opacity: 0.85,
  },
  fallbackButtonText: {
    ...textStyles.button,
    color: colors.background,
    fontWeight: '900',
  },
  secondaryButton: {
    minHeight: 48,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(196, 184, 176, 0.08)',
    borderWidth: 1,
    borderColor: colors.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    width: '100%',
  },
  secondaryButtonPressed: {
    opacity: 0.8,
  },
  secondaryButtonText: {
    ...textStyles.button,
    color: colors.text,
    fontWeight: '700',
  },
});

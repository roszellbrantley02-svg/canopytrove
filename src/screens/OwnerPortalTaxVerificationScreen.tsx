/**
 * Tax-ID Verification Screen (Phase 2.5).
 *
 * Owner enters their NY business taxpayer ID (TPID); we look it up against
 * the public NYS Department of Taxation and Finance dataset (gttd-5u6y).
 * On match against the OCM legal entity for the owner's primary
 * storefront, we tag their profile with a "Tax-verified" badge.
 *
 * NOT a verification gate. Owner can use the full feature set without
 * tax verification — this is purely an opt-in trust booster.
 *
 * Privacy properties:
 *   - TPID is sent over HTTPS, hashed server-side with TAX_ID_HASH_SALT
 *     before persistence, and never logged or returned in the response.
 *   - We don't echo the entered TPID back in the result UI.
 *
 * Behavior when tax-ID verification is disabled server-side:
 *   - Backend returns { ok: false, code: 'feature_disabled' }
 *   - Screen renders a friendly "not yet available" message instead of
 *     the form.
 */

import React from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MotionInView } from '../components/MotionInView';
import { ScreenShell } from '../components/ScreenShell';
import { SectionCard } from '../components/SectionCard';
import { withScreenErrorBoundary } from '../components/withScreenErrorBoundary';
import { AppUiIcon } from '../icons/AppUiIcon';
import { useStorefrontProfileController } from '../context/StorefrontController';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { getOwnerProfile } from '../services/ownerPortalProfileService';
import { submitOwnerTaxVerification } from '../services/ownerPortalTaxVerificationService';
import { colors } from '../theme/tokens';
import { OwnerPortalHeroPanel } from './ownerPortal/OwnerPortalHeroPanel';
import { ownerPortalStyles as styles } from './ownerPortal/ownerPortalStyles';

type Stage =
  | { phase: 'loading' }
  | { phase: 'no_primary' }
  | { phase: 'ready'; primaryDispensaryId: string }
  | { phase: 'submitting'; primaryDispensaryId: string }
  | {
      phase: 'matched';
      legalName: string;
      tpidLicenseCount: number;
      taxVerifiedAt: string;
    }
  | { phase: 'no_match'; reason: string }
  | { phase: 'feature_disabled' }
  | { phase: 'error'; message: string };

function reasonToFriendly(reason: string): string {
  switch (reason) {
    case 'tpid_not_found':
      return "We didn't find that taxpayer ID in the NYS Tax & Finance registry. Double-check the digits and try again — or skip this step entirely if your shop is too newly licensed to be in the tax registry yet.";
    case 'storefront_not_found':
      return "We couldn't load your primary storefront. Try again, or contact support.";
    case 'ocm_match_not_found':
      return "We couldn't find your storefront in the OCM public license registry. Tax verification needs that match to confirm the legal-entity name.";
    case 'legal_name_mismatch':
      return "Your tax record's legal entity name doesn't match the OCM record for your storefront. If you recently changed your business name, both registries need to be updated before tax verification can match.";
    default:
      return reason;
  }
}

function OwnerPortalTaxVerificationScreenInner() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { authSession } = useStorefrontProfileController();
  const [tpid, setTpid] = React.useState('');
  const [stage, setStage] = React.useState<Stage>({ phase: 'loading' });

  // Capture once per re-render so the IIFE can use a non-nullable string and
  // TS narrows correctly inside the async closure.
  const ownerUid = authSession.status === 'authenticated' ? authSession.uid : null;
  // Persist the resolved primary dispensary id across phase transitions —
  // the discriminated union loses access to it during submitting/error/no_match,
  // so we keep an independent ref for the submit handler to use.
  const primaryDispensaryIdRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    let active = true;
    if (!ownerUid) {
      setStage({ phase: 'no_primary' });
      return () => {
        active = false;
      };
    }
    void (async () => {
      try {
        const profile = await getOwnerProfile(ownerUid);
        if (!active) return;
        if (!profile?.dispensaryId) {
          primaryDispensaryIdRef.current = null;
          setStage({ phase: 'no_primary' });
          return;
        }
        primaryDispensaryIdRef.current = profile.dispensaryId;
        setStage({ phase: 'ready', primaryDispensaryId: profile.dispensaryId });
      } catch (error) {
        if (!active) return;
        setStage({
          phase: 'error',
          message: error instanceof Error ? error.message : 'Could not load your profile.',
        });
      }
    })();
    return () => {
      active = false;
    };
  }, [ownerUid]);

  const canSubmit =
    (stage.phase === 'ready' || stage.phase === 'no_match' || stage.phase === 'error') &&
    /^\d{8,11}$/.test(tpid.trim());
  const isSubmitting = stage.phase === 'submitting';

  const handleSubmit = async () => {
    if (!canSubmit) return;
    const primaryDispensaryId = primaryDispensaryIdRef.current;
    if (!primaryDispensaryId) return;
    setStage({ phase: 'submitting', primaryDispensaryId });
    try {
      const result = await submitOwnerTaxVerification({
        tpid: tpid.trim(),
        primaryDispensaryId,
      });
      if (!result.ok) {
        if (result.code === 'feature_disabled') {
          setStage({ phase: 'feature_disabled' });
          return;
        }
        setStage({
          phase: 'error',
          message: result.message ?? 'Tax verification is unavailable right now.',
        });
        return;
      }
      if (result.matched) {
        // Clear the input — never keep the entered TPID in component state
        // longer than needed.
        setTpid('');
        setStage({
          phase: 'matched',
          legalName: result.legalName,
          tpidLicenseCount: result.tpidLicenseCount,
          taxVerifiedAt: result.taxVerifiedAt,
        });
        return;
      }
      setStage({ phase: 'no_match', reason: result.reason });
    } catch (error) {
      setStage({
        phase: 'error',
        message: error instanceof Error ? error.message : 'Tax verification request failed.',
      });
    }
  };

  const handleRetry = () => {
    // Resume from the original primary dispensary id by re-reading profile.
    setTpid('');
    setStage({ phase: 'loading' });
    if (!ownerUid) return;
    const ownerUidLocal = ownerUid;
    void (async () => {
      try {
        const profile = await getOwnerProfile(ownerUidLocal);
        if (!profile?.dispensaryId) {
          primaryDispensaryIdRef.current = null;
          setStage({ phase: 'no_primary' });
          return;
        }
        primaryDispensaryIdRef.current = profile.dispensaryId;
        setStage({ phase: 'ready', primaryDispensaryId: profile.dispensaryId });
      } catch (error) {
        setStage({
          phase: 'error',
          message: error instanceof Error ? error.message : 'Could not load your profile.',
        });
      }
    })();
  };

  return (
    <ScreenShell
      eyebrow="Owner Portal"
      title="Tax-verify your business"
      subtitle="Optional — adds a Tax-verified badge to your owner profile when your NY taxpayer ID matches the OCM legal entity for your shop."
      headerPill="Verification"
    >
      <MotionInView delay={70}>
        <OwnerPortalHeroPanel
          kicker="Trust booster"
          title="Match your NY business taxpayer ID to your OCM license"
          body="Your TPID is hashed before storage and never logged. This step is optional — your owner account works without it."
          metrics={[
            { value: 'Optional', label: 'Status', body: '' },
            { value: 'Hashed', label: 'Privacy', body: '' },
            { value: '~10 sec', label: 'Time', body: '' },
          ]}
          steps={[]}
          activeStepIndex={0}
        />
      </MotionInView>

      <MotionInView delay={120}>
        <SectionCard
          title={
            stage.phase === 'matched'
              ? 'Tax verification successful'
              : stage.phase === 'feature_disabled'
                ? 'Tax verification is not available yet'
                : stage.phase === 'no_primary'
                  ? "You don't have a primary storefront claimed yet"
                  : 'Enter your NY business taxpayer ID'
          }
          body={
            stage.phase === 'matched'
              ? `Your owner profile now displays a Tax-verified badge.`
              : stage.phase === 'feature_disabled'
                ? "We're rolling out tax verification gradually. Check back soon."
                : stage.phase === 'no_primary'
                  ? 'Claim and verify your primary storefront first, then come back here.'
                  : 'We compare your TPID against the public NYS Tax & Finance retailer registry and the OCM license registry.'
          }
        >
          {stage.phase === 'matched' ? (
            <View style={styles.sectionStack}>
              <View style={styles.statusPanel}>
                <View style={styles.statusRow}>
                  <Text style={styles.statusLabel}>Legal entity</Text>
                  <Text style={styles.statusValue}>{stage.legalName}</Text>
                </View>
                <View style={styles.statusRow}>
                  <Text style={styles.statusLabel}>Licenses under this TPID</Text>
                  <Text style={styles.statusValue}>{stage.tpidLicenseCount}</Text>
                </View>
                <View style={styles.statusRow}>
                  <Text style={styles.statusLabel}>Verified at</Text>
                  <Text style={styles.statusValue}>
                    {new Date(stage.taxVerifiedAt).toLocaleString()}
                  </Text>
                </View>
              </View>
              <Pressable
                onPress={() => navigation.replace('OwnerPortalHome')}
                style={styles.primaryButton}
              >
                <Text style={styles.primaryButtonText}>Continue to Owner Home</Text>
              </Pressable>
            </View>
          ) : stage.phase === 'feature_disabled' || stage.phase === 'no_primary' ? (
            <View style={styles.sectionStack}>
              <Pressable
                onPress={() => navigation.replace('OwnerPortalHome')}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonText}>Back to Owner Home</Text>
              </Pressable>
            </View>
          ) : stage.phase === 'loading' ? (
            <Text style={styles.fieldHint}>Loading your profile…</Text>
          ) : (
            <View style={styles.sectionStack}>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>NY Taxpayer ID (TPID)</Text>
                <TextInput
                  value={tpid}
                  onChangeText={setTpid}
                  placeholder="123456789"
                  keyboardType="number-pad"
                  placeholderTextColor={colors.textSoft}
                  style={styles.inputPremium}
                  accessibilityLabel="NY business taxpayer ID"
                  autoComplete="off"
                  textContentType="none"
                  maxLength={11}
                />
                <Text style={styles.fieldHint}>
                  8 to 11 digits. We hash this value before storage — the raw number is never
                  written to disk or logged.
                </Text>
              </View>
              {stage.phase === 'no_match' ? (
                <Text style={styles.errorText} accessibilityLiveRegion="polite">
                  {reasonToFriendly(stage.reason)}
                </Text>
              ) : null}
              {stage.phase === 'error' ? (
                <View style={styles.fieldGroup}>
                  <Text style={styles.errorText} accessibilityLiveRegion="polite">
                    {stage.message}
                  </Text>
                  <Pressable onPress={handleRetry} style={styles.secondaryButton}>
                    <Text style={styles.secondaryButtonText}>Retry</Text>
                  </Pressable>
                </View>
              ) : null}
              <Pressable
                disabled={!canSubmit || isSubmitting}
                onPress={() => {
                  void handleSubmit();
                }}
                style={[
                  styles.primaryButton,
                  (!canSubmit || isSubmitting) && styles.buttonDisabled,
                ]}
              >
                <Text style={styles.primaryButtonText}>
                  {isSubmitting ? 'Verifying…' : 'Verify Tax ID'}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => navigation.replace('OwnerPortalHome')}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonText}>Skip for now</Text>
              </Pressable>
            </View>
          )}
        </SectionCard>
      </MotionInView>

      <MotionInView delay={180}>
        <SectionCard
          title="Why this is optional"
          body="The OCM license registry already covers the verification needed to claim your storefront. Tax verification adds an extra trust badge for owners whose business is registered in the NYS Tax & Finance retailer dataset. If your shop was newly licensed (2026 onward), you may not be in the tax registry yet — that's normal and expected."
        >
          <View style={styles.statusPanel}>
            <View style={styles.statusRow}>
              <View style={styles.splitHeaderRow}>
                <View style={styles.splitHeaderCopy}>
                  <Text style={styles.statusLabel}>Optional badge</Text>
                  <Text style={styles.statusValue}>
                    Adds a Tax-verified badge to your owner profile
                  </Text>
                </View>
                <AppUiIcon name="checkmark-circle" size={20} color={colors.primary} />
              </View>
            </View>
          </View>
        </SectionCard>
      </MotionInView>
    </ScreenShell>
  );
}

export const OwnerPortalTaxVerificationScreen = withScreenErrorBoundary(
  OwnerPortalTaxVerificationScreenInner,
  'owner-portal-tax-verification',
);

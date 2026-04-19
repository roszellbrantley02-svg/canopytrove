import React from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppUiIcon } from '../icons/AppUiIcon';
import { InlineFeedbackPanel } from '../components/InlineFeedbackPanel';
import { LicensedBadge } from '../components/LicensedBadge';
import { MotionInView } from '../components/MotionInView';
import { ScreenShell } from '../components/ScreenShell';
import { SectionCard } from '../components/SectionCard';
import { withScreenErrorBoundary } from '../components/withScreenErrorBoundary';
import { trackAnalyticsEvent } from '../services/analyticsService';
import { verifyLicense, type LicenseVerifyResult } from '../services/licenseVerificationService';
import { colors, fontFamilies, radii, spacing, textStyles, typography } from '../theme/tokens';
import type { RootStackParamList } from '../navigation/rootNavigatorConfig';

type VerifyManualEntryScreenProps = NativeStackScreenProps<RootStackParamList, 'VerifyManualEntry'>;

type ManualEntryState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'result'; result: LicenseVerifyResult }
  | { kind: 'error'; message: string };

function VerifyManualEntryScreenInner({ navigation: _navigation }: VerifyManualEntryScreenProps) {
  const [licenseNumber, setLicenseNumber] = React.useState('');
  const [name, setName] = React.useState('');
  const [address, setAddress] = React.useState('');
  const [city, setCity] = React.useState('');
  const [zip, setZip] = React.useState('');
  const [state, setState] = React.useState<ManualEntryState>({ kind: 'idle' });

  const canSubmit =
    licenseNumber.trim().length > 0 || name.trim().length > 0 || address.trim().length > 0;

  const handleSubmit = React.useCallback(async () => {
    if (!canSubmit || state.kind === 'loading') {
      return;
    }

    const query = {
      license: licenseNumber.trim() || undefined,
      name: name.trim() || undefined,
      address: address.trim() || undefined,
      city: city.trim() || undefined,
      zip: zip.trim() || undefined,
    };

    setState({ kind: 'loading' });
    trackAnalyticsEvent('license_verify_submitted', {
      hasLicense: Boolean(query.license),
      hasName: Boolean(query.name),
      hasAddress: Boolean(query.address),
    });

    try {
      const result = await verifyLicense(query);
      setState({ kind: 'result', result });
      trackAnalyticsEvent('license_verify_result', {
        licensed: result.licensed,
        confidence: result.confidence,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to check license records right now.';
      setState({ kind: 'error', message });
    }
  }, [address, canSubmit, city, licenseNumber, name, state.kind, zip]);

  const handleReset = React.useCallback(() => {
    setLicenseNumber('');
    setName('');
    setAddress('');
    setCity('');
    setZip('');
    setState({ kind: 'idle' });
  }, []);

  return (
    <ScreenShell
      eyebrow="Manual entry"
      title="Enter what you have"
      subtitle="License number, shop name, or street address."
      headerPill={undefined}
      resetScrollOnFocus={true}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        enabled={Platform.OS === 'ios'}
        keyboardVerticalOffset={24}
      >
        <View style={styles.stack}>
          <MotionInView delay={90}>
            <SectionCard
              title="Check a dispensary"
              body="Paste a license number, street address, or storefront name. Any single field works — more fields make the match tighter."
              eyebrow="OCM public records"
              iconName="shield-checkmark-outline"
              tone="primary"
            >
              <View style={styles.form}>
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>License number</Text>
                  <TextInput
                    value={licenseNumber}
                    onChangeText={setLicenseNumber}
                    placeholder="e.g. OCM-CAURD-23-000123"
                    placeholderTextColor={colors.textSoft}
                    style={styles.input}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    accessibilityLabel="License number"
                    accessibilityHint="Enter the OCM license number printed on the shop's display."
                  />
                </View>
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Shop name</Text>
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    placeholder="e.g. Housing Works Cannabis Co"
                    placeholderTextColor={colors.textSoft}
                    style={styles.input}
                    autoCorrect={false}
                    accessibilityLabel="Shop name"
                    accessibilityHint="Enter the dispensary name exactly as it appears on the storefront."
                  />
                </View>
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Street address</Text>
                  <TextInput
                    value={address}
                    onChangeText={setAddress}
                    placeholder="e.g. 750 Broadway"
                    placeholderTextColor={colors.textSoft}
                    style={styles.input}
                    autoCapitalize="words"
                    accessibilityLabel="Street address"
                    accessibilityHint="Enter the street number and name of the dispensary."
                  />
                </View>
                <View style={styles.inlineFieldRow}>
                  <View style={[styles.field, styles.fieldFlex]}>
                    <Text style={styles.fieldLabel}>City</Text>
                    <TextInput
                      value={city}
                      onChangeText={setCity}
                      placeholder="City"
                      placeholderTextColor={colors.textSoft}
                      style={styles.input}
                      autoCapitalize="words"
                      accessibilityLabel="City"
                    />
                  </View>
                  <View style={[styles.field, styles.fieldZip]}>
                    <Text style={styles.fieldLabel}>ZIP</Text>
                    <TextInput
                      value={zip}
                      onChangeText={setZip}
                      placeholder="10003"
                      placeholderTextColor={colors.textSoft}
                      style={styles.input}
                      keyboardType="number-pad"
                      maxLength={10}
                      accessibilityLabel="ZIP code"
                    />
                  </View>
                </View>
              </View>

              <View style={styles.actions}>
                <Pressable
                  disabled={!canSubmit || state.kind === 'loading'}
                  onPress={() => {
                    void handleSubmit();
                  }}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    (!canSubmit || state.kind === 'loading') && styles.primaryButtonDisabled,
                    pressed && styles.primaryButtonPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Verify license"
                  accessibilityHint="Checks the entered details against the OCM public registry."
                >
                  {state.kind === 'loading' ? (
                    <ActivityIndicator color={colors.backgroundDeep} size="small" />
                  ) : (
                    <AppUiIcon
                      name="shield-checkmark-outline"
                      size={16}
                      color={colors.backgroundDeep}
                    />
                  )}
                  <Text style={styles.primaryButtonText}>
                    {state.kind === 'loading' ? 'Checking OCM records…' : 'Verify license'}
                  </Text>
                </Pressable>

                {state.kind !== 'idle' ? (
                  <Pressable
                    onPress={handleReset}
                    style={({ pressed }) => [
                      styles.secondaryButton,
                      pressed && styles.secondaryButtonPressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Start a new check"
                    accessibilityHint="Clears the form so you can verify a different shop."
                  >
                    <Text style={styles.secondaryButtonText}>New check</Text>
                  </Pressable>
                ) : null}
              </View>
            </SectionCard>
          </MotionInView>

          {state.kind === 'result' ? (
            <MotionInView delay={120}>
              <View style={styles.resultBlock}>
                {state.result.licensed ? (
                  <>
                    <LicensedBadge verification={state.result} variant="full" />
                    {state.result.record ? (
                      <View style={styles.recordCard}>
                        <Text style={styles.recordHeading}>{state.result.record.licenseeName}</Text>
                        {state.result.record.dbaName ? (
                          <Text style={styles.recordDba}>
                            Doing business as {state.result.record.dbaName}
                          </Text>
                        ) : null}
                        {state.result.record.address ? (
                          <Text style={styles.recordMeta}>
                            {state.result.record.address}
                            {state.result.record.city ? `, ${state.result.record.city}` : ''}
                            {state.result.record.state ? `, ${state.result.record.state}` : ''}
                            {state.result.record.zip ? ` ${state.result.record.zip}` : ''}
                          </Text>
                        ) : null}
                        <View style={styles.recordPillRow}>
                          <View style={styles.recordPill}>
                            <Text style={styles.recordPillLabel}>Status</Text>
                            <Text style={styles.recordPillValue}>{state.result.record.status}</Text>
                          </View>
                          <View style={styles.recordPill}>
                            <Text style={styles.recordPillLabel}>Type</Text>
                            <Text style={styles.recordPillValue} numberOfLines={1}>
                              {state.result.record.licenseType}
                            </Text>
                          </View>
                        </View>
                      </View>
                    ) : null}
                  </>
                ) : (
                  <InlineFeedbackPanel
                    tone="warning"
                    label="No match"
                    title="We couldn't match this to a licensed dispensary."
                    body="Double-check the spelling, try the street address instead of the name, or add the license number. OCM publishes updates on a rolling basis — a brand-new shop may take a day or two to appear."
                    iconName="information-circle-outline"
                  />
                )}

                <InlineFeedbackPanel
                  tone="info"
                  label="About this check"
                  title="Sourced from the OCM public dispensary registry."
                  body={state.result.disclaimer}
                  iconName="information-circle-outline"
                />
              </View>
            </MotionInView>
          ) : null}

          {state.kind === 'error' ? (
            <MotionInView delay={120}>
              <InlineFeedbackPanel
                tone="danger"
                label="Couldn't check"
                title="Verification is temporarily unavailable."
                body={state.message}
                iconName="information-circle-outline"
              />
            </MotionInView>
          ) : null}

          {state.kind === 'idle' ? (
            <MotionInView delay={140}>
              <InlineFeedbackPanel
                tone="info"
                label="How it works"
                title="Every storefront is also pre-checked for you."
                body="Listings tagged Verified licensed in Browse, Nearby, and Hot Deals are matched against the same OCM registry in the background. Use this screen to double-check a shop you're standing in front of."
                iconName="information-circle-outline"
              />
            </MotionInView>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </ScreenShell>
  );
}

export const VerifyManualEntryScreen = withScreenErrorBoundary(
  VerifyManualEntryScreenInner,
  'verify-manual-entry-screen',
);

const styles = StyleSheet.create({
  stack: {
    gap: spacing.lg,
  },
  form: {
    gap: spacing.md,
  },
  field: {
    gap: spacing.xs,
  },
  fieldLabel: {
    ...textStyles.labelCaps,
    color: colors.textSoft,
    fontSize: 11,
    letterSpacing: 0.6,
  },
  input: {
    minHeight: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: 'rgba(8, 14, 19, 0.78)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    fontFamily: fontFamilies.body,
    fontSize: typography.body,
  },
  inlineFieldRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  fieldFlex: {
    flex: 1,
  },
  fieldZip: {
    width: 116,
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    shadowColor: colors.primary,
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  primaryButtonDisabled: {
    opacity: 0.55,
    shadowOpacity: 0.1,
  },
  primaryButtonPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  primaryButtonText: {
    ...textStyles.button,
    color: colors.backgroundDeep,
    fontWeight: '900',
  },
  secondaryButton: {
    minHeight: 44,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: 'rgba(8, 14, 19, 0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  secondaryButtonPressed: {
    opacity: 0.86,
  },
  secondaryButtonText: {
    ...textStyles.button,
    color: colors.text,
  },
  resultBlock: {
    gap: spacing.md,
  },
  recordCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: 'rgba(8, 14, 19, 0.72)',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  recordHeading: {
    ...textStyles.section,
    color: colors.text,
  },
  recordDba: {
    ...textStyles.caption,
    color: colors.textSoft,
  },
  recordMeta: {
    ...textStyles.body,
    color: colors.textMuted,
    lineHeight: 22,
  },
  recordPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  recordPill: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: 'rgba(0, 245, 140, 0.06)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    flexShrink: 1,
    maxWidth: '100%',
  },
  recordPillLabel: {
    ...textStyles.labelCaps,
    color: colors.textSoft,
    fontSize: 10,
    letterSpacing: 0.6,
  },
  recordPillValue: {
    ...textStyles.caption,
    color: colors.text,
    fontWeight: '800',
    textTransform: 'capitalize',
  },
});

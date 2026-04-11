import React from 'react';
import { colors } from '../theme/tokens';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MotionInView } from '../components/MotionInView';
import { ScreenShell } from '../components/ScreenShell';
import { SectionCard } from '../components/SectionCard';
import { AppUiIcon } from '../icons/AppUiIcon';

import type { RootStackParamList } from '../navigation/RootNavigator';
import { OwnerPortalStageList } from './ownerPortal/OwnerPortalStageList';
import { ownerPortalStyles as styles } from './ownerPortal/ownerPortalStyles';
import { useOwnerPortalIdentityVerificationModel } from './ownerPortal/useOwnerPortalIdentityVerificationModel';

type IdentityVerificationRoute = RouteProp<RootStackParamList, 'OwnerPortalIdentityVerification'>;

const ONBOARDING_STEPS = [
  'Account',
  'Business Details',
  'Claim Listing',
  'Business Verification',
  'Identity',
];

function OwnerPortalIdentityVerificationPreview() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <ScreenShell
      eyebrow="Owner Portal"
      title="Identity verification."
      subtitle="Review the identity step with preview data."
      headerPill="Preview"
    >
      <MotionInView delay={70}>
        <View style={styles.portalHeroCard}>
          <View style={styles.portalHeroGlow} />
          <Text style={styles.portalHeroKicker}>Verification</Text>
          <Text style={styles.portalHeroTitle}>Inspect the final identity-review step.</Text>
          <Text style={styles.portalHeroBody}>
            Stripe Identity verifies your government-issued ID and matches it to a live selfie.
          </Text>
          <View style={styles.summaryStrip}>
            <View style={styles.summaryTile}>
              <Text style={styles.summaryTileValue}>Automated</Text>
              <Text style={styles.summaryTileLabel}>Verification</Text>
              <Text style={styles.summaryTileBody}></Text>
            </View>
            <View style={styles.summaryTile}>
              <Text style={styles.summaryTileValue}>Preview</Text>
              <Text style={styles.summaryTileLabel}>Mode</Text>
              <Text style={styles.summaryTileBody}></Text>
            </View>
          </View>
          <View style={styles.onboardingStepRow}>
            {ONBOARDING_STEPS.map((step, index) => (
              <View
                key={step}
                style={[styles.onboardingStepChip, index === 4 && styles.onboardingStepChipActive]}
              >
                <Text
                  style={[
                    styles.onboardingStepChipText,
                    index === 4 && styles.onboardingStepChipTextActive,
                  ]}
                >
                  {step}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </MotionInView>

      <MotionInView delay={120}>
        <SectionCard title="Identity review" body="">
          <View style={styles.sectionStack}>
            <OwnerPortalStageList
              items={[
                {
                  label: 'Business review comes first',
                  body: 'Identity review follows business verification.',
                  tone: 'complete',
                },
                {
                  label: 'Stripe Identity verification',
                  body: 'Scan your ID and take a selfie — Stripe verifies instantly.',
                  tone: 'current',
                },
                {
                  label: 'Next: owner access',
                  body: 'Owner access follows approval.',
                  tone: 'pending',
                },
              ]}
            />
            <View style={styles.ctaPanel}>
              <Pressable
                onPress={() => navigation.navigate('OwnerPortalSubscription')}
                style={styles.primaryButton}
              >
                <Text style={styles.primaryButtonText}>Continue To Owner Access</Text>
              </Pressable>
            </View>
          </View>
        </SectionCard>
      </MotionInView>
    </ScreenShell>
  );
}

function OwnerPortalIdentityVerificationLive() {
  const {
    isAlreadyVerified,
    isLoading,
    isProcessing,
    isSubmitDisabled,
    isSubmitting,
    statusText,
    verificationStarted,
    startVerification,
    checkStatus,
  } = useOwnerPortalIdentityVerificationModel();

  const statusLabel = isAlreadyVerified
    ? 'Verified'
    : isProcessing
      ? 'Processing'
      : verificationStarted
        ? 'In Progress'
        : 'Not Started';

  return (
    <ScreenShell
      eyebrow="Owner Portal"
      title="Identity verification."
      subtitle="Verify your identity securely through Stripe. Scan your government-issued ID and take a selfie."
      headerPill="Verification"
    >
      <MotionInView delay={70}>
        <View style={styles.portalHeroCard}>
          <View style={styles.portalHeroGlow} />
          <Text style={styles.portalHeroKicker}>Verification</Text>
          <Text style={styles.portalHeroTitle}>Complete the final identity step.</Text>
          <Text style={styles.portalHeroBody}>
            Stripe Identity scans your ID, checks its authenticity, and matches your selfie to the
            photo on your document — all automatically.
          </Text>
          <View style={styles.summaryStrip}>
            <View style={styles.summaryTile}>
              <Text style={styles.summaryTileValue}>Stripe Identity</Text>
              <Text style={styles.summaryTileLabel}>Provider</Text>
              <Text style={styles.summaryTileBody}></Text>
            </View>
            <View style={styles.summaryTile}>
              <Text style={styles.summaryTileValue}>{statusLabel}</Text>
              <Text style={styles.summaryTileLabel}>Status</Text>
              <Text style={styles.summaryTileBody}></Text>
            </View>
          </View>
          <View style={styles.onboardingStepRow}>
            {ONBOARDING_STEPS.map((step, index) => (
              <View
                key={step}
                style={[styles.onboardingStepChip, index === 4 && styles.onboardingStepChipActive]}
              >
                <Text
                  style={[
                    styles.onboardingStepChipText,
                    index === 4 && styles.onboardingStepChipTextActive,
                  ]}
                >
                  {step}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </MotionInView>

      <MotionInView delay={120}>
        <SectionCard title="Identity review" body="">
          <View style={styles.sectionStack}>
            <OwnerPortalStageList
              items={[
                {
                  label: 'Business review',
                  body: 'Identity step follows business verification.',
                  tone: 'complete',
                },
                {
                  label: 'Stripe Identity verification',
                  body: 'Scan your government-issued ID and take a live selfie.',
                  tone: isAlreadyVerified ? 'complete' : 'current',
                },
                {
                  label: 'Next: owner access',
                  body: 'Owner access follows approval.',
                  tone: isAlreadyVerified ? 'current' : 'pending',
                },
              ]}
            />
            {isLoading ? (
              <View style={styles.emptyStateCard}>
                <Text style={styles.emptyStateTitle}>Loading owner profile</Text>
                <Text style={styles.emptyStateBody}>
                  Preparing the identity-review step with the current owner profile data.
                </Text>
              </View>
            ) : (
              <>
                <View style={styles.plannerPanel}>
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>How it works</Text>
                    <Text style={localStyles.howItWorksBody}>
                      Stripe Identity verifies your government-issued ID is authentic and matches
                      your face to the photo on the document. The entire process takes about 60
                      seconds. Your data is handled securely by Stripe and never stored by Canopy
                      Trove.
                    </Text>
                  </View>

                  <View style={styles.cardStack}>
                    <View style={styles.onboardingFileCard}>
                      <View style={styles.onboardingFileHeader}>
                        <View style={styles.onboardingFileMeta}>
                          <Text style={styles.sectionEyebrow}>Step 1</Text>
                          <Text style={styles.splitHeaderTitle}>Scan your ID</Text>
                          <Text style={styles.onboardingFileHint}>
                            Driver's license, state ID, or passport.
                          </Text>
                        </View>
                        <AppUiIcon name="document-text-outline" size={20} color="#F5C86A" />
                      </View>
                    </View>

                    <View style={styles.onboardingFileCard}>
                      <View style={styles.onboardingFileHeader}>
                        <View style={styles.onboardingFileMeta}>
                          <Text style={styles.sectionEyebrow}>Step 2</Text>
                          <Text style={styles.splitHeaderTitle}>Take a selfie</Text>
                          <Text style={styles.onboardingFileHint}>
                            Live camera capture matches your face to your ID photo.
                          </Text>
                        </View>
                        <AppUiIcon name="camera-outline" size={20} color="#F5C86A" />
                      </View>
                    </View>

                    <View style={styles.onboardingFileCard}>
                      <View style={styles.onboardingFileHeader}>
                        <View style={styles.onboardingFileMeta}>
                          <Text style={styles.sectionEyebrow}>Step 3</Text>
                          <Text style={styles.splitHeaderTitle}>Instant result</Text>
                          <Text style={styles.onboardingFileHint}>
                            Stripe checks authenticity and biometric match automatically.
                          </Text>
                        </View>
                        <AppUiIcon name="checkmark-circle-outline" size={20} color="#F5C86A" />
                      </View>
                    </View>
                  </View>
                </View>
              </>
            )}

            {statusText ? <Text style={styles.errorText}>{statusText}</Text> : null}

            <View style={styles.ctaPanel}>
              <View style={styles.splitHeaderRow}>
                <View style={styles.splitHeaderCopy}>
                  <Text style={styles.sectionEyebrow}>
                    {verificationStarted
                      ? 'Verification in progress'
                      : 'Start identity verification'}
                  </Text>
                </View>
                <AppUiIcon name="person-circle-outline" size={20} color="#F5C86A" />
              </View>
              {verificationStarted || isProcessing ? (
                <Pressable onPress={checkStatus} style={styles.primaryButton}>
                  <Text style={styles.primaryButtonText}>Check Verification Status</Text>
                </Pressable>
              ) : (
                <Pressable
                  disabled={isSubmitDisabled}
                  onPress={startVerification}
                  style={[styles.primaryButton, isSubmitDisabled && styles.buttonDisabled]}
                >
                  <Text style={styles.primaryButtonText}>
                    {isSubmitting
                      ? 'Opening Stripe...'
                      : isAlreadyVerified
                        ? 'Identity Verified'
                        : 'Verify My Identity'}
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        </SectionCard>
      </MotionInView>
    </ScreenShell>
  );
}

const localStyles = StyleSheet.create({
  howItWorksBody: { color: colors.textSoft, fontSize: 14, lineHeight: 20 },
});

export function OwnerPortalIdentityVerificationScreen() {
  const route = useRoute<IdentityVerificationRoute>();
  const preview = route.params?.preview ?? false;

  if (preview) {
    return <OwnerPortalIdentityVerificationPreview />;
  }

  return <OwnerPortalIdentityVerificationLive />;
}

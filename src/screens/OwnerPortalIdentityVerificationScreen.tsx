import React from 'react';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Pressable, Text, TextInput, View } from 'react-native';
import { MotionInView } from '../components/MotionInView';
import { ScreenShell } from '../components/ScreenShell';
import { SectionCard } from '../components/SectionCard';
import { AppUiIcon } from '../icons/AppUiIcon';
import { ownerPortalPreviewEnabled } from '../config/ownerPortalConfig';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { OwnerPortalStageList } from './ownerPortal/OwnerPortalStageList';
import { ownerPortalStyles as styles } from './ownerPortal/ownerPortalStyles';
import {
  ID_TYPE_OPTIONS,
  useOwnerPortalIdentityVerificationModel,
} from './ownerPortal/useOwnerPortalIdentityVerificationModel';
import { ownerPortalPreviewProfile } from './ownerPortal/ownerPortalPreviewData';

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
  const [fullName, setFullName] = React.useState(ownerPortalPreviewProfile.legalName);
  const [idType, setIdType] = React.useState<(typeof ID_TYPE_OPTIONS)[number]>('drivers_license');

  return (
    <ScreenShell
      eyebrow="Owner Portal"
      title="Identity verification."
      subtitle="Review the identity step with preview files."
      headerPill="Preview"
    >
      <MotionInView delay={70}>
        <View style={styles.portalHeroCard}>
          <View style={styles.portalHeroGlow} />
          <Text style={styles.portalHeroKicker}>Verification</Text>
          <Text style={styles.portalHeroTitle}>Inspect the final identity-review step.</Text>
          <Text style={styles.portalHeroBody}>
            Package the owner's identity proof before workspace access.
          </Text>
          <View style={styles.summaryStrip}>
            <View style={styles.summaryTile}>
              <Text style={styles.summaryTileValue}>3 files</Text>
              <Text style={styles.summaryTileLabel}>Image slots</Text>
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
                  label: 'Identity package',
                  body: 'ID and selfie in final review step.',
                  tone: 'current',
                },
                {
                  label: 'Next: owner access',
                  body: 'Owner access follows approval.',
                  tone: 'pending',
                },
              ]}
            />
            <View style={styles.plannerPanel}>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Full legal name</Text>
                <TextInput
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="Full legal name"
                  placeholderTextColor="#738680"
                  style={styles.inputPremium}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>ID type</Text>
                <View style={styles.wrapRow}>
                  {ID_TYPE_OPTIONS.map((option) => {
                    const selected = option === idType;
                    return (
                      <Pressable
                        key={option}
                        onPress={() => setIdType(option)}
                        style={[styles.choiceChip, selected && styles.choiceChipSelected]}
                      >
                        <Text
                          style={[styles.choiceChipText, selected && styles.choiceChipTextSelected]}
                        >
                          {option.replace(/_/g, ' ')}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>

            <View style={styles.cardStack}>
              <View style={styles.onboardingFileCard}>
                <View style={styles.onboardingFileHeader}>
                  <View style={styles.onboardingFileMeta}>
                    <Text style={styles.sectionEyebrow}>ID front</Text>
                    <Text style={styles.splitHeaderTitle}>Preview-id-front.jpg</Text>
                    <Text style={styles.onboardingFileHint}>
                      Front-side identity image for review.
                    </Text>
                  </View>
                  <AppUiIcon name="image-outline" size={20} color="#F5C86A" />
                </View>
              </View>

              <View style={styles.onboardingFileCard}>
                <View style={styles.onboardingFileHeader}>
                  <View style={styles.onboardingFileMeta}>
                    <Text style={styles.sectionEyebrow}>ID back</Text>
                    <Text style={styles.splitHeaderTitle}>Preview-id-back.jpg</Text>
                    <Text style={styles.onboardingFileHint}>
                      Back image slot, optional when passport is selected.
                    </Text>
                  </View>
                  <AppUiIcon name="images-outline" size={20} color="#F5C86A" />
                </View>
              </View>

              <View style={styles.onboardingFileCard}>
                <View style={styles.onboardingFileHeader}>
                  <View style={styles.onboardingFileMeta}>
                    <Text style={styles.sectionEyebrow}>Selfie</Text>
                    <Text style={styles.splitHeaderTitle}>Preview-selfie.jpg</Text>
                    <Text style={styles.onboardingFileHint}>Selfie for identity match.</Text>
                  </View>
                  <AppUiIcon name="camera-outline" size={20} color="#F5C86A" />
                </View>
              </View>

              <View style={[styles.onboardingInfoCard, styles.onboardingInfoCardWarm]}>
                <Text style={styles.splitHeaderTitle}>Preview mode</Text>
                <Text style={styles.splitHeaderBody}>
                  No identity files are chosen or uploaded.
                </Text>
              </View>
            </View>

            <View style={styles.ctaPanel}>
              <Pressable
                onPress={() => navigation.navigate('OwnerPortalSubscription', { preview: true })}
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
    backFile,
    chooseBackFile,
    chooseFrontFile,
    chooseSelfieFile,
    frontFile,
    fullName,
    idType,
    isLoading,
    isSubmitDisabled,
    isSubmitting,
    selfieFile,
    setFullName,
    setIdType,
    statusText,
    submit,
  } = useOwnerPortalIdentityVerificationModel();

  return (
    <ScreenShell
      eyebrow="Owner Portal"
      title="Identity verification."
      subtitle="Upload ID images and a selfie so Canopy Trove can complete manual owner review."
      headerPill="Verification"
    >
      <MotionInView delay={70}>
        <View style={styles.portalHeroCard}>
          <View style={styles.portalHeroGlow} />
          <Text style={styles.portalHeroKicker}>Verification</Text>
          <Text style={styles.portalHeroTitle}>Complete the final identity step.</Text>
          <Text style={styles.portalHeroBody}>
            Sensitive files stay private for manual owner review.
          </Text>
          <View style={styles.summaryStrip}>
            <View style={styles.summaryTile}>
              <Text style={styles.summaryTileValue}>{idType.replace(/_/g, ' ')}</Text>
              <Text style={styles.summaryTileLabel}>Selected ID</Text>
              <Text style={styles.summaryTileBody}></Text>
            </View>
            <View style={styles.summaryTile}>
              <Text style={styles.summaryTileValue}>
                {frontFile && selfieFile ? 'Ready' : 'Pending'}
              </Text>
              <Text style={styles.summaryTileLabel}>Required files</Text>
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
                  label: 'Identity package',
                  body: 'Choose ID images and selfie.',
                  tone: 'current',
                },
                {
                  label: 'Next: owner access',
                  body: 'Owner access follows approval.',
                  tone: 'pending',
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
                    <Text style={styles.fieldLabel}>Full legal name</Text>
                    <TextInput
                      value={fullName}
                      onChangeText={setFullName}
                      placeholder="Full legal name"
                      placeholderTextColor="#738680"
                      style={styles.inputPremium}
                    />
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>ID type</Text>
                    <View style={styles.wrapRow}>
                      {ID_TYPE_OPTIONS.map((option) => {
                        const selected = option === idType;
                        return (
                          <Pressable
                            key={option}
                            onPress={() => setIdType(option)}
                            style={[styles.choiceChip, selected && styles.choiceChipSelected]}
                          >
                            <Text
                              style={[
                                styles.choiceChipText,
                                selected && styles.choiceChipTextSelected,
                              ]}
                            >
                              {option.replace(/_/g, ' ')}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                </View>

                <View style={styles.cardStack}>
                  <View style={styles.onboardingFileCard}>
                    <View style={styles.onboardingFileHeader}>
                      <View style={styles.onboardingFileMeta}>
                        <Text style={styles.sectionEyebrow}>ID front</Text>
                        <Text style={styles.splitHeaderTitle}>
                          {frontFile?.name ?? 'No image selected yet.'}
                        </Text>
                        <Text style={styles.onboardingFileHint}>
                          Front-side identity image required.
                        </Text>
                      </View>
                      <AppUiIcon name="image-outline" size={20} color="#F5C86A" />
                    </View>
                    <Pressable onPress={chooseFrontFile} style={styles.secondaryButton}>
                      <Text style={styles.secondaryButtonText}>Choose Front Image</Text>
                    </Pressable>
                  </View>

                  <View style={styles.onboardingFileCard}>
                    <View style={styles.onboardingFileHeader}>
                      <View style={styles.onboardingFileMeta}>
                        <Text style={styles.sectionEyebrow}>ID back</Text>
                        <Text style={styles.splitHeaderTitle}>
                          {backFile?.name ?? 'Optional for passport. Select if needed.'}
                        </Text>
                        <Text style={styles.onboardingFileHint}>
                          Back-side image is optional when passport is used.
                        </Text>
                      </View>
                      <AppUiIcon name="images-outline" size={20} color="#F5C86A" />
                    </View>
                    <Pressable onPress={chooseBackFile} style={styles.secondaryButton}>
                      <Text style={styles.secondaryButtonText}>Choose Back Image</Text>
                    </Pressable>
                  </View>

                  <View style={styles.onboardingFileCard}>
                    <View style={styles.onboardingFileHeader}>
                      <View style={styles.onboardingFileMeta}>
                        <Text style={styles.sectionEyebrow}>Selfie</Text>
                        <Text style={styles.splitHeaderTitle}>
                          {selfieFile?.name ?? 'No image selected yet.'}
                        </Text>
                        <Text style={styles.onboardingFileHint}>Selfie for identity matching.</Text>
                      </View>
                      <AppUiIcon name="camera-outline" size={20} color="#F5C86A" />
                    </View>
                    <Pressable onPress={chooseSelfieFile} style={styles.secondaryButton}>
                      <Text style={styles.secondaryButtonText}>Choose Selfie</Text>
                    </Pressable>
                  </View>
                </View>
              </>
            )}

            {statusText ? <Text style={styles.errorText}>{statusText}</Text> : null}

            <View style={styles.ctaPanel}>
              <View style={styles.splitHeaderRow}>
                <View style={styles.splitHeaderCopy}>
                  <Text style={styles.sectionEyebrow}>Submit identity review</Text>
                </View>
                <AppUiIcon name="person-circle-outline" size={20} color="#F5C86A" />
              </View>
              <Pressable
                disabled={isSubmitDisabled}
                onPress={submit}
                style={[styles.primaryButton, isSubmitDisabled && styles.buttonDisabled]}
              >
                <Text style={styles.primaryButtonText}>
                  {isSubmitting ? 'Submitting...' : 'Submit Identity Verification'}
                </Text>
              </Pressable>
            </View>
          </View>
        </SectionCard>
      </MotionInView>
    </ScreenShell>
  );
}

export function OwnerPortalIdentityVerificationScreen() {
  const route = useRoute<IdentityVerificationRoute>();
  const preview = ownerPortalPreviewEnabled && Boolean(route.params?.preview);

  if (preview) {
    return <OwnerPortalIdentityVerificationPreview />;
  }

  return <OwnerPortalIdentityVerificationLive />;
}

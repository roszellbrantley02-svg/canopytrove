import { colors } from '../theme/tokens';
import React from 'react';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Pressable, Text, TextInput, View } from 'react-native';
import { MotionInView } from '../components/MotionInView';
import { ScreenShell } from '../components/ScreenShell';
import { SectionCard } from '../components/SectionCard';
import { AppUiIcon } from '../icons/AppUiIcon';

import type { RootStackParamList } from '../navigation/RootNavigator';
import { OwnerPortalStageList } from './ownerPortal/OwnerPortalStageList';
import { ownerPortalStyles as styles } from './ownerPortal/ownerPortalStyles';
import { useOwnerPortalBusinessVerificationModel } from './ownerPortal/useOwnerPortalBusinessVerificationModel';
import {
  ownerPortalPreviewProfile,
  ownerPortalPreviewStorefront,
} from './ownerPortal/ownerPortalPreviewData';

type BusinessVerificationRoute = RouteProp<RootStackParamList, 'OwnerPortalBusinessVerification'>;

const ONBOARDING_STEPS = [
  'Account',
  'Business Details',
  'Claim Listing',
  'Business Verification',
  'Identity',
];

function OwnerPortalBusinessVerificationPreview() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [legalBusinessName, setLegalBusinessName] = React.useState(
    ownerPortalPreviewProfile.companyName,
  );
  const [storefrontName, setStorefrontName] = React.useState(
    ownerPortalPreviewStorefront.displayName,
  );
  const [licenseNumber, setLicenseNumber] = React.useState(ownerPortalPreviewStorefront.licenseId);
  const [licenseType, setLicenseType] = React.useState('Adult-use retail dispensary');
  const [stateValue, setStateValue] = React.useState<string>(ownerPortalPreviewStorefront.state);
  const [address, setAddress] = React.useState(
    `${ownerPortalPreviewStorefront.addressLine1}, ${ownerPortalPreviewStorefront.city}, ${ownerPortalPreviewStorefront.state} ${ownerPortalPreviewStorefront.zip}`,
  );

  return (
    <ScreenShell
      eyebrow="Owner Portal"
      title="Business verification."
      subtitle="Review the business proof step with preview files."
      headerPill="Preview"
    >
      <MotionInView delay={70}>
        <View style={styles.portalHeroCard}>
          <View style={styles.portalHeroGlow} />
          <Text style={styles.portalHeroKicker}>Verification</Text>
          <Text style={styles.portalHeroTitle}>Inspect the business-proof step.</Text>
          <Text style={styles.portalHeroBody}>
            Claim details and documents combine for owner review.
          </Text>
          <View style={styles.summaryStrip}>
            <View style={styles.summaryTile}>
              <Text style={styles.summaryTileValue}>Preview</Text>
              <Text style={styles.summaryTileLabel}>Mode</Text>
              <Text style={styles.summaryTileBody}></Text>
            </View>
            <View style={styles.summaryTile}>
              <Text style={styles.summaryTileValue}>2 files</Text>
              <Text style={styles.summaryTileLabel}>Document slots</Text>
              <Text style={styles.summaryTileBody}></Text>
            </View>
          </View>
          <View style={styles.onboardingStepRow}>
            {ONBOARDING_STEPS.map((step, index) => (
              <View
                key={step}
                style={[styles.onboardingStepChip, index === 3 && styles.onboardingStepChipActive]}
              >
                <Text
                  style={[
                    styles.onboardingStepChipText,
                    index === 3 && styles.onboardingStepChipTextActive,
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
        <SectionCard title="Verification details" body="">
          <View style={styles.sectionStack}>
            <OwnerPortalStageList
              items={[
                {
                  label: 'Claimed storefront',
                  body: 'Owner account matched to the listing.',
                  tone: 'complete',
                },
                {
                  label: 'Business package',
                  body: 'License and registration proof reviewed.',
                  tone: 'current',
                },
                {
                  label: 'Next: identity review',
                  body: 'Identity verification is next.',
                  tone: 'pending',
                },
              ]}
            />
            <View style={styles.plannerPanel}>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Legal business name</Text>
                <TextInput
                  value={legalBusinessName}
                  onChangeText={setLegalBusinessName}
                  placeholder="Legal business name"
                  placeholderTextColor={colors.textSoft}
                  style={styles.inputPremium}
                />
              </View>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Storefront name</Text>
                <TextInput
                  value={storefrontName}
                  onChangeText={setStorefrontName}
                  placeholder="Storefront name"
                  placeholderTextColor={colors.textSoft}
                  style={styles.inputPremium}
                />
              </View>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>License number</Text>
                <TextInput
                  value={licenseNumber}
                  onChangeText={setLicenseNumber}
                  placeholder="License number"
                  placeholderTextColor={colors.textSoft}
                  style={styles.inputPremium}
                />
              </View>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>License type</Text>
                <TextInput
                  value={licenseType}
                  onChangeText={setLicenseType}
                  placeholder="License type"
                  placeholderTextColor={colors.textSoft}
                  style={styles.inputPremium}
                />
              </View>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>State</Text>
                <TextInput
                  value={stateValue}
                  onChangeText={setStateValue}
                  placeholder="State"
                  placeholderTextColor={colors.textSoft}
                  style={styles.inputPremium}
                />
              </View>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Business address</Text>
                <TextInput
                  value={address}
                  onChangeText={setAddress}
                  placeholder="Business address"
                  placeholderTextColor={colors.textSoft}
                  style={[styles.inputPremium, styles.textAreaPremium]}
                  multiline={true}
                />
              </View>
            </View>

            <View style={styles.cardStack}>
              <View style={styles.onboardingFileCard}>
                <View style={styles.onboardingFileHeader}>
                  <View style={styles.onboardingFileMeta}>
                    <Text style={styles.sectionEyebrow}>License document</Text>
                    <Text style={styles.splitHeaderTitle}>Preview-license.pdf</Text>
                    <Text style={styles.onboardingFileHint}>
                      Business license proof for layout review.
                    </Text>
                  </View>
                  <AppUiIcon name="document-text-outline" size={20} color="#F5C86A" />
                </View>
              </View>

              <View style={styles.onboardingFileCard}>
                <View style={styles.onboardingFileHeader}>
                  <View style={styles.onboardingFileMeta}>
                    <Text style={styles.sectionEyebrow}>Business registration</Text>
                    <Text style={styles.splitHeaderTitle}>Preview-registration.pdf</Text>
                    <Text style={styles.onboardingFileHint}>
                      Registration proof for preview review.
                    </Text>
                  </View>
                  <AppUiIcon name="document-attach-outline" size={20} color="#F5C86A" />
                </View>
              </View>
            </View>

            <View style={styles.ctaPanel}>
              <Pressable
                onPress={() => navigation.navigate('OwnerPortalIdentityVerification')}
                style={styles.primaryButton}
              >
                <Text style={styles.primaryButtonText}>Continue To Identity Review</Text>
              </Pressable>
            </View>
          </View>
        </SectionCard>
      </MotionInView>
    </ScreenShell>
  );
}

function OwnerPortalBusinessVerificationLive() {
  const model = useOwnerPortalBusinessVerificationModel();

  return (
    <ScreenShell
      eyebrow="Owner Portal"
      title="Business verification."
      subtitle="Upload business proof so Canopy Trove can confirm your storefront claim."
      headerPill="Verification"
    >
      <MotionInView delay={70}>
        <View style={styles.portalHeroCard}>
          <View style={styles.portalHeroGlow} />
          <Text style={styles.portalHeroKicker}>Verification</Text>
          <Text style={styles.portalHeroTitle}>
            Turn the claim into a clear business review package.
          </Text>
          <Text style={styles.portalHeroBody}>
            Combine storefront details with business proof for verification.
          </Text>
          <View style={styles.summaryStrip}>
            <View style={styles.summaryTile}>
              <Text style={styles.summaryTileValue}>
                {model.claimedStorefront ? 'Linked' : 'Missing'}
              </Text>
              <Text style={styles.summaryTileLabel}>Claimed listing</Text>
              <Text style={styles.summaryTileBody}></Text>
            </View>
            <View style={styles.summaryTile}>
              <Text style={styles.summaryTileValue}>
                {model.licenseFile && model.businessDocFile ? 'Ready' : 'Pending'}
              </Text>
              <Text style={styles.summaryTileLabel}>Documents</Text>
              <Text style={styles.summaryTileBody}></Text>
            </View>
          </View>
          <View style={styles.onboardingStepRow}>
            {ONBOARDING_STEPS.map((step, index) => (
              <View
                key={step}
                style={[styles.onboardingStepChip, index === 3 && styles.onboardingStepChipActive]}
              >
                <Text
                  style={[
                    styles.onboardingStepChipText,
                    index === 3 && styles.onboardingStepChipTextActive,
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
        <SectionCard title="Verification details" body="">
          <View style={styles.sectionStack}>
            <OwnerPortalStageList
              items={[
                {
                  label: 'Claimed storefront',
                  body: model.claimedStorefront
                    ? 'Storefront is linked.'
                    : 'Claim a storefront first.',
                  tone: model.claimedStorefront ? 'complete' : 'attention',
                },
                {
                  label: 'Business package',
                  body: 'Gather license and registration proof.',
                  tone: 'current',
                },
                {
                  label: 'Next: identity review',
                  body: 'Identity verification is next.',
                  tone: 'pending',
                },
              ]}
            />
            {model.isLoading || model.isLoadingClaimedStorefront ? (
              <View style={styles.emptyStateCard}>
                <Text style={styles.emptyStateTitle}>Loading claimed storefront</Text>
                <Text style={styles.emptyStateBody}>
                  Pulling the owner profile and storefront claim details before the verification
                  package can be reviewed.
                </Text>
              </View>
            ) : !model.claimedStorefront ? (
              <View style={styles.emptyStateCard}>
                <Text style={styles.emptyStateTitle}>Claim a storefront first</Text>
                <Text style={styles.emptyStateBody}>
                  Link the workspace to a claimed listing to continue.
                </Text>
              </View>
            ) : (
              <>
                <View style={styles.plannerPanel}>
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Legal business name</Text>
                    <TextInput
                      value={model.legalBusinessName}
                      onChangeText={model.setLegalBusinessName}
                      placeholder="Legal business name"
                      placeholderTextColor={colors.textSoft}
                      style={styles.inputPremium}
                    />
                  </View>
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Storefront name</Text>
                    <TextInput
                      value={model.storefrontName}
                      onChangeText={model.setStorefrontName}
                      placeholder="Storefront name"
                      placeholderTextColor={colors.textSoft}
                      style={styles.inputPremium}
                    />
                  </View>
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>License number</Text>
                    <TextInput
                      value={model.licenseNumber}
                      onChangeText={model.setLicenseNumber}
                      placeholder="License number"
                      placeholderTextColor={colors.textSoft}
                      style={styles.inputPremium}
                    />
                  </View>
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>License type</Text>
                    <TextInput
                      value={model.licenseType}
                      onChangeText={model.setLicenseType}
                      placeholder="License type"
                      placeholderTextColor={colors.textSoft}
                      style={styles.inputPremium}
                    />
                  </View>
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>State</Text>
                    <TextInput
                      value={model.stateValue}
                      onChangeText={model.setStateValue}
                      placeholder="State"
                      placeholderTextColor={colors.textSoft}
                      style={styles.inputPremium}
                    />
                  </View>
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Business address</Text>
                    <TextInput
                      value={model.address}
                      onChangeText={model.setAddress}
                      placeholder="Business address"
                      placeholderTextColor={colors.textSoft}
                      style={[styles.inputPremium, styles.textAreaPremium]}
                      multiline={true}
                    />
                  </View>
                </View>

                <View style={styles.cardStack}>
                  <View style={styles.onboardingFileCard}>
                    <View style={styles.onboardingFileHeader}>
                      <View style={styles.onboardingFileMeta}>
                        <Text style={styles.sectionEyebrow}>License document</Text>
                        <Text style={styles.splitHeaderTitle}>
                          {model.licenseFile?.name ?? 'No file selected yet.'}
                        </Text>
                        <Text style={styles.onboardingFileHint}>Upload business license.</Text>
                      </View>
                      <AppUiIcon name="document-text-outline" size={20} color="#F5C86A" />
                    </View>
                    <Pressable onPress={model.chooseLicenseFile} style={styles.secondaryButton}>
                      <Text style={styles.secondaryButtonText}>Choose License File</Text>
                    </Pressable>
                  </View>

                  <View style={styles.onboardingFileCard}>
                    <View style={styles.onboardingFileHeader}>
                      <View style={styles.onboardingFileMeta}>
                        <Text style={styles.sectionEyebrow}>Business registration</Text>
                        <Text style={styles.splitHeaderTitle}>
                          {model.businessDocFile?.name ?? 'No file selected yet.'}
                        </Text>
                        <Text style={styles.onboardingFileHint}>Upload registration proof.</Text>
                      </View>
                      <AppUiIcon name="document-attach-outline" size={20} color="#F5C86A" />
                    </View>
                    <Pressable onPress={model.chooseBusinessDocFile} style={styles.secondaryButton}>
                      <Text style={styles.secondaryButtonText}>Choose Business Document</Text>
                    </Pressable>
                  </View>
                </View>
              </>
            )}

            {model.statusText ? <Text style={styles.errorText}>{model.statusText}</Text> : null}

            <View style={styles.ctaPanel}>
              <View style={styles.splitHeaderRow}>
                <View style={styles.splitHeaderCopy}>
                  <Text style={styles.sectionEyebrow}>Submit business review</Text>
                </View>
                <AppUiIcon name="shield-checkmark-outline" size={20} color="#F5C86A" />
              </View>
              <Pressable
                disabled={model.isSubmitDisabled}
                onPress={model.submit}
                style={[styles.primaryButton, model.isSubmitDisabled && styles.buttonDisabled]}
              >
                <Text style={styles.primaryButtonText}>
                  {model.isSubmitting ? 'Submitting...' : 'Submit Business Verification'}
                </Text>
              </Pressable>
            </View>
          </View>
        </SectionCard>
      </MotionInView>
    </ScreenShell>
  );
}

export function OwnerPortalBusinessVerificationScreen() {
  const route = useRoute<BusinessVerificationRoute>();
  const preview = route.params?.preview ?? false;

  if (preview) {
    return <OwnerPortalBusinessVerificationPreview />;
  }

  return <OwnerPortalBusinessVerificationLive />;
}

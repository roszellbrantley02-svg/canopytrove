import React from 'react';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MotionInView } from '../components/MotionInView';
import { ScreenShell } from '../components/ScreenShell';
import { SectionCard } from '../components/SectionCard';
import { ownerPortalPreviewEnabled } from '../config/ownerPortalConfig';
import { RootStackParamList } from '../navigation/RootNavigator';
import { OwnerPortalStageList } from './ownerPortal/OwnerPortalStageList';
import { ownerPortalStyles as styles } from './ownerPortal/ownerPortalStyles';
import { useOwnerPortalBusinessVerificationModel } from './ownerPortal/useOwnerPortalBusinessVerificationModel';
import {
  ownerPortalPreviewProfile,
  ownerPortalPreviewStorefront,
} from './ownerPortal/ownerPortalPreviewData';

type BusinessVerificationRoute = RouteProp<RootStackParamList, 'OwnerPortalBusinessVerification'>;

const ONBOARDING_STEPS = ['Account', 'Business Details', 'Claim Listing', 'Business Verification', 'Identity'];

function OwnerPortalBusinessVerificationPreview() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [legalBusinessName, setLegalBusinessName] = React.useState(
    ownerPortalPreviewProfile.companyName
  );
  const [storefrontName, setStorefrontName] = React.useState(
    ownerPortalPreviewStorefront.displayName
  );
  const [licenseNumber, setLicenseNumber] = React.useState(ownerPortalPreviewStorefront.licenseId);
  const [licenseType, setLicenseType] = React.useState('Adult-use retail dispensary');
  const [stateValue, setStateValue] = React.useState<string>(ownerPortalPreviewStorefront.state);
  const [address, setAddress] = React.useState(
    `${ownerPortalPreviewStorefront.addressLine1}, ${ownerPortalPreviewStorefront.city}, ${ownerPortalPreviewStorefront.state} ${ownerPortalPreviewStorefront.zip}`
  );

  return (
    <ScreenShell
      eyebrow="Owner Portal"
      title="Business verification."
      subtitle="Review the business proof step with sample data and sample files before using the live upload flow."
      headerPill="Demo"
    >
      <MotionInView delay={70}>
        <View style={styles.portalHeroCard}>
          <View style={styles.portalHeroGlow} />
          <Text style={styles.portalHeroKicker}>Verification</Text>
          <Text style={styles.portalHeroTitle}>
            Inspect the business-proof step with clearer premium verification framing.
          </Text>
          <Text style={styles.portalHeroBody}>
            The business-verification screen is where claim details and uploaded documents start to
            read like a formal owner review package.
          </Text>
          <View style={styles.summaryStrip}>
            <View style={styles.summaryTile}>
              <Text style={styles.summaryTileValue}>Preview</Text>
              <Text style={styles.summaryTileLabel}>Mode</Text>
              <Text style={styles.summaryTileBody}>
                Demo mode never uploads private business records.
              </Text>
            </View>
            <View style={styles.summaryTile}>
              <Text style={styles.summaryTileValue}>2 files</Text>
              <Text style={styles.summaryTileLabel}>Document slots</Text>
              <Text style={styles.summaryTileBody}>
                License and business-registration proof are shown for layout review only.
              </Text>
            </View>
          </View>
          <View style={styles.onboardingStepRow}>
            {ONBOARDING_STEPS.map((step, index) => (
              <View
                key={step}
                style={[
                  styles.onboardingStepChip,
                  index === 3 && styles.onboardingStepChipActive,
                ]}
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
        <SectionCard
          title="Verification details"
          body="Use this demo to inspect the form, guidance, and file slots without uploading private business records."
        >
          <View style={styles.sectionStack}>
            <OwnerPortalStageList
              items={[
                {
                  label: 'Claimed storefront',
                  body: 'This step assumes the owner account is already matched to the right listing.',
                  tone: 'complete',
                },
                {
                  label: 'Business package',
                  body: 'License and registration proof are reviewed here before identity review begins.',
                  tone: 'current',
                },
                {
                  label: 'Next: identity review',
                  body: 'Once the business package is ready, the next step is owner identity verification.',
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
                  placeholderTextColor="#738680"
                  style={styles.inputPremium}
                />
              </View>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Storefront name</Text>
                <TextInput
                  value={storefrontName}
                  onChangeText={setStorefrontName}
                  placeholder="Storefront name"
                  placeholderTextColor="#738680"
                  style={styles.inputPremium}
                />
              </View>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>License number</Text>
                <TextInput
                  value={licenseNumber}
                  onChangeText={setLicenseNumber}
                  placeholder="License number"
                  placeholderTextColor="#738680"
                  style={styles.inputPremium}
                />
              </View>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>License type</Text>
                <TextInput
                  value={licenseType}
                  onChangeText={setLicenseType}
                  placeholder="License type"
                  placeholderTextColor="#738680"
                  style={styles.inputPremium}
                />
              </View>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>State</Text>
                <TextInput
                  value={stateValue}
                  onChangeText={setStateValue}
                  placeholder="State"
                  placeholderTextColor="#738680"
                  style={styles.inputPremium}
                />
              </View>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Business address</Text>
                <TextInput
                  value={address}
                  onChangeText={setAddress}
                  placeholder="Business address"
                  placeholderTextColor="#738680"
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
                      Primary business license proof shown only for layout review.
                    </Text>
                  </View>
                  <Ionicons name="document-text-outline" size={20} color="#F5C86A" />
                </View>
              </View>

              <View style={styles.onboardingFileCard}>
                <View style={styles.onboardingFileHeader}>
                  <View style={styles.onboardingFileMeta}>
                    <Text style={styles.sectionEyebrow}>Business registration</Text>
                    <Text style={styles.splitHeaderTitle}>Preview-registration.pdf</Text>
                    <Text style={styles.onboardingFileHint}>
                      Registration proof shown only for safe demo review.
                    </Text>
                  </View>
                  <Ionicons name="document-attach-outline" size={20} color="#F5C86A" />
                </View>
              </View>

              <View style={[styles.onboardingInfoCard, styles.onboardingInfoCardWarm]}>
                <Text style={styles.splitHeaderTitle}>Preview-safe verification review</Text>
                <Text style={styles.splitHeaderBody}>
                  Demo mode does not upload files. It only exposes the layout and guidance for the
                  business-proof step.
                </Text>
              </View>
            </View>

            <View style={styles.ctaPanel}>
              <Pressable
                onPress={() =>
                  navigation.navigate('OwnerPortalIdentityVerification', { preview: true })
                }
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

export function OwnerPortalBusinessVerificationScreen() {
  const route = useRoute<BusinessVerificationRoute>();
  const preview = ownerPortalPreviewEnabled && Boolean(route.params?.preview);
  if (preview) {
    return <OwnerPortalBusinessVerificationPreview />;
  }

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
            This step combines claimed storefront details with business proof so Canopy Trove can
            confirm the owner relationship before identity review.
          </Text>
          <View style={styles.summaryStrip}>
            <View style={styles.summaryTile}>
              <Text style={styles.summaryTileValue}>
                {model.claimedStorefront ? 'Linked' : 'Missing'}
              </Text>
              <Text style={styles.summaryTileLabel}>Claimed listing</Text>
              <Text style={styles.summaryTileBody}>
                A claimed storefront is required before business verification can be sent.
              </Text>
            </View>
            <View style={styles.summaryTile}>
              <Text style={styles.summaryTileValue}>
                {model.licenseFile && model.businessDocFile ? 'Ready' : 'Pending'}
              </Text>
              <Text style={styles.summaryTileLabel}>Documents</Text>
              <Text style={styles.summaryTileBody}>
                Both business proof files must be chosen before submit becomes available.
              </Text>
            </View>
          </View>
          <View style={styles.onboardingStepRow}>
            {ONBOARDING_STEPS.map((step, index) => (
              <View
                key={step}
                style={[
                  styles.onboardingStepChip,
                  index === 3 && styles.onboardingStepChipActive,
                ]}
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
        <SectionCard
          title="Verification details"
          body="These documents stay private and are used only for manual business review."
        >
          <View style={styles.sectionStack}>
            <OwnerPortalStageList
              items={[
                {
                  label: 'Claimed storefront',
                  body: model.claimedStorefront
                    ? 'A storefront is linked and can be attached to this business package.'
                    : 'Claim the correct storefront before business verification can be treated as live.',
                  tone: model.claimedStorefront ? 'complete' : 'attention',
                },
                {
                  label: 'Business package',
                  body: 'This step gathers license and registration proof for manual business review.',
                  tone: 'current',
                },
                {
                  label: 'Next: identity review',
                  body: 'After the business package is submitted, identity verification is the next owner step.',
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
                  Business verification cannot begin until the owner workspace is linked to a
                  claimed dispensary listing.
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
                      placeholderTextColor="#738680"
                      style={styles.inputPremium}
                    />
                  </View>
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Storefront name</Text>
                    <TextInput
                      value={model.storefrontName}
                      onChangeText={model.setStorefrontName}
                      placeholder="Storefront name"
                      placeholderTextColor="#738680"
                      style={styles.inputPremium}
                    />
                  </View>
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>License number</Text>
                    <TextInput
                      value={model.licenseNumber}
                      onChangeText={model.setLicenseNumber}
                      placeholder="License number"
                      placeholderTextColor="#738680"
                      style={styles.inputPremium}
                    />
                  </View>
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>License type</Text>
                    <TextInput
                      value={model.licenseType}
                      onChangeText={model.setLicenseType}
                      placeholder="License type"
                      placeholderTextColor="#738680"
                      style={styles.inputPremium}
                    />
                  </View>
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>State</Text>
                    <TextInput
                      value={model.stateValue}
                      onChangeText={model.setStateValue}
                      placeholder="State"
                      placeholderTextColor="#738680"
                      style={styles.inputPremium}
                    />
                  </View>
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Business address</Text>
                    <TextInput
                      value={model.address}
                      onChangeText={model.setAddress}
                      placeholder="Business address"
                      placeholderTextColor="#738680"
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
                        <Text style={styles.onboardingFileHint}>
                          Upload the primary business license for manual owner review.
                        </Text>
                      </View>
                      <Ionicons name="document-text-outline" size={20} color="#F5C86A" />
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
                        <Text style={styles.onboardingFileHint}>
                          Add registration proof to complete the business package.
                        </Text>
                      </View>
                      <Ionicons name="document-attach-outline" size={20} color="#F5C86A" />
                    </View>
                    <Pressable
                      onPress={model.chooseBusinessDocFile}
                      style={styles.secondaryButton}
                    >
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
                  <Text style={styles.splitHeaderTitle}>Send the business verification package</Text>
                  <Text style={styles.splitHeaderBody}>
                    Canopy Trove uses these private documents only for manual owner verification.
                  </Text>
                </View>
                <Ionicons name="shield-checkmark-outline" size={20} color="#F5C86A" />
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

import React from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MotionInView } from '../components/MotionInView';
import { ScreenShell } from '../components/ScreenShell';
import { SectionCard } from '../components/SectionCard';
import { ownerPortalPreviewEnabled } from '../config/ownerPortalConfig';
import { RootStackParamList } from '../navigation/RootNavigator';
import { saveOwnerBusinessDetails } from '../services/ownerPortalService';
import { ownerPortalStyles as styles } from './ownerPortal/ownerPortalStyles';
import {
  OWNER_PORTAL_PREVIEW_UID,
  ownerPortalPreviewProfile,
} from './ownerPortal/ownerPortalPreviewData';

type BusinessDetailsRoute = RouteProp<RootStackParamList, 'OwnerPortalBusinessDetails'>;

const ONBOARDING_STEPS = ['Account', 'Business Details', 'Claim Listing', 'Verification'];

export function OwnerPortalBusinessDetailsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<BusinessDetailsRoute>();
  const preview = ownerPortalPreviewEnabled && Boolean(route.params?.preview);
  const ownerUid = route.params?.ownerUid ?? OWNER_PORTAL_PREVIEW_UID;
  const [legalName, setLegalName] = React.useState(
    route.params?.initialLegalName ?? ownerPortalPreviewProfile.legalName
  );
  const [companyName, setCompanyName] = React.useState(
    route.params?.initialCompanyName ?? ownerPortalPreviewProfile.companyName
  );
  const [phone, setPhone] = React.useState(
    route.params?.initialPhone ?? ownerPortalPreviewProfile.phone ?? ''
  );
  const [isSaving, setIsSaving] = React.useState(false);
  const [errorText, setErrorText] = React.useState<string | null>(null);
  const canContinue = !isSaving && Boolean(legalName.trim()) && Boolean(companyName.trim());

  const handleSave = async () => {
    if (isSaving) {
      return;
    }

    if (preview) {
      navigation.replace('OwnerPortalClaimListing', { preview: true });
      return;
    }

    setIsSaving(true);
    setErrorText(null);
    try {
      await saveOwnerBusinessDetails(ownerUid, {
        legalName,
        phone,
        companyName,
      });
      navigation.replace('OwnerPortalHome');
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : 'Unable to save business details.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ScreenShell
      eyebrow="Owner Portal"
      title="Business details."
      subtitle={
        preview
          ? 'Demo mode shows the business profile step with sample data so you can review the owner experience safely.'
          : 'Set the legal and public business details tied to your owner workspace.'
      }
      headerPill={preview ? 'Demo' : 'Onboarding'}
    >
      <MotionInView delay={70}>
        <View style={styles.portalHeroCard}>
          <View style={styles.portalHeroGlow} />
          <Text style={styles.portalHeroKicker}>Owner onboarding</Text>
          <Text style={styles.portalHeroTitle}>
            Capture the business profile with a clearer onboarding step rhythm.
          </Text>
          <Text style={styles.portalHeroBody}>
            These details anchor storefront claim, document review, and future owner plan access.
            This step should feel like the formal setup layer for the owner workspace.
          </Text>
          <View style={styles.summaryStrip}>
            <View style={styles.summaryTile}>
              <Text style={styles.summaryTileValue}>{preview ? 'Preview' : 'Live'}</Text>
              <Text style={styles.summaryTileLabel}>Mode</Text>
              <Text style={styles.summaryTileBody}>
                {preview
                  ? 'Changes stay local to this screen during demo review.'
                  : 'Saved details become part of the owner profile state.'}
              </Text>
            </View>
            <View style={styles.summaryTile}>
              <Text style={styles.summaryTileValue}>Step 2</Text>
              <Text style={styles.summaryTileLabel}>Onboarding</Text>
              <Text style={styles.summaryTileBody}>
                Claim listing comes immediately after this profile step.
              </Text>
            </View>
          </View>
          <View style={styles.onboardingStepRow}>
            {ONBOARDING_STEPS.map((step, index) => (
              <View
                key={step}
                style={[
                  styles.onboardingStepChip,
                  index === 1 && styles.onboardingStepChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.onboardingStepChipText,
                    index === 1 && styles.onboardingStepChipTextActive,
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
          title="Business profile"
          body="These details anchor listing claim, document review, and plan access."
        >
          <View style={styles.sectionStack}>
            <View style={styles.plannerPanel}>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Legal name</Text>
                <TextInput
                  value={legalName}
                  onChangeText={setLegalName}
                  placeholder="Legal name"
                  placeholderTextColor="#738680"
                  style={styles.inputPremium}
                />
              </View>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Company name</Text>
                <TextInput
                  value={companyName}
                  onChangeText={setCompanyName}
                  placeholder="Company name"
                  placeholderTextColor="#738680"
                  style={styles.inputPremium}
                />
              </View>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Phone</Text>
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="Phone"
                  keyboardType="phone-pad"
                  placeholderTextColor="#738680"
                  style={styles.inputPremium}
                />
              </View>
              {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}
              {preview ? (
                <View style={[styles.onboardingInfoCard, styles.onboardingInfoCardWarm]}>
                  <Text style={styles.splitHeaderTitle}>Preview-safe business edits</Text>
                  <Text style={styles.splitHeaderBody}>
                    Demo mode keeps these edits local to the screen so the onboarding layout and
                    copy can be reviewed safely.
                  </Text>
                </View>
              ) : null}
            </View>

            <View style={styles.ctaPanel}>
              <View style={styles.splitHeaderRow}>
                <View style={styles.splitHeaderCopy}>
                  <Text style={styles.sectionEyebrow}>Continue onboarding</Text>
                  <Text style={styles.splitHeaderTitle}>Save the business profile step</Text>
                  <Text style={styles.splitHeaderBody}>
                    Continue to the listing-claim stage once the legal and public business details
                    are ready.
                  </Text>
                </View>
                <Ionicons name="briefcase-outline" size={20} color="#F5C86A" />
              </View>
              <Pressable
                disabled={!canContinue}
                onPress={() => {
                  void handleSave();
                }}
                style={[styles.primaryButton, !canContinue && styles.buttonDisabled]}
              >
                <Text style={styles.primaryButtonText}>
                  {preview
                    ? 'Continue To Claim Listing'
                    : isSaving
                      ? 'Saving...'
                      : 'Save Business Details'}
                </Text>
              </Pressable>
            </View>
          </View>
        </SectionCard>
      </MotionInView>
    </ScreenShell>
  );
}

import { colors } from '../theme/tokens';
import React from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { withScreenErrorBoundary } from '../components/withScreenErrorBoundary';
import { MotionInView } from '../components/MotionInView';
import { ScreenShell } from '../components/ScreenShell';
import { SectionCard } from '../components/SectionCard';
import { AppUiIcon } from '../icons/AppUiIcon';

import type { RootStackParamList } from '../navigation/RootNavigator';
import { saveOwnerBusinessDetails } from '../services/ownerPortalService';
import { OwnerPortalHeroPanel } from './ownerPortal/OwnerPortalHeroPanel';
import { ownerPortalStyles as styles } from './ownerPortal/ownerPortalStyles';
import {
  OWNER_PORTAL_PREVIEW_UID,
  ownerPortalPreviewProfile,
} from './ownerPortal/ownerPortalPreviewData';

type BusinessDetailsRoute = RouteProp<RootStackParamList, 'OwnerPortalBusinessDetails'>;

const ONBOARDING_STEPS = ['Account', 'Business Details', 'Claim Listing', 'Verification'];

function OwnerPortalBusinessDetailsScreenInner() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<BusinessDetailsRoute>();
  const preview = route.params?.preview ?? false;
  const ownerUid = route.params?.ownerUid ?? (preview ? OWNER_PORTAL_PREVIEW_UID : null);
  const [legalName, setLegalName] = React.useState(
    route.params?.initialLegalName ?? (preview ? ownerPortalPreviewProfile.legalName : ''),
  );
  const [companyName, setCompanyName] = React.useState(
    route.params?.initialCompanyName ?? (preview ? ownerPortalPreviewProfile.companyName : ''),
  );
  const [phone, setPhone] = React.useState(
    route.params?.initialPhone ?? (preview ? (ownerPortalPreviewProfile.phone ?? '') : ''),
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

    if (!ownerUid) {
      setErrorText(
        'You are not signed in as an owner. Please sign in again from the Owner Portal.',
      );
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
      title="Business details"
      subtitle="Add the main business details tied to this owner account."
      headerPill="Onboarding"
    >
      <MotionInView delay={70}>
        <OwnerPortalHeroPanel
          kicker="Business details"
          title="Tell us about the business."
          body="These details help connect the account to the right storefront."
          metrics={[
            {
              value: 'Live',
              label: 'Status',
              body: '',
            },
            {
              value: 'Step 2',
              label: 'Onboarding',
              body: '',
            },
          ]}
          steps={ONBOARDING_STEPS}
          activeStepIndex={1}
        />
      </MotionInView>

      <MotionInView delay={120}>
        <SectionCard title="Business profile" body="">
          <View style={styles.sectionStack}>
            <View style={styles.plannerPanel}>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Legal name</Text>
                <TextInput
                  value={legalName}
                  onChangeText={setLegalName}
                  placeholder="Legal name"
                  placeholderTextColor={colors.textSoft}
                  style={styles.inputPremium}
                />
              </View>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Company name</Text>
                <TextInput
                  value={companyName}
                  onChangeText={setCompanyName}
                  placeholder="Company name"
                  placeholderTextColor={colors.textSoft}
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
                  placeholderTextColor={colors.textSoft}
                  style={styles.inputPremium}
                />
              </View>
              {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}
            </View>

            <View style={styles.ctaPanel}>
              <View style={styles.splitHeaderRow}>
                <View style={styles.splitHeaderCopy}>
                  <Text style={styles.sectionEyebrow}>Save details</Text>
                </View>
                <AppUiIcon name="briefcase-outline" size={20} color="#F5C86A" />
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
                    ? 'Continue to Claim Listing'
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

export const OwnerPortalBusinessDetailsScreen = withScreenErrorBoundary(
  OwnerPortalBusinessDetailsScreenInner,
  'owner-portal-business-details',
);

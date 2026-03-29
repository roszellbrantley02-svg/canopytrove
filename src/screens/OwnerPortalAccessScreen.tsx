import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MotionInView } from '../components/MotionInView';
import { ScreenShell } from '../components/ScreenShell';
import { SectionCard } from '../components/SectionCard';
import { ownerPortalPreviewEnabled } from '../config/ownerPortalConfig';
import { useStorefrontProfileController } from '../context/StorefrontController';
import { RootStackParamList } from '../navigation/RootNavigator';
import { getOwnerPortalAccessState } from '../services/ownerPortalService';
import { OwnerPortalStageList } from './ownerPortal/OwnerPortalStageList';
import { ownerPortalStyles as styles } from './ownerPortal/ownerPortalStyles';

const OWNER_WORKSPACE_FEATURES = [
  'Claim and manage your dispensary listing',
  'Submit business and identity verification',
  'Reply to reviews and monitor reports fast',
  'Schedule live deals with follower alerts and performance results',
  'Control premium card treatments, menu links, and photo upgrades',
  'Manage owner-only plan access and listing tools',
];

const ONBOARDING_STEPS = [
  'Access',
  'Account',
  'Business Details',
  'Claim Listing',
  'Verification',
];

export function OwnerPortalAccessScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { authSession } = useStorefrontProfileController();
  const accessState = getOwnerPortalAccessState(authSession.email);
  const accessLabel = !accessState.enabled
    ? 'Open'
    : accessState.allowlisted
      ? 'Approved'
      : 'Invite required';
  const accountLabel = authSession.status === 'authenticated' ? 'Signed in' : 'Not signed in';
  const summaryTiles = [
    {
      label: 'Access',
      value: accessLabel,
      body: 'Current owner-access state for the active account email.',
    },
    {
      label: 'Account',
      value: accountLabel,
      body: 'Whether the owner account session is currently live in this app.',
    },
    {
      label: 'Preview',
      value: ownerPortalPreviewEnabled ? 'Available' : 'Off',
      body: 'Safe demo access for reviewing the owner journey without live changes.',
    },
  ];

  return (
    <ScreenShell
      eyebrow="Owner Portal"
      title="Owner access."
      subtitle="Sign in to manage your storefront, verification, live deal badges, and plan tools from one private owner workspace."
      headerPill="Owner"
    >
      <MotionInView delay={70}>
        <View style={styles.portalHeroCard}>
          <View style={styles.portalHeroGlow} />
          <Text style={styles.portalHeroKicker}>Owner access</Text>
          <Text style={styles.portalHeroTitle}>
            Open the owner workspace with a clearer premium access path.
          </Text>
          <Text style={styles.portalHeroBody}>
            This screen is the entry layer for sign-in, account creation, guided demo, and the
            onboarding sequence that leads into claim and verification.
          </Text>
          <View style={styles.summaryStrip}>
            {summaryTiles.map((tile) => (
              <View key={tile.label} style={styles.summaryTile}>
                <Text style={styles.summaryTileValue}>{tile.value}</Text>
                <Text style={styles.summaryTileLabel}>{tile.label}</Text>
                <Text style={styles.summaryTileBody}>{tile.body}</Text>
              </View>
            ))}
          </View>
          <View style={styles.onboardingStepRow}>
            {ONBOARDING_STEPS.map((step, index) => (
              <View
                key={step}
                style={[
                  styles.onboardingStepChip,
                  index === 0 && styles.onboardingStepChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.onboardingStepChipText,
                    index === 0 && styles.onboardingStepChipTextActive,
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
          title="Access status"
          body="Owner access is currently invite-only so Canopy Trove can control business verification, moderation, and billing quality before full public rollout."
        >
          <View style={[styles.statusPanel, accessState.allowlisted ? styles.statusPanelSuccess : styles.statusPanelWarm]}>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Account</Text>
              <Text style={styles.statusValue}>{accountLabel}</Text>
            </View>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Current email</Text>
              <Text style={styles.statusValue}>{authSession.email ?? 'Not signed in'}</Text>
            </View>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Access</Text>
              <Text style={styles.statusValue}>{accessLabel}</Text>
            </View>
            <View style={styles.portalHeroMetaRow}>
              <View style={styles.metaChip}>
                <Text style={styles.metaChipText}>
                  {accessState.enabled ? 'Controlled owner rollout' : 'Open access build'}
                </Text>
              </View>
              <View style={styles.metaChip}>
                <Text style={styles.metaChipText}>
                  {authSession.email ?? 'Email will appear after sign-in'}
                </Text>
              </View>
            </View>
          </View>
        </SectionCard>
      </MotionInView>

      <MotionInView delay={180}>
        <SectionCard
          title="Live vs demo"
          body="Live access and demo review stay separate here so sample data never gets confused with the real owner workspace."
        >
          <View style={styles.actionGrid}>
            <View style={styles.ctaPanel}>
              <View style={styles.splitHeaderRow}>
                <View style={styles.splitHeaderCopy}>
                  <Text style={styles.sectionEyebrow}>Live owner workspace</Text>
                  <Text style={styles.splitHeaderTitle}>Use your approved owner email</Text>
                  <Text style={styles.splitHeaderBody}>
                    This path is for the real owner account tied to storefront claim, verification,
                    billing, and live management tools.
                  </Text>
                </View>
                <Ionicons name="lock-closed-outline" size={20} color="#F5C86A" />
              </View>
              <Pressable
                onPress={() => navigation.navigate('OwnerPortalSignIn')}
                style={styles.primaryButton}
              >
                <Text style={styles.primaryButtonText}>Sign In</Text>
              </Pressable>
              <Pressable
                onPress={() => navigation.navigate('OwnerPortalSignUp')}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonText}>Create Owner Account</Text>
              </Pressable>
            </View>

            {ownerPortalPreviewEnabled ? (
              <View style={[styles.ctaPanel, styles.onboardingInfoCardWarm]}>
                <View style={styles.splitHeaderRow}>
                  <View style={styles.splitHeaderCopy}>
                    <Text style={styles.sectionEyebrow}>Guided demo</Text>
                    <Text style={styles.splitHeaderTitle}>Review the owner journey safely</Text>
                    <Text style={styles.splitHeaderBody}>
                      Demo mode is read-only. It lets you inspect the owner flow without changing
                      live owner data or bypassing real access controls.
                    </Text>
                  </View>
                  <Ionicons name="eye-outline" size={20} color="#9CC5B4" />
                </View>
                <Pressable
                  onPress={() => navigation.navigate('OwnerPortalHome', { preview: true })}
                  style={styles.secondaryButton}
                >
                  <Text style={styles.secondaryButtonText}>Open Owner Demo</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        </SectionCard>
      </MotionInView>

      <MotionInView delay={220}>
        <SectionCard
          title="Owner entry rhythm"
          body="This is the cleanest order for real owner onboarding before any premium access starts."
        >
          <OwnerPortalStageList
            items={[
              {
                label: 'Sign in with the real owner account',
                body: 'Use the live owner path first so the account attaches to the right email and profile.',
                tone: authSession.status === 'authenticated' ? 'complete' : 'current',
              },
              {
                label: 'Finish the business profile',
                body: 'Add legal and company details before claiming a listing.',
                tone: authSession.status === 'authenticated' ? 'current' : 'pending',
              },
              {
                label: 'Claim and verify the storefront',
                body: 'Claim the listing, then complete business and identity review.',
                tone: 'pending',
              },
              {
                label: 'Open premium owner tools',
                body: 'Billing and premium controls should only happen in the live owner workspace.',
                tone: 'pending',
              },
            ]}
          />
        </SectionCard>
      </MotionInView>

      <MotionInView delay={260}>
        <SectionCard
          title="What owners can do"
          body="The owner workspace is structured around listing control, verification, promotional tools, and live billing access."
        >
          <View style={styles.actionGrid}>
            {OWNER_WORKSPACE_FEATURES.map((feature) => (
              <View key={feature} style={styles.actionTile}>
                <Text style={styles.actionTileMeta}>Owner capability</Text>
                <Text style={styles.actionTileTitle}>{feature}</Text>
              </View>
            ))}
          </View>
        </SectionCard>
      </MotionInView>

      {authSession.status === 'authenticated' && accessState.allowlisted ? (
        <MotionInView delay={ownerPortalPreviewEnabled ? 340 : 300}>
          <SectionCard
            title="Owner dashboard"
            body="Your account is approved. Open the owner dashboard to continue onboarding or manage an existing storefront."
          >
            <View style={[styles.ctaPanel, styles.onboardingInfoCardSuccess]}>
              <Text style={styles.splitHeaderTitle}>Approved owner workspace ready</Text>
              <Text style={styles.splitHeaderBody}>
                Access is approved for this signed-in account, so the private owner dashboard is
                available immediately.
              </Text>
              <Pressable
                onPress={() => navigation.navigate('OwnerPortalHome')}
                style={styles.primaryButton}
              >
                <Text style={styles.primaryButtonText}>Open Owner Dashboard</Text>
              </Pressable>
            </View>
          </SectionCard>
        </MotionInView>
      ) : null}
    </ScreenShell>
  );
}

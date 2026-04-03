import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MotionInView } from '../components/MotionInView';
import { ScreenShell } from '../components/ScreenShell';
import { SectionCard } from '../components/SectionCard';
import { AppUiIcon } from '../icons/AppUiIcon';
import { ownerPortalPreviewEnabled } from '../config/ownerPortalConfig';
import { useStorefrontProfileController } from '../context/StorefrontController';
import { useOwnerPortalAccessState } from '../hooks/useOwnerPortalAccessState';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { OwnerPortalHeroPanel } from './ownerPortal/OwnerPortalHeroPanel';
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

const ONBOARDING_STEPS = ['Access', 'Account', 'Business Details', 'Claim Listing', 'Verification'];

export function OwnerPortalAccessScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { authSession } = useStorefrontProfileController();
  const { accessState, isCheckingAccess } = useOwnerPortalAccessState(authSession);
  const accessLabel = !accessState.enabled
    ? 'Open'
    : isCheckingAccess
      ? 'Checking'
      : accessState.allowlisted
        ? 'Approved'
        : 'Invite required';
  const accessBody = accessState.enabled
    ? 'Access is controlled for quality and security.'
    : 'Owner access is open for this workspace.';
  const accountLabel = authSession.status === 'authenticated' ? 'Signed in' : 'Not signed in';
  const summaryTiles = [
    {
      label: 'Access',
      value: accessLabel,
      body: '',
    },
    {
      label: 'Account',
      value: accountLabel,
      body: '',
    },
    {
      label: 'Preview',
      value: ownerPortalPreviewEnabled ? 'Ready' : 'Off',
      body: '',
    },
  ];

  return (
    <ScreenShell
      eyebrow="Owner Portal"
      title="Owner access."
      subtitle="Sign in to manage a claimed licensed dispensary storefront from one private business workspace."
      headerPill="Owner"
    >
      <MotionInView delay={70}>
        <OwnerPortalHeroPanel
          kicker="Owner access"
          title="Open the private business workspace for your dispensary team."
          body="Licensed operators manage storefront claims, verification, reviews, and business tools here."
          metrics={summaryTiles}
          steps={ONBOARDING_STEPS}
          activeStepIndex={0}
        />
      </MotionInView>

      <MotionInView delay={120}>
        <SectionCard title="Access status" body={accessBody}>
          <View
            style={[
              styles.statusPanel,
              accessState.allowlisted ? styles.statusPanelSuccess : styles.statusPanelWarm,
            ]}
          >
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
            {isCheckingAccess ? (
              <Text style={styles.helperText}>
                Confirming this signed-in account against the private owner access controls.
              </Text>
            ) : null}
            <View style={styles.portalHeroMetaRow}>
              <View style={styles.metaChip}>
                <Text style={styles.metaChipText}>
                  {accessState.enabled ? 'Approved access' : 'Owner access open'}
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
          title="Owner access options"
          body="Choose business access or a preview workspace."
        >
          <View style={styles.actionGrid}>
            <View style={styles.ctaPanel}>
              <View style={styles.splitHeaderRow}>
                <View style={styles.splitHeaderCopy}>
                  <Text style={styles.sectionEyebrow}>Live owner workspace</Text>
                  <Text style={styles.splitHeaderTitle}>
                    {accessState.enabled
                      ? 'Use your approved business email'
                      : 'Use your business email'}
                  </Text>
                </View>
                <AppUiIcon name="lock-closed-outline" size={20} color="#F5C86A" />
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
              <Text style={styles.helperText}>
                Access and storefront claims are confirmed after sign-in.
              </Text>
            </View>

            {ownerPortalPreviewEnabled ? (
              <View style={[styles.ctaPanel, styles.onboardingInfoCardWarm]}>
                <View style={styles.splitHeaderRow}>
                  <View style={styles.splitHeaderCopy}>
                    <Text style={styles.sectionEyebrow}>Preview workspace</Text>
                    <Text style={styles.splitHeaderTitle}>Review the owner journey safely</Text>
                  </View>
                  <AppUiIcon name="eye-outline" size={20} color="#9CC5B4" />
                </View>
                <Pressable
                  onPress={() => navigation.navigate('OwnerPortalHome', { preview: true })}
                  style={styles.secondaryButton}
                >
                  <Text style={styles.secondaryButtonText}>Open Preview Workspace</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        </SectionCard>
      </MotionInView>

      <MotionInView delay={220}>
        <SectionCard
          title="Getting started"
          body="Complete these steps before using live storefront tools."
        >
          <OwnerPortalStageList
            items={[
              {
                label: 'Sign in with the real business account',
                body: 'Use your business email.',
                tone: authSession.status === 'authenticated' ? 'complete' : 'current',
              },
              {
                label: 'Finish the business profile',
                body: 'Add legal and company details.',
                tone: authSession.status === 'authenticated' ? 'current' : 'pending',
              },
              {
                label: 'Claim and verify the storefront',
                body: 'Claim the listing and complete verification.',
                tone: 'pending',
              },
              {
                label: 'Open live owner tools',
                body: 'Access storefront controls and billing.',
                tone: 'pending',
              },
            ]}
          />
        </SectionCard>
      </MotionInView>

      <MotionInView delay={260}>
        <SectionCard title="What owners can do">
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

      {authSession.status === 'authenticated' && accessState.allowlisted && !isCheckingAccess ? (
        <MotionInView delay={ownerPortalPreviewEnabled ? 340 : 300}>
          <SectionCard title="Owner dashboard" body="Your account is approved.">
            <View style={[styles.ctaPanel, styles.onboardingInfoCardSuccess]}>
              <Text style={styles.splitHeaderTitle}>Owner workspace is ready</Text>
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

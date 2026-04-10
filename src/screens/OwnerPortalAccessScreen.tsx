import React from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MotionInView } from '../components/MotionInView';
import { ScreenShell } from '../components/ScreenShell';
import { SectionCard } from '../components/SectionCard';
import { withScreenErrorBoundary } from '../components/withScreenErrorBoundary';
import { AppUiIcon } from '../icons/AppUiIcon';
import { useStorefrontProfileController } from '../context/StorefrontController';
import { useOwnerPortalAccessState } from '../hooks/useOwnerPortalAccessState';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { OwnerPortalHeroPanel } from './ownerPortal/OwnerPortalHeroPanel';
import { OwnerPortalStageList } from './ownerPortal/OwnerPortalStageList';
import { ownerPortalStyles as styles } from './ownerPortal/ownerPortalStyles';

const OWNER_WORKSPACE_FEATURES = [
  'Claim and manage your dispensary listing',
  'Submit business and identity approval details',
  'Reply to reviews and monitor reports fast',
  Platform.OS === 'android'
    ? 'Schedule owner updates with follower alerts and performance results'
    : 'Schedule live deals with follower alerts and performance results',
  Platform.OS === 'android'
    ? 'Update website links, storefront photos, and listing details'
    : 'Update menu links, storefront photos, and listing details',
  'Manage business plans and owner-only features',
];

const ONBOARDING_STEPS = ['Access', 'Account', 'Business Details', 'Claim Listing', 'Verification'];

function OwnerPortalAccessScreenInner() {
  const isAndroid = Platform.OS === 'android';
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
    ? 'Business access is reviewed before it is approved.'
    : 'Owner access is currently open.';
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
  ];

  return (
    <ScreenShell
      eyebrow="Owner Portal"
      title="Owner access"
      subtitle="Sign in to manage a licensed storefront from one private business space."
      headerPill="Business"
    >
      <MotionInView delay={70}>
        <OwnerPortalHeroPanel
          kicker="Owner access"
          title="Open the private business side of the app."
          body={
            isAndroid
              ? 'This is where storefront owners handle photos, reviews, updates, and business setup.'
              : 'This is where storefront owners handle photos, reviews, offers, and business setup.'
          }
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
                Checking whether this signed-in account already has owner access.
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
          title="How to get in"
          body="Sign in with your business email to manage your storefront."
        >
          <View style={styles.actionGrid}>
            <View style={styles.ctaPanel}>
              <View style={styles.splitHeaderRow}>
                <View style={styles.splitHeaderCopy}>
                  <Text style={styles.sectionEyebrow}>Business sign in</Text>
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
                Once you sign in, we can confirm access and help connect the right storefront.
              </Text>
            </View>
          </View>
        </SectionCard>
      </MotionInView>

      <MotionInView delay={220}>
        <SectionCard
          title="Getting started"
          body="These are the main steps before you start managing the storefront."
        >
          <OwnerPortalStageList
            items={[
              {
                label: 'Sign in with the real business account',
                body: 'Use the business email tied to the storefront.',
                tone: authSession.status === 'authenticated' ? 'complete' : 'current',
              },
              {
                label: 'Finish the business profile',
                body: 'Add your business name and company details.',
                tone: authSession.status === 'authenticated' ? 'current' : 'pending',
              },
              {
                label: 'Claim and verify the storefront',
                body: 'Connect the storefront and finish approval.',
                tone: 'pending',
              },
              {
                label: 'Start managing the storefront',
                body: isAndroid
                  ? 'Open photos, reviews, updates, and billing.'
                  : 'Open photos, reviews, offers, and billing.',
                tone: 'pending',
              },
            ]}
          />
        </SectionCard>
      </MotionInView>

      <MotionInView delay={260}>
        <SectionCard title="What you can do here">
          <View style={styles.actionGrid}>
            {OWNER_WORKSPACE_FEATURES.map((feature) => (
              <View key={feature} style={styles.actionTile}>
                <Text style={styles.actionTileMeta}>Business feature</Text>
                <Text style={styles.actionTileTitle}>{feature}</Text>
              </View>
            ))}
          </View>
        </SectionCard>
      </MotionInView>

      {authSession.status === 'authenticated' && accessState.allowlisted && !isCheckingAccess ? (
        <MotionInView delay={300}>
          <SectionCard title="Business dashboard" body="Your account is approved.">
            <View style={[styles.ctaPanel, styles.onboardingInfoCardSuccess]}>
              <Text style={styles.splitHeaderTitle}>Your business side is ready</Text>
              <Pressable
                onPress={() => navigation.navigate('OwnerPortalHome')}
                style={styles.primaryButton}
              >
                <Text style={styles.primaryButtonText}>Open Business Dashboard</Text>
              </Pressable>
            </View>
          </SectionCard>
        </MotionInView>
      ) : null}
    </ScreenShell>
  );
}

export const OwnerPortalAccessScreen = withScreenErrorBoundary(
  OwnerPortalAccessScreenInner,
  'owner-portal-access-screen',
);

import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { MotionInView } from '../components/MotionInView';
import { QuickActionsRow, type QuickAction } from '../components/QuickActionsRow';
import { ScreenShell } from '../components/ScreenShell';
import { SectionCard } from '../components/SectionCard';
import { withScreenErrorBoundary } from '../components/withScreenErrorBoundary';
import { ownerPortalAccessAvailable } from '../config/ownerPortalConfig';
import { useStorefrontProfileController } from '../context/StorefrontController';
import { useOwnerPortalAccessState } from '../hooks/useOwnerPortalAccessState';
import { AppUiIcon } from '../icons/AppUiIcon';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { colors, radii, spacing, textStyles } from '../theme/tokens';

function OwnerWorkspaceScreenInner() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { authSession } = useStorefrontProfileController();
  const { accessState, isCheckingAccess } = useOwnerPortalAccessState(authSession);
  const isAndroid = Platform.OS === 'android';
  const isAuthenticated = authSession.status === 'authenticated';
  const ownerWorkspaceReady =
    ownerPortalAccessAvailable && isAuthenticated && accessState.allowlisted && !isCheckingAccess;

  const ownerQuickActions: QuickAction[] = React.useMemo(
    () => [
      {
        key: 'dashboard',
        label: 'Dashboard',
        iconName: 'stats-chart-outline',
        onPress: () => navigation.navigate('OwnerPortalHome'),
      },
      {
        key: 'reviews',
        label: 'Reviews',
        iconName: 'chatbubble-ellipses-outline',
        onPress: () => navigation.navigate('OwnerPortalReviewInbox'),
      },
      {
        key: 'listing',
        label: 'Listing',
        iconName: 'storefront-outline',
        onPress: () => navigation.navigate('OwnerPortalProfileTools'),
      },
      {
        key: 'deals',
        label: isAndroid ? 'Updates' : 'Deals',
        iconName: 'megaphone-outline',
        onPress: () => navigation.navigate('OwnerPortalPromotions'),
      },
      {
        key: 'billing',
        label: 'Billing',
        iconName: 'pricetag-outline',
        onPress: () => navigation.navigate('OwnerPortalSubscription'),
      },
    ],
    [isAndroid, navigation],
  );

  const ownerStatus = !ownerPortalAccessAvailable
    ? 'Closed'
    : !isAuthenticated
      ? 'Sign in'
      : isCheckingAccess
        ? 'Checking'
        : accessState.allowlisted
          ? 'Ready'
          : 'Invite required';

  return (
    <ScreenShell
      eyebrow="Owner"
      title="Business dashboard"
      subtitle={
        isAndroid
          ? 'Business tools stay separate from the member profile so storefront updates, reviews, and billing all live in one place.'
          : 'Business tools stay separate from the member profile so storefront updates, reviews, offers, and billing all live in one place.'
      }
      headerPill="Owner"
    >
      <MotionInView delay={70}>
        <SectionCard
          title="Business dashboard"
          body="Use this area for storefront ownership and day-to-day business updates. Member activity and saved storefronts stay under the Profile tab."
        >
          <View style={styles.statusHero}>
            <View style={styles.statusCopy}>
              <Text style={styles.statusEyebrow}>Status</Text>
              <Text style={styles.statusTitle}>
                {ownerWorkspaceReady
                  ? 'This owner account is ready to work.'
                  : 'This business dashboard is separate from the member profile.'}
              </Text>
              <Text style={styles.statusBody}>
                {ownerWorkspaceReady
                  ? isAndroid
                    ? 'Jump into the owner dashboard or go straight to reviews, listing tools, updates, and billing.'
                    : 'Jump into the owner dashboard or go straight to reviews, listing tools, deals, and billing.'
                  : !ownerPortalAccessAvailable
                    ? 'Owner access is not enabled in this build.'
                    : !isAuthenticated
                      ? 'Sign in with the business account to open owner access and claim tools.'
                      : isCheckingAccess
                        ? 'Checking whether this signed-in account already has owner access.'
                        : 'This signed-in account is not approved for owner access yet. Continue through the owner access flow.'}
              </Text>
            </View>
            <View
              style={[
                styles.statusChip,
                ownerWorkspaceReady ? styles.statusChipReady : styles.statusChipPending,
              ]}
            >
              <Text
                style={[
                  styles.statusChipText,
                  ownerWorkspaceReady ? styles.statusChipTextReady : styles.statusChipTextPending,
                ]}
              >
                {ownerStatus}
              </Text>
            </View>
          </View>
        </SectionCard>
      </MotionInView>

      {ownerWorkspaceReady ? (
        <>
          <MotionInView delay={120}>
            <QuickActionsRow actions={ownerQuickActions} />
          </MotionInView>

          <MotionInView delay={170}>
            <SectionCard
              title="Open owner tools"
              body="The owner side is where storefront operations happen. You should not need to pass through the member profile to get here."
            >
              <View style={styles.actionStack}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Open owner dashboard"
                  onPress={() => navigation.navigate('OwnerPortalHome')}
                  style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
                >
                  <Text style={styles.primaryButtonText}>Open Dashboard</Text>
                </Pressable>
                <View style={styles.secondaryRow}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Open owner reviews"
                    onPress={() => navigation.navigate('OwnerPortalReviewInbox')}
                    style={({ pressed }) => [
                      styles.secondaryButton,
                      pressed && styles.buttonPressed,
                    ]}
                  >
                    <Text style={styles.secondaryButtonText}>Review Inbox</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Open owner listing tools"
                    onPress={() => navigation.navigate('OwnerPortalProfileTools')}
                    style={({ pressed }) => [
                      styles.secondaryButton,
                      pressed && styles.buttonPressed,
                    ]}
                  >
                    <Text style={styles.secondaryButtonText}>Listing Tools</Text>
                  </Pressable>
                </View>
              </View>
            </SectionCard>
          </MotionInView>
        </>
      ) : (
        <MotionInView delay={120}>
          <SectionCard
            title="Open owner access"
            body="Use the owner flow for business sign-in, storefront claims, verification, and owner-only tools."
          >
            <View style={styles.actionStack}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open owner access"
                onPress={() => navigation.navigate('OwnerPortalAccess')}
                style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
              >
                <Text style={styles.primaryButtonText}>Open Owner Access</Text>
              </Pressable>
              <View style={styles.secondaryRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Owner sign in"
                  onPress={() => navigation.navigate('OwnerPortalSignIn')}
                  style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
                >
                  <Text style={styles.secondaryButtonText}>Owner Sign In</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Owner sign up"
                  onPress={() => navigation.navigate('OwnerPortalSignUp')}
                  style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
                >
                  <Text style={styles.secondaryButtonText}>Create Owner Account</Text>
                </Pressable>
              </View>
            </View>
          </SectionCard>
        </MotionInView>
      )}

      <MotionInView delay={220}>
        <SectionCard
          title="Member side stays separate"
          body="Reviews you write as a customer, saved storefronts, badges, and personal settings stay in the Me tab."
        >
          <View style={styles.memberNoteRow}>
            <View style={styles.memberNoteIcon}>
              <AppUiIcon name="person-circle-outline" size={18} color={colors.accent} />
            </View>
            <View style={styles.memberNoteCopy}>
              <Text style={styles.memberNoteTitle}>Keep customer activity under Me</Text>
              <Text style={styles.memberNoteBody}>
                This split keeps owner operations out of the member profile and makes the app easier
                to navigate.
              </Text>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open member profile"
            onPress={() => navigation.navigate('Tabs', { screen: 'Profile' })}
            style={({ pressed }) => [styles.tertiaryButton, pressed && styles.buttonPressed]}
          >
            <Text style={styles.tertiaryButtonText}>Open Me</Text>
          </Pressable>
        </SectionCard>
      </MotionInView>
    </ScreenShell>
  );
}

export const OwnerWorkspaceScreen = withScreenErrorBoundary(
  OwnerWorkspaceScreenInner,
  'owner-workspace-screen',
);

const styles = StyleSheet.create({
  statusHero: {
    gap: spacing.md,
  },
  statusCopy: {
    gap: spacing.xs,
  },
  statusEyebrow: {
    ...textStyles.labelCaps,
    color: colors.gold,
  },
  statusTitle: {
    ...textStyles.section,
    color: colors.text,
  },
  statusBody: {
    ...textStyles.body,
    color: colors.textMuted,
  },
  statusChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  statusChipReady: {
    backgroundColor: 'rgba(143, 255, 209, 0.12)',
    borderColor: 'rgba(143, 255, 209, 0.18)',
  },
  statusChipPending: {
    backgroundColor: 'rgba(245, 200, 106, 0.12)',
    borderColor: 'rgba(245, 200, 106, 0.18)',
  },
  statusChipText: {
    ...textStyles.caption,
  },
  statusChipTextReady: {
    color: colors.accent,
  },
  statusChipTextPending: {
    color: colors.goldSoft,
  },
  actionStack: {
    gap: spacing.md,
  },
  secondaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: radii.md,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
  },
  primaryButtonText: {
    ...textStyles.bodyStrong,
    color: colors.backgroundDeep,
  },
  secondaryButton: {
    flexGrow: 1,
    minHeight: 46,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    backgroundColor: colors.surfaceElevated,
  },
  secondaryButtonText: {
    ...textStyles.bodyStrong,
    color: colors.text,
  },
  tertiaryButton: {
    alignSelf: 'flex-start',
    minHeight: 42,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: 9,
    backgroundColor: colors.surfaceElevated,
    marginTop: spacing.md,
  },
  tertiaryButtonText: {
    ...textStyles.bodyStrong,
    color: colors.text,
  },
  memberNoteRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  memberNoteIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    backgroundColor: 'rgba(143, 255, 209, 0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  memberNoteCopy: {
    flex: 1,
    gap: 2,
  },
  memberNoteTitle: {
    ...textStyles.bodyStrong,
    color: colors.text,
  },
  memberNoteBody: {
    ...textStyles.caption,
    color: colors.textMuted,
  },
  buttonPressed: {
    opacity: 0.84,
  },
});

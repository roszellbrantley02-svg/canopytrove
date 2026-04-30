import React from 'react';
import { Alert, Linking, Platform, Pressable, StyleSheet, Text, View, Switch } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AppUiIcon } from '../icons/AppUiIcon';
import { MotionInView } from '../components/MotionInView';
import { ScreenShell } from '../components/ScreenShell';
import { withScreenErrorBoundary } from '../components/withScreenErrorBoundary';
import { colors, radii, spacing, textStyles, motion } from '../theme/tokens';
import { useStorefrontProfileController } from '../context/StorefrontController';
import { useMemberEmailSubscription } from '../hooks/useMemberEmailSubscription';
import {
  getCommunitySafetyState,
  subscribeToCommunitySafetyState,
} from '../services/communitySafetyService';
import { legalConfig } from '../config/legal';
import Constants from 'expo-constants';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import type { AppUiIconName } from '../icons/AppUiIcon';

type SettingsRowProps = {
  icon: AppUiIconName;
  title: string;
  subtitle?: string;
  value?: string | boolean;
  onPress?: () => void;
  onToggle?: (value: boolean) => void;
  isLoading?: boolean;
  isDanger?: boolean;
  isLast?: boolean;
  tone?: string;
};

function SettingsRow({
  icon,
  title,
  subtitle,
  value,
  onPress,
  onToggle,
  isLoading = false,
  isDanger = false,
  isLast = false,
  tone,
}: SettingsRowProps) {
  const isToggle = typeof value === 'boolean';
  const rowStyle = [styles.row, isLast && styles.rowLast];
  const effectiveTone = isDanger ? colors.danger : (tone ?? colors.accent);
  const iconTint = `${effectiveTone}1F`;
  const iconBorder = `${effectiveTone}40`;

  const content = (
    <>
      <View
        style={[
          styles.rowIconWrap,
          { backgroundColor: iconTint, borderColor: iconBorder },
          isDanger && styles.rowIconWrapDanger,
        ]}
      >
        <AppUiIcon name={icon} size={22} color={effectiveTone} />
      </View>

      <View style={styles.rowContent}>
        <Text style={[styles.rowTitle, isDanger && styles.rowTitleDanger]}>{title}</Text>
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>

      {isToggle ? (
        <Switch
          value={value as boolean}
          onValueChange={onToggle}
          disabled={isLoading}
          trackColor={{ false: colors.borderSoft, true: colors.primary }}
          thumbColor={value ? colors.accent : colors.textSoft}
          accessibilityRole="switch"
          accessibilityLabel={title}
          accessibilityState={{ checked: value }}
        />
      ) : value ? (
        <View style={styles.rowAccessory}>
          <Text
            style={[styles.rowValue, isDanger && styles.rowValueDanger]}
            numberOfLines={1}
            ellipsizeMode="middle"
          >
            {String(value)}
          </Text>
          {onPress ? <AppUiIcon name="chevron-forward" size={16} color={colors.textSoft} /> : null}
        </View>
      ) : onPress ? (
        <AppUiIcon name="chevron-forward" size={16} color={colors.textSoft} />
      ) : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        disabled={isLoading}
        style={({ pressed }) => [rowStyle, pressed && styles.rowPressed]}
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityHint={subtitle}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View style={rowStyle} accessible accessibilityLabel={title} accessibilityHint={subtitle}>
      {content}
    </View>
  );
}

type SectionGroupProps = {
  title: string;
  tone: string;
  emoji: string;
  children: React.ReactNode;
};

function SectionGroup({ title, tone, emoji, children }: SectionGroupProps) {
  return (
    <View style={styles.sectionGroup}>
      <View style={styles.sectionHeaderRow}>
        <View
          style={[
            styles.sectionEmojiPuck,
            { backgroundColor: `${tone}1F`, borderColor: `${tone}40` },
          ]}
        >
          <Text style={styles.sectionEmoji}>{emoji}</Text>
        </View>
        <Text style={[styles.sectionHeader, { color: tone }]}>{title}</Text>
      </View>
      <View style={[styles.rowsContainer, { borderColor: `${tone}2A` }]}>{children}</View>
    </View>
  );
}

function SettingsScreenInner() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { authSession, signOutSession } = useStorefrontProfileController();
  const emailSubscription = useMemberEmailSubscription(authSession);
  const [communitySafetyState, setCommunitySafetyState] = React.useState(() =>
    getCommunitySafetyState(),
  );

  // Refresh community safety state on screen focus
  React.useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      setCommunitySafetyState(getCommunitySafetyState());
    });
    const unsubscribeCommunitySafety = subscribeToCommunitySafetyState((state) => {
      setCommunitySafetyState(state);
    });
    return () => {
      unsubscribe();
      unsubscribeCommunitySafety();
    };
  }, [navigation]);

  const isAuthenticated = authSession.status === 'authenticated';
  const memberEmail = authSession.email;
  const emailSubscribed = emailSubscription.status.subscribed;
  const isLoadingEmailSubscription = emailSubscription.isLoading;
  const hasAcceptedGuidelines = Boolean(communitySafetyState.acceptedGuidelinesVersion);
  const blockedAuthorCount = communitySafetyState.blockedReviewAuthors.length;
  const supportEmail = legalConfig.supportEmail;
  const appVersion = Constants.expoConfig?.version || '1.0.0';

  const handleSignOut = React.useCallback(() => {
    void signOutSession();
  }, [signOutSession]);

  // Open a mailto: URL gracefully. On iOS without a configured Mail account
  // (or Android without any email handler), Linking.openURL throws "Unable
  // to open URL: mailto:..." — previously bubbled to Sentry as Bug Reports
  // even though it's a routine "user has no email app" condition. Now we
  // probe with canOpenURL first and show the support address in an alert
  // dialog the user can long-press to copy.
  const openMailtoOrFallback = React.useCallback(
    async (url: string) => {
      if (Platform.OS === 'web') {
        window.location.href = url;
        return;
      }
      try {
        const canOpen = await Linking.canOpenURL(url);
        if (canOpen) {
          await Linking.openURL(url);
          return;
        }
      } catch {
        // canOpenURL itself can throw on some Android versions if no
        // handler is registered for the scheme — fall through to the
        // alert path below.
      }
      Alert.alert(
        'Email app not available',
        `No email app is configured on this device. You can reach us at:\n\n${supportEmail}\n\nLong-press the address above to copy it.`,
        [{ text: 'OK' }],
      );
    },
    [supportEmail],
  );

  const handleReportBug = React.useCallback(() => {
    const subject = encodeURIComponent('Bug Report — Canopy Trove');
    const body = encodeURIComponent(
      [
        '',
        '--- Please describe the issue below ---',
        '',
        '',
        '',
        '--- Device info (auto-filled) ---',
        `App version: ${appVersion}`,
        `Platform: ${Platform.OS}`,
        `Authenticated: ${isAuthenticated ? 'Yes' : 'No'}`,
        `Date: ${new Date().toISOString()}`,
      ].join('\n'),
    );
    void openMailtoOrFallback(`mailto:${supportEmail}?subject=${subject}&body=${body}`);
  }, [appVersion, isAuthenticated, supportEmail, openMailtoOrFallback]);

  const handleContactSupport = React.useCallback(() => {
    const subject = encodeURIComponent('Support Request — Canopy Trove');
    void openMailtoOrFallback(`mailto:${supportEmail}?subject=${subject}`);
  }, [supportEmail, openMailtoOrFallback]);

  const handleSubscribeEmail = React.useCallback(() => {
    void emailSubscription.subscribe();
  }, [emailSubscription]);

  const handleUnsubscribeEmail = React.useCallback(() => {
    void emailSubscription.unsubscribe();
  }, [emailSubscription]);

  return (
    <ScreenShell
      eyebrow="Account"
      title="Settings"
      subtitle="Manage your preferences and account information."
      showHero
      showTopBar
    >
      <MotionInView
        delay={motion.sectionStagger}
        distance={motion.revealDistance}
        duration={motion.standard}
      >
        <SectionGroup title="Account" tone={colors.accent} emoji="👋">
          <SettingsRow
            icon="mail-open-outline"
            title="Email"
            value={memberEmail || 'Not signed in'}
            tone={colors.accent}
          />

          <SettingsRow
            icon={isAuthenticated ? 'log-out-outline' : 'log-in-outline'}
            title={isAuthenticated ? 'Sign out' : 'Sign in'}
            onPress={
              isAuthenticated ? handleSignOut : () => navigation.navigate('CanopyTroveSignIn')
            }
            isDanger={isAuthenticated}
            tone={colors.accent}
            isLast={!isAuthenticated}
          />

          {isAuthenticated ? (
            <SettingsRow
              icon="close-circle-outline"
              title="Delete account"
              subtitle="Start permanent account deletion"
              onPress={() => navigation.navigate('DeleteAccount')}
              isDanger
              isLast
            />
          ) : null}
        </SectionGroup>
      </MotionInView>

      {isAuthenticated && (
        <MotionInView
          delay={motion.sectionStagger + 40}
          distance={motion.revealDistance}
          duration={motion.standard}
        >
          <SectionGroup title="Notifications" tone={colors.gold} emoji="🔔">
            <SettingsRow
              icon="notifications-outline"
              title="Email updates"
              subtitle="Welcome notes and product news"
              value={emailSubscribed}
              onToggle={emailSubscribed ? handleUnsubscribeEmail : handleSubscribeEmail}
              isLoading={isLoadingEmailSubscription}
              tone={colors.gold}
              isLast
            />
          </SectionGroup>
        </MotionInView>
      )}

      <MotionInView
        delay={motion.sectionStagger + 80}
        distance={motion.revealDistance}
        duration={motion.standard}
      >
        <SectionGroup title="Safety & Privacy" tone="#4D9CFF" emoji="🛡️">
          <SettingsRow
            icon="shield-checkmark-outline"
            title="Community guidelines"
            value={hasAcceptedGuidelines ? 'Accepted' : 'Review required'}
            tone="#4D9CFF"
          />

          <SettingsRow
            icon="close-circle-outline"
            title="Blocked authors"
            value={String(blockedAuthorCount)}
            tone="#4D9CFF"
          />

          <SettingsRow
            icon="flag-outline"
            title="Report a bug"
            subtitle="Describe what went wrong and we'll look into it"
            onPress={handleReportBug}
            tone="#4D9CFF"
          />

          <SettingsRow
            icon="help-buoy-outline"
            title="Contact support"
            value={supportEmail}
            onPress={handleContactSupport}
            tone="#4D9CFF"
            isLast
          />
        </SectionGroup>
      </MotionInView>

      <MotionInView
        delay={motion.sectionStagger + 120}
        distance={motion.revealDistance}
        duration={motion.standard}
      >
        <SectionGroup title="About" tone={colors.goldSoft} emoji="📖">
          <SettingsRow
            icon="document-text-outline"
            title="Legal Center"
            onPress={() => navigation.navigate('LegalCenter')}
            tone={colors.goldSoft}
          />

          <SettingsRow
            icon="close-circle-outline"
            title="Delete account"
            subtitle="Start permanent account deletion"
            onPress={() => navigation.navigate('DeleteAccount')}
            isDanger
          />

          <SettingsRow
            icon="information-circle-outline"
            title="App version"
            value={appVersion}
            tone={colors.goldSoft}
            isLast
          />
        </SectionGroup>
      </MotionInView>
    </ScreenShell>
  );
}

export const SettingsScreen = withScreenErrorBoundary(SettingsScreenInner, 'settings-screen');

const styles = StyleSheet.create({
  sectionGroup: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
    marginBottom: spacing.xs,
  },
  sectionEmojiPuck: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  sectionEmoji: {
    fontSize: 14,
  },
  sectionHeader: {
    ...textStyles.labelCaps,
    letterSpacing: 1.2,
    fontWeight: '800',
  },
  rowsContainer: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.xl,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: colors.shadow,
    shadowOpacity: 0.22,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 68,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSoft,
    gap: spacing.md,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowPressed: {
    backgroundColor: 'rgba(255, 251, 247, 0.04)',
  },
  rowIconWrap: {
    width: 46,
    height: 46,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    shadowColor: colors.shadow,
    shadowOpacity: 0.16,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  rowIconWrapDanger: {
    backgroundColor: 'rgba(231, 76, 60, 0.12)',
    borderColor: 'rgba(231, 76, 60, 0.30)',
  },
  rowContent: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    ...textStyles.bodyStrong,
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  rowTitleDanger: {
    color: colors.danger,
  },
  rowSubtitle: {
    ...textStyles.caption,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  rowAccessory: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rowValue: {
    ...textStyles.caption,
    color: colors.textSoft,
    fontSize: 14,
    textAlign: 'right',
    maxWidth: 180,
  },
  rowValueDanger: {
    color: colors.danger,
  },
});

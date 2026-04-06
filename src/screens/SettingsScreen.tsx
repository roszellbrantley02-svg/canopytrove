import React from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View, Switch } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AppUiIcon } from '../icons/AppUiIcon';
import { MotionInView } from '../components/MotionInView';
import { ScreenShell } from '../components/ScreenShell';
import { withScreenErrorBoundary } from '../components/withScreenErrorBoundary';
import { colors, radii, spacing, textStyles, motion } from '../theme/tokens';
import { useStorefrontProfileController } from '../context/StorefrontController';
import { useMemberEmailSubscription } from '../hooks/useMemberEmailSubscription';
import { getCommunitySafetyState } from '../services/communitySafetyService';
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
}: SettingsRowProps) {
  const isToggle = typeof value === 'boolean';

  const content = (
    <>
      <View style={styles.rowIconWrap}>
        <AppUiIcon name={icon} size={20} color={isDanger ? colors.danger : colors.textSoft} />
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
          {onPress ? <AppUiIcon name="chevron-forward" size={14} color={colors.textSoft} /> : null}
        </View>
      ) : onPress ? (
        <AppUiIcon name="chevron-forward" size={14} color={colors.textSoft} />
      ) : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        disabled={isLoading}
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityHint={subtitle}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View style={styles.row} accessible accessibilityLabel={title} accessibilityHint={subtitle}>
      {content}
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
    return () => {
      unsubscribe();
    };
  }, [navigation]);

  const isAuthenticated = authSession.status === 'authenticated';
  const memberEmail = authSession.email;
  const emailSubscribed = emailSubscription.status.subscribed;
  const isLoadingEmailSubscription = emailSubscription.isLoading;
  const hasAcceptedGuidelines = Boolean(communitySafetyState.acceptedGuidelinesVersion);
  const blockedAuthorCount = communitySafetyState.blockedAuthorProfileIds.length;
  const supportEmail = legalConfig.supportEmail;
  const appVersion = Constants.expoConfig?.version || '1.0.0';

  const handleSignOut = React.useCallback(() => {
    void signOutSession();
  }, [signOutSession]);

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
    const url = `mailto:${supportEmail}?subject=${subject}&body=${body}`;
    if (Platform.OS === 'web') {
      window.location.href = url;
    } else {
      void Linking.openURL(url);
    }
  }, [appVersion, isAuthenticated, supportEmail]);

  const handleContactSupport = React.useCallback(() => {
    const subject = encodeURIComponent('Support Request — Canopy Trove');
    const url = `mailto:${supportEmail}?subject=${subject}`;
    if (Platform.OS === 'web') {
      window.location.href = url;
    } else {
      void Linking.openURL(url);
    }
  }, [supportEmail]);

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
        {/* Account Group */}
        <View style={styles.sectionGroup}>
          <Text style={styles.sectionHeader}>Account</Text>

          <View style={styles.rowsContainer}>
            <SettingsRow
              icon="mail-open-outline"
              title="Email"
              value={memberEmail || 'Not signed in'}
            />

            <SettingsRow
              icon={isAuthenticated ? 'log-out-outline' : 'log-in-outline'}
              title={isAuthenticated ? 'Sign out' : 'Sign in'}
              onPress={
                isAuthenticated ? handleSignOut : () => navigation.navigate('CanopyTroveSignIn')
              }
              isDanger={isAuthenticated}
            />
          </View>
        </View>
      </MotionInView>

      {isAuthenticated && (
        <MotionInView
          delay={motion.sectionStagger + 40}
          distance={motion.revealDistance}
          duration={motion.standard}
        >
          {/* Notifications Group */}
          <View style={styles.sectionGroup}>
            <Text style={styles.sectionHeader}>Notifications</Text>

            <View style={styles.rowsContainer}>
              <SettingsRow
                icon="notifications-outline"
                title="Email updates"
                subtitle="Welcome notes and product news"
                value={emailSubscribed}
                onToggle={emailSubscribed ? handleUnsubscribeEmail : handleSubscribeEmail}
                isLoading={isLoadingEmailSubscription}
              />
            </View>
          </View>
        </MotionInView>
      )}

      <MotionInView
        delay={motion.sectionStagger + 80}
        distance={motion.revealDistance}
        duration={motion.standard}
      >
        {/* Safety & Privacy Group */}
        <View style={styles.sectionGroup}>
          <Text style={styles.sectionHeader}>Safety & Privacy</Text>

          <View style={styles.rowsContainer}>
            <SettingsRow
              icon="shield-checkmark-outline"
              title="Community guidelines"
              value={hasAcceptedGuidelines ? 'Accepted' : 'Review required'}
            />

            <SettingsRow
              icon="close-circle-outline"
              title="Blocked authors"
              value={String(blockedAuthorCount)}
            />

            <SettingsRow
              icon="flag-outline"
              title="Report a bug"
              subtitle="Describe what went wrong and we'll look into it"
              onPress={handleReportBug}
            />

            <SettingsRow
              icon="help-buoy-outline"
              title="Contact support"
              value={supportEmail}
              onPress={handleContactSupport}
            />
          </View>
        </View>
      </MotionInView>

      <MotionInView
        delay={motion.sectionStagger + 120}
        distance={motion.revealDistance}
        duration={motion.standard}
      >
        {/* About Group */}
        <View style={styles.sectionGroup}>
          <Text style={styles.sectionHeader}>About</Text>

          <View style={styles.rowsContainer}>
            <SettingsRow
              icon="document-text-outline"
              title="Legal Center"
              onPress={() => navigation.navigate('LegalCenter')}
            />

            <SettingsRow
              icon="close-circle-outline"
              title="Delete account"
              onPress={() => navigation.navigate('DeleteAccount')}
              isDanger
            />

            <SettingsRow icon="information-circle-outline" title="App version" value={appVersion} />
          </View>
        </View>
      </MotionInView>
    </ScreenShell>
  );
}

export const SettingsScreen = withScreenErrorBoundary(SettingsScreenInner, 'settings-screen');

const styles = StyleSheet.create({
  sectionGroup: {
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  sectionHeader: {
    ...textStyles.labelCaps,
    color: colors.goldSoft,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.xs,
  },
  rowsContainer: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    overflow: 'hidden',
    shadowColor: colors.shadow,
    shadowOpacity: 0.14,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSoft,
    gap: spacing.md,
  },
  rowPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  rowIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  rowContent: {
    flex: 1,
    gap: spacing.xs,
  },
  rowTitle: {
    ...textStyles.bodyStrong,
    color: colors.text,
    fontSize: 16,
  },
  rowTitleDanger: {
    color: colors.danger,
  },
  rowSubtitle: {
    ...textStyles.caption,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
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

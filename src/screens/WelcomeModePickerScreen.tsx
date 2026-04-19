import React from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MotionInView } from '../components/MotionInView';
import { ScreenShell } from '../components/ScreenShell';
import { withScreenErrorBoundary } from '../components/withScreenErrorBoundary';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { colors, radii, spacing, typography } from '../theme/tokens';
import { trackAnalyticsEvent } from '../services/analyticsService';
import { StyleSheet } from 'react-native';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
  sectionStack: {
    gap: spacing.lg,
    flex: 1,
    justifyContent: 'center',
  },
  buttonStack: {
    gap: spacing.lg,
  },
  modeButton: {
    minHeight: 100,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  modeButtonPrimary: {
    backgroundColor: colors.primary,
  },
  modeButtonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: colors.gold,
  },
  modeButtonLabel: {
    fontSize: typography.section,
    fontWeight: '900',
    lineHeight: 24,
  },
  modeButtonLabelPrimary: {
    color: colors.backgroundDeep,
  },
  modeButtonLabelSecondary: {
    color: colors.text,
  },
  modeButtonSubtitle: {
    fontSize: typography.caption,
    lineHeight: 18,
  },
  modeButtonSubtitlePrimary: {
    color: 'rgba(6, 11, 16, 0.7)',
  },
  modeButtonSubtitleSecondary: {
    color: colors.textMuted,
  },
  guestLink: {
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  guestLinkText: {
    fontSize: typography.caption,
    color: colors.textSoft,
    textDecorationLine: 'underline',
  },
});

function WelcomeModePickerScreenInner() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  React.useEffect(() => {
    trackAnalyticsEvent('auth_mode_picker_shown', {});
  }, []);

  const handleMemberTap = () => {
    trackAnalyticsEvent('auth_member_mode_tapped', {});
    navigation.replace('MemberSignIn');
  };

  const handleOwnerTap = () => {
    trackAnalyticsEvent('auth_owner_mode_tapped', {});
    navigation.replace('OwnerSignIn');
  };

  const handleGuestTap = () => {
    trackAnalyticsEvent('auth_guest_mode_tapped', {});
    navigation.replace('Tabs', { screen: 'Browse' });
  };

  return (
    <ScreenShell eyebrow="" title="" subtitle="">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        enabled={Platform.OS === 'ios'}
        keyboardVerticalOffset={24}
        style={styles.container}
      >
        <View style={styles.sectionStack}>
          <MotionInView delay={90}>
            <View style={styles.buttonStack}>
              <Pressable
                onPress={handleMemberTap}
                style={[styles.modeButton, styles.modeButtonPrimary]}
                accessibilityRole="button"
                accessibilityLabel="I'm a member"
                accessibilityHint="Sign in as a member to discover licensed dispensaries, save favorites, and earn rewards."
              >
                <Text style={[styles.modeButtonLabel, styles.modeButtonLabelPrimary]}>
                  I'm a member
                </Text>
                <Text style={[styles.modeButtonSubtitle, styles.modeButtonSubtitlePrimary]}>
                  Discover licensed dispensaries, save favorites, earn rewards.
                </Text>
              </Pressable>

              <Pressable
                onPress={handleOwnerTap}
                style={[styles.modeButton, styles.modeButtonSecondary]}
                accessibilityRole="button"
                accessibilityLabel="I'm a dispensary owner"
                accessibilityHint="Sign in as a dispensary owner to manage your verified storefront, reviews, and visibility."
              >
                <Text style={[styles.modeButtonLabel, styles.modeButtonLabelSecondary]}>
                  I'm a dispensary owner
                </Text>
                <Text style={[styles.modeButtonSubtitle, styles.modeButtonSubtitleSecondary]}>
                  Manage your verified storefront, reviews, and visibility.
                </Text>
              </Pressable>
            </View>
          </MotionInView>

          <MotionInView delay={140}>
            <View style={styles.guestLink}>
              <Pressable
                onPress={handleGuestTap}
                accessibilityRole="button"
                accessibilityLabel="Browse as a guest"
                accessibilityHint="Browse dispensaries without signing in."
              >
                <Text style={styles.guestLinkText}>Just looking around? Browse as a guest.</Text>
              </Pressable>
            </View>
          </MotionInView>
        </View>
      </KeyboardAvoidingView>
    </ScreenShell>
  );
}

export const WelcomeModePickerScreen = withScreenErrorBoundary(
  WelcomeModePickerScreenInner,
  'welcome-mode-picker',
);

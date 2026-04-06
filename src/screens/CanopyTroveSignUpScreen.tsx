import React from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MotionInView } from '../components/MotionInView';
import { ScreenShell } from '../components/ScreenShell';
import { SectionCard } from '../components/SectionCard';
import { withScreenErrorBoundary } from '../components/withScreenErrorBoundary';
import { AppUiIcon } from '../icons/AppUiIcon';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { trackAnalyticsEvent } from '../services/analyticsService';
import { signUpCanopyTroveEmailPassword } from '../services/canopyTroveAuthService';
import { syncMemberEmailSubscription } from '../services/memberEmailSubscriptionService';
import { reportRuntimeError } from '../services/runtimeReportingService';
import { colors } from '../theme/tokens';
import { customerEntryStyles as styles } from './customerEntry/customerEntryStyles';

function CanopyTroveSignUpScreenInner() {
  const minimumPasswordLength = 6;
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [wantsEmailUpdates, setWantsEmailUpdates] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorText, setErrorText] = React.useState<string | null>(null);
  const passwordTooShort = password.length > 0 && password.length < minimumPasswordLength;
  const canSubmit =
    email.trim().length > 0 &&
    password.length >= minimumPasswordLength &&
    confirmPassword.length > 0;

  const handleSubmit = async () => {
    if (isSubmitting) {
      return;
    }

    if (password.length < minimumPasswordLength) {
      setErrorText(`Password must be at least ${minimumPasswordLength} characters.`);
      return;
    }

    if (password !== confirmPassword) {
      setErrorText('Passwords must match.');
      return;
    }

    setIsSubmitting(true);
    setErrorText(null);
    trackAnalyticsEvent('signup_started', {
      role: 'customer',
      source: 'profile',
    });
    try {
      const authSession = await signUpCanopyTroveEmailPassword(email, password, email.trim());
      if (!authSession?.uid) {
        throw new Error('Unable to create account.');
      }

      trackAnalyticsEvent('signup_completed', {
        role: 'customer',
        source: 'profile',
        email_updates_opt_in: wantsEmailUpdates ? 'yes' : 'no',
      });

      if (wantsEmailUpdates) {
        try {
          await syncMemberEmailSubscription({
            subscribed: true,
            source: 'member_signup',
          });
        } catch (error) {
          reportRuntimeError(error, {
            source: 'member-signup-email-opt-in',
            screen: 'CanopyTroveSignUp',
          });
        }
      }

      navigation.replace('Tabs');
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : 'Unable to create account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScreenShell
      eyebrow="Member access"
      title="Create your member account."
      subtitle="Set up your Canopy Trove member profile for saved storefronts, reviews, and account continuity."
      headerPill="Member"
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        enabled={Platform.OS === 'ios'}
        keyboardVerticalOffset={24}
      >
        <View style={styles.sectionStack}>
          <MotionInView delay={90}>
            <View style={styles.heroCard}>
              <View style={styles.heroGlow} />
              <Text style={styles.heroKicker}>Customer account</Text>
              <Text style={styles.heroTitle}>Start a member profile.</Text>
              <Text style={styles.heroBody}>
                Create a member account to save storefronts, keep review history, and carry your
                account context across sessions.
              </Text>
              <View style={styles.summaryStrip}>
                <View style={styles.summaryTile}>
                  <Text style={styles.summaryTileValue}>Save</Text>
                  <Text style={styles.summaryTileLabel}>Storefronts</Text>
                  <Text style={styles.summaryTileBody}>
                    Keep a durable list of storefronts worth returning to.
                  </Text>
                </View>
                <View style={styles.summaryTile}>
                  <Text style={styles.summaryTileValue}>Keep</Text>
                  <Text style={styles.summaryTileLabel}>Account history</Text>
                  <Text style={styles.summaryTileBody}>
                    Carry your member account state across devices and sessions.
                  </Text>
                </View>
                <View style={styles.summaryTile}>
                  <Text style={styles.summaryTileValue}>Join</Text>
                  <Text style={styles.summaryTileLabel}>Reviews</Text>
                  <Text style={styles.summaryTileBody}>
                    Write reviews and keep your storefront feedback history in one account.
                  </Text>
                </View>
              </View>
              <View style={styles.trustRow}>
                <View style={styles.trustChip}>
                  <Text style={styles.trustChipText}>Member sign-up</Text>
                </View>
                <View style={[styles.trustChip, styles.trustChipWarm]}>
                  <Text style={styles.trustChipText}>Owner onboarding is separate</Text>
                </View>
              </View>
            </View>
          </MotionInView>

          <MotionInView delay={140}>
            <SectionCard
              title="Create account"
              body="This creates a consumer member account for saved storefronts and reviews. Dispensary owners should use the separate owner portal flow."
            >
              <View style={styles.sectionStack}>
                <View style={[styles.plannerPanel, styles.plannerPanelFeatured]}>
                  <View style={styles.form}>
                    <View style={styles.fieldGroup}>
                      <Text style={styles.fieldLabel}>Email</Text>
                      <TextInput
                        value={email}
                        onChangeText={setEmail}
                        placeholder="Email"
                        autoCapitalize="none"
                        keyboardType="email-address"
                        placeholderTextColor={colors.textSoft}
                        style={styles.inputPremium}
                        accessibilityLabel="Email"
                        accessibilityHint="Enter your email address for your member account."
                        autoComplete="email"
                      />
                    </View>
                    <View style={styles.fieldGroup}>
                      <Text style={styles.fieldLabel}>Password</Text>
                      <TextInput
                        value={password}
                        onChangeText={setPassword}
                        placeholder="Password"
                        secureTextEntry={true}
                        placeholderTextColor={colors.textSoft}
                        style={styles.inputPremium}
                        accessibilityLabel="Password"
                        accessibilityHint="Enter a password for your member account."
                        autoComplete="new-password"
                      />
                      {passwordTooShort ? (
                        <Text style={[styles.fieldHint, styles.fieldHintDanger]}>
                          Password must be at least {minimumPasswordLength} characters.
                        </Text>
                      ) : null}
                    </View>
                    <View style={styles.fieldGroup}>
                      <Text style={styles.fieldLabel}>Confirm password</Text>
                      <TextInput
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        placeholder="Confirm password"
                        secureTextEntry={true}
                        placeholderTextColor={colors.textSoft}
                        style={styles.inputPremium}
                        accessibilityLabel="Confirm password"
                        accessibilityHint="Re-enter your password to confirm."
                        autoComplete="new-password"
                      />
                      <Text style={styles.fieldHint}>
                        Your member profile is separate from any owner or business access.
                      </Text>
                    </View>
                    <Pressable
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: wantsEmailUpdates }}
                      accessibilityLabel="Email me product updates and a welcome note"
                      accessibilityHint="Lets Canopy Trove send a thank-you email and occasional product updates."
                      onPress={() => setWantsEmailUpdates((currentValue) => !currentValue)}
                      style={[styles.optInCard, wantsEmailUpdates && styles.optInCardSelected]}
                    >
                      <View
                        style={[
                          styles.optInIndicator,
                          wantsEmailUpdates && styles.optInIndicatorSelected,
                        ]}
                      >
                        {wantsEmailUpdates ? (
                          <AppUiIcon
                            name="checkmark-circle"
                            size={14}
                            color={colors.backgroundDeep}
                          />
                        ) : null}
                      </View>
                      <View style={styles.optInTextStack}>
                        <Text style={styles.optInTitle}>
                          Email me a thank-you note and product updates
                        </Text>
                        <Text style={styles.optInBody}>
                          Join the Canopy Trove list for launch notes, feature drops, and occasional
                          product updates. You can turn this off later in your profile.
                        </Text>
                      </View>
                    </Pressable>
                    {errorText ? (
                      <View
                        style={[styles.helperCard, styles.helperCardDanger]}
                        accessibilityLiveRegion="polite"
                        accessibilityRole="alert"
                      >
                        <Text style={[styles.helperTitle, styles.helperTitleDanger]}>
                          Create account issue
                        </Text>
                        <Text style={styles.helperBody}>{errorText}</Text>
                      </View>
                    ) : (
                      <View style={[styles.helperCard, styles.helperCardWarm]}>
                        <Text style={styles.helperTitle}>What this keeps</Text>
                        <Text style={styles.helperBody}>
                          A member account keeps your saved storefronts, review activity, and
                          profile context attached to one sign-in.
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
                <View style={styles.ctaPanel}>
                  <Pressable
                    disabled={isSubmitting || !canSubmit}
                    onPress={() => {
                      void handleSubmit();
                    }}
                    style={[
                      styles.primaryButton,
                      (isSubmitting || !canSubmit) && styles.buttonDisabled,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Create account"
                    accessibilityHint="Submits the account information to create a new member account."
                  >
                    <Text style={styles.primaryButtonText}>
                      {isSubmitting ? 'Creating Account...' : 'Create Account'}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => navigation.navigate('CanopyTroveSignIn')}
                    style={styles.secondaryButton}
                    accessibilityRole="button"
                    accessibilityLabel="Already have an account"
                    accessibilityHint="Opens the sign in screen for existing members."
                  >
                    <Text style={styles.secondaryButtonText}>Already Have an Account</Text>
                  </Pressable>
                </View>
              </View>
            </SectionCard>
          </MotionInView>
        </View>
      </KeyboardAvoidingView>
    </ScreenShell>
  );
}

export const CanopyTroveSignUpScreen = withScreenErrorBoundary(
  CanopyTroveSignUpScreenInner,
  'canopy-trove-sign-up-screen',
);

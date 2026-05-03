import { colors } from '../theme/tokens';
import React from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MotionInView } from '../components/MotionInView';
import { ScreenShell } from '../components/ScreenShell';
import { SectionCard } from '../components/SectionCard';
import { withScreenErrorBoundary } from '../components/withScreenErrorBoundary';
import { AppUiIcon } from '../icons/AppUiIcon';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { trackAnalyticsEvent } from '../services/analyticsService';
import {
  mapFirebaseAuthError,
  type FirebaseAuthErrorRecoveryAction,
} from '../services/firebaseAuthErrorMapper';
import { signUpOwnerPortalAccount } from '../services/ownerPortalService';
import { OwnerPortalHeroPanel } from './ownerPortal/OwnerPortalHeroPanel';
import { ownerPortalStyles as styles } from './ownerPortal/ownerPortalStyles';

const SIGN_UP_STEPS = ['Access', 'Create Account', 'Business Details', 'Claim Listing'];

function OwnerPortalSignUpScreenInner() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [displayName, setDisplayName] = React.useState('');
  const [legalName, setLegalName] = React.useState('');
  const [companyName, setCompanyName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorText, setErrorText] = React.useState<string | null>(null);
  // Track recovery action separately so the screen can offer a
  // concrete next step (e.g. "Sign in instead" with the email
  // pre-filled when the email is already registered). Cleared on every
  // new submit attempt.
  const [errorRecovery, setErrorRecovery] = React.useState<FirebaseAuthErrorRecoveryAction | null>(
    null,
  );
  // Synchronous in-flight guard. The previous version only checked
  // `isSubmitting` (a useState value), which is async — between a tap
  // firing handleSubmit and the next render disabling the button, a
  // second tap can fire with isSubmitting still false in its closure.
  // The April 29 2026 forensic showed an owner clicking "Create Owner
  // Account" 3 times across 7 seconds, generating 3 signup_started
  // events with no signup_completed (silent error each time). The ref
  // closes that race AND keeps the analytics counts honest.
  const isSubmittingRef = React.useRef(false);
  const canSubmit =
    !isSubmitting &&
    Boolean(displayName.trim()) &&
    Boolean(legalName.trim()) &&
    Boolean(companyName.trim()) &&
    Boolean(email.trim()) &&
    password.length >= 8 &&
    confirmPassword.length >= 8;

  const handleSubmit = async () => {
    if (isSubmittingRef.current) {
      return;
    }

    if (password !== confirmPassword) {
      setErrorText('Passwords must match.');
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setErrorText(null);
    setErrorRecovery(null);
    try {
      const result = await signUpOwnerPortalAccount({
        displayName,
        legalName,
        companyName,
        email,
        password,
      });
      navigation.replace('OwnerPortalBusinessDetails', {
        ownerUid: result.authSession.uid!,
        initialLegalName: result.ownerProfile.legalName,
        initialCompanyName: result.ownerProfile.companyName,
        initialPhone: result.ownerProfile.phone ?? '',
      });
    } catch (error) {
      // Translate the raw Firebase error into a friendly message
      // with a concrete recovery action — the same fix applied to the
      // member signup screen on May 2 2026 after the platform-three-
      // reports audit found 43% signup completion. Owner signups had
      // an even worse failure mode: the raw error displayed and
      // analytics emitted no `signup_failed` event, so we couldn't
      // even see WHY owners were dropping off. April 29 forensic
      // confirmed at least one real prospective owner clicked Create
      // Owner Account 3 times before giving up.
      const friendly = mapFirebaseAuthError(error, email);
      setErrorText(friendly.message);
      setErrorRecovery(friendly.recoveryAction);

      // Emit a structured signup_failed event so the analytics
      // pipeline captures owner failures the same way it captures
      // customer failures. Without this, owner-side drop-off is
      // invisible to the funnel.
      trackAnalyticsEvent('signup_failed', {
        role: 'owner',
        source: 'owner_portal',
        errorCode: friendly.code,
      });
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  // Recovery affordance. For email-already-in-use we route to owner
  // sign-in with the email pre-filled; for wrong-password (which only
  // applies on signin, not here) we'd route to forgot-password. For
  // 'retry' and 'none' there's no nav — the friendly message itself
  // is the guidance.
  const handleRecoveryAction = React.useCallback(() => {
    if (!errorRecovery) return;
    if (errorRecovery.kind === 'try_signin') {
      navigation.replace('OwnerPortalSignIn', {
        prefilledEmail: errorRecovery.prefilledEmail,
      });
      return;
    }
    if (errorRecovery.kind === 'reset_password') {
      navigation.navigate('OwnerPortalForgotPassword');
      return;
    }
  }, [errorRecovery, navigation]);

  return (
    <ScreenShell
      eyebrow="Owner Portal"
      title="Create owner account"
      subtitle="Set up your business account, connect your storefront, and get ready to manage it in one place."
      headerPill="Business"
    >
      <MotionInView delay={70}>
        <OwnerPortalHeroPanel
          kicker="Business account"
          title="Create your owner account."
          body="Start here, then add your business details and connect your storefront."
          metrics={[
            {
              value: 'New',
              label: 'Account',
              body: '',
            },
            {
              value: '8+',
              label: 'Password',
              body: '',
            },
            {
              value: 'Step 1',
              label: 'Onboarding',
              body: '',
            },
          ]}
          steps={SIGN_UP_STEPS}
          activeStepIndex={1}
        />
      </MotionInView>

      <MotionInView delay={120}>
        <SectionCard title="Owner account">
          <View style={styles.sectionStack}>
            <View style={styles.plannerPanel}>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Display name</Text>
                <TextInput
                  value={displayName}
                  onChangeText={setDisplayName}
                  placeholder="Display name"
                  placeholderTextColor={colors.textSoft}
                  style={styles.inputPremium}
                  accessibilityLabel="Display name"
                  autoComplete="name"
                />
              </View>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Legal name</Text>
                <TextInput
                  value={legalName}
                  onChangeText={setLegalName}
                  placeholder="Legal name"
                  placeholderTextColor={colors.textSoft}
                  style={styles.inputPremium}
                  accessibilityLabel="Legal name"
                  autoComplete="name"
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
                  accessibilityLabel="Company name"
                  autoComplete="organization"
                />
              </View>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Business email</Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Email"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholderTextColor={colors.textSoft}
                  style={styles.inputPremium}
                  accessibilityLabel="Business email"
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
                  autoComplete="new-password"
                />
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
                  autoComplete="new-password"
                />
              </View>
              {errorText ? (
                <View accessibilityLiveRegion="polite" accessibilityRole="alert">
                  <Text style={styles.errorText}>{errorText}</Text>
                  {errorRecovery?.kind === 'try_signin' ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Sign in instead with this email"
                      onPress={handleRecoveryAction}
                      style={styles.primaryButton}
                    >
                      <Text style={styles.primaryButtonText}>Sign in instead</Text>
                    </Pressable>
                  ) : null}
                  {errorRecovery?.kind === 'reset_password' ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Reset your password"
                      onPress={handleRecoveryAction}
                      style={styles.primaryButton}
                    >
                      <Text style={styles.primaryButtonText}>Reset password</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
            </View>

            <View style={styles.ctaPanel}>
              <View style={styles.splitHeaderRow}>
                <View style={styles.splitHeaderCopy}>
                  <Text style={styles.sectionEyebrow}>Create account</Text>
                  <Text style={styles.splitHeaderTitle}>Start your business setup</Text>
                </View>
                <AppUiIcon name="person-add-outline" size={20} color="#F5C86A" />
              </View>
              <Pressable
                disabled={!canSubmit}
                onPress={() => {
                  void handleSubmit();
                }}
                style={[styles.primaryButton, !canSubmit && styles.buttonDisabled]}
              >
                <Text style={styles.primaryButtonText}>
                  {isSubmitting ? 'Creating Account...' : 'Create Owner Account'}
                </Text>
              </Pressable>
            </View>
          </View>
        </SectionCard>
      </MotionInView>
    </ScreenShell>
  );
}

export const OwnerPortalSignUpScreen = withScreenErrorBoundary(
  OwnerPortalSignUpScreenInner,
  'owner-portal-sign-up',
);

import React from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MotionInView } from '../components/MotionInView';
import { ScreenShell } from '../components/ScreenShell';
import { SectionCard } from '../components/SectionCard';
import { withScreenErrorBoundary } from '../components/withScreenErrorBoundary';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { colors } from '../theme/tokens';
import { trackAnalyticsEvent } from '../services/analyticsService';
import {
  signInCanopyTroveEmailPassword,
  getCanopyTroveAuthIdTokenResult,
} from '../services/canopyTroveAuthService';
import { customerEntryStyles as styles } from './customerEntry/customerEntryStyles';

const SIGN_IN_TIMEOUT_MS = 30_000;

function withSignInTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(
        new Error('Sign-in is taking longer than expected. Check your connection and try again.'),
      );
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      });
  });
}

function getOwnerSessionRole(claims: Record<string, unknown> | undefined): string {
  if (claims?.admin === true || claims?.role === 'admin') {
    return 'admin';
  }
  if (claims?.role === 'owner') {
    return 'owner';
  }
  return 'member';
}

function OwnerSignInScreenInner() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorText, setErrorText] = React.useState<string | null>(null);
  const canSubmit = email.trim().length > 0 && password.length > 0;

  const handleSubmit = async () => {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setErrorText(null);
    try {
      const authSession = await withSignInTimeout(
        signInCanopyTroveEmailPassword(email, password),
        SIGN_IN_TIMEOUT_MS,
      );
      if (!authSession?.uid) {
        throw new Error('Unable to sign in.');
      }

      // Check if user has owner role
      const tokenResult = await getCanopyTroveAuthIdTokenResult();
      const sessionRole = getOwnerSessionRole(tokenResult?.claims);

      if (sessionRole !== 'owner' && sessionRole !== 'admin') {
        trackAnalyticsEvent('auth_owner_role_denied', {
          email: email.toLowerCase(),
        });
        setErrorText(
          'This email is not linked to an owner account. Please check your email or contact support.',
        );
        return;
      }

      trackAnalyticsEvent('signin', {
        role: 'owner',
        source: 'owner_signin_screen',
      });
      navigation.replace('OwnerPortalHome');
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : 'Unable to sign in.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    navigation.replace('WelcomeModePicker');
  };

  return (
    <ScreenShell
      eyebrow="Operator sign-in"
      title="Welcome back, operator."
      subtitle="Manage your verified storefront and team."
      headerPill="Business"
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        enabled={Platform.OS === 'ios'}
        keyboardVerticalOffset={24}
      >
        <View style={styles.sectionStack}>
          <MotionInView delay={140}>
            <SectionCard
              title="Sign in"
              body="Use your business email and password to access the owner portal."
            >
              <View style={styles.sectionStack}>
                <View style={styles.plannerPanel}>
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
                        accessibilityHint="Enter your business account email address."
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
                        accessibilityHint="Enter your business account password."
                        autoComplete="current-password"
                      />
                      <Text style={styles.fieldHint}>
                        Use your business email linked to your owner account.
                      </Text>
                    </View>
                    {errorText ? (
                      <View
                        style={[styles.helperCard, styles.helperCardDanger]}
                        accessibilityLiveRegion="polite"
                        accessibilityRole="alert"
                      >
                        <Text style={[styles.helperTitle, styles.helperTitleDanger]}>
                          Could not sign you in
                        </Text>
                        <Text style={styles.helperBody}>{errorText}</Text>
                      </View>
                    ) : null}
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
                    accessibilityLabel="Sign in"
                    accessibilityHint="Submits your email and password to sign in to your owner account."
                  >
                    <Text style={styles.primaryButtonText}>
                      {isSubmitting ? 'Signing In...' : 'Sign In'}
                    </Text>
                  </Pressable>
                  <View style={styles.buttonRow}>
                    <Pressable
                      onPress={() => navigation.navigate('OwnerPortalForgotPassword')}
                      style={[styles.secondaryButton, styles.buttonFlex]}
                      accessibilityRole="button"
                      accessibilityLabel="Forgot password"
                      accessibilityHint="Opens the password reset flow."
                    >
                      <Text style={styles.secondaryButtonText}>Forgot Password</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => navigation.navigate('OwnerPortalSignUp')}
                      style={[styles.secondaryButton, styles.buttonFlex]}
                      accessibilityRole="button"
                      accessibilityLabel="Create account"
                      accessibilityHint="Opens the account creation flow."
                    >
                      <Text style={styles.secondaryButtonText}>Create Account</Text>
                    </Pressable>
                  </View>
                  <Pressable
                    onPress={handleBack}
                    style={styles.secondaryButton}
                    accessibilityRole="button"
                    accessibilityLabel="Back to mode picker"
                    accessibilityHint="Returns to the sign-in mode selection screen."
                  >
                    <Text style={styles.secondaryButtonText}>Back</Text>
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

export const OwnerSignInScreen = withScreenErrorBoundary(
  OwnerSignInScreenInner,
  'owner-sign-in-screen',
);

import React from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MotionInView } from '../components/MotionInView';
import { ScreenShell } from '../components/ScreenShell';
import { SectionCard } from '../components/SectionCard';
import { withScreenErrorBoundary } from '../components/withScreenErrorBoundary';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { colors } from '../theme/tokens';
import { trackAnalyticsEvent } from '../services/analyticsService';
import { signInCanopyTroveEmailPassword } from '../services/canopyTroveAuthService';
import { customerEntryStyles as styles } from './customerEntry/customerEntryStyles';

const SIGN_IN_TIMEOUT_MS = 30_000;

type MemberSignInScreenProps = NativeStackScreenProps<RootStackParamList, 'MemberSignIn'>;

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

function MemberSignInScreenInner({ navigation, route }: MemberSignInScreenProps) {
  const redirectTo = route.params?.redirectTo;
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorText, setErrorText] = React.useState<string | null>(null);
  const canSubmit = email.trim().length > 0 && password.length > 0;

  const handlePostSignIn = React.useCallback(() => {
    if (redirectTo?.kind === 'goBack') {
      if (navigation.canGoBack()) {
        navigation.goBack();
        return;
      }
      navigation.replace('Tabs', { screen: 'Profile' });
      return;
    }

    if (redirectTo?.kind === 'navigate') {
      if (redirectTo.screen === 'RateProductPicker') {
        navigation.replace('RateProductPicker');
        return;
      }

      navigation.replace('ProductReviewComposer', redirectTo.params);
      return;
    }

    navigation.replace('Tabs', { screen: 'Profile' });
  }, [navigation, redirectTo]);

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

      trackAnalyticsEvent('signin', {
        role: 'customer',
        source: 'member_signin_screen',
      });
      handlePostSignIn();
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : 'Unable to sign in.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    if (redirectTo && navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.replace('WelcomeModePicker');
  };

  return (
    <ScreenShell
      eyebrow="Member sign-in"
      title="Welcome back, explorer."
      subtitle="Sign in to save favorites, scan products, and earn badges."
      headerPill="Member"
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        enabled={Platform.OS === 'ios'}
        keyboardVerticalOffset={24}
      >
        <View style={styles.sectionStack}>
          <MotionInView delay={140}>
            <SectionCard title="Sign in" body="Use your Canopy Trove member email and password.">
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
                        accessibilityHint="Enter your member account email address."
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
                        accessibilityHint="Enter your member account password."
                        autoComplete="current-password"
                      />
                      <Text style={styles.fieldHint}>
                        Use the same member email you use for saved storefronts and reviews.
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
                    accessibilityHint="Submits your email and password to sign in to your member account."
                  >
                    <Text style={styles.primaryButtonText}>
                      {isSubmitting ? 'Signing In...' : 'Sign In'}
                    </Text>
                  </Pressable>
                  <View style={styles.buttonRow}>
                    <Pressable
                      onPress={() => navigation.navigate('CanopyTroveForgotPassword')}
                      style={[styles.secondaryButton, styles.buttonFlex]}
                      accessibilityRole="button"
                      accessibilityLabel="Forgot password"
                      accessibilityHint="Opens the password reset flow."
                    >
                      <Text style={styles.secondaryButtonText}>Forgot Password</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => navigation.navigate('CanopyTroveSignUp')}
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
                    accessibilityLabel="Back"
                    accessibilityHint="Returns to the previous screen."
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

export const MemberSignInScreen = withScreenErrorBoundary(
  MemberSignInScreenInner,
  'member-sign-in',
);
            
import React from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MotionInView } from '../components/MotionInView';
import { ScreenShell } from '../components/ScreenShell';
import { SectionCard } from '../components/SectionCard';
import { withScreenErrorBoundary } from '../components/withScreenErrorBoundary';
import { ownerPortalAccessAvailable } from '../config/ownerPortalConfig';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { colors } from '../theme/tokens';
import { trackAnalyticsEvent } from '../services/analyticsService';
import { signInCanopyTroveEmailPassword } from '../services/canopyTroveAuthService';
import { customerEntryStyles as styles } from './customerEntry/customerEntryStyles';

function CanopyTroveSignInScreenInner() {
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
      const authSession = await signInCanopyTroveEmailPassword(email, password);
      if (!authSession?.uid) {
        throw new Error('Unable to sign in.');
      }

      trackAnalyticsEvent('signin', {
        role: 'customer',
        source: 'profile',
      });
      navigation.replace('Tabs', { screen: 'Profile' });
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : 'Unable to sign in.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScreenShell
      eyebrow="Member access"
      title="Welcome back."
      subtitle="Sign in to restore saved storefronts, review history, and your Canopy Trove account context."
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
              <Text style={styles.heroTitle}>Return to your storefront list.</Text>
              <Text style={styles.heroBody}>
                Member sign in restores favorites, review history, and profile context across
                devices.
              </Text>
              <View style={styles.summaryStrip}>
                <View style={styles.summaryTile}>
                  <Text style={styles.summaryTileValue}>Restore</Text>
                  <Text style={styles.summaryTileLabel}>Saved storefronts</Text>
                  <Text style={styles.summaryTileBody}>
                    Restore your storefront lists and follow-up browsing.
                  </Text>
                </View>
                <View style={styles.summaryTile}>
                  <Text style={styles.summaryTileValue}>Review</Text>
                  <Text style={styles.summaryTileLabel}>History</Text>
                  <Text style={styles.summaryTileBody}>
                    Bring back your review history and customer contribution record.
                  </Text>
                </View>
                <View style={styles.summaryTile}>
                  <Text style={styles.summaryTileValue}>Keep</Text>
                  <Text style={styles.summaryTileLabel}>Profile context</Text>
                  <Text style={styles.summaryTileBody}>
                    Bring back your member profile, saved context, and account state.
                  </Text>
                </View>
              </View>
              <View style={styles.trustRow}>
                <View style={styles.trustChip}>
                  <Text style={styles.trustChipText}>Secure email sign-in</Text>
                </View>
                <View style={[styles.trustChip, styles.trustChipWarm]}>
                  <Text style={styles.trustChipText}>Owners use a separate portal</Text>
                </View>
              </View>
            </View>
          </MotionInView>
          <MotionInView delay={140}>
            <SectionCard
              title="Sign in"
              body="Use your Canopy Trove member email and password. Owner access stays in the separate owner portal."
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
                    ) : (
                      <View style={[styles.helperCard, styles.helperCardWarm]}>
                        <Text style={styles.helperTitle}>Customer account only</Text>
                        <Text style={styles.helperBody}>
                          This sign-in is only for Canopy Trove member accounts. Dispensary owners
                          should use the owner portal flow.
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
                  {ownerPortalAccessAvailable ? (
                    <Pressable
                      onPress={() => navigation.replace('OwnerPortalSignIn')}
                      style={styles.secondaryButton}
                      accessibilityRole="button"
                      accessibilityLabel="Use owner portal"
                      accessibilityHint="Opens the owner sign in screen instead of the member account flow."
                    >
                      <Text style={styles.secondaryButtonText}>Use Owner Portal Instead</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            </SectionCard>
          </MotionInView>
        </View>
      </KeyboardAvoidingView>
    </ScreenShell>
  );
}

export const CanopyTroveSignInScreen = withScreenErrorBoundary(
  CanopyTroveSignInScreenInner,
  'canopy-trove-sign-in-screen',
);

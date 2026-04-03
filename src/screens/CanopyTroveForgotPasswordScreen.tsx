import React from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MotionInView } from '../components/MotionInView';
import { ScreenShell } from '../components/ScreenShell';
import { SectionCard } from '../components/SectionCard';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { trackAnalyticsEvent } from '../services/analyticsService';
import { sendCanopyTrovePasswordReset } from '../services/canopyTroveAuthService';
import { customerEntryStyles as styles } from './customerEntry/customerEntryStyles';

export function CanopyTroveForgotPasswordScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [email, setEmail] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorText, setErrorText] = React.useState<string | null>(null);
  const [successText, setSuccessText] = React.useState<string | null>(null);
  const canSubmit = email.trim().length > 0;

  const handleSubmit = async () => {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setErrorText(null);
    setSuccessText(null);
    try {
      await sendCanopyTrovePasswordReset(email);
      trackAnalyticsEvent('password_reset_requested', {
        role: 'customer',
        source: 'profile',
      });
      setSuccessText('Password reset email sent.');
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : 'Unable to send reset email.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScreenShell
      eyebrow="Member access"
      title="Reset your member password."
      subtitle="Send a recovery email for the Canopy Trove member account tied to this address."
      headerPill="Member"
    >
      <MotionInView delay={90}>
        <View style={styles.heroCard}>
          <View style={styles.heroGlow} />
          <Text style={styles.heroKicker}>Account recovery</Text>
          <Text style={styles.heroTitle}>Recover your member sign-in.</Text>
          <Text style={styles.heroBody}>
            Use the email tied to your Canopy Trove member profile and we will send the reset link
            there.
          </Text>
          <View style={styles.summaryStrip}>
            <View style={styles.summaryTile}>
              <Text style={styles.summaryTileValue}>Send</Text>
              <Text style={styles.summaryTileLabel}>Recovery email</Text>
              <Text style={styles.summaryTileBody}>
                Start the reset flow from the inbox tied to your member profile.
              </Text>
            </View>
            <View style={styles.summaryTile}>
              <Text style={styles.summaryTileValue}>Return</Text>
              <Text style={styles.summaryTileLabel}>Sign-in flow</Text>
              <Text style={styles.summaryTileBody}>
                Use the new password to continue back into your member account.
              </Text>
            </View>
          </View>
          <View style={styles.trustRow}>
            <View style={styles.trustChip}>
              <Text style={styles.trustChipText}>Member account recovery</Text>
            </View>
            <View style={[styles.trustChip, styles.trustChipWarm]}>
              <Text style={styles.trustChipText}>Owner recovery is separate</Text>
            </View>
          </View>
        </View>
      </MotionInView>
      <MotionInView delay={140}>
        <SectionCard
          title="Forgot password"
          body="Use this only for the consumer member account flow. Owner access resets inside the owner portal."
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
                    placeholderTextColor="#738680"
                    style={styles.inputPremium}
                    accessibilityLabel="Email"
                    accessibilityHint="Enter the email address associated with your member account."
                  />
                  <Text style={styles.fieldHint}>
                    We will send the reset email to the address tied to your member sign-in.
                  </Text>
                </View>
                {errorText ? (
                  <View style={[styles.helperCard, styles.helperCardDanger]}>
                    <Text style={[styles.helperTitle, styles.helperTitleDanger]}>
                      Reset email failed
                    </Text>
                    <Text style={styles.helperBody}>{errorText}</Text>
                  </View>
                ) : null}
                {successText ? (
                  <View style={[styles.helperCard, styles.helperCardSuccess]}>
                    <Text style={[styles.helperTitle, styles.helperTitleSuccess]}>
                      Reset email sent
                    </Text>
                    <Text style={styles.helperBody}>{successText}</Text>
                  </View>
                ) : null}
                {!errorText && !successText ? (
                  <View style={[styles.helperCard, styles.helperCardWarm]}>
                    <Text style={styles.helperTitle}>Check the same inbox</Text>
                    <Text style={styles.helperBody}>
                      If the address exists for a member account, the reset email should arrive
                      there shortly.
                    </Text>
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
                accessibilityLabel="Send reset email"
                accessibilityHint="Sends a password reset email to your member account email address."
              >
                <Text style={styles.primaryButtonText}>
                  {isSubmitting ? 'Sending...' : 'Send Reset Email'}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => navigation.navigate('CanopyTroveSignIn')}
                style={styles.secondaryButton}
                accessibilityRole="button"
                accessibilityLabel="Back to sign in"
                accessibilityHint="Returns to the sign in screen."
              >
                <Text style={styles.secondaryButtonText}>Back to Sign In</Text>
              </Pressable>
            </View>
          </View>
        </SectionCard>
      </MotionInView>
    </ScreenShell>
  );
}

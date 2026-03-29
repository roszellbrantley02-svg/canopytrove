import React from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MotionInView } from '../components/MotionInView';
import { ScreenShell } from '../components/ScreenShell';
import { SectionCard } from '../components/SectionCard';
import { sendOwnerPortalPasswordReset } from '../services/ownerPortalService';
import { ownerPortalStyles as styles } from './ownerPortal/ownerPortalStyles';

export function OwnerPortalForgotPasswordScreen() {
  const [email, setEmail] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorText, setErrorText] = React.useState<string | null>(null);
  const [successText, setSuccessText] = React.useState<string | null>(null);
  const canSubmit = !isSubmitting && Boolean(email.trim());

  const handleSubmit = async () => {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setErrorText(null);
    setSuccessText(null);
    try {
      await sendOwnerPortalPasswordReset(email);
      setSuccessText('Password reset email sent.');
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : 'Unable to send password reset email.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScreenShell
      eyebrow="Owner Portal"
      title="Reset password."
      subtitle="We will send a secure reset link so you can get back into your owner workspace."
      headerPill="Owner"
    >
      <MotionInView delay={70}>
        <View style={styles.portalHeroCard}>
          <View style={styles.portalHeroGlow} />
          <Text style={styles.portalHeroKicker}>Owner recovery</Text>
          <Text style={styles.portalHeroTitle}>
            Recover account access with a calmer premium password-reset flow.
          </Text>
          <Text style={styles.portalHeroBody}>
            Use the business email connected to the owner account. The reset link returns you to
            the sign-in path without changing any owner onboarding or workspace state.
          </Text>
          <View style={styles.summaryStrip}>
            <View style={styles.summaryTile}>
              <Text style={styles.summaryTileValue}>Secure</Text>
              <Text style={styles.summaryTileLabel}>Reset path</Text>
              <Text style={styles.summaryTileBody}>
                A reset email is sent to the account’s approved business inbox.
              </Text>
            </View>
            <View style={styles.summaryTile}>
              <Text style={styles.summaryTileValue}>No data loss</Text>
              <Text style={styles.summaryTileLabel}>Workspace state</Text>
              <Text style={styles.summaryTileBody}>
                Password reset does not alter storefront claim or verification progress.
              </Text>
            </View>
          </View>
        </View>
      </MotionInView>

      <MotionInView delay={120}>
        <SectionCard
          title="Password reset"
          body="Enter the business email connected to your owner account."
        >
          <View style={styles.sectionStack}>
            <View style={styles.plannerPanel}>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Business email</Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Email"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholderTextColor="#738680"
                  style={styles.inputPremium}
                />
              </View>
              {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}
              {successText ? (
                <View style={[styles.onboardingInfoCard, styles.onboardingInfoCardSuccess]}>
                  <Text style={styles.splitHeaderTitle}>Reset email sent</Text>
                  <Text style={styles.splitHeaderBody}>{successText}</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.ctaPanel}>
              <View style={styles.splitHeaderRow}>
                <View style={styles.splitHeaderCopy}>
                  <Text style={styles.sectionEyebrow}>Recovery action</Text>
                  <Text style={styles.splitHeaderTitle}>Send secure reset link</Text>
                  <Text style={styles.splitHeaderBody}>
                    If the email matches an owner account, the reset message is sent so the
                    sign-in path can be recovered quickly.
                  </Text>
                </View>
                <Ionicons name="mail-open-outline" size={20} color="#F5C86A" />
              </View>
              <Pressable
                disabled={!canSubmit}
                onPress={() => {
                  void handleSubmit();
                }}
                style={[styles.primaryButton, !canSubmit && styles.buttonDisabled]}
              >
                <Text style={styles.primaryButtonText}>
                  {isSubmitting ? 'Sending...' : 'Send Reset Email'}
                </Text>
              </Pressable>
            </View>
          </View>
        </SectionCard>
      </MotionInView>
    </ScreenShell>
  );
}

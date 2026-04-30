import { colors } from '../theme/tokens';
import React from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { MotionInView } from '../components/MotionInView';
import { ScreenShell } from '../components/ScreenShell';
import { SectionCard } from '../components/SectionCard';
import { withScreenErrorBoundary } from '../components/withScreenErrorBoundary';
import { sendOwnerPortalPasswordReset } from '../services/ownerPortalService';
import { AppUiIcon } from '../icons/AppUiIcon';
import { OwnerPortalHeroPanel } from './ownerPortal/OwnerPortalHeroPanel';
import { ownerPortalStyles as styles } from './ownerPortal/ownerPortalStyles';

function OwnerPortalForgotPasswordScreenInner() {
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
      title="Reset owner password."
      subtitle="We will send a secure reset link so you can get back into your business account."
      headerPill="Owner"
    >
      <MotionInView delay={70}>
        <OwnerPortalHeroPanel
          kicker="Owner recovery"
          title="Recover owner access."
          body="We'll send a reset link to your business email."
          metrics={[
            {
              value: 'Secure',
              label: 'Reset path',
              body: '',
            },
            {
              value: 'No data loss',
              label: 'Your account',
              body: '',
            },
          ]}
        />
      </MotionInView>

      <MotionInView delay={120}>
        <SectionCard title="Password reset">
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
                  placeholderTextColor={colors.textSoft}
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
                </View>
                <AppUiIcon name="mail-open-outline" size={20} color="#F5C86A" />
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

export const OwnerPortalForgotPasswordScreen = withScreenErrorBoundary(
  OwnerPortalForgotPasswordScreenInner,
  'owner-portal-forgot-password',
);

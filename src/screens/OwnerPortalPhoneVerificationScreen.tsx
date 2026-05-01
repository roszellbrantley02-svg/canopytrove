import { colors } from '../theme/tokens';
import React from 'react';
import { Linking, Pressable, Text, TextInput, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MotionInView } from '../components/MotionInView';
import { ScreenShell } from '../components/ScreenShell';
import { SectionCard } from '../components/SectionCard';
import { withScreenErrorBoundary } from '../components/withScreenErrorBoundary';
import { AppUiIcon } from '../icons/AppUiIcon';
import type { RootStackParamList } from '../navigation/RootNavigator';
import {
  confirmOwnerPhoneVerificationCode,
  isOwnerPhoneVerificationError,
  sendOwnerPhoneVerificationCode,
} from '../services/ownerPortalPhoneVerificationService';
import { OwnerPortalHeroPanel } from './ownerPortal/OwnerPortalHeroPanel';
import { ownerPortalStyles as styles } from './ownerPortal/ownerPortalStyles';

const ONBOARDING_STEPS = ['Account', 'Verify Phone', 'Business Details', 'Verification'];
const SUPPORT_EMAIL = 'askmehere@canopytrove.com';

type PhoneVerificationRoute = RouteProp<RootStackParamList, 'OwnerPortalPhoneVerification'>;

type Stage = 'enter_phone' | 'enter_code';

function OwnerPortalPhoneVerificationScreenInner() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<PhoneVerificationRoute>();
  const nextRoute = route.params?.nextRoute ?? null;

  const [stage, setStage] = React.useState<Stage>('enter_phone');
  const [phone, setPhone] = React.useState('');
  const [code, setCode] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorText, setErrorText] = React.useState<string | null>(null);
  const [verifiedPhoneE164, setVerifiedPhoneE164] = React.useState<string | null>(null);

  const canSendCode = !isSubmitting && phone.trim().length >= 10;
  const canConfirmCode = !isSubmitting && code.trim().length >= 4;

  const handleSendCode = async () => {
    if (!canSendCode) return;
    setIsSubmitting(true);
    setErrorText(null);
    try {
      const result = await sendOwnerPhoneVerificationCode(phone);
      setVerifiedPhoneE164(result.phoneE164);
      setStage('enter_code');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to send verification code.';
      setErrorText(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmCode = async () => {
    if (!canConfirmCode) return;
    setIsSubmitting(true);
    setErrorText(null);
    try {
      await confirmOwnerPhoneVerificationCode(verifiedPhoneE164 ?? phone, code);
      // Successfully verified — continue to next step
      if (nextRoute === 'OwnerPortalBusinessDetails') {
        navigation.replace('OwnerPortalBusinessDetails', {});
      } else if (nextRoute === 'OwnerPortalBusinessVerification') {
        navigation.replace('OwnerPortalBusinessVerification', {});
      } else if (nextRoute === 'OwnerPortalIdentityVerification') {
        navigation.replace('OwnerPortalIdentityVerification', {});
      } else if (nextRoute === 'OwnerPortalHome') {
        navigation.replace('OwnerPortalHome');
      } else if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.replace('OwnerPortalHome');
      }
    } catch (error) {
      if (isOwnerPhoneVerificationError(error) && error.code === 'invalid_verification_code') {
        setErrorText('That code is incorrect or expired. Tap "Resend code" to get a new one.');
      } else {
        setErrorText(error instanceof Error ? error.message : 'Unable to verify the code.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendCode = async () => {
    setStage('enter_phone');
    setCode('');
    setErrorText(null);
  };

  const handleEmailSupport = () => {
    void Linking.canOpenURL(`mailto:${SUPPORT_EMAIL}`).then((canOpen) => {
      if (canOpen) {
        void Linking.openURL(
          `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Owner phone verification trouble')}`,
        );
      }
    });
  };

  return (
    <ScreenShell
      eyebrow="Owner Portal"
      title="Verify your phone"
      subtitle="We use this to confirm your account, send security alerts, and protect your dispensary listing from unauthorized claims."
      headerPill="Onboarding"
    >
      <MotionInView delay={70}>
        <OwnerPortalHeroPanel
          kicker="Step 2 of 4"
          title="Verify the phone number on your account."
          body="Takes about 30 seconds. We'll text you a 6-digit code."
          metrics={[
            { value: 'SMS', label: 'Delivery', body: '' },
            { value: '~30 sec', label: 'Total time', body: '' },
            { value: 'Required', label: 'Status', body: '' },
          ]}
          steps={ONBOARDING_STEPS}
          activeStepIndex={1}
        />
      </MotionInView>

      <MotionInView delay={120}>
        <SectionCard
          title={stage === 'enter_phone' ? 'Phone number' : 'Enter the code'}
          body={
            stage === 'enter_phone'
              ? 'US mobile numbers preferred. Landlines may not receive SMS.'
              : verifiedPhoneE164
                ? `We sent a code to ${verifiedPhoneE164}.`
                : 'Check your messages.'
          }
        >
          <View style={styles.sectionStack}>
            {stage === 'enter_phone' ? (
              <View style={styles.plannerPanel}>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Phone</Text>
                  <TextInput
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="+1 555 555 1234"
                    keyboardType="phone-pad"
                    autoCapitalize="none"
                    placeholderTextColor={colors.textSoft}
                    style={styles.inputPremium}
                    accessibilityLabel="Phone number"
                    autoComplete="tel"
                  />
                </View>
                {errorText ? (
                  <Text
                    style={styles.errorText}
                    accessibilityLiveRegion="polite"
                    accessibilityRole="alert"
                  >
                    {errorText}
                  </Text>
                ) : null}
                <Pressable
                  disabled={!canSendCode}
                  onPress={() => {
                    void handleSendCode();
                  }}
                  style={[styles.primaryButton, !canSendCode && styles.buttonDisabled]}
                >
                  <Text style={styles.primaryButtonText}>
                    {isSubmitting ? 'Sending...' : 'Send Code'}
                  </Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.plannerPanel}>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>6-digit code</Text>
                  <TextInput
                    value={code}
                    onChangeText={setCode}
                    placeholder="123456"
                    keyboardType="number-pad"
                    placeholderTextColor={colors.textSoft}
                    style={styles.inputPremium}
                    accessibilityLabel="Verification code"
                    autoComplete="one-time-code"
                    maxLength={10}
                  />
                </View>
                {errorText ? (
                  <Text
                    style={styles.errorText}
                    accessibilityLiveRegion="polite"
                    accessibilityRole="alert"
                  >
                    {errorText}
                  </Text>
                ) : null}
                <Pressable
                  disabled={!canConfirmCode}
                  onPress={() => {
                    void handleConfirmCode();
                  }}
                  style={[styles.primaryButton, !canConfirmCode && styles.buttonDisabled]}
                >
                  <Text style={styles.primaryButtonText}>
                    {isSubmitting ? 'Verifying...' : 'Verify'}
                  </Text>
                </Pressable>
                <Pressable onPress={handleResendCode} style={styles.secondaryButton}>
                  <Text style={styles.secondaryButtonText}>Resend code</Text>
                </Pressable>
              </View>
            )}
          </View>
        </SectionCard>
      </MotionInView>

      <MotionInView delay={180}>
        <SectionCard
          title="Trouble verifying?"
          body="If you can't receive the code or your number isn't accepted, email support."
        >
          <View style={styles.ctaPanel}>
            <View style={styles.splitHeaderRow}>
              <View style={styles.splitHeaderCopy}>
                <Text style={styles.sectionEyebrow}>Manual help</Text>
                <Text style={styles.splitHeaderTitle}>{SUPPORT_EMAIL}</Text>
              </View>
              <AppUiIcon name="mail-open-outline" size={20} color="#F5C86A" />
            </View>
            <Pressable onPress={handleEmailSupport} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Email Support</Text>
            </Pressable>
          </View>
        </SectionCard>
      </MotionInView>
    </ScreenShell>
  );
}

export const OwnerPortalPhoneVerificationScreen = withScreenErrorBoundary(
  OwnerPortalPhoneVerificationScreenInner,
  'owner-portal-phone-verification',
);

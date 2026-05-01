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
  confirmShopVerificationCode,
  isOwnerShopVerificationError,
  sendShopVerificationCode,
} from '../services/ownerPortalShopVerificationService';
import { OwnerPortalHeroPanel } from './ownerPortal/OwnerPortalHeroPanel';
import { ownerPortalStyles as styles } from './ownerPortal/ownerPortalStyles';

const ONBOARDING_STEPS = [
  'Account',
  'Business Details',
  'Claim Listing',
  'Shop Verification',
  'Verification',
];
const SUPPORT_EMAIL = 'askmehere@canopytrove.com';

type ShopOwnershipRoute = RouteProp<RootStackParamList, 'OwnerPortalShopOwnershipVerification'>;

type Stage = 'intro' | 'enter_code' | 'unavailable';

function OwnerPortalShopOwnershipVerificationScreenInner() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<ShopOwnershipRoute>();
  const storefrontId = route.params?.storefrontId ?? '';
  const storefrontDisplayName = route.params?.storefrontDisplayName ?? null;

  const [stage, setStage] = React.useState<Stage>('intro');
  const [code, setCode] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorText, setErrorText] = React.useState<string | null>(null);
  const [shopName, setShopName] = React.useState<string | null>(storefrontDisplayName);
  const [phoneSuffix, setPhoneSuffix] = React.useState<string | null>(null);

  const canSendCode = !isSubmitting && Boolean(storefrontId);
  const canConfirmCode = !isSubmitting && code.trim().length >= 4;

  const handleSendCode = async () => {
    if (!canSendCode) return;
    setIsSubmitting(true);
    setErrorText(null);
    try {
      const result = await sendShopVerificationCode(storefrontId);
      setShopName(result.shopName);
      setPhoneSuffix(result.phoneSuffix);
      setStage('enter_code');
    } catch (error) {
      if (isOwnerShopVerificationError(error) && error.code === 'shop_phone_unavailable') {
        setStage('unavailable');
        setErrorText(error.message);
      } else {
        setErrorText(error instanceof Error ? error.message : 'Unable to send verification call.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmCode = async () => {
    if (!canConfirmCode) return;
    setIsSubmitting(true);
    setErrorText(null);
    try {
      await confirmShopVerificationCode(storefrontId, code);
      navigation.replace('OwnerPortalHome');
    } catch (error) {
      if (isOwnerShopVerificationError(error) && error.code === 'invalid_verification_code') {
        setErrorText('That code is incorrect or expired. Tap "Send another call" to try again.');
      } else {
        setErrorText(error instanceof Error ? error.message : 'Unable to verify the code.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendCode = async () => {
    setStage('intro');
    setCode('');
    setErrorText(null);
  };

  const handleSkip = () => {
    // Optional layer — owners who can't access the shop's published phone
    // (landlines, off-site management, multi-shop operators) can skip
    // straight to admin review. We've already filed the claim and fired
    // the out-of-band notification call when the claim was submitted.
    navigation.replace('OwnerPortalHome');
  };

  const handleEmailSupport = () => {
    void Linking.canOpenURL(`mailto:${SUPPORT_EMAIL}`).then((canOpen) => {
      if (canOpen) {
        void Linking.openURL(
          `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Shop ownership verification trouble')}`,
        );
      }
    });
  };

  const heroSubtitle = shopName
    ? `Confirm you control the published phone for ${shopName}. This is optional — claims are also reviewed by our team.`
    : 'Confirm you control the published phone for the storefront you claimed. This is optional — claims are also reviewed by our team.';

  return (
    <ScreenShell
      eyebrow="Owner Portal"
      title="Verify shop ownership"
      subtitle={heroSubtitle}
      headerPill="Optional"
    >
      <MotionInView delay={70}>
        <OwnerPortalHeroPanel
          kicker="Optional fast-path"
          title="Speed up review by verifying the shop's listed phone."
          body="We'll place a short voice call to the phone number on the storefront's public listing. Pick up and read back the code."
          metrics={[
            { value: 'Voice', label: 'Delivery', body: '' },
            { value: '~60 sec', label: 'Total time', body: '' },
            { value: 'Optional', label: 'Status', body: '' },
          ]}
          steps={ONBOARDING_STEPS}
          activeStepIndex={3}
        />
      </MotionInView>

      <MotionInView delay={120}>
        <SectionCard
          title={
            stage === 'intro'
              ? 'How fast-path verification works'
              : stage === 'enter_code'
                ? 'Enter the code from the call'
                : "Can't reach the shop phone"
          }
          body={
            stage === 'intro'
              ? "We'll call the storefront's published phone (the one shown in directory listings) and read out a 6-digit code."
              : stage === 'enter_code'
                ? phoneSuffix
                  ? `We just called the storefront line ending in ${phoneSuffix}. Enter the code our voice call read out.`
                  : 'Enter the code our voice call read out.'
                : "Looks like we can't reach the shop's published phone right now. You can still finish your claim — our team reviews every submission."
          }
        >
          <View style={styles.sectionStack}>
            {stage === 'intro' ? (
              <View style={styles.plannerPanel}>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>What happens next</Text>
                  <Text style={styles.fieldHint}>
                    1. Tap "Call shop now" — we place a short voice call to the published phone.
                    {'\n'}2. Pick up and listen for a 6-digit code.
                    {'\n'}3. Enter the code on the next screen.
                  </Text>
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
                    {isSubmitting ? 'Calling...' : 'Call Shop Now'}
                  </Text>
                </Pressable>
                <Pressable onPress={handleSkip} style={styles.secondaryButton}>
                  <Text style={styles.secondaryButtonText}>Skip and request manual review</Text>
                </Pressable>
              </View>
            ) : stage === 'enter_code' ? (
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
                    accessibilityLabel="Shop verification code"
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
                    {isSubmitting ? 'Verifying...' : 'Verify Shop Ownership'}
                  </Text>
                </Pressable>
                <Pressable onPress={handleResendCode} style={styles.secondaryButton}>
                  <Text style={styles.secondaryButtonText}>Send another call</Text>
                </Pressable>
                <Pressable onPress={handleSkip} style={styles.secondaryButton}>
                  <Text style={styles.secondaryButtonText}>Skip and request manual review</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.plannerPanel}>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Common reasons</Text>
                  <Text style={styles.fieldHint}>
                    The published number routes to a landline, an answering service, or off-site
                    management — or the listing has no phone on file. None of these block your
                    claim.
                  </Text>
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
                <Pressable onPress={handleSkip} style={styles.primaryButton}>
                  <Text style={styles.primaryButtonText}>Continue to manual review</Text>
                </Pressable>
                <Pressable onPress={handleEmailSupport} style={styles.secondaryButton}>
                  <Text style={styles.secondaryButtonText}>Email Support</Text>
                </Pressable>
              </View>
            )}
          </View>
        </SectionCard>
      </MotionInView>

      <MotionInView delay={180}>
        <SectionCard
          title="Trouble with the call?"
          body="If the shop phone doesn't ring, the code doesn't read clearly, or you don't have access to the line, email support."
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

export const OwnerPortalShopOwnershipVerificationScreen = withScreenErrorBoundary(
  OwnerPortalShopOwnershipVerificationScreenInner,
  'owner-portal-shop-ownership-verification',
);

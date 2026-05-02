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
import { ownerPortalBulkClaimQueueEnabled } from '../config/ownerPortalConfig';
import { OwnerPortalHeroPanel } from './ownerPortal/OwnerPortalHeroPanel';
import { SiblingLocationsHeroCard } from './ownerPortal/SiblingLocationsHeroCard';
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

// Stage flow:
//  - enter_code:  default — call has already fired automatically when the
//                 claim was submitted. Owner enters the 6-digit code they
//                 heard on the shop's phone.
//  - cooldown:    "Send another call" was tapped while still in the 30-min
//                 between-calls window. Live countdown until next call is
//                 allowed; user can keep entering the existing code.
//  - daily_limit: 3 calls per claim per 24h hit. No more calls today,
//                 admin review fallback only.
//  - unavailable: shop has no published phone or call couldn't reach it.
//                 Manual review fallback.
type Stage = 'enter_code' | 'cooldown' | 'daily_limit' | 'unavailable';

function formatCountdown(msRemaining: number): string {
  if (msRemaining <= 0) return '0:00';
  const totalSeconds = Math.ceil(msRemaining / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function OwnerPortalShopOwnershipVerificationScreenInner() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<ShopOwnershipRoute>();
  const storefrontId = route.params?.storefrontId ?? '';
  const storefrontDisplayName = route.params?.storefrontDisplayName ?? null;

  const [stage, setStage] = React.useState<Stage>('enter_code');
  const [code, setCode] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorText, setErrorText] = React.useState<string | null>(null);
  const [shopName, setShopName] = React.useState<string | null>(storefrontDisplayName);
  const [phoneSuffix, setPhoneSuffix] = React.useState<string | null>(null);
  const [callsRemainingToday, setCallsRemainingToday] = React.useState<number | null>(null);
  const [cooldownEndsAtMs, setCooldownEndsAtMs] = React.useState<number | null>(null);
  const [now, setNow] = React.useState<number>(() => Date.now());
  /**
   * Flips to true after the OTP confirms successfully. While true, the
   * sibling-locations hero card mounts and self-discovers OCM siblings.
   * If the flag is off OR the entity has no siblings, the card hides
   * itself silently.
   */
  const [didVerify, setDidVerify] = React.useState(false);

  const canConfirmCode = !isSubmitting && /^\d{6}$/.test(code.trim());

  // Live ticker for the countdown — only runs while we have an active
  // cooldown to display. One-second resolution is plenty for a 30-min
  // window and avoids unnecessary re-renders.
  React.useEffect(() => {
    if (cooldownEndsAtMs === null) return;
    const interval = setInterval(() => {
      const next = Date.now();
      setNow(next);
      if (next >= cooldownEndsAtMs) {
        // Cooldown elapsed — let user request another call again.
        setCooldownEndsAtMs(null);
        setStage('enter_code');
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldownEndsAtMs]);

  const handleSendAnotherCall = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setErrorText(null);
    try {
      const result = await sendShopVerificationCode(storefrontId);
      setShopName(result.shopName);
      setPhoneSuffix(result.phoneSuffix);
      setCallsRemainingToday(result.callsRemainingToday);
      setCooldownEndsAtMs(new Date(result.cooldownEndsAt).getTime());
      setStage('enter_code');
      setCode('');
    } catch (error) {
      if (!isOwnerShopVerificationError(error)) {
        setErrorText(error instanceof Error ? error.message : 'Unable to place the call.');
        setIsSubmitting(false);
        return;
      }
      if (error.code === 'cooldown_active') {
        const endsAtMs = error.cooldownEndsAt
          ? new Date(error.cooldownEndsAt).getTime()
          : Date.now() + 30 * 60_000;
        setCooldownEndsAtMs(endsAtMs);
        setStage('cooldown');
        setErrorText(error.message);
      } else if (error.code === 'daily_limit_reached') {
        setStage('daily_limit');
        setErrorText(error.message);
      } else if (error.code === 'shop_phone_unavailable') {
        setStage('unavailable');
        setErrorText(error.message);
      } else {
        setErrorText(error.message);
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
      await confirmShopVerificationCode(storefrontId, code.trim());
      // If bulk-claim queue is enabled, give the sibling-discovery card a
      // chance to mount before navigating away. The card self-hides when
      // the entity has no siblings, so the typical owner sees no extra
      // delay. When it does mount, owner gets the "Add N siblings" CTA
      // before continuing to the owner home.
      if (ownerPortalBulkClaimQueueEnabled) {
        setDidVerify(true);
        setIsSubmitting(false);
        return;
      }
      navigation.replace('OwnerPortalHome');
    } catch (error) {
      if (isOwnerShopVerificationError(error)) {
        if (error.code === 'invalid_verification_code') {
          setErrorText(
            'That code is incorrect. Double-check and try again, or tap "Send another call".',
          );
        } else if (error.code === 'code_expired') {
          setErrorText('That code has expired. Tap "Send another call" to receive a new one.');
        } else if (error.code === 'too_many_failed_attempts') {
          setErrorText(
            'Too many incorrect attempts on this code. Tap "Send another call" to receive a new one.',
          );
        } else {
          setErrorText(error.message);
        }
      } else {
        setErrorText(error instanceof Error ? error.message : 'Unable to verify the code.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => {
    // Optional layer — owners who can't access the shop's published phone
    // (landlines, off-site management, multi-shop operators) can skip
    // straight to admin review. The merged call already fired when the
    // claim was submitted, so the legitimate operator was alerted no
    // matter what.
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
    ? `We just called ${shopName}'s published phone with a 6-digit code. Enter the code below to confirm you control the shop.`
    : "We just called the storefront's published phone with a 6-digit code. Enter the code below to confirm you control the shop.";

  const cooldownMsRemaining = cooldownEndsAtMs ? Math.max(0, cooldownEndsAtMs - now) : 0;
  const cooldownLabel = cooldownEndsAtMs ? formatCountdown(cooldownMsRemaining) : '';
  const callsRemainingLabel =
    callsRemainingToday !== null
      ? `${callsRemainingToday} ${callsRemainingToday === 1 ? 'call' : 'calls'} remaining today`
      : '';

  return (
    <ScreenShell
      eyebrow="Owner Portal"
      title="Verify shop ownership"
      subtitle={heroSubtitle}
      headerPill="Verification"
    >
      <MotionInView delay={70}>
        <OwnerPortalHeroPanel
          kicker="Listen for the code"
          title="Answer the shop's phone and enter the code we read out."
          body="The call repeats your 6-digit code three times. Take your time — you can stay on the line while you type it in."
          metrics={[
            { value: 'Voice', label: 'Delivery', body: '' },
            { value: '~60 sec', label: 'Call length', body: '' },
            {
              value: callsRemainingToday !== null ? String(callsRemainingToday) : '3',
              label: 'Calls left today',
              body: '',
            },
          ]}
          steps={ONBOARDING_STEPS}
          activeStepIndex={3}
        />
      </MotionInView>

      <MotionInView delay={120}>
        <SectionCard
          title={
            stage === 'enter_code'
              ? 'Enter the 6-digit code'
              : stage === 'cooldown'
                ? 'Another call is on the way'
                : stage === 'daily_limit'
                  ? 'Maximum calls reached for today'
                  : "Can't reach the shop phone"
          }
          body={
            stage === 'enter_code'
              ? phoneSuffix
                ? `We called the storefront line ending in ${phoneSuffix}. Enter the 6-digit code our voice call read out.`
                : 'Enter the 6-digit code our voice call read out.'
              : stage === 'cooldown'
                ? "We can't call the same shop again right away — that would harass the line. Wait for the timer below, then try again."
                : stage === 'daily_limit'
                  ? "We've called this shop's phone the maximum number of times today. Email support so we can verify your ownership another way."
                  : "Looks like we can't reach the shop's published phone right now. You can still finish your claim — our team reviews every submission."
          }
        >
          <View style={styles.sectionStack}>
            {stage === 'enter_code' ? (
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
                    maxLength={6}
                  />
                  {callsRemainingLabel ? (
                    <Text style={styles.fieldHint}>{callsRemainingLabel}</Text>
                  ) : null}
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
                <Pressable
                  disabled={isSubmitting}
                  onPress={() => {
                    void handleSendAnotherCall();
                  }}
                  style={[styles.secondaryButton, isSubmitting && styles.buttonDisabled]}
                >
                  <Text style={styles.secondaryButtonText}>
                    {isSubmitting ? 'Calling...' : 'Send another call'}
                  </Text>
                </Pressable>
                <Pressable onPress={handleSkip} style={styles.secondaryButton}>
                  <Text style={styles.secondaryButtonText}>Skip and request manual review</Text>
                </Pressable>
              </View>
            ) : stage === 'cooldown' ? (
              <View style={styles.plannerPanel}>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>You can request another call in</Text>
                  <Text style={styles.portalHeroTitle}>{cooldownLabel}</Text>
                  <Text style={styles.fieldHint}>
                    The 6-digit code from the previous call is still valid. Try entering it below if
                    you have it.
                  </Text>
                </View>
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
                    maxLength={6}
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
                <Pressable onPress={handleSkip} style={styles.secondaryButton}>
                  <Text style={styles.secondaryButtonText}>Skip and request manual review</Text>
                </Pressable>
              </View>
            ) : stage === 'daily_limit' ? (
              <View style={styles.plannerPanel}>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>What to do next</Text>
                  <Text style={styles.fieldHint}>
                    Email askmehere@canopytrove.com and we will verify your ownership another way.
                    Most manual reviews finish within 24 hours.
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
                <Pressable onPress={handleEmailSupport} style={styles.primaryButton}>
                  <Text style={styles.primaryButtonText}>Email Support</Text>
                </Pressable>
                <Pressable onPress={handleSkip} style={styles.secondaryButton}>
                  <Text style={styles.secondaryButtonText}>Continue to manual review</Text>
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

      {didVerify && ownerPortalBulkClaimQueueEnabled ? (
        <MotionInView delay={150}>
          <SectionCard
            title="Looking for sibling locations"
            body="If the OCM legal entity behind this storefront also runs other licensed locations, you can add them in one tap below."
          >
            <SiblingLocationsHeroCard
              primaryDispensaryId={storefrontId}
              onBulkSubmissionComplete={() => {
                // Stay on the screen so owner sees the confirmation.
                // They can manually navigate to OwnerPortalHome from here
                // or use the listing-screen queue to verify each sibling.
              }}
            />
            <Pressable
              onPress={() => navigation.replace('OwnerPortalHome')}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>Continue to Owner Home</Text>
            </Pressable>
          </SectionCard>
        </MotionInView>
      ) : null}

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

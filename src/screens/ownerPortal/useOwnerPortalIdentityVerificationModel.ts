import React from 'react';
import { Linking, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useStorefrontProfileController } from '../../context/StorefrontController';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import {
  isBackendPhoneVerificationRequiredError,
  requestJson,
} from '../../services/storefrontBackendHttp';
import type { OwnerPortalIdentityIdType } from '../../types/ownerPortal';
import { useOwnerPortalProfileLoader } from './useOwnerPortalProfileLoader';

export const ID_TYPE_OPTIONS: OwnerPortalIdentityIdType[] = [
  'drivers_license',
  'state_id',
  'passport',
];

type StripeIdentitySessionResponse = {
  ok: boolean;
  sessionId: string;
  clientSecret: string;
  verificationUrl: string | null;
};

/**
 * Owner portal identity verification model — now powered by Stripe Identity.
 *
 * Instead of capturing photos manually, we create a Stripe Identity
 * VerificationSession and open the hosted verification UI. Stripe handles
 * document scanning, selfie capture, and biometric matching. The result
 * comes back via webhook and auto-updates Firestore.
 */
export function useOwnerPortalIdentityVerificationModel() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { authSession } = useStorefrontProfileController();
  const ownerUid = authSession.uid;
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [verificationStarted, setVerificationStarted] = React.useState(false);
  const { isLoading, ownerProfile, setStatusText, statusText } =
    useOwnerPortalProfileLoader(ownerUid);

  // Check if identity verification is already in progress or completed
  const identityStatus = ownerProfile?.identityVerificationStatus ?? null;
  const isAlreadyVerified = identityStatus === 'verified';
  const isProcessing = identityStatus === 'pending';

  const startVerification = React.useCallback(async () => {
    if (!ownerUid || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setStatusText(null);
    try {
      const response = await requestJson<StripeIdentitySessionResponse>(
        '/owner-portal/identity-verification/session',
        { method: 'POST' },
      );

      if (!response.ok) {
        throw new Error('Unable to create identity verification session.');
      }

      // Open the Stripe-hosted verification URL
      if (response.verificationUrl) {
        if (Platform.OS === 'web') {
          // On web, open in a new tab
          window.open(response.verificationUrl, '_blank');
        } else {
          // On native, open in the in-app browser
          // expo-web-browser would be ideal, but Linking works as a fallback
          await Linking.openURL(response.verificationUrl);
        }
        setVerificationStarted(true);
        setStatusText('Verification opened. Complete it in the browser, then return here.');
      } else {
        throw new Error('Verification URL not available. Please try again.');
      }
    } catch (error) {
      // Backend gates identity verification behind owner phone verification.
      // Auto-route to the phone-verification screen rather than showing a
      // raw "Verify your phone first" string the user can't act on.
      if (isBackendPhoneVerificationRequiredError(error)) {
        navigation.replace('OwnerPortalPhoneVerification', {
          nextRoute: 'OwnerPortalIdentityVerification',
        });
        return;
      }
      setStatusText(
        error instanceof Error ? error.message : 'Unable to start identity verification.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [navigation, ownerUid, isSubmitting, setStatusText]);

  const checkStatus = React.useCallback(() => {
    // Navigate home — the profile loader will re-fetch and show current status
    navigation.replace('OwnerPortalHome');
  }, [navigation]);

  const isSubmitDisabled = isSubmitting || isAlreadyVerified || isProcessing;

  return {
    identityStatus,
    isAlreadyVerified,
    isLoading,
    isProcessing,
    isSubmitDisabled,
    isSubmitting,
    ownerProfile,
    statusText,
    verificationStarted,
    startVerification: () => {
      void startVerification();
    },
    checkStatus,
  };
}

import { colors } from '../theme/tokens';
import React from 'react';
import { Linking, Platform, Text, TextInput, View } from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CustomerStateCard } from '../components/CustomerStateCard';
import { MotionInView } from '../components/MotionInView';
import { HapticPressable } from '../components/HapticPressable';
import { ScreenShell } from '../components/ScreenShell';
import { SectionCard } from '../components/SectionCard';
import { legalConfig } from '../config/legal';
import { useStorefrontProfileController } from '../context/StorefrontController';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { customerSupportStyles as styles } from './customerSupport/customerSupportStyles';

const DELETE_CONFIRMATION_PHRASE = 'DELETE';

export function DeleteAccountScreen({
  navigation,
}: {
  navigation: NativeStackNavigationProp<RootStackParamList>;
}) {
  const { authSession, deleteAccount } = useStorefrontProfileController();
  const [confirmationText, setConfirmationText] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [statusState, setStatusState] = React.useState<{
    text: string;
    tone: 'success' | 'error';
  } | null>(null);
  const matchesConfirmation = confirmationText.trim().toUpperCase() === DELETE_CONFIRMATION_PHRASE;
  const isMemberAccount = authSession.status === 'authenticated';
  const openSupportEmail = React.useCallback(() => {
    if (Platform.OS === 'web') {
      window.open(legalConfig.supportEmailUrl, '_blank', 'noopener,noreferrer');
    } else {
      void Linking.openURL(legalConfig.supportEmailUrl);
    }
  }, []);

  const handleDelete = React.useCallback(async () => {
    if (!matchesConfirmation || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setStatusState(null);
    try {
      const result = await deleteAccount();
      setStatusState({
        text: result.message,
        tone: result.ok ? 'success' : 'error',
      });
      if (result.ok) {
        navigation.reset({
          index: 0,
          routes: [{ name: 'Tabs' }],
        });
      }
    } catch {
      // Defensive: deleteAccount() is expected to resolve with a result
      // object even on partial failure, but an unexpected throw (e.g.,
      // local storage write blocked) should still surface to the user
      // rather than silently reset the submit button.
      setStatusState({
        text: 'Something went wrong while clearing your data. Please try again, or email support if this keeps happening.',
        tone: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [deleteAccount, isSubmitting, matchesConfirmation, navigation]);

  return (
    <ScreenShell
      eyebrow="Account"
      title={isMemberAccount ? 'Delete account.' : 'Reset local profile.'}
      subtitle={
        isMemberAccount
          ? 'Removes your account data and clears the app on this device.'
          : 'Clears the local profile and device data for this guest session.'
      }
      headerPill="Danger"
    >
      <MotionInView delay={120}>
        <SectionCard
          title="What this does"
          body={
            isMemberAccount
              ? 'Clears local data, removes the linked profile, and deletes the login.'
              : 'Clears profile, saved storefronts, history, and community data from this device.'
          }
        >
          <View style={styles.list}>
            <Text style={styles.helperText}>
              {`\u2022 Account: ${authSession.email ?? 'Guest session on this device'}`}
            </Text>
            <Text style={styles.helperText}>
              {`\u2022 Everything linked to this account on this device will be removed.`}
            </Text>
            <Text style={styles.helperText}>
              {`\u2022 If a recent sign-in is needed, you'll be signed out first.`}
            </Text>
          </View>
        </SectionCard>
      </MotionInView>

      <MotionInView delay={180}>
        <SectionCard
          title="Confirm deletion"
          body={`Type ${DELETE_CONFIRMATION_PHRASE} to confirm.`}
        >
          <View style={styles.form}>
            <TextInput
              value={confirmationText}
              onChangeText={setConfirmationText}
              autoCapitalize="characters"
              placeholder={DELETE_CONFIRMATION_PHRASE}
              placeholderTextColor={colors.textSoft}
              style={styles.input}
              accessibilityLabel="Confirmation text"
              accessibilityHint={`Type ${DELETE_CONFIRMATION_PHRASE} to confirm account deletion.`}
            />
            {statusState ? (
              <CustomerStateCard
                title={
                  statusState.tone === 'error' ? 'Deletion needs attention' : 'Deletion complete'
                }
                body={statusState.text}
                tone={statusState.tone === 'error' ? 'danger' : 'success'}
                iconName={
                  statusState.tone === 'error' ? 'alert-circle-outline' : 'checkmark-circle-outline'
                }
                eyebrow="Account state"
              />
            ) : null}
            <HapticPressable
              disabled={!matchesConfirmation || isSubmitting}
              onPress={() => {
                void handleDelete();
              }}
              style={[
                styles.primaryButton,
                styles.primaryButtonDanger,
                (!matchesConfirmation || isSubmitting) && styles.buttonDisabled,
              ]}
              accessibilityRole="button"
              accessibilityLabel={isMemberAccount ? 'Delete account' : 'Reset profile'}
              accessibilityHint={
                isMemberAccount ? 'Permanently deletes your account.' : 'Resets your guest profile.'
              }
            >
              <Text style={styles.primaryButtonText}>
                {isSubmitting
                  ? 'Deleting...'
                  : isMemberAccount
                    ? 'Delete Canopy Trove Account'
                    : 'Reset Canopy Trove Profile'}
              </Text>
            </HapticPressable>
          </View>
        </SectionCard>
      </MotionInView>

      <MotionInView delay={240}>
        <SectionCard
          title="Need help instead?"
          body="Need a support trail first, or deletion was blocked? Try these."
        >
          <CustomerStateCard
            title="Try support before retrying"
            body="If deletion was blocked, these paths give you a calmer next step."
            tone="warm"
            iconName="help-buoy-outline"
            eyebrow="Support state"
          >
            <View style={styles.row}>
              <HapticPressable
                onPress={openSupportEmail}
                style={styles.secondaryButton}
                accessibilityRole="button"
                accessibilityLabel="Email support"
                accessibilityHint="Opens an email compose window to contact support."
              >
                <Text style={styles.secondaryButtonText}>Email Support</Text>
              </HapticPressable>
              <HapticPressable
                onPress={() => navigation.navigate('LegalCenter')}
                style={styles.secondaryButton}
                accessibilityRole="button"
                accessibilityLabel="Open legal center"
                accessibilityHint="Opens the legal center with terms, privacy, and guidelines."
              >
                <Text style={styles.secondaryButtonText}>Open Legal Center</Text>
              </HapticPressable>
            </View>
          </CustomerStateCard>
        </SectionCard>
      </MotionInView>
    </ScreenShell>
  );
}

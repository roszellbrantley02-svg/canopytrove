import React from 'react';
import { Linking, Text, TextInput, View } from 'react-native';
import { CustomerStateCard } from '../components/CustomerStateCard';
import { MotionInView } from '../components/MotionInView';
import { HapticPressable } from '../components/HapticPressable';
import { ScreenShell } from '../components/ScreenShell';
import { SectionCard } from '../components/SectionCard';
import { legalConfig } from '../config/legal';
import { useStorefrontProfileController } from '../context/StorefrontController';
import { customerSupportStyles as styles } from './customerSupport/customerSupportStyles';

const DELETE_CONFIRMATION_PHRASE = 'DELETE';

export function DeleteAccountScreen({ navigation }: { navigation: any }) {
  const { appProfile, authSession, deleteAccount } = useStorefrontProfileController();
  const [confirmationText, setConfirmationText] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [statusState, setStatusState] = React.useState<{
    text: string;
    tone: 'success' | 'error';
  } | null>(null);
  const matchesConfirmation = confirmationText.trim().toUpperCase() === DELETE_CONFIRMATION_PHRASE;
  const isMemberAccount = authSession.status === 'authenticated';
  const openSupportEmail = React.useCallback(() => {
    void Linking.openURL(legalConfig.supportEmailUrl);
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
          ? 'This removes the Canopy Trove account data path tied to this login and clears the app on this device.'
          : 'This clears the local Canopy Trove profile and device data for the current guest session.'
      }
      headerPill="Danger"
    >
      <MotionInView delay={120}>
        <SectionCard
          title="What this does"
          body={
            isMemberAccount
              ? 'Canopy Trove will clear your local app data, remove the linked backend profile path, and then try to remove the authenticated login itself.'
              : 'Canopy Trove will clear the local profile, saved storefronts, recent history, and community data from this device.'
          }
        >
          <View style={styles.list}>
            <Text style={styles.helperText}>{`\u2022 Profile id: ${appProfile?.id ?? 'Unavailable'}`}</Text>
            <Text style={styles.helperText}>{`\u2022 Account email: ${authSession.email ?? 'Guest session'}`}</Text>
            <Text style={styles.helperText}>
              {`\u2022 If login deletion needs a recent sign-in, Canopy Trove will sign you out and tell you to sign back in before retrying.`}
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
              placeholderTextColor="#738680"
              style={styles.input}
            />
            {statusState ? (
              <CustomerStateCard
                title={statusState.tone === 'error' ? 'Deletion needs attention' : 'Deletion complete'}
                body={statusState.text}
                tone={statusState.tone === 'error' ? 'danger' : 'success'}
                iconName={statusState.tone === 'error' ? 'alert-circle-outline' : 'checkmark-circle-outline'}
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
          body="If deletion is blocked because a recent sign-in is required, or you want a support paper trail first, use these paths before retrying."
        >
          <CustomerStateCard
            title="Use support before retrying if needed"
            body="If deletion is blocked by a recent-sign-in requirement, Canopy Trove will tell you clearly. These support paths give you a calmer next step instead of guessing."
            tone="warm"
            iconName="help-buoy-outline"
            eyebrow="Support state"
          >
            <View style={styles.row}>
              <HapticPressable onPress={openSupportEmail} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Email Support</Text>
              </HapticPressable>
              <HapticPressable
                onPress={() => navigation.navigate('LegalCenter')}
                style={styles.secondaryButton}
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

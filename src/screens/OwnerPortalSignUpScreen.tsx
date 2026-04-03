import React from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MotionInView } from '../components/MotionInView';
import { ScreenShell } from '../components/ScreenShell';
import { SectionCard } from '../components/SectionCard';
import { AppUiIcon } from '../icons/AppUiIcon';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { signUpOwnerPortalAccount } from '../services/ownerPortalService';
import { OwnerPortalHeroPanel } from './ownerPortal/OwnerPortalHeroPanel';
import { ownerPortalStyles as styles } from './ownerPortal/ownerPortalStyles';

const SIGN_UP_STEPS = ['Access', 'Create Account', 'Business Details', 'Claim Listing'];

export function OwnerPortalSignUpScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [displayName, setDisplayName] = React.useState('');
  const [legalName, setLegalName] = React.useState('');
  const [companyName, setCompanyName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorText, setErrorText] = React.useState<string | null>(null);
  const canSubmit =
    !isSubmitting &&
    Boolean(displayName.trim()) &&
    Boolean(legalName.trim()) &&
    Boolean(companyName.trim()) &&
    Boolean(email.trim()) &&
    password.length >= 8 &&
    confirmPassword.length >= 8;

  const handleSubmit = async () => {
    if (isSubmitting) {
      return;
    }

    if (password !== confirmPassword) {
      setErrorText('Passwords must match.');
      return;
    }

    setIsSubmitting(true);
    setErrorText(null);
    try {
      const result = await signUpOwnerPortalAccount({
        displayName,
        legalName,
        companyName,
        email,
        password,
      });
      navigation.replace('OwnerPortalBusinessDetails', {
        ownerUid: result.authSession.uid!,
        initialLegalName: result.ownerProfile.legalName,
        initialCompanyName: result.ownerProfile.companyName,
        initialPhone: result.ownerProfile.phone ?? '',
      });
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : 'Unable to create owner account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScreenShell
      eyebrow="Owner Portal"
      title="Create owner account."
      subtitle="Start your owner workspace and move through business details, listing claim, and verification from one place."
      headerPill="Owner"
    >
      <MotionInView delay={70}>
        <OwnerPortalHeroPanel
          kicker="Owner onboarding"
          title="Start the owner workspace."
          body="Create a new account to begin your owner journey."
          metrics={[
            {
              value: 'New',
              label: 'Account',
              body: '',
            },
            {
              value: '8+',
              label: 'Password',
              body: '',
            },
            {
              value: 'Step 1',
              label: 'Onboarding',
              body: '',
            },
          ]}
          steps={SIGN_UP_STEPS}
          activeStepIndex={1}
        />
      </MotionInView>

      <MotionInView delay={120}>
        <SectionCard title="Owner account">
          <View style={styles.sectionStack}>
            <View style={styles.plannerPanel}>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Display name</Text>
                <TextInput
                  value={displayName}
                  onChangeText={setDisplayName}
                  placeholder="Display name"
                  placeholderTextColor="#738680"
                  style={styles.inputPremium}
                />
              </View>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Legal name</Text>
                <TextInput
                  value={legalName}
                  onChangeText={setLegalName}
                  placeholder="Legal name"
                  placeholderTextColor="#738680"
                  style={styles.inputPremium}
                />
              </View>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Company name</Text>
                <TextInput
                  value={companyName}
                  onChangeText={setCompanyName}
                  placeholder="Company name"
                  placeholderTextColor="#738680"
                  style={styles.inputPremium}
                />
              </View>
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
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Password</Text>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Password"
                  secureTextEntry={true}
                  placeholderTextColor="#738680"
                  style={styles.inputPremium}
                />
              </View>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Confirm password</Text>
                <TextInput
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Confirm password"
                  secureTextEntry={true}
                  placeholderTextColor="#738680"
                  style={styles.inputPremium}
                />
              </View>
              {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}
            </View>

            <View style={styles.ctaPanel}>
              <View style={styles.splitHeaderRow}>
                <View style={styles.splitHeaderCopy}>
                  <Text style={styles.sectionEyebrow}>Create owner account</Text>
                  <Text style={styles.splitHeaderTitle}>Open the onboarding sequence</Text>
                </View>
                <AppUiIcon name="person-add-outline" size={20} color="#F5C86A" />
              </View>
              <Pressable
                disabled={!canSubmit}
                onPress={() => {
                  void handleSubmit();
                }}
                style={[styles.primaryButton, !canSubmit && styles.buttonDisabled]}
              >
                <Text style={styles.primaryButtonText}>
                  {isSubmitting ? 'Creating Account...' : 'Create Owner Account'}
                </Text>
              </Pressable>
            </View>
          </View>
        </SectionCard>
      </MotionInView>
    </ScreenShell>
  );
}

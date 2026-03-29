import React from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MotionInView } from '../components/MotionInView';
import { ScreenShell } from '../components/ScreenShell';
import { SectionCard } from '../components/SectionCard';
import { RootStackParamList } from '../navigation/RootNavigator';
import { signUpOwnerPortalAccount } from '../services/ownerPortalService';
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
      subtitle="Start your owner workspace and move through claim, verification, and plan setup from one place."
      headerPill="Owner"
    >
      <MotionInView delay={70}>
        <View style={styles.portalHeroCard}>
          <View style={styles.portalHeroGlow} />
          <Text style={styles.portalHeroKicker}>Owner onboarding</Text>
          <Text style={styles.portalHeroTitle}>
            Start the owner workspace with clearer premium onboarding framing.
          </Text>
          <Text style={styles.portalHeroBody}>
            Account creation anchors the full owner journey: business details, listing claim,
            verification review, and later owner-only plan access.
          </Text>
          <View style={styles.summaryStrip}>
            <View style={styles.summaryTile}>
              <Text style={styles.summaryTileValue}>New</Text>
              <Text style={styles.summaryTileLabel}>Account path</Text>
              <Text style={styles.summaryTileBody}>
                Use this flow when the owner account does not exist yet.
              </Text>
            </View>
            <View style={styles.summaryTile}>
              <Text style={styles.summaryTileValue}>8+</Text>
              <Text style={styles.summaryTileLabel}>Password length</Text>
              <Text style={styles.summaryTileBody}>
                Password and confirmation both require at least eight characters.
              </Text>
            </View>
            <View style={styles.summaryTile}>
              <Text style={styles.summaryTileValue}>Step 1</Text>
              <Text style={styles.summaryTileLabel}>Onboarding</Text>
              <Text style={styles.summaryTileBody}>
                Business details come immediately after account creation succeeds.
              </Text>
            </View>
          </View>
          <View style={styles.onboardingStepRow}>
            {SIGN_UP_STEPS.map((step, index) => (
              <View
                key={step}
                style={[
                  styles.onboardingStepChip,
                  index === 1 && styles.onboardingStepChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.onboardingStepChipText,
                    index === 1 && styles.onboardingStepChipTextActive,
                  ]}
                >
                  {step}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </MotionInView>

      <MotionInView delay={120}>
        <SectionCard
          title="Owner account"
          body="Use the business email approved for owner access. This account will anchor your storefront onboarding and future plan management."
        >
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
                  <Text style={styles.splitHeaderBody}>
                    Once this account is created successfully, the next step moves directly into
                    owner business details.
                  </Text>
                </View>
                <Ionicons name="person-add-outline" size={20} color="#F5C86A" />
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

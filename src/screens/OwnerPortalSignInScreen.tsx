import React from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MotionInView } from '../components/MotionInView';
import { ScreenShell } from '../components/ScreenShell';
import { SectionCard } from '../components/SectionCard';
import { RootStackParamList } from '../navigation/RootNavigator';
import { signInOwnerPortalAccount } from '../services/ownerPortalService';
import { ownerPortalStyles as styles } from './ownerPortal/ownerPortalStyles';

const ACCESS_STEPS = ['Access', 'Sign In', 'Onboarding', 'Verification'];

export function OwnerPortalSignInScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorText, setErrorText] = React.useState<string | null>(null);
  const canSubmit = !isSubmitting && Boolean(email.trim()) && Boolean(password);

  const handleSubmit = async () => {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setErrorText(null);
    try {
      await signInOwnerPortalAccount(email, password);
      navigation.replace('OwnerPortalHome');
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : 'Unable to sign in.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScreenShell
      eyebrow="Owner Portal"
      title="Owner sign in."
      subtitle="Sign in to manage your storefront, verification documents, deal badges, and owner plan access."
      headerPill="Owner"
    >
      <MotionInView delay={70}>
        <View style={styles.portalHeroCard}>
          <View style={styles.portalHeroGlow} />
          <Text style={styles.portalHeroKicker}>Owner access</Text>
          <Text style={styles.portalHeroTitle}>
            Return to the owner workspace with a clearer premium sign-in flow.
          </Text>
          <Text style={styles.portalHeroBody}>
            Use the approved business email connected to your owner workspace. Sign-in is the
            quickest path back into claim, verification, and owner controls.
          </Text>
          <View style={styles.summaryStrip}>
            <View style={styles.summaryTile}>
              <Text style={styles.summaryTileValue}>Existing</Text>
              <Text style={styles.summaryTileLabel}>Account path</Text>
              <Text style={styles.summaryTileBody}>
                Sign in when the owner account already exists.
              </Text>
            </View>
            <View style={styles.summaryTile}>
              <Text style={styles.summaryTileValue}>Private</Text>
              <Text style={styles.summaryTileLabel}>Workspace</Text>
              <Text style={styles.summaryTileBody}>
                Sign-in restores access to the private owner dashboard.
              </Text>
            </View>
          </View>
          <View style={styles.onboardingStepRow}>
            {ACCESS_STEPS.map((step, index) => (
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
          title="Welcome back"
          body="Use the approved business email connected to your owner workspace."
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
              {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}
            </View>

            <View style={styles.ctaPanel}>
              <View style={styles.splitHeaderRow}>
                <View style={styles.splitHeaderCopy}>
                  <Text style={styles.sectionEyebrow}>Sign-in action</Text>
                  <Text style={styles.splitHeaderTitle}>Open your owner workspace</Text>
                  <Text style={styles.splitHeaderBody}>
                    Continue with the business email tied to your owner account. If you do not have
                    access yet, create an owner account first.
                  </Text>
                </View>
                <Ionicons name="log-in-outline" size={20} color="#F5C86A" />
              </View>
              <Pressable
                disabled={!canSubmit}
                onPress={() => {
                  void handleSubmit();
                }}
                style={[styles.primaryButton, !canSubmit && styles.buttonDisabled]}
              >
                <Text style={styles.primaryButtonText}>
                  {isSubmitting ? 'Signing In...' : 'Sign In'}
                </Text>
              </Pressable>
              <View style={styles.buttonRow}>
                <Pressable
                  onPress={() => navigation.navigate('OwnerPortalForgotPassword')}
                  style={styles.secondaryButton}
                >
                  <Text style={styles.secondaryButtonText}>Forgot Password</Text>
                </Pressable>
                <Pressable
                  onPress={() => navigation.navigate('OwnerPortalSignUp')}
                  style={styles.secondaryButton}
                >
                  <Text style={styles.secondaryButtonText}>Create Owner Account</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </SectionCard>
      </MotionInView>
    </ScreenShell>
  );
}

import { colors } from '../theme/tokens';
import React from 'react';
import { Platform, Pressable, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MotionInView } from '../components/MotionInView';
import { ScreenShell } from '../components/ScreenShell';
import { SectionCard } from '../components/SectionCard';
import { AppUiIcon } from '../icons/AppUiIcon';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { signInOwnerPortalAccount } from '../services/ownerPortalService';
import { OwnerPortalHeroPanel } from './ownerPortal/OwnerPortalHeroPanel';
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
      navigation.replace('Tabs', { screen: 'Profile' });
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : 'Unable to sign in.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScreenShell
      eyebrow="Owner Portal"
      title="Owner sign in"
      subtitle={
        Platform.OS === 'android'
          ? 'Sign in to manage your storefront, business details, reviews, and updates.'
          : 'Sign in to manage your storefront, business details, reviews, and offers.'
      }
      headerPill="Business"
    >
      <MotionInView delay={70}>
        <OwnerPortalHeroPanel
          kicker="Business sign in"
          title="Welcome back."
          body="Use your business email to open the owner side of the app."
          metrics={[
            {
              value: 'Existing',
              label: 'Account',
              body: '',
            },
            {
              value: 'Private',
              label: 'Access',
              body: '',
            },
          ]}
          steps={ACCESS_STEPS}
          activeStepIndex={1}
        />
      </MotionInView>

      <MotionInView delay={120}>
        <SectionCard title="Welcome back">
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
                  accessibilityLabel="Business email"
                  autoComplete="email"
                />
              </View>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Password</Text>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Password"
                  secureTextEntry={true}
                  placeholderTextColor={colors.textSoft}
                  style={styles.inputPremium}
                  accessibilityLabel="Password"
                  autoComplete="current-password"
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
            </View>

            <View style={styles.ctaPanel}>
              <View style={styles.splitHeaderRow}>
                <View style={styles.splitHeaderCopy}>
                  <Text style={styles.sectionEyebrow}>Sign in</Text>
                  <Text style={styles.splitHeaderTitle}>Open your business profile</Text>
                </View>
                <AppUiIcon name="log-in-outline" size={20} color="#F5C86A" />
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

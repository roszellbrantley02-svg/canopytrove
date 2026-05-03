import { colors } from '../theme/tokens';
import React from 'react';
import { Platform, Pressable, Text, TextInput, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { MotionInView } from '../components/MotionInView';
import { ScreenShell } from '../components/ScreenShell';
import { SectionCard } from '../components/SectionCard';
import { withScreenErrorBoundary } from '../components/withScreenErrorBoundary';
import { AppUiIcon } from '../icons/AppUiIcon';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { mapFirebaseAuthError } from '../services/firebaseAuthErrorMapper';
import { signInOwnerPortalAccount } from '../services/ownerPortalService';
import { OwnerPortalHeroPanel } from './ownerPortal/OwnerPortalHeroPanel';
import { ownerPortalStyles as styles } from './ownerPortal/ownerPortalStyles';

const ACCESS_STEPS = ['Access', 'Sign In', 'Onboarding', 'Verification'];

function OwnerPortalSignInScreenInner() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'OwnerPortalSignIn'>>();
  // Pre-fill from the recovery CTA on the owner-signup screen
  // ("This email is already registered. Sign in to use it instead").
  const [email, setEmail] = React.useState(route.params?.prefilledEmail ?? '');
  const [password, setPassword] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorText, setErrorText] = React.useState<string | null>(null);
  // Synchronous in-flight guard — prevents the rapid-tap race where
  // multiple onPress events fire before isSubmitting state propagates
  // to the next render.
  const isSubmittingRef = React.useRef(false);
  const canSubmit = !isSubmitting && Boolean(email.trim()) && Boolean(password);

  const handleSubmit = async () => {
    if (isSubmittingRef.current) {
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setErrorText(null);
    try {
      await signInOwnerPortalAccount(email, password);
      navigation.replace('Tabs', { screen: 'Profile' });
    } catch (error) {
      // Translate raw Firebase auth errors into a friendly message —
      // wrong-password, user-not-found, too-many-requests etc. all
      // get plain-English copy with a recovery hint.
      const friendly = mapFirebaseAuthError(error, email);
      setErrorText(friendly.message);
    } finally {
      isSubmittingRef.current = false;
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

export const OwnerPortalSignInScreen = withScreenErrorBoundary(
  OwnerPortalSignInScreenInner,
  'owner-portal-sign-in',
);

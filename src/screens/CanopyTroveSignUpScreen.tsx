import React from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MotionInView } from '../components/MotionInView';
import { ScreenShell } from '../components/ScreenShell';
import { SectionCard } from '../components/SectionCard';
import { RootStackParamList } from '../navigation/RootNavigator';
import { trackAnalyticsEvent } from '../services/analyticsService';
import { signUpCanopyTroveEmailPassword } from '../services/canopyTroveAuthService';
import { customerEntryStyles as styles } from './customerEntry/customerEntryStyles';

export function CanopyTroveSignUpScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [displayName, setDisplayName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorText, setErrorText] = React.useState<string | null>(null);
  const canSubmit = email.trim().length > 0 && password.length > 0 && confirmPassword.length > 0;

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
    trackAnalyticsEvent('signup_started', {
      role: 'customer',
      source: 'profile',
    });
    try {
      const authSession = await signUpCanopyTroveEmailPassword(email, password, displayName);
      if (!authSession?.uid) {
        throw new Error('Unable to create account.');
      }

      trackAnalyticsEvent('signup_completed', {
        role: 'customer',
        source: 'profile',
      });
      navigation.replace('Tabs');
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : 'Unable to create account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScreenShell
      eyebrow="Member access"
      title="Create your member account."
      subtitle="Set up your Canopy Trove member profile for favorites, reviews, and a smoother return visit."
      headerPill="Member"
    >
      <MotionInView delay={90}>
        <View style={styles.heroCard}>
          <View style={styles.heroGlow} />
          <Text style={styles.heroKicker}>Customer account</Text>
          <Text style={styles.heroTitle}>Start a cleaner Canopy Trove session.</Text>
          <Text style={styles.heroBody}>
            Create a member account to save storefronts, keep profile progress, and participate in reviews.
          </Text>
          <View style={styles.summaryStrip}>
            <View style={styles.summaryTile}>
              <Text style={styles.summaryTileValue}>Save</Text>
              <Text style={styles.summaryTileLabel}>Favorites</Text>
              <Text style={styles.summaryTileBody}>Keep a durable list of storefronts worth returning to.</Text>
            </View>
            <View style={styles.summaryTile}>
              <Text style={styles.summaryTileValue}>Track</Text>
              <Text style={styles.summaryTileLabel}>Profile</Text>
              <Text style={styles.summaryTileBody}>Carry your account state across devices and sessions.</Text>
            </View>
            <View style={styles.summaryTile}>
              <Text style={styles.summaryTileValue}>Join</Text>
              <Text style={styles.summaryTileLabel}>Community</Text>
              <Text style={styles.summaryTileBody}>Write reviews and keep your storefront feedback history.</Text>
            </View>
          </View>
          <View style={styles.trustRow}>
            <View style={styles.trustChip}>
              <Text style={styles.trustChipText}>Member sign-up</Text>
            </View>
            <View style={[styles.trustChip, styles.trustChipWarm]}>
              <Text style={styles.trustChipText}>Owner onboarding is separate</Text>
            </View>
          </View>
        </View>
      </MotionInView>
      <MotionInView delay={140}>
        <SectionCard title="Create account" body="This creates a consumer member account. Dispensary owners should use the separate owner portal flow.">
          <View style={styles.sectionStack}>
            <View style={[styles.plannerPanel, styles.plannerPanelFeatured]}>
              <View style={styles.form}>
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
                  <Text style={styles.fieldLabel}>Email</Text>
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
                  <Text style={styles.fieldHint}>Your member profile is separate from any owner or business access.</Text>
                </View>
                {errorText ? (
                  <View style={[styles.helperCard, styles.helperCardDanger]}>
                    <Text style={[styles.helperTitle, styles.helperTitleDanger]}>Create account issue</Text>
                    <Text style={styles.helperBody}>{errorText}</Text>
                  </View>
                ) : (
                  <View style={[styles.helperCard, styles.helperCardWarm]}>
                    <Text style={styles.helperTitle}>What this unlocks</Text>
                    <Text style={styles.helperBody}>
                      A member account keeps your saved storefronts, review activity, and profile context attached to one sign-in.
                    </Text>
                  </View>
                )}
              </View>
            </View>
            <View style={styles.ctaPanel}>
              <Pressable
                disabled={isSubmitting || !canSubmit}
                onPress={() => {
                  void handleSubmit();
                }}
                style={[
                  styles.primaryButton,
                  (isSubmitting || !canSubmit) && styles.buttonDisabled,
                ]}
              >
                <Text style={styles.primaryButtonText}>
                  {isSubmitting ? 'Creating Account...' : 'Create Account'}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => navigation.navigate('CanopyTroveSignIn')}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonText}>Already Have An Account</Text>
              </Pressable>
            </View>
          </View>
        </SectionCard>
      </MotionInView>
    </ScreenShell>
  );
}

import React from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MotionInView } from '../components/MotionInView';
import { ScreenShell } from '../components/ScreenShell';
import { SectionCard } from '../components/SectionCard';
import { RootStackParamList } from '../navigation/RootNavigator';
import { trackAnalyticsEvent } from '../services/analyticsService';
import { signInCanopyTroveEmailPassword } from '../services/canopyTroveAuthService';
import { customerEntryStyles as styles } from './customerEntry/customerEntryStyles';

export function CanopyTroveSignInScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorText, setErrorText] = React.useState<string | null>(null);
  const canSubmit = email.trim().length > 0 && password.length > 0;

  const handleSubmit = async () => {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setErrorText(null);
    try {
      const authSession = await signInCanopyTroveEmailPassword(email, password);
      if (!authSession?.uid) {
        throw new Error('Unable to sign in.');
      }

      trackAnalyticsEvent('signin', {
        role: 'customer',
        source: 'profile',
      });
      navigation.replace('Tabs');
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : 'Unable to sign in.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScreenShell
      eyebrow="Member access"
      title="Welcome back."
      subtitle="Sign in to restore saved storefronts, member reviews, and your Canopy Trove profile progress."
      headerPill="Member"
    >
      <MotionInView delay={90}>
        <View style={styles.heroCard}>
          <View style={styles.heroGlow} />
          <Text style={styles.heroKicker}>Customer account</Text>
          <Text style={styles.heroTitle}>Pick up where you left off.</Text>
          <Text style={styles.heroBody}>
            Member sign in restores favorites, review activity, and storefront progress across devices.
          </Text>
          <View style={styles.summaryStrip}>
            <View style={styles.summaryTile}>
              <Text style={styles.summaryTileValue}>Sync</Text>
              <Text style={styles.summaryTileLabel}>Saved places</Text>
              <Text style={styles.summaryTileBody}>Restore your storefront lists and follow-up browsing.</Text>
            </View>
            <View style={styles.summaryTile}>
              <Text style={styles.summaryTileValue}>Write</Text>
              <Text style={styles.summaryTileLabel}>Reviews</Text>
              <Text style={styles.summaryTileBody}>Pick up review history and community activity.</Text>
            </View>
            <View style={styles.summaryTile}>
              <Text style={styles.summaryTileValue}>Return</Text>
              <Text style={styles.summaryTileLabel}>Profile</Text>
              <Text style={styles.summaryTileBody}>Bring back your member profile and saved context.</Text>
            </View>
          </View>
          <View style={styles.trustRow}>
            <View style={styles.trustChip}>
              <Text style={styles.trustChipText}>Secure email sign-in</Text>
            </View>
            <View style={[styles.trustChip, styles.trustChipWarm]}>
              <Text style={styles.trustChipText}>Owners use a separate portal</Text>
            </View>
          </View>
        </View>
      </MotionInView>
      <MotionInView delay={140}>
        <SectionCard title="Sign in" body="Use your Canopy Trove member email and password. Owner access lives in the separate owner portal.">
          <View style={styles.sectionStack}>
            <View style={styles.plannerPanel}>
              <View style={styles.form}>
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
                  <Text style={styles.fieldHint}>Use the same member email you use for saved storefronts and reviews.</Text>
                </View>
                {errorText ? (
                  <View style={[styles.helperCard, styles.helperCardDanger]}>
                    <Text style={[styles.helperTitle, styles.helperTitleDanger]}>Could not sign you in</Text>
                    <Text style={styles.helperBody}>{errorText}</Text>
                  </View>
                ) : (
                  <View style={[styles.helperCard, styles.helperCardWarm]}>
                    <Text style={styles.helperTitle}>Customer account only</Text>
                    <Text style={styles.helperBody}>
                      This sign-in is only for Canopy Trove member accounts. Dispensary owners should use the owner portal flow.
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
                style={[styles.primaryButton, (isSubmitting || !canSubmit) && styles.buttonDisabled]}
              >
                <Text style={styles.primaryButtonText}>{isSubmitting ? 'Signing In...' : 'Sign In'}</Text>
              </Pressable>
              <View style={styles.buttonRow}>
                <Pressable
                  onPress={() => navigation.navigate('CanopyTroveForgotPassword')}
                  style={[styles.secondaryButton, styles.buttonFlex]}
                >
                  <Text style={styles.secondaryButtonText}>Forgot Password</Text>
                </Pressable>
                <Pressable
                  onPress={() => navigation.navigate('CanopyTroveSignUp')}
                  style={[styles.secondaryButton, styles.buttonFlex]}
                >
                  <Text style={styles.secondaryButtonText}>Create Account</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </SectionCard>
      </MotionInView>
    </ScreenShell>
  );
}

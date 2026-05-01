import { colors } from '../theme/tokens';
import React from 'react';
import { Linking, Pressable, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MotionInView } from '../components/MotionInView';
import { ScreenShell } from '../components/ScreenShell';
import { SectionCard } from '../components/SectionCard';
import { withScreenErrorBoundary } from '../components/withScreenErrorBoundary';
import { AppUiIcon } from '../icons/AppUiIcon';
import {
  useStorefrontProfileController,
  useStorefrontQueryController,
} from '../context/StorefrontController';
import { useBrowseSummaries } from '../hooks/useStorefrontSummaryData';
import { useStorefrontDetails } from '../hooks/useStorefrontDetailData';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { signUpOwnerPortalAccount } from '../services/ownerPortalAuthService';
import { submitOwnerDispensaryClaim } from '../services/ownerPortalClaimService';
import type { StorefrontSummary } from '../types/storefront';
import { OwnerPortalHeroPanel } from './ownerPortal/OwnerPortalHeroPanel';
import { ownerPortalStyles as styles } from './ownerPortal/ownerPortalStyles';

const ONBOARDING_STEPS = ['Find shop', 'Sign up', 'Verify shop phone'];
const SUPPORT_EMAIL = 'askmehere@canopytrove.com';

// Stage flow:
//  - find_shop:    search the directory + pick a storefront + inline signup
//                  (name, business name, email, password). Phone preview
//                  is shown as soon as a shop is selected.
//  - manual_review: owner can't answer the shop's published phone — short
//                  form gathers reason + alternate contact and routes
//                  the claim to admin review without firing the voice call.
type Stage = 'find_shop' | 'manual_review';

const MANUAL_REVIEW_REASONS = [
  'The published phone is wrong or disconnected',
  "It's a landline I can't access right now",
  'Off-site management answers that line',
  'I am not at the shop right now',
  'Other',
];

type ManualReviewSubmission = {
  reason: string;
  alternateContact: string;
  notes: string;
};

function describeStorefrontAddress(storefront: StorefrontSummary): string {
  const parts = [storefront.addressLine1, storefront.city, storefront.state, storefront.zip].filter(
    (part) => typeof part === 'string' && part.trim().length > 0,
  );
  return parts.join(', ');
}

function OwnerPortalQuickClaimScreenInner() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { authSession } = useStorefrontProfileController();
  const { activeLocation, activeLocationLabel } = useStorefrontQueryController();

  const [stage, setStage] = React.useState<Stage>('find_shop');
  const [draftQuery, setDraftQuery] = React.useState('');
  const [submittedQuery, setSubmittedQuery] = React.useState('');
  const [selectedStorefront, setSelectedStorefront] = React.useState<StorefrontSummary | null>(
    null,
  );

  // Inline signup fields. We collect the minimum to create a usable
  // owner account. Fields the existing 4-screen flow asks for separately
  // (legalName, companyName) are derived from displayName + businessName
  // here — owner can edit them later from the workspace home screen.
  const [displayName, setDisplayName] = React.useState('');
  const [businessName, setBusinessName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorText, setErrorText] = React.useState<string | null>(null);

  const [manualReason, setManualReason] = React.useState<string>(MANUAL_REVIEW_REASONS[0]);
  const [manualAlternate, setManualAlternate] = React.useState('');
  const [manualNotes, setManualNotes] = React.useState('');

  const isAuthenticated = authSession.status === 'authenticated';

  const { data: searchData, isLoading: isSearching } = useBrowseSummaries(
    {
      areaId: '',
      searchQuery: submittedQuery,
      origin: activeLocation,
      locationLabel: activeLocationLabel,
    },
    'distance',
    8,
    0,
  );
  const searchResults = submittedQuery.trim() ? searchData.items : [];

  const { data: storefrontDetail, isLoading: isLoadingDetail } = useStorefrontDetails(
    selectedStorefront?.id ?? null,
    selectedStorefront ?? null,
  );

  const shopPhone =
    typeof storefrontDetail?.phone === 'string' ? storefrontDetail.phone.trim() : '';
  const hasPhonePreview = Boolean(selectedStorefront && shopPhone);

  const canSubmitClaim =
    !isSubmitting &&
    Boolean(selectedStorefront) &&
    (isAuthenticated ||
      (Boolean(displayName.trim()) &&
        Boolean(businessName.trim()) &&
        Boolean(email.trim()) &&
        password.length >= 8));

  const canSubmitManualReview =
    !isSubmitting && Boolean(selectedStorefront) && Boolean(manualAlternate.trim());

  const handleSearch = () => {
    setErrorText(null);
    setSubmittedQuery(draftQuery.trim());
  };

  const handlePickStorefront = (storefront: StorefrontSummary) => {
    setSelectedStorefront(storefront);
    setErrorText(null);
  };

  const ensureSignedIn = async (): Promise<string | null> => {
    if (isAuthenticated && authSession.uid) {
      return authSession.uid;
    }
    const result = await signUpOwnerPortalAccount({
      displayName: displayName.trim(),
      legalName: displayName.trim(),
      companyName: businessName.trim(),
      email: email.trim(),
      password,
    });
    return result.authSession.uid ?? null;
  };

  const handleConfirmAndSubmit = async () => {
    if (!canSubmitClaim || !selectedStorefront) return;
    setIsSubmitting(true);
    setErrorText(null);
    try {
      const ownerUid = await ensureSignedIn();
      if (!ownerUid) {
        setErrorText('Account setup failed. Try again or email askmehere@canopytrove.com.');
        return;
      }
      // submitOwnerDispensaryClaim auto-fires the merged voice OTP +
      // alert call to the shop's published phone (PR #4). The
      // shop-ownership screen we land on shows the enter-code stage.
      await submitOwnerDispensaryClaim(ownerUid, {
        id: selectedStorefront.id,
        displayName: selectedStorefront.displayName,
      });
      navigation.replace('OwnerPortalShopOwnershipVerification', {
        storefrontId: selectedStorefront.id,
        storefrontDisplayName: selectedStorefront.displayName,
      });
    } catch (error) {
      setErrorText(
        error instanceof Error
          ? error.message
          : 'Could not submit your claim. Try again or email askmehere@canopytrove.com.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartManualReview = () => {
    setErrorText(null);
    setStage('manual_review');
  };

  const handleSubmitManualReview = async () => {
    if (!canSubmitManualReview || !selectedStorefront) return;
    setIsSubmitting(true);
    setErrorText(null);
    try {
      const ownerUid = await ensureSignedIn();
      if (!ownerUid) {
        setErrorText('Account setup failed. Try again or email askmehere@canopytrove.com.');
        return;
      }
      // Submit the claim so it lands in the admin review queue. Auto-fire
      // call still happens (the call serves as the alert to the legit
      // operator regardless of whether the claimant intends to verify).
      await submitOwnerDispensaryClaim(ownerUid, {
        id: selectedStorefront.id,
        displayName: selectedStorefront.displayName,
      });
      // Compose a support email with the manual-review context. We pre-fill
      // the body so the owner just hits send. Backend admin-review queue
      // already has the claim; this email gives admins extra context.
      const submission: ManualReviewSubmission = {
        reason: manualReason,
        alternateContact: manualAlternate.trim(),
        notes: manualNotes.trim(),
      };
      const subject = `Manual review request: ${selectedStorefront.displayName}`;
      const body = [
        `Storefront: ${selectedStorefront.displayName}`,
        `Address: ${describeStorefrontAddress(selectedStorefront)}`,
        '',
        `Reason can't verify by shop phone: ${submission.reason}`,
        `Alternate contact: ${submission.alternateContact}`,
        submission.notes ? `\nNotes:\n${submission.notes}` : '',
      ].join('\n');
      const mailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      void Linking.canOpenURL(mailto).then((canOpen) => {
        if (canOpen) {
          void Linking.openURL(mailto);
        }
      });
      // Land on home — admin review will email back within 24h. The claim
      // is in the queue, alert call already fired to the shop.
      navigation.replace('OwnerPortalHome');
    } catch (error) {
      setErrorText(
        error instanceof Error
          ? error.message
          : 'Could not submit your manual review request. Email askmehere@canopytrove.com directly.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmailSupport = () => {
    void Linking.canOpenURL(`mailto:${SUPPORT_EMAIL}`).then((canOpen) => {
      if (canOpen) {
        void Linking.openURL(
          `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Owner claim help')}`,
        );
      }
    });
  };

  return (
    <ScreenShell
      eyebrow="Owner Portal"
      title="Claim your dispensary"
      subtitle="Find your shop, set up an account, and verify ownership in about a minute. We'll call the shop's published phone with a code."
      headerPill="Onboarding"
    >
      <MotionInView delay={70}>
        <OwnerPortalHeroPanel
          kicker="Quick claim"
          title="One screen. About sixty seconds."
          body="Search the directory, fill in your name and email, and we'll call the shop's listed phone with a 6-digit code that proves you're the operator."
          metrics={[
            { value: '~60 sec', label: 'Total time', body: '' },
            { value: '1 call', label: 'To shop phone', body: '' },
            { value: 'Manual', label: 'Backup path', body: '' },
          ]}
          steps={ONBOARDING_STEPS}
          activeStepIndex={stage === 'find_shop' ? 0 : 2}
        />
      </MotionInView>

      {stage === 'find_shop' ? (
        <>
          <MotionInView delay={120}>
            <SectionCard
              title="1. Find your shop"
              body="Search the Canopy Trove directory. Pick the storefront you operate."
            >
              <View style={styles.sectionStack}>
                <View style={styles.plannerPanel}>
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Search</Text>
                    <TextInput
                      value={draftQuery}
                      onChangeText={setDraftQuery}
                      onSubmitEditing={handleSearch}
                      placeholder="Storefront name, address, city, or ZIP"
                      placeholderTextColor={colors.textSoft}
                      style={styles.inputPremium}
                      accessibilityLabel="Search storefronts"
                      autoCapitalize="words"
                      returnKeyType="search"
                    />
                  </View>
                  <Pressable
                    disabled={!draftQuery.trim()}
                    onPress={handleSearch}
                    style={[styles.primaryButton, !draftQuery.trim() && styles.buttonDisabled]}
                  >
                    <Text style={styles.primaryButtonText}>Search</Text>
                  </Pressable>
                </View>

                {!submittedQuery.trim() ? (
                  <View style={styles.emptyStateCard}>
                    <Text style={styles.emptyStateTitle}>Search to begin</Text>
                    <Text style={styles.emptyStateBody}>
                      Try the name on your awning, your street address, or your ZIP.
                    </Text>
                  </View>
                ) : isSearching ? (
                  <View style={styles.emptyStateCard}>
                    <Text style={styles.emptyStateTitle}>Searching the directory…</Text>
                    <Text style={styles.emptyStateBody}>
                      Looking up shops that match your search term.
                    </Text>
                  </View>
                ) : !searchResults.length ? (
                  <View style={styles.emptyStateCard}>
                    <Text style={styles.emptyStateTitle}>No matches</Text>
                    <Text style={styles.emptyStateBody}>
                      Try a broader search — just the city, just the ZIP, or part of the name.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.actionGrid}>
                    {searchResults.map((storefront) => {
                      const isPicked = selectedStorefront?.id === storefront.id;
                      return (
                        <Pressable
                          key={storefront.id}
                          onPress={() => handlePickStorefront(storefront)}
                          style={[styles.actionTile, isPicked && styles.onboardingInfoCardSuccess]}
                        >
                          <View style={styles.splitHeaderRow}>
                            <View style={styles.splitHeaderCopy}>
                              <Text style={styles.actionTileMeta}>
                                {isPicked ? 'Selected' : 'Tap to select'}
                              </Text>
                              <Text style={styles.actionTileTitle}>{storefront.displayName}</Text>
                              <Text style={styles.actionTileBody}>{storefront.addressLine1}</Text>
                              <Text style={styles.actionTileBody}>
                                {storefront.city}, {storefront.state} {storefront.zip}
                              </Text>
                            </View>
                            <AppUiIcon
                              name={isPicked ? 'checkmark-circle-outline' : 'storefront-outline'}
                              size={20}
                              color={isPicked ? '#00F58C' : '#F5C86A'}
                            />
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </View>
            </SectionCard>
          </MotionInView>

          {selectedStorefront ? (
            <>
              {!isAuthenticated ? (
                <MotionInView delay={160}>
                  <SectionCard
                    title="2. Quick account setup"
                    body="We'll create your owner account. You can edit details from the workspace home screen later."
                  >
                    <View style={styles.plannerPanel}>
                      <View style={styles.fieldGroup}>
                        <Text style={styles.fieldLabel}>Your name</Text>
                        <TextInput
                          value={displayName}
                          onChangeText={setDisplayName}
                          placeholder="First and last name"
                          placeholderTextColor={colors.textSoft}
                          style={styles.inputPremium}
                          accessibilityLabel="Your name"
                          autoComplete="name"
                        />
                      </View>
                      <View style={styles.fieldGroup}>
                        <Text style={styles.fieldLabel}>Business name</Text>
                        <TextInput
                          value={businessName}
                          onChangeText={setBusinessName}
                          placeholder="Legal business / LLC name"
                          placeholderTextColor={colors.textSoft}
                          style={styles.inputPremium}
                          accessibilityLabel="Business name"
                          autoComplete="organization"
                        />
                      </View>
                      <View style={styles.fieldGroup}>
                        <Text style={styles.fieldLabel}>Business email</Text>
                        <TextInput
                          value={email}
                          onChangeText={setEmail}
                          placeholder="you@yourbusiness.com"
                          placeholderTextColor={colors.textSoft}
                          style={styles.inputPremium}
                          accessibilityLabel="Business email"
                          autoCapitalize="none"
                          keyboardType="email-address"
                          autoComplete="email"
                        />
                      </View>
                      <View style={styles.fieldGroup}>
                        <Text style={styles.fieldLabel}>Password (8+ characters)</Text>
                        <TextInput
                          value={password}
                          onChangeText={setPassword}
                          placeholder="Create a password"
                          placeholderTextColor={colors.textSoft}
                          style={styles.inputPremium}
                          accessibilityLabel="Password"
                          secureTextEntry={true}
                          autoComplete="new-password"
                        />
                      </View>
                    </View>
                  </SectionCard>
                </MotionInView>
              ) : null}

              <MotionInView delay={200}>
                <SectionCard
                  title={isAuthenticated ? '2. Verify your shop' : '3. Verify your shop'}
                  body="We'll call the phone number publicly listed for your shop and read out a 6-digit code. Pick up and enter the code on the next screen."
                >
                  <View style={styles.sectionStack}>
                    <View
                      style={[
                        styles.statusPanel,
                        hasPhonePreview ? styles.statusPanelSuccess : styles.statusPanelWarm,
                      ]}
                    >
                      <View style={styles.statusRow}>
                        <Text style={styles.statusLabel}>Selected shop</Text>
                        <Text style={styles.statusValue}>{selectedStorefront.displayName}</Text>
                      </View>
                      <View style={styles.statusRow}>
                        <Text style={styles.statusLabel}>We will call</Text>
                        <Text style={styles.statusValue}>
                          {isLoadingDetail
                            ? 'Loading…'
                            : hasPhonePreview
                              ? shopPhone
                              : 'No published phone on file'}
                        </Text>
                      </View>
                      {!hasPhonePreview && !isLoadingDetail ? (
                        <Text style={styles.helperText}>
                          We don't have a published phone for this shop. Use the manual review
                          option below — our team will verify your ownership another way, usually
                          within 24 hours.
                        </Text>
                      ) : (
                        <Text style={styles.helperText}>
                          Make sure you can answer this phone right now — or pick the manual review
                          option below if you can't.
                        </Text>
                      )}
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

                    <Pressable
                      disabled={!canSubmitClaim || !hasPhonePreview}
                      onPress={() => {
                        void handleConfirmAndSubmit();
                      }}
                      style={[
                        styles.primaryButton,
                        (!canSubmitClaim || !hasPhonePreview) && styles.buttonDisabled,
                      ]}
                    >
                      <Text style={styles.primaryButtonText}>
                        {isSubmitting ? 'Calling shop…' : 'Confirm and call shop now'}
                      </Text>
                    </Pressable>
                    <Pressable
                      disabled={!selectedStorefront}
                      onPress={handleStartManualReview}
                      style={[styles.secondaryButton, !selectedStorefront && styles.buttonDisabled]}
                    >
                      <Text style={styles.secondaryButtonText}>
                        I can't answer the shop phone — request manual review
                      </Text>
                    </Pressable>
                  </View>
                </SectionCard>
              </MotionInView>
            </>
          ) : null}
        </>
      ) : (
        <MotionInView delay={120}>
          <SectionCard
            title="Request manual review"
            body="Tell us how to reach you and why you can't answer the shop's published phone. Most reviews finish within 24 hours."
          >
            <View style={styles.sectionStack}>
              {selectedStorefront ? (
                <View style={styles.statusPanel}>
                  <View style={styles.statusRow}>
                    <Text style={styles.statusLabel}>Storefront</Text>
                    <Text style={styles.statusValue}>{selectedStorefront.displayName}</Text>
                  </View>
                  <View style={styles.statusRow}>
                    <Text style={styles.statusLabel}>Address</Text>
                    <Text style={styles.statusValue}>
                      {describeStorefrontAddress(selectedStorefront)}
                    </Text>
                  </View>
                </View>
              ) : null}

              <View style={styles.plannerPanel}>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Reason</Text>
                  <View style={styles.wrapRow}>
                    {MANUAL_REVIEW_REASONS.map((reason) => {
                      const selected = manualReason === reason;
                      return (
                        <Pressable
                          key={reason}
                          onPress={() => setManualReason(reason)}
                          style={[styles.choiceChip, selected && styles.choiceChipSelected]}
                        >
                          <Text
                            style={[
                              styles.choiceChipText,
                              selected && styles.choiceChipTextSelected,
                            ]}
                          >
                            {reason}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>How can we reach you?</Text>
                  <TextInput
                    value={manualAlternate}
                    onChangeText={setManualAlternate}
                    placeholder="Phone or email — best way to confirm with you"
                    placeholderTextColor={colors.textSoft}
                    style={styles.inputPremium}
                    accessibilityLabel="Alternate contact"
                  />
                </View>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Anything else we should know? (optional)</Text>
                  <TextInput
                    value={manualNotes}
                    onChangeText={setManualNotes}
                    placeholder="Helpful context, role at the business, etc."
                    placeholderTextColor={colors.textSoft}
                    style={[styles.inputPremium, styles.textAreaPremium]}
                    multiline={true}
                    numberOfLines={4}
                    accessibilityLabel="Additional notes"
                  />
                </View>
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

              <Pressable
                disabled={!canSubmitManualReview}
                onPress={() => {
                  void handleSubmitManualReview();
                }}
                style={[styles.primaryButton, !canSubmitManualReview && styles.buttonDisabled]}
              >
                <Text style={styles.primaryButtonText}>
                  {isSubmitting ? 'Submitting…' : 'Submit for manual review'}
                </Text>
              </Pressable>
              <Pressable
                disabled={isSubmitting}
                onPress={() => setStage('find_shop')}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonText}>Back to claim</Text>
              </Pressable>
            </View>
          </SectionCard>
        </MotionInView>
      )}

      <MotionInView delay={240}>
        <SectionCard
          title="Need help?"
          body="If anything's confusing, you can always email support directly."
        >
          <View style={styles.ctaPanel}>
            <View style={styles.splitHeaderRow}>
              <View style={styles.splitHeaderCopy}>
                <Text style={styles.sectionEyebrow}>Direct help</Text>
                <Text style={styles.splitHeaderTitle}>{SUPPORT_EMAIL}</Text>
              </View>
              <AppUiIcon name="mail-open-outline" size={20} color="#F5C86A" />
            </View>
            <Pressable onPress={handleEmailSupport} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Email Support</Text>
            </Pressable>
          </View>
        </SectionCard>
      </MotionInView>
    </ScreenShell>
  );
}

export const OwnerPortalQuickClaimScreen = withScreenErrorBoundary(
  OwnerPortalQuickClaimScreenInner,
  'owner-portal-quick-claim',
);

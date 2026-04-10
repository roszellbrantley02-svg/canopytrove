import React from 'react';
import { Linking, Platform, Text, View } from 'react-native';
import { CustomerStateCard } from '../components/CustomerStateCard';
import { HapticPressable } from '../components/HapticPressable';
import { MotionInView } from '../components/MotionInView';
import { ScreenShell } from '../components/ScreenShell';
import { SectionCard } from '../components/SectionCard';
import { withScreenErrorBoundary } from '../components/withScreenErrorBoundary';
import {
  accountDeletionDisclosureText,
  communityGuidelines,
  hasPublishedLegalLinks,
  legalConfig,
  legalDocumentLinks,
  legalReadinessText,
  legalSupportLinks,
  locationDisclosureText,
  missingPublishedLegalLinks,
  moderationPolicyNotes,
  privacyPolicySections,
} from '../config/legal';
import {
  clearBlockedCommunityAuthors,
  getCommunitySafetyState,
  initializeCommunitySafetyState,
  subscribeToCommunitySafetyState,
  unblockCommunityAuthor,
} from '../services/communitySafetyService';
import { customerSupportStyles as styles } from './customerSupport/customerSupportStyles';

function LegalCenterScreenInner() {
  const [communitySafetyState, setCommunitySafetyState] = React.useState(() =>
    getCommunitySafetyState(),
  );

  React.useEffect(() => {
    let alive = true;

    void initializeCommunitySafetyState().then((state) => {
      if (alive) {
        setCommunitySafetyState(state);
      }
    });
    const unsubscribe = subscribeToCommunitySafetyState((state) => {
      if (alive) {
        setCommunitySafetyState(state);
      }
    });

    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);

  const refreshBlockedAuthors = React.useCallback(() => {
    setCommunitySafetyState(getCommunitySafetyState());
  }, []);

  const openExternalLink = React.useCallback((url: string | null) => {
    if (!url) {
      return;
    }

    if (Platform.OS === 'web') {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      void Linking.openURL(url);
    }
  }, []);

  const openSupportEmail = React.useCallback(() => {
    if (Platform.OS === 'web') {
      window.open(legalConfig.supportEmailUrl, '_blank', 'noopener,noreferrer');
    } else {
      void Linking.openURL(legalConfig.supportEmailUrl);
    }
  }, []);

  return (
    <ScreenShell
      eyebrow="Legal"
      title="Privacy and safety."
      subtitle="This is the in-app compliance hub for privacy, community standards, moderation, and account control."
      headerPill="Legal"
    >
      <MotionInView delay={120}>
        <SectionCard
          title="Release status"
          body={
            hasPublishedLegalLinks
              ? legalReadinessText
              : 'The app still needs live public legal pages before store submission. This screen now shows exactly what is missing.'
          }
        >
          <View style={styles.list}>
            {!hasPublishedLegalLinks ? (
              <CustomerStateCard
                title="Public legal links are still incomplete"
                body="The in-app legal center is present, but store submission still needs live public privacy, terms, and community-guidelines URLs."
                tone="danger"
                iconName="document-text-outline"
                eyebrow="Release readiness"
                note={`Still missing ${missingPublishedLegalLinks.length} public legal link${missingPublishedLegalLinks.length === 1 ? '' : 's'}.`}
              />
            ) : null}
            {legalDocumentLinks.map((link) => (
              <View key={link.key} style={[styles.resultCard, !link.url && styles.resultCardWarm]}>
                <Text style={styles.resultMeta}>{link.envVar}</Text>
                <Text style={styles.resultTitle}>
                  {link.label} {link.url ? 'Ready' : 'Missing'}
                </Text>
                <Text style={styles.helperText}>
                  {link.url ?? `Set ${link.envVar} to a live public URL.`}
                </Text>
              </View>
            ))}
            <View style={[styles.resultCard, styles.resultCardWarm]}>
              <Text style={styles.resultMeta}>Support</Text>
              <Text style={styles.resultTitle}>Support email</Text>
              <Text style={styles.helperText}>{legalConfig.supportEmail}</Text>
            </View>
          </View>
        </SectionCard>
      </MotionInView>

      <MotionInView delay={180}>
        <SectionCard
          title="Privacy policy summary"
          body="Publish the matching web policy URL before store submission. This in-app summary keeps the app itself transparent."
        >
          <View style={styles.list}>
            {privacyPolicySections.map((section) => (
              <View key={section.title} style={styles.resultCard}>
                <Text style={styles.resultTitle}>{section.title}</Text>
                <Text style={styles.helperText}>{section.body}</Text>
              </View>
            ))}
          </View>
        </SectionCard>
      </MotionInView>

      <MotionInView delay={240}>
        <SectionCard
          title="Community guidelines"
          body="Canopy Trove reviews should stay useful, lawful, and safe for everyone."
        >
          <View style={styles.list}>
            {communityGuidelines.map((line) => (
              <Text key={line} style={styles.helperText}>{`\u2022 ${line}`}</Text>
            ))}
          </View>
        </SectionCard>
      </MotionInView>

      <MotionInView delay={300}>
        <SectionCard
          title="Moderation and reporting"
          body="These are the current moderation controls and review expectations inside Canopy Trove."
        >
          <View style={styles.list}>
            {moderationPolicyNotes.map((line) => (
              <Text key={line} style={styles.helperText}>{`\u2022 ${line}`}</Text>
            ))}
          </View>
        </SectionCard>
      </MotionInView>

      <MotionInView delay={360}>
        <SectionCard title="Location disclosure" body={locationDisclosureText} />
      </MotionInView>

      <MotionInView delay={420}>
        <SectionCard title="Account deletion" body={accountDeletionDisclosureText} />
      </MotionInView>

      <MotionInView delay={480}>
        <SectionCard
          title="Blocked review authors"
          body={
            communitySafetyState.blockedReviewAuthors.length
              ? 'Blocked authors are hidden from their matching storefront review sections on this account.'
              : 'No review authors are blocked right now.'
          }
        >
          <View style={styles.list}>
            {communitySafetyState.blockedReviewAuthors.length === 0 ? (
              <CustomerStateCard
                title="No blocked review authors"
                body="Your review feed is currently showing every author normally. If you block someone later, their reviews will be hidden on that storefront for this account."
                tone="success"
                iconName="shield-checkmark-outline"
                eyebrow="Safety state"
              />
            ) : null}
            {communitySafetyState.blockedReviewAuthors.map((blockedAuthor) => (
              <View
                key={`${blockedAuthor.storefrontId}:${blockedAuthor.authorId}`}
                style={styles.resultCard}
              >
                <Text style={styles.resultMeta}>Blocked author</Text>
                <Text style={styles.resultTitle}>{blockedAuthor.authorId}</Text>
                <Text style={styles.helperText}>
                  {blockedAuthor.storefrontName?.trim()
                    ? `Storefront: ${blockedAuthor.storefrontName}`
                    : `Storefront ID: ${blockedAuthor.storefrontId}`}
                </Text>
                <HapticPressable
                  onPress={() => {
                    void unblockCommunityAuthor({
                      storefrontId: blockedAuthor.storefrontId,
                      authorId: blockedAuthor.authorId,
                    }).then(refreshBlockedAuthors);
                  }}
                  style={styles.secondaryButton}
                  accessibilityRole="button"
                  accessibilityLabel={`Unblock ${blockedAuthor.authorId}`}
                  accessibilityHint="Unblocks this author so their reviews are visible again on that storefront."
                >
                  <Text style={styles.secondaryButtonText}>Unblock</Text>
                </HapticPressable>
              </View>
            ))}
            {communitySafetyState.blockedReviewAuthors.length ? (
              <HapticPressable
                onPress={() => {
                  void clearBlockedCommunityAuthors().then(refreshBlockedAuthors);
                }}
                style={styles.secondaryButton}
                accessibilityRole="button"
                accessibilityLabel="Clear block list"
                accessibilityHint="Unblocks all authors to see their reviews again."
              >
                <Text style={styles.secondaryButtonText}>Clear Block List</Text>
              </HapticPressable>
            ) : null}
          </View>
        </SectionCard>
      </MotionInView>

      <MotionInView delay={540}>
        <SectionCard
          title="External links"
          body="These URLs should point to live public documents before the app goes to the stores."
        >
          <View style={styles.form}>
            <HapticPressable
              onPress={openSupportEmail}
              style={styles.primaryButton}
              accessibilityRole="button"
              accessibilityLabel="Email support"
              accessibilityHint="Opens an email compose window to contact support."
            >
              <Text style={styles.primaryButtonText}>Email Support</Text>
            </HapticPressable>
            {legalSupportLinks.map((link) =>
              link.url ? (
                <HapticPressable
                  key={link.key}
                  onPress={() => openExternalLink(link.url)}
                  style={styles.secondaryButton}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${link.label}`}
                  accessibilityHint="Opens the external legal link in a browser."
                >
                  <Text style={styles.secondaryButtonText}>{`Open ${link.label}`}</Text>
                </HapticPressable>
              ) : null,
            )}
            {legalDocumentLinks.map((link) =>
              link.url ? (
                <HapticPressable
                  key={link.key}
                  onPress={() => openExternalLink(link.url)}
                  style={styles.secondaryButton}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${link.label}`}
                  accessibilityHint="Opens the external legal document in a browser."
                >
                  <Text style={styles.secondaryButtonText}>{`Open ${link.label}`}</Text>
                </HapticPressable>
              ) : null,
            )}
            {!hasPublishedLegalLinks ? (
              <CustomerStateCard
                title="Some external legal links are still missing"
                body="The support email works now, but missing public legal URLs still need to be published before release."
                tone="warm"
                iconName="link-outline"
                eyebrow="External links"
              >
                <View style={styles.list}>
                  {missingPublishedLegalLinks.map((link) => (
                    <Text key={link.key} style={styles.helperText}>
                      {`\u2022 Missing ${link.label}: set ${link.envVar}`}
                    </Text>
                  ))}
                </View>
              </CustomerStateCard>
            ) : null}
            {!legalConfig.privacyPolicyUrl &&
            !legalConfig.termsUrl &&
            !legalConfig.communityGuidelinesUrl ? (
              <Text style={styles.helperText}>
                Publish the public legal URLs and add them to the Expo public env vars before store
                submission.
              </Text>
            ) : null}
          </View>
        </SectionCard>
      </MotionInView>
    </ScreenShell>
  );
}

export const LegalCenterScreen = withScreenErrorBoundary(
  LegalCenterScreenInner,
  'legal-center-screen',
);

import React from 'react';
import { Linking, Text, View } from 'react-native';
import { CustomerStateCard } from '../components/CustomerStateCard';
import { HapticPressable } from '../components/HapticPressable';
import { MotionInView } from '../components/MotionInView';
import { ScreenShell } from '../components/ScreenShell';
import { SectionCard } from '../components/SectionCard';
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
  unblockCommunityAuthor,
} from '../services/communitySafetyService';
import { customerSupportStyles as styles } from './customerSupport/customerSupportStyles';

export function LegalCenterScreen() {
  const [blockedAuthorProfileIds, setBlockedAuthorProfileIds] = React.useState<string[]>([]);

  React.useEffect(() => {
    let alive = true;

    void initializeCommunitySafetyState().then((state) => {
      if (alive) {
        setBlockedAuthorProfileIds(state.blockedAuthorProfileIds);
      }
    });

    return () => {
      alive = false;
    };
  }, []);

  const refreshBlockedAuthors = React.useCallback(() => {
    setBlockedAuthorProfileIds(getCommunitySafetyState().blockedAuthorProfileIds);
  }, []);

  const openExternalLink = React.useCallback((url: string | null) => {
    if (!url) {
      return;
    }

    void Linking.openURL(url);
  }, []);

  const openSupportEmail = React.useCallback(() => {
    void Linking.openURL(legalConfig.supportEmailUrl);
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
              <View
                key={link.key}
                style={[styles.resultCard, !link.url && styles.resultCardWarm]}
              >
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
            blockedAuthorProfileIds.length
              ? 'Blocked authors are hidden from review sections on this device.'
              : 'No review authors are blocked right now.'
          }
        >
          <View style={styles.list}>
            {blockedAuthorProfileIds.length === 0 ? (
              <CustomerStateCard
                title="No blocked review authors"
                body="Your review feed is currently showing every author normally. If you block someone later, their reviews will be hidden on this device."
                tone="success"
                iconName="shield-checkmark-outline"
                eyebrow="Safety state"
              />
            ) : null}
            {blockedAuthorProfileIds.map((profileId) => (
              <View key={profileId} style={styles.resultCard}>
                <Text style={styles.resultMeta}>Blocked author</Text>
                <Text style={styles.resultTitle}>{profileId}</Text>
                <HapticPressable
                  onPress={() => {
                    void unblockCommunityAuthor(profileId).then(refreshBlockedAuthors);
                  }}
                  style={styles.secondaryButton}
                >
                  <Text style={styles.secondaryButtonText}>Unblock</Text>
                </HapticPressable>
              </View>
            ))}
            {blockedAuthorProfileIds.length ? (
              <HapticPressable
                onPress={() => {
                  void clearBlockedCommunityAuthors().then(refreshBlockedAuthors);
                }}
                style={styles.secondaryButton}
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
            <HapticPressable onPress={openSupportEmail} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Email Support</Text>
            </HapticPressable>
            {legalSupportLinks.map((link) =>
              link.url ? (
                <HapticPressable
                  key={link.key}
                  onPress={() => openExternalLink(link.url)}
                  style={styles.secondaryButton}
                >
                  <Text style={styles.secondaryButtonText}>{`Open ${link.label}`}</Text>
                </HapticPressable>
              ) : null
            )}
            {legalDocumentLinks.map((link) =>
              link.url ? (
                <HapticPressable
                  key={link.key}
                  onPress={() => openExternalLink(link.url)}
                  style={styles.secondaryButton}
                >
                  <Text style={styles.secondaryButtonText}>{`Open ${link.label}`}</Text>
                </HapticPressable>
              ) : null
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
            {!legalConfig.privacyPolicyUrl && !legalConfig.termsUrl && !legalConfig.communityGuidelinesUrl ? (
              <Text style={styles.helperText}>
                Publish the public legal URLs and add them to the Expo public env vars before store submission.
              </Text>
            ) : null}
          </View>
        </SectionCard>
      </MotionInView>
    </ScreenShell>
  );
}

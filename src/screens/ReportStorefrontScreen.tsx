import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { CustomerStateCard } from '../components/CustomerStateCard';
import { MotionInView } from '../components/MotionInView';
import { ScreenShell } from '../components/ScreenShell';
import { SectionCard } from '../components/SectionCard';
import {
  useStorefrontProfileController,
  useStorefrontRewardsController,
} from '../context/StorefrontController';
import { RootStackParamList } from '../navigation/RootNavigator';
import { trackAnalyticsEvent } from '../services/analyticsService';
import { submitStorefrontReport } from '../services/storefrontCommunityService';
import { storefrontSourceMode } from '../config/storefrontSourceConfig';
import { colors, radii, spacing, typography } from '../theme/tokens';

type ReportRoute = RouteProp<RootStackParamList, 'ReportStorefront'>;

const REPORT_REASONS = [
  'Listing issue',
  'Address issue',
  'Store closed',
  'Wrong storefront',
  'Other',
];
const MIN_REPORT_DESCRIPTION_LENGTH = 12;
const REPORT_SCREEN_NAME = 'ReportStorefront';

function getReportValidationState(textLength: number) {
  if (textLength >= MIN_REPORT_DESCRIPTION_LENGTH) {
    return null;
  }

  return `Add ${MIN_REPORT_DESCRIPTION_LENGTH - textLength} more characters so the report can be reviewed.`;
}

function getReportSubmitErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : '';

  if (
    message.includes('403') ||
    message.includes('forbidden') ||
    message.includes('not allowed') ||
    message.includes('cannot submit')
  ) {
    return 'This profile cannot submit reports right now.';
  }

  if (message.includes('429') || message.includes('too many') || message.includes('rate')) {
    return 'Too many report attempts right now. Wait a moment and try again.';
  }

  return 'Could not submit the report right now. Try again.';
}

function getReportStorageBody() {
  return 'Every report stores the storefront id, your profile id, the reason you picked, your notes, and a timestamp so it can be reviewed later.';
}

function getReportRoutingBody() {
  if (storefrontSourceMode === 'api') {
    return 'This build sends reports to the Canopy Trove backend moderation path. When backend Firestore is configured, the report is written into the storefront_reports review queue.';
  }

  return 'This preview build stores reports locally on this device for testing. They stay in the Canopy Trove storefront community cache until the live backend moderation path is enabled.';
}

export function ReportStorefrontScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<ReportRoute>();
  const { storefront } = route.params;
  const { appProfile, profileId } = useStorefrontProfileController();
  const { applyRewardResult, trackReportSubmittedReward } = useStorefrontRewardsController();
  const [reason, setReason] = React.useState(REPORT_REASONS[0]);
  const [description, setDescription] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitErrorText, setSubmitErrorText] = React.useState<string | null>(null);
  const descriptionLength = description.trim().length;
  const validationState = getReportValidationState(descriptionLength);

  React.useEffect(() => {
    trackAnalyticsEvent(
      'report_started',
      {
        sourceScreen: REPORT_SCREEN_NAME,
      },
      {
        screen: REPORT_SCREEN_NAME,
        storefrontId: storefront.id,
      }
    );
  }, [storefront.id]);

  const handleSubmit = async () => {
    if (isSubmitting) {
      return;
    }

    if (validationState) {
      setSubmitErrorText(validationState);
      return;
    }

    setSubmitErrorText(null);
    setIsSubmitting(true);
    try {
      const response = await submitStorefrontReport({
        storefrontId: storefront.id,
        profileId,
        authorName:
          appProfile?.displayName ||
          (appProfile?.kind === 'authenticated' ? 'Canopy Trove member' : 'Canopy Trove user'),
        reason,
        description: description.trim(),
      });

      if (response.rewardResult) {
        applyRewardResult(response.rewardResult);
      } else {
        trackReportSubmittedReward();
      }

      trackAnalyticsEvent(
        'report_submitted',
        {
          reason,
          descriptionLength,
        },
        {
          screen: REPORT_SCREEN_NAME,
          storefrontId: storefront.id,
        }
      );

      navigation.goBack();
    } catch (error) {
      setSubmitErrorText(getReportSubmitErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScreenShell
      eyebrow="Report"
      title={`Report ${storefront.displayName}`}
      subtitle="Use reports for data or storefront problems. They support moderation and quality control, not points."
      headerPill="Report"
    >
      <MotionInView delay={80}>
        <SectionCard
          title="Report snapshot"
          body="Reports help clean up storefront quality and moderation issues. This flow is intentionally calmer than rewards-based actions."
        >
          <View style={styles.overviewCard}>
            <Text style={styles.storefrontName}>{storefront.displayName}</Text>
            <Text style={styles.storefrontAddress}>
              {storefront.addressLine1}, {storefront.city}, {storefront.state} {storefront.zip}
            </Text>
            <View style={styles.summaryStrip}>
              <View style={styles.summaryTile}>
                <Text style={styles.summaryTileValue}>{reason}</Text>
                <Text style={styles.summaryTileLabel}>Current reason</Text>
                <Text style={styles.summaryTileBody}>
                  The selected routing reason for moderation review.
                </Text>
              </View>
              <View style={styles.summaryTile}>
                <Text style={styles.summaryTileValue}>{descriptionLength}</Text>
                <Text style={styles.summaryTileLabel}>Characters</Text>
                <Text style={styles.summaryTileBody}>
                  Enough detail helps the report get reviewed faster.
                </Text>
              </View>
              <View style={styles.summaryTile}>
                <Text style={styles.summaryTileValue}>
                  {storefrontSourceMode === 'api' ? 'Backend' : 'Preview'}
                </Text>
                <Text style={styles.summaryTileLabel}>Routing mode</Text>
                <Text style={styles.summaryTileBody}>
                  Where this report will be stored for moderation follow-up.
                </Text>
              </View>
            </View>
          </View>
        </SectionCard>
      </MotionInView>

      <MotionInView delay={140}>
        <SectionCard
          title="Reason"
          body="Pick the closest reason so Canopy Trove can route the report correctly later."
        >
          <View style={styles.reasonRow}>
            {REPORT_REASONS.map((value) => {
              const selected = reason === value;
              return (
                <Pressable
                  key={value}
                  onPress={() => setReason(value)}
                  style={[styles.reasonChip, selected && styles.reasonChipSelected]}
                >
                  <Text style={[styles.reasonText, selected && styles.reasonTextSelected]}>
                    {value}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </SectionCard>
      </MotionInView>

      <MotionInView delay={200}>
        <SectionCard title="Details" body="Add enough detail so the issue can be reviewed later.">
          <TextInput
            multiline
            value={description}
            onChangeText={(text) => {
              setSubmitErrorText(null);
              setDescription(text);
            }}
            placeholder="Describe the issue with this storefront listing."
            placeholderTextColor={colors.textSoft}
            style={styles.input}
            textAlignVertical="top"
          />
          <Text style={styles.caption}>{descriptionLength} characters</Text>
          {validationState ? (
            <CustomerStateCard
              title="More detail is still needed"
              body={validationState}
              tone="warm"
              iconName="document-text-outline"
              eyebrow="Validation"
            />
          ) : (
            <CustomerStateCard
              title="Reports are for quality control"
              body="Reports help correct storefront data and moderation issues. They do not award points or badges."
              tone="neutral"
              iconName="shield-checkmark-outline"
              eyebrow="Reassurance"
            />
          )}
        </SectionCard>
      </MotionInView>

      <MotionInView delay={260}>
        <SectionCard title="What gets stored" body={getReportStorageBody()}>
          <View style={styles.infoCard}>
            <View style={styles.infoHeader}>
              <View style={styles.infoIconWrap}>
                <Ionicons name="archive-outline" size={18} color={colors.goldSoft} />
              </View>
              <View style={styles.infoCopy}>
                <Text style={styles.infoTitle}>Report audit trail</Text>
                <Text style={styles.infoBody}>
                  Reports store the storefront id, reporting profile, selected reason, notes, and a
                  timestamp so the moderation trail stays reviewable.
                </Text>
              </View>
            </View>
          </View>
        </SectionCard>
      </MotionInView>

      <MotionInView delay={300}>
        <SectionCard title="Where this report goes" body={getReportRoutingBody()}>
          <View style={styles.infoCard}>
            <View style={styles.infoHeader}>
              <View style={styles.infoIconWrap}>
                <Ionicons
                  name={storefrontSourceMode === 'api' ? 'server-outline' : 'phone-portrait-outline'}
                  size={18}
                  color={colors.cyan}
                />
              </View>
              <View style={styles.infoCopy}>
                <Text style={styles.infoTitle}>Moderation routing</Text>
                <Text style={styles.infoBody}>{getReportRoutingBody()}</Text>
              </View>
            </View>
          </View>
        </SectionCard>
      </MotionInView>

      <MotionInView delay={360}>
        <SectionCard
          title="Send report"
          body="Send the report once the reason and notes are accurate. Reports are reviewed for quality control, not rewards."
        >
          <View style={styles.ctaPanel}>
            <View style={styles.summaryStrip}>
              <View style={styles.summaryTile}>
                <Text style={styles.summaryTileValue}>{reason}</Text>
                <Text style={styles.summaryTileLabel}>Selected reason</Text>
                <Text style={styles.summaryTileBody}>
                  Current moderation reason attached to this report.
                </Text>
              </View>
              <View style={styles.summaryTile}>
                <Text style={styles.summaryTileValue}>
                  {validationState ? 'Needs detail' : 'Ready'}
                </Text>
                <Text style={styles.summaryTileLabel}>Validation</Text>
                <Text style={styles.summaryTileBody}>
                  {validationState ?? 'The report has enough detail to be submitted.'}
                </Text>
              </View>
            </View>
            {submitErrorText ? (
              <CustomerStateCard
                title="Report submission did not go through"
                body={submitErrorText}
                tone="danger"
                iconName="alert-circle-outline"
                eyebrow="Submit state"
              />
            ) : null}
            <Pressable
              disabled={isSubmitting}
              onPress={() => {
                void handleSubmit();
              }}
              style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
            >
              <Ionicons name="flag-outline" size={16} color={colors.background} />
              <Text style={styles.submitButtonText}>
                {isSubmitting ? 'Submitting...' : 'Submit Report'}
              </Text>
            </Pressable>
          </View>
        </SectionCard>
      </MotionInView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  overviewCard: {
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: 'rgba(245, 200, 106, 0.18)',
    backgroundColor: colors.surfaceGlassStrong,
    padding: spacing.xl,
    gap: spacing.lg,
  },
  storefrontName: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: '900',
    lineHeight: 28,
  },
  storefrontAddress: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 22,
  },
  summaryStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  summaryTile: {
    minWidth: 136,
    flexGrow: 1,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: 'rgba(8, 14, 19, 0.76)',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  summaryTileValue: {
    color: colors.text,
    fontSize: typography.section,
    fontWeight: '900',
  },
  summaryTileLabel: {
    color: colors.goldSoft,
    fontSize: typography.caption,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryTileBody: {
    color: colors.textMuted,
    fontSize: typography.caption,
    lineHeight: 18,
  },
  reasonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  reasonChip: {
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceGlass,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  reasonChipSelected: {
    backgroundColor: 'rgba(255, 122, 122, 0.14)',
    borderColor: 'rgba(255, 122, 122, 0.28)',
  },
  reasonText: {
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: '700',
  },
  reasonTextSelected: {
    color: colors.rose,
  },
  input: {
    minHeight: 152,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceGlass,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    color: colors.text,
    padding: spacing.lg,
    fontSize: typography.body,
    lineHeight: 22,
  },
  caption: {
    marginTop: spacing.sm,
    color: colors.goldSoft,
    fontSize: typography.caption,
    fontWeight: '700',
  },
  helperText: {
    marginTop: spacing.sm,
    color: colors.textSoft,
    fontSize: typography.caption,
    fontWeight: '600',
    lineHeight: 18,
  },
  validationText: {
    marginTop: spacing.sm,
    color: colors.warning,
    fontSize: typography.caption,
    fontWeight: '700',
    lineHeight: 18,
  },
  infoCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: 'rgba(8, 14, 19, 0.72)',
    padding: spacing.lg,
    gap: spacing.md,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  infoIconWrap: {
    width: 38,
    height: 38,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: 'rgba(8, 14, 19, 0.78)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  infoTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '900',
  },
  infoBody: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 22,
  },
  ctaPanel: {
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: 'rgba(245, 200, 106, 0.18)',
    backgroundColor: 'rgba(18, 25, 31, 0.88)',
    padding: spacing.xl,
    gap: spacing.lg,
  },
  errorText: {
    color: colors.danger,
    fontSize: typography.caption,
    fontWeight: '700',
    lineHeight: 18,
  },
  submitButton: {
    minHeight: 50,
    borderRadius: radii.md,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    shadowColor: colors.danger,
    shadowOpacity: 0.22,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  submitButtonDisabled: {
    opacity: 0.45,
  },
  submitButtonText: {
    color: colors.background,
    fontSize: typography.body,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
});

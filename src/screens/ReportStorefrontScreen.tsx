import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CustomerStateCard } from '../components/CustomerStateCard';
import { MotionInView } from '../components/MotionInView';
import { ScreenShell } from '../components/ScreenShell';
import { SectionCard } from '../components/SectionCard';
import { withScreenErrorBoundary } from '../components/withScreenErrorBoundary';
import { AppUiIcon } from '../icons/AppUiIcon';
import {
  useStorefrontProfileController,
  useStorefrontRewardsController,
} from '../context/StorefrontController';
import { crossPlatformAlert } from '../utils/crossPlatformAlert';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { trackAnalyticsEvent } from '../services/analyticsService';
import { submitStorefrontReport } from '../services/storefrontCommunityService';
import { storefrontSourceMode } from '../config/storefrontSourceConfig';
import { colors, radii, spacing, typography } from '../theme/tokens';
import type { StorefrontReportEntryMode } from './reportStorefront/ReportStorefrontSections';
import {
  REPORT_REASONS,
  REPORT_SCREEN_NAME,
  ReportStorefrontInfoCard,
  ReportStorefrontValidationCard,
  getReportDetailsPlaceholder,
  getReportRoutingBody,
  getReportRoutingIconName,
  getReportScreenSubtitle,
  getReportScreenTitle,
  getReportSnapshotBody,
  getReportStorageBody,
  getReportSubmitBody,
  getReportSubmitErrorMessage,
  getReportValidationState,
  isReportReason,
} from './reportStorefront/ReportStorefrontSections';

type ReportRoute = RouteProp<RootStackParamList, 'ReportStorefront'>;

function ReportStorefrontScreenInner() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<ReportRoute>();
  const routeParams =
    (route.params as Partial<RootStackParamList['ReportStorefront']> | undefined) ?? undefined;
  const storefront = routeParams?.storefront ?? null;
  const { appProfile, authSession, profileId } = useStorefrontProfileController();
  const { applyRewardResult, trackReportSubmittedReward } = useStorefrontRewardsController();
  const entryMode: StorefrontReportEntryMode = routeParams?.entryMode ?? 'general_report';
  const initialReason = routeParams?.initialReason;
  const initialDescription = routeParams?.initialDescription ?? '';
  const [reason, setReason] = React.useState(
    initialReason && isReportReason(initialReason) ? initialReason : REPORT_REASONS[0],
  );
  const [description, setDescription] = React.useState(initialDescription);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitErrorText, setSubmitErrorText] = React.useState<string | null>(null);
  const descriptionLength = description.trim().length;
  const validationState = getReportValidationState(descriptionLength);

  React.useEffect(() => {
    if (!storefront) {
      return;
    }

    trackAnalyticsEvent(
      'report_started',
      {
        sourceScreen: REPORT_SCREEN_NAME,
      },
      {
        screen: REPORT_SCREEN_NAME,
        storefrontId: storefront.id,
      },
    );
  }, [storefront]);

  if (!storefront) {
    return (
      <ScreenShell
        eyebrow="Report"
        title="Storefront unavailable"
        subtitle="This report screen needs a storefront before you can send a report."
        headerPill="Report"
      >
        <CustomerStateCard
          title="Report could not start"
          body="This report opened without a storefront. Head back to the storefront page and try again."
          tone="warm"
          iconName="flag-outline"
          eyebrow="Navigation"
        />
      </ScreenShell>
    );
  }

  const handleSubmit = async () => {
    if (isSubmitting) {
      return;
    }

    if (authSession.status !== 'authenticated') {
      if (authSession.status === 'disabled') {
        crossPlatformAlert(
          'Sign in unavailable',
          'Reporting storefronts requires a signed-in account, but sign-in is not available in this build right now.',
          [{ text: 'OK', style: 'cancel' }],
        );
        return;
      }

      crossPlatformAlert(
        'Sign in required',
        'You need to sign in before you can send a storefront report.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Sign In',
            onPress: () => navigation.navigate('Tabs', { screen: 'Profile' }),
          },
        ],
      );
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
        },
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
      title={getReportScreenTitle(entryMode, storefront.displayName)}
      subtitle={getReportScreenSubtitle(entryMode)}
      headerPill="Report"
    >
      <MotionInView delay={80}>
        <SectionCard title="About this report" body={getReportSnapshotBody(entryMode)}>
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
                  The issue you have selected for this report.
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
                <Text style={styles.summaryTileLabel}>Review path</Text>
                <Text style={styles.summaryTileBody}>
                  How this report will be handled after you send it.
                </Text>
              </View>
            </View>
          </View>
        </SectionCard>
      </MotionInView>

      <MotionInView delay={140}>
        <SectionCard title="Reason" body="Pick the reason that best matches the problem.">
          <View style={styles.reasonRow}>
            {REPORT_REASONS.map((value) => {
              const selected = reason === value;
              return (
                <Pressable
                  key={value}
                  onPress={() => setReason(value)}
                  style={[styles.reasonChip, selected && styles.reasonChipSelected]}
                  accessibilityRole="radio"
                  accessibilityLabel={value}
                  accessibilityHint="Selects this reason for the storefront report"
                  accessibilityState={{ selected }}
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
        <SectionCard
          title="Details"
          body="Add enough detail so our team can understand what happened."
        >
          <TextInput
            multiline
            value={description}
            onChangeText={(text) => {
              setSubmitErrorText(null);
              setDescription(text);
            }}
            placeholder={getReportDetailsPlaceholder(entryMode)}
            placeholderTextColor={colors.textSoft}
            style={styles.input}
            textAlignVertical="top"
            accessibilityLabel="Report details"
            accessibilityHint="Describe the issue with the storefront in detail."
          />
          <Text style={styles.caption}>{descriptionLength} characters</Text>
          <ReportStorefrontValidationCard validationState={validationState} />
        </SectionCard>
      </MotionInView>

      <MotionInView delay={260}>
        <SectionCard title="What we save with your report" body={getReportStorageBody()}>
          <ReportStorefrontInfoCard
            title="Saved with this report"
            body="We save the storefront, the reason you picked, your notes, and the time you sent the report."
            iconName="archive-outline"
            iconColor={colors.goldSoft}
          />
        </SectionCard>
      </MotionInView>

      <MotionInView delay={300}>
        <SectionCard title="How this gets reviewed" body={getReportRoutingBody()}>
          <ReportStorefrontInfoCard
            title="Review path"
            body={getReportRoutingBody()}
            iconName={getReportRoutingIconName()}
            iconColor={colors.cyan}
          />
        </SectionCard>
      </MotionInView>

      <MotionInView delay={360}>
        <SectionCard title="Send report" body={getReportSubmitBody(entryMode)}>
          <View style={styles.ctaPanel}>
            <View style={styles.summaryStrip}>
              <View style={styles.summaryTile}>
                <Text style={styles.summaryTileValue}>{reason}</Text>
                <Text style={styles.summaryTileLabel}>Selected reason</Text>
                <Text style={styles.summaryTileBody}>The issue this report is being sent for.</Text>
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
                title="Report could not be sent"
                body={submitErrorText}
                tone="danger"
                iconName="alert-circle-outline"
                eyebrow="Send report"
              />
            ) : null}
            <Pressable
              disabled={isSubmitting}
              onPress={() => {
                void handleSubmit();
              }}
              style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
              accessibilityRole="button"
              accessibilityLabel="Submit report"
              accessibilityHint="Sends this storefront report to our team."
            >
              <AppUiIcon name="flag-outline" size={16} color={colors.backgroundDeep} />
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

export const ReportStorefrontScreen = withScreenErrorBoundary(
  ReportStorefrontScreenInner,
  'report-storefront-screen',
);

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
    color: colors.textSoft,
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
    color: colors.textSoft,
    fontSize: typography.caption,
    fontWeight: '700',
  },
  ctaPanel: {
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: 'rgba(18, 25, 31, 0.88)',
    padding: spacing.xl,
    gap: spacing.lg,
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
    color: colors.backgroundDeep,
    fontSize: typography.body,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
});

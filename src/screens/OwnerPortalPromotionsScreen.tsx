import { colors } from '../theme/tokens';
import React from 'react';
import type { RouteProp } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import { Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { withScreenErrorBoundary } from '../components/withScreenErrorBoundary';
import { MotionInView } from '../components/MotionInView';
import { ScreenShell } from '../components/ScreenShell';
import { SectionCard } from '../components/SectionCard';
import { AppUiIcon } from '../icons/AppUiIcon';

import type { RootStackParamList } from '../navigation/RootNavigator';
import type {
  OwnerPromotionCardTone,
  OwnerPromotionPlacementScope,
  OwnerPromotionPlacementSurface,
  OwnerPromotionAudience,
} from '../types/ownerPortal';
import { OwnerPortalAnalyticsCard } from './ownerPortal/OwnerPortalAnalyticsCard';
import {
  clampProgress,
  formatCount,
  formatRate,
  getRelativeProgress,
} from './ownerPortal/ownerPortalMetricUtils';
import type { OwnerPromotionPlannerFormState } from './ownerPortal/ownerPortalPromotionUtils';
import {
  buildPromotionPlannerInput,
  createDefaultPromotionEnd,
  createDefaultPromotionPlannerState,
  createDefaultPromotionStart,
  DEFAULT_PROMOTION_PLACEMENT_SURFACES,
  formatPromotionPlacementScope,
  formatPromotionPlacementSurfaces,
  formatPromotionValue,
  getAndroidEligibilityLabel,
  getPromotionAnalyticsSummary,
  getPromotionPerformancePresentation,
  getPromotionPlannerBody,
  getPromotionPlannerModeLabel,
  getPromotionPlannerStateFromDraft,
  getPromotionPlannerStateFromPromotion,
  getPromotionPlannerTitle,
  getPromotionRuntimeMessage,
  getPromotionSaveButtonLabel,
  getPromotionTrackedActions,
  precheckAndroidModeration,
  PROMOTION_AUDIENCE_OPTIONS,
  PROMOTION_CARD_TONE_OPTIONS,
  PROMOTION_PLACEMENT_SCOPE_OPTIONS,
  PROMOTION_PLACEMENT_SURFACE_OPTIONS,
} from './ownerPortal/ownerPortalPromotionUtils';
import { ownerPortalStyles as styles } from './ownerPortal/ownerPortalStyles';
import { useOwnerPortalWorkspace } from './ownerPortal/useOwnerPortalWorkspace';
import { getOwnerTierDefinition } from '../types/ownerTiers';

type OwnerPortalPromotionsRoute = RouteProp<RootStackParamList, 'OwnerPortalPromotions'>;
const ignoreAsyncError = () => undefined;
const metricGridMinWidthStyle = { minWidth: 920 } as const;

function OwnerPortalPromotionsScreenInner() {
  const route = useRoute<OwnerPortalPromotionsRoute>();
  const isAndroid = Platform.OS === 'android';
  const preview = route.params?.preview ?? false;
  const {
    workspace,
    runtimeStatus,
    isLoading,
    isSaving,
    isAiLoading,
    errorText,
    aiErrorText,
    createPromotion,
    updatePromotion,
    deletePromotion,
    draftPromotionWithAi,
  } = useOwnerPortalWorkspace(preview);
  const [editingPromotionId, setEditingPromotionId] = React.useState<string | null>(null);
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [badgesInput, setBadgesInput] = React.useState('');
  const [startsAt, setStartsAt] = React.useState(createDefaultPromotionStart());
  const [endsAt, setEndsAt] = React.useState(createDefaultPromotionEnd());
  const [audiences, setAudiences] = React.useState<OwnerPromotionAudience[]>(['all_followers']);
  const [cardTone, setCardTone] = React.useState<OwnerPromotionCardTone>('hot_deal');
  const [alertFollowersOnStart, setAlertFollowersOnStart] = React.useState(true);
  const [placementSurfaces, setPlacementSurfaces] = React.useState<
    OwnerPromotionPlacementSurface[]
  >(DEFAULT_PROMOTION_PLACEMENT_SURFACES);
  const [placementScope, setPlacementScope] =
    React.useState<OwnerPromotionPlacementScope>('storefront_area');

  const applyPlannerState = React.useCallback((nextState: OwnerPromotionPlannerFormState) => {
    setTitle(nextState.title);
    setDescription(nextState.description);
    setBadgesInput(nextState.badgesInput);
    setStartsAt(nextState.startsAt);
    setEndsAt(nextState.endsAt);
    setAudiences(nextState.audiences);
    setCardTone(nextState.cardTone);
    setAlertFollowersOnStart(nextState.alertFollowersOnStart);
    setPlacementSurfaces(nextState.placementSurfaces);
    setPlacementScope(nextState.placementScope);
  }, []);

  const resetForm = React.useCallback(() => {
    setEditingPromotionId(null);
    applyPlannerState(createDefaultPromotionPlannerState());
  }, [applyPlannerState]);

  const promotions = React.useMemo(() => workspace?.promotions ?? [], [workspace?.promotions]);
  const promotionPerformance = React.useMemo(
    () => workspace?.promotionPerformance ?? [],
    [workspace?.promotionPerformance],
  );
  const tierDef = getOwnerTierDefinition(workspace?.tier);
  const maxPromotions = tierDef.maxPromotions;
  const nonExpiredPromotionCount = promotions.filter((p) => p.status !== 'expired').length;
  const isAtPromotionLimit =
    !editingPromotionId && (maxPromotions === 0 || nonExpiredPromotionCount >= maxPromotions);
  const {
    activePromotions,
    totalImpressions,
    totalTrackedActions,
    bestActionRate,
    topPerformance,
    maxPromotionImpressions,
    maxPromotionActions,
  } = React.useMemo(
    () => getPromotionAnalyticsSummary(promotions, promotionPerformance),
    [promotions, promotionPerformance],
  );
  const plannerTitle = getPromotionPlannerTitle(editingPromotionId);
  const plannerBody = getPromotionPlannerBody(editingPromotionId);
  const promotionWritesEnabled = runtimeStatus?.policy.promotionWritesEnabled !== false;
  const runtimeMessage = getPromotionRuntimeMessage(
    promotionWritesEnabled,
    runtimeStatus?.policy.safeModeEnabled === true,
  );
  const plannerModeLabel = getPromotionPlannerModeLabel(editingPromotionId);
  const saveButtonLabel = getPromotionSaveButtonLabel({
    preview,
    promotionWritesEnabled,
    isSaving,
    editingPromotionId,
  });
  const ctaDisabled =
    isSaving ||
    isAtPromotionLimit ||
    (!preview && !promotionWritesEnabled) ||
    !title.trim() ||
    !description.trim() ||
    !startsAt.trim() ||
    !endsAt.trim();

  const androidPrecheck =
    Platform.OS === 'android'
      ? precheckAndroidModeration(
          title,
          description,
          badgesInput
            .split(',')
            .map((b) => b.trim())
            .filter(Boolean),
        )
      : null;

  return (
    <ScreenShell
      eyebrow="Owner Portal"
      title={isAndroid ? 'Updates and results.' : 'Promotions and results.'}
      subtitle={
        isAndroid
          ? 'Create updates, spotlight the most important ones, and compare performance over time.'
          : 'Create offers, spotlight the most important ones, and compare performance over time.'
      }
      headerPill={isAndroid ? 'Updates' : 'Hot Deals'}
    >
      <MotionInView delay={70}>
        <View style={styles.portalHeroCard}>
          <View style={styles.portalHeroGlow} />
          <Text style={styles.portalHeroKicker}>
            {isAndroid ? 'Update studio' : 'Offer studio'}
          </Text>
          <Text style={styles.portalHeroTitle}>
            {isAndroid
              ? 'Share updates customers should notice.'
              : 'Share offers customers should notice.'}
          </Text>
          <Text style={styles.portalHeroBody}>
            {isAndroid
              ? 'Use updates for day-to-day highlights and save featured cards for bigger stories.'
              : 'Use offers for timely deals and save featured cards for bigger stories.'}
          </Text>
          <View style={styles.portalHeroMetricRow}>
            <View style={styles.portalHeroMetricCard}>
              <Text style={styles.portalHeroMetricValue}>{activePromotions}</Text>
              <Text style={styles.portalHeroMetricLabel}>
                {isAndroid ? 'Active Updates' : 'Active Offers'}
              </Text>
            </View>
            <View style={styles.portalHeroMetricCard}>
              <Text style={styles.portalHeroMetricValue}>{promotionPerformance.length}</Text>
              <Text style={styles.portalHeroMetricLabel}>
                {isAndroid ? 'Tracked Updates' : 'Tracked Offers'}
              </Text>
            </View>
            <View style={styles.portalHeroMetricCard}>
              <Text style={styles.portalHeroMetricValue}>
                {workspace?.metrics.storefrontImpressions7d ?? 0}
              </Text>
              <Text style={styles.portalHeroMetricLabel}>Storefront Views 7D</Text>
            </View>
          </View>
          <View style={styles.portalHeroMetaRow}>
            <View style={styles.metaChip}>
              <Text style={styles.metaChipText}>{'Business portal'}</Text>
            </View>
            <View style={styles.metaChip}>
              <Text style={styles.metaChipText}>
                {Platform.OS === 'android'
                  ? 'Updates first, featured cards when needed'
                  : 'Offers first, featured cards when needed'}
              </Text>
            </View>
          </View>
        </View>
      </MotionInView>

      <MotionInView delay={120}>
        <SectionCard
          title={isAndroid ? 'Update editor' : 'Offer editor'}
          body={
            isAndroid
              ? 'Choose dates, audience, and placement. Each storefront can keep up to five scheduled or active updates at once.'
              : 'Choose dates, audience, and placement. Each storefront can keep up to five scheduled or active offers at once.'
          }
        >
          <View style={styles.sectionStack}>
            {runtimeMessage ? (
              <View
                style={[
                  styles.statusPanel,
                  runtimeStatus?.policy.safeModeEnabled
                    ? styles.statusPanelWarm
                    : styles.statusPanelSuccess,
                ]}
              >
                <Text style={styles.helperText}>{runtimeMessage}</Text>
              </View>
            ) : null}
            <View
              style={[
                styles.plannerPanel,
                editingPromotionId ? styles.plannerPanelSuccess : styles.plannerPanelFeatured,
              ]}
            >
              <View style={styles.splitHeaderRow}>
                <View style={styles.splitHeaderCopy}>
                  <Text style={styles.sectionEyebrow}>Editor status</Text>
                  <Text style={styles.splitHeaderTitle}>{plannerTitle}</Text>
                  <Text style={styles.splitHeaderBody}>{plannerBody}</Text>
                </View>
                <AppUiIcon
                  name={editingPromotionId ? 'create-outline' : 'sparkles-outline'}
                  size={20}
                  color={editingPromotionId ? '#00F58C' : '#F5C86A'}
                />
              </View>
              <View style={styles.summaryStrip}>
                <View style={styles.summaryTile}>
                  <Text style={styles.summaryTileValue}>{plannerModeLabel}</Text>
                  <Text style={styles.summaryTileLabel}>Mode</Text>
                  <Text style={styles.summaryTileBody}>
                    {editingPromotionId
                      ? isAndroid
                        ? 'A saved update is loaded into the editor.'
                        : 'A saved offer is loaded into the editor.'
                      : preview
                        ? isAndroid
                          ? 'Preview changes stay inside preview mode.'
                          : 'Preview changes stay inside preview mode.'
                        : isAndroid
                          ? 'No saved update is loaded yet.'
                          : 'No saved offer is loaded yet.'}
                  </Text>
                </View>
                <View style={styles.summaryTile}>
                  <Text style={styles.summaryTileValue}>
                    {audiences.map((a) => formatPromotionValue(a)).join(', ') || 'None'}
                  </Text>
                  <Text style={styles.summaryTileLabel}>Audience</Text>
                  <Text style={styles.summaryTileBody}>
                    {isAndroid
                      ? 'Which customer segments should see this update.'
                      : 'Which customer segments should see this offer.'}
                  </Text>
                </View>
                <View style={styles.summaryTile}>
                  <Text style={styles.summaryTileValue}>{placementSurfaces.length}</Text>
                  <Text style={styles.summaryTileLabel}>Featured spots</Text>
                  <Text style={styles.summaryTileBody}>
                    Where this campaign gets extra visibility.
                  </Text>
                </View>
              </View>
              {aiErrorText ? <Text style={styles.errorText}>{aiErrorText}</Text> : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={isAndroid ? 'Draft update with AI' : 'Draft promotion with AI'}
                accessibilityHint={
                  isAndroid
                    ? 'Generates suggested update copy and placement settings.'
                    : 'Generates suggested promotion copy and placement settings.'
                }
                disabled={preview || isAiLoading}
                onPress={() => {
                  void draftPromotionWithAi({
                    goal: title.trim() || description.trim() || null,
                    tone: cardTone,
                  })
                    .then((draft) => {
                      const nextDraftState = getPromotionPlannerStateFromDraft(draft);
                      setTitle(nextDraftState.title);
                      setDescription(nextDraftState.description);
                      setBadgesInput(nextDraftState.badgesInput);
                      setAudiences(nextDraftState.audiences);
                      setCardTone(nextDraftState.cardTone);
                      setPlacementSurfaces(nextDraftState.placementSurfaces);
                      setPlacementScope(nextDraftState.placementScope);
                    })
                    .catch(ignoreAsyncError);
                }}
                style={[styles.secondaryButton, (preview || isAiLoading) && styles.buttonDisabled]}
              >
                <Text style={styles.secondaryButtonText}>
                  {preview ? 'Preview Only' : isAiLoading ? 'Drafting...' : 'Draft With AI'}
                </Text>
              </Pressable>
            </View>

            {isLoading ? (
              <Text style={styles.helperText}>
                {isAndroid ? 'Loading updates...' : 'Loading promotions...'}
              </Text>
            ) : null}
            {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}

            <View style={styles.plannerPanel}>
              <View style={styles.splitHeaderRow}>
                <View style={styles.splitHeaderCopy}>
                  <Text style={styles.sectionEyebrow}>Creative</Text>
                  <Text style={styles.splitHeaderTitle}>
                    {isAndroid
                      ? 'Update headline and storefront card copy'
                      : 'Offer headline and storefront card copy'}
                  </Text>
                  <Text style={styles.splitHeaderBody}>
                    Keep the message tight enough to scan in one pass whether it lands as a featured{' '}
                    {isAndroid ? 'update' : 'deal'} or an owner highlight.
                  </Text>
                </View>
                <AppUiIcon name="megaphone-outline" size={20} color="#F5C86A" />
              </View>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>
                  {isAndroid ? 'Update title' : 'Promotion title'}
                </Text>
                <TextInput
                  accessibilityLabel={isAndroid ? 'Update title' : 'Promotion title'}
                  accessibilityHint={
                    isAndroid
                      ? 'Sets the headline shown for this update.'
                      : 'Sets the headline shown for this promotion.'
                  }
                  value={title}
                  onChangeText={setTitle}
                  placeholder={isAndroid ? 'Update title' : 'Promotion title'}
                  placeholderTextColor={colors.textSoft}
                  style={styles.inputPremium}
                />
              </View>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Customer-facing card copy</Text>
                <TextInput
                  accessibilityLabel="Customer-facing card copy"
                  accessibilityHint={
                    isAndroid
                      ? 'Sets the text customers see on the storefront card.'
                      : 'Sets the deal text customers see on the storefront card.'
                  }
                  value={description}
                  onChangeText={setDescription}
                  placeholder="What should customers see on the card?"
                  placeholderTextColor={colors.textSoft}
                  multiline={true}
                  style={[styles.inputPremium, styles.textAreaPremium]}
                />
              </View>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Badge set</Text>
                <TextInput
                  accessibilityLabel={isAndroid ? 'Update badges' : 'Promotion badges'}
                  accessibilityHint={
                    isAndroid
                      ? 'Enter comma-separated badges for this update.'
                      : 'Enter comma-separated badges for this promotion.'
                  }
                  value={badgesInput}
                  onChangeText={setBadgesInput}
                  placeholder="Badges, comma separated"
                  placeholderTextColor={colors.textSoft}
                  style={styles.inputPremium}
                />
              </View>
            </View>

            <View style={styles.plannerPanel}>
              <View style={styles.splitHeaderRow}>
                <View style={styles.splitHeaderCopy}>
                  <Text style={styles.sectionEyebrow}>Audience and placement</Text>
                  <Text style={styles.splitHeaderTitle}>
                    Choose who sees this and where it shows up
                  </Text>
                  <Text style={styles.splitHeaderBody}>
                    {Platform.OS === 'android'
                      ? 'Choose whether this should appear as a regular update or as a featured story.'
                      : 'Choose whether this should appear as a regular offer or as a featured story.'}
                  </Text>
                </View>
                <AppUiIcon name="options-outline" size={20} color="#8EDCFF" />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Schedule window</Text>
                <Text style={styles.fieldHint}>
                  ISO-style timestamps are still used so scheduling stays exact.
                </Text>
                <TextInput
                  accessibilityLabel={
                    Platform.OS === 'android' ? 'Update start time' : 'Promotion start time'
                  }
                  accessibilityHint="Enter the start time in ISO format."
                  value={startsAt}
                  onChangeText={setStartsAt}
                  placeholder="Starts at"
                  placeholderTextColor={colors.textSoft}
                  style={styles.inputPremium}
                />
                <TextInput
                  accessibilityLabel={
                    Platform.OS === 'android' ? 'Update end time' : 'Promotion end time'
                  }
                  accessibilityHint="Enter the end time in ISO format."
                  value={endsAt}
                  onChangeText={setEndsAt}
                  placeholder="Ends at"
                  placeholderTextColor={colors.textSoft}
                  style={styles.inputPremium}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Audience</Text>
                <View style={styles.wrapRow}>
                  {PROMOTION_AUDIENCE_OPTIONS.map((option) => {
                    const isSelected = audiences.includes(option.value);
                    return (
                      <Pressable
                        key={option.value}
                        accessibilityRole="button"
                        accessibilityLabel={`${isSelected ? 'Remove' : 'Add'} audience ${option.label}`}
                        accessibilityHint={
                          isAndroid
                            ? `Toggles the ${option.label.toLowerCase()} audience for this update.`
                            : `Toggles the ${option.label.toLowerCase()} audience for this promotion.`
                        }
                        accessibilityState={isSelected ? { selected: true } : {}}
                        onPress={() =>
                          setAudiences((current) =>
                            isSelected
                              ? current.filter((v) => v !== option.value)
                              : [...current, option.value],
                          )
                        }
                        style={[styles.choiceChip, isSelected && styles.choiceChipSelected]}
                      >
                        <Text
                          style={[
                            styles.choiceChipText,
                            isSelected && styles.choiceChipTextSelected,
                          ]}
                        >
                          {option.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Card lane</Text>
                <View style={styles.wrapRow}>
                  {PROMOTION_CARD_TONE_OPTIONS.map((option) => (
                    <Pressable
                      key={option.value}
                      accessibilityRole="button"
                      accessibilityLabel={`Set card tone to ${option.label}`}
                      accessibilityHint={
                        isAndroid
                          ? `Applies the ${option.label.toLowerCase()} card tone to this update.`
                          : `Applies the ${option.label.toLowerCase()} card tone to this promotion.`
                      }
                      accessibilityState={cardTone === option.value ? { selected: true } : {}}
                      onPress={() => setCardTone(option.value)}
                      style={[
                        styles.choiceChip,
                        cardTone === option.value && styles.choiceChipSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.choiceChipText,
                          cardTone === option.value && styles.choiceChipTextSelected,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.fieldHint}>
                  {cardTone === 'hot_deal'
                    ? isAndroid
                      ? 'Use Featured Update when this content should drive engagement and feel timely.'
                      : 'Use Hot Deal when this offer should own the urgency lane and feel time-sensitive.'
                    : cardTone === 'owner_featured'
                      ? isAndroid
                        ? 'Use Owner Highlight when the card should feel premium, curated, and showcase value over promotions.'
                        : 'Use Owner Highlight when the card should feel premium, curated, and less discount-driven.'
                      : isAndroid
                        ? 'Standard Card keeps the update visible without special urgency or premium framing.'
                        : 'Standard Card keeps the offer visible without special urgency or premium framing.'}
                </Text>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Priority placement surfaces</Text>
                <View style={styles.wrapRow}>
                  {PROMOTION_PLACEMENT_SURFACE_OPTIONS.map((option) => {
                    const isSelected = placementSurfaces.includes(option.value);
                    return (
                      <Pressable
                        key={option.value}
                        accessibilityRole="button"
                        accessibilityLabel={`${isSelected ? 'Remove' : 'Add'} placement surface ${option.label}`}
                        accessibilityHint={
                          isAndroid
                            ? `Toggles update placement on the ${option.label} surface.`
                            : `Toggles promotion placement on the ${option.label} surface.`
                        }
                        accessibilityState={isSelected ? { selected: true } : {}}
                        onPress={() =>
                          setPlacementSurfaces((current) =>
                            isSelected
                              ? current.filter((value) => value !== option.value)
                              : current.concat(option.value),
                          )
                        }
                        style={[styles.choiceChip, isSelected && styles.choiceChipSelected]}
                      >
                        <Text
                          style={[
                            styles.choiceChipText,
                            isSelected && styles.choiceChipTextSelected,
                          ]}
                        >
                          {option.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={styles.fieldHint}>
                  {isAndroid
                    ? 'Updates is the primary content lane. Nearby and Browse keep the update visible in the standard discovery feeds.'
                    : 'Hot Deals is the primary promotions lane. Nearby and Browse keep the campaign visible in the standard discovery feeds.'}
                </Text>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Highlight reach</Text>
                <View style={styles.wrapRow}>
                  {PROMOTION_PLACEMENT_SCOPE_OPTIONS.map((option) => (
                    <Pressable
                      key={option.value}
                      accessibilityRole="button"
                      accessibilityLabel={`Set placement scope to ${option.label}`}
                      accessibilityHint={
                        isAndroid
                          ? `Sets the update scope to ${option.label.toLowerCase()}.`
                          : `Sets the promotion scope to ${option.label.toLowerCase()}.`
                      }
                      accessibilityState={placementScope === option.value ? { selected: true } : {}}
                      onPress={() => setPlacementScope(option.value)}
                      style={[
                        styles.choiceChip,
                        placementScope === option.value && styles.choiceChipSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.choiceChipText,
                          placementScope === option.value && styles.choiceChipTextSelected,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>

            {androidPrecheck ? (
              <View
                style={[
                  styles.statusPanel,
                  androidPrecheck.level === 'red'
                    ? styles.statusPanelDanger
                    : androidPrecheck.level === 'yellow'
                      ? styles.statusPanelWarm
                      : styles.statusPanelSuccess,
                ]}
              >
                <Text style={styles.helperText}>{getAndroidEligibilityLabel(androidPrecheck)}</Text>
                {androidPrecheck.message ? (
                  <Text style={styles.helperText}>{androidPrecheck.message}</Text>
                ) : null}
              </View>
            ) : null}

            <View style={styles.ctaPanel}>
              <View style={styles.splitHeaderRow}>
                <View style={styles.splitHeaderCopy}>
                  <Text style={styles.sectionEyebrow}>Launch controls</Text>
                  <Text style={styles.splitHeaderTitle}>Final checks before saving</Text>
                  <Text style={styles.splitHeaderBody}>
                    Save the campaign with the current planner state, or reset the form to start
                    clean.
                  </Text>
                </View>
                <AppUiIcon
                  name={alertFollowersOnStart ? 'notifications' : 'notifications-off-outline'}
                  size={20}
                  color={alertFollowersOnStart ? '#00F58C' : '#9CC5B4'}
                />
              </View>

              <Pressable
                accessibilityRole="switch"
                accessibilityLabel={
                  isAndroid
                    ? 'Alert followers when update starts'
                    : 'Alert followers when promotion starts'
                }
                accessibilityHint={
                  isAndroid
                    ? 'Turns follower notifications on or off for this update.'
                    : 'Turns follower notifications on or off for this promotion.'
                }
                accessibilityState={{ checked: alertFollowersOnStart }}
                onPress={() => setAlertFollowersOnStart((current) => !current)}
                style={[
                  styles.actionTile,
                  alertFollowersOnStart ? styles.statusPanelSuccess : styles.statusPanel,
                ]}
              >
                <View style={styles.splitHeaderRow}>
                  <View style={styles.splitHeaderCopy}>
                    <Text style={styles.actionTileMeta}>Follower alerts</Text>
                    <Text style={styles.actionTileTitle}>
                      {alertFollowersOnStart ? 'Alert Followers On Start' : 'No Follower Alert'}
                    </Text>
                    <Text style={styles.actionTileBody}>
                      {isAndroid
                        ? 'Trigger owner follower notifications when this update starts.'
                        : 'Trigger owner follower notifications when this promotion starts.'}
                    </Text>
                  </View>
                  <AppUiIcon
                    name={alertFollowersOnStart ? 'radio-button-on' : 'radio-button-off-outline'}
                    size={20}
                    color={alertFollowersOnStart ? '#00F58C' : '#9CC5B4'}
                  />
                </View>
              </Pressable>

              {isAtPromotionLimit ? (
                <Text style={styles.limitNotice}>
                  {maxPromotions === 0
                    ? isAndroid
                      ? 'Updates require the Growth plan or higher. Upgrade to create updates.'
                      : 'Promotions require the Growth plan or higher. Upgrade to create deals.'
                    : isAndroid
                      ? `You've reached the limit of ${maxPromotions} active or scheduled updates. Let one expire or remove it to create a new one.`
                      : `You've reached the limit of ${maxPromotions} active or scheduled promotions. Let one expire or remove it to create a new deal.`}
                </Text>
              ) : null}

              <View style={styles.buttonRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    isAtPromotionLimit
                      ? isAndroid
                        ? 'Update limit reached'
                        : 'Promotion limit reached'
                      : saveButtonLabel
                  }
                  accessibilityHint={
                    isAtPromotionLimit
                      ? maxPromotions === 0
                        ? isAndroid
                          ? 'Updates require a plan upgrade.'
                          : 'Promotions require a plan upgrade.'
                        : isAndroid
                          ? `You have reached the maximum of ${maxPromotions} updates.`
                          : `You have reached the maximum of ${maxPromotions} promotions.`
                      : isAndroid
                        ? 'Saves the current update changes.'
                        : 'Saves the current offer changes.'
                  }
                  disabled={ctaDisabled}
                  onPress={() => {
                    const input = buildPromotionPlannerInput({
                      title,
                      description,
                      badgesInput,
                      startsAt,
                      endsAt,
                      audiences,
                      alertFollowersOnStart,
                      cardTone,
                      placementSurfaces,
                      placementScope,
                    });

                    void (
                      editingPromotionId
                        ? updatePromotion(editingPromotionId, input)
                        : createPromotion(input)
                    )
                      .then(() => {
                        resetForm();
                      })
                      .catch((err: unknown) => {
                        const message =
                          err instanceof Error
                            ? err.message
                            : isAndroid
                              ? 'Something went wrong saving the update.'
                              : 'Something went wrong saving the promotion.';
                        // Surface the error so the owner knows what happened
                        if (typeof alert === 'function') {
                          alert(message);
                        }
                      });
                  }}
                  style={[styles.primaryButton, ctaDisabled && styles.buttonDisabled]}
                >
                  <Text style={styles.primaryButtonText}>{saveButtonLabel}</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={isAndroid ? 'Reset update form' : 'Reset promotion form'}
                  accessibilityHint="Clears the editor and returns it to the default state."
                  onPress={resetForm}
                  style={styles.secondaryButton}
                >
                  <Text style={styles.secondaryButtonText}>Reset Form</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </SectionCard>
      </MotionInView>

      <MotionInView delay={220}>
        <SectionCard
          title={isAndroid ? 'Live and scheduled updates' : 'Live and scheduled promotions'}
          body={
            isAndroid
              ? 'Select any update to edit its timing, placement, or badges.'
              : 'Select any offer to edit its timing, placement, or badges.'
          }
        >
          {promotions.length ? (
            <View style={styles.cardStack}>
              {promotions.map((promotion) => (
                <View
                  key={promotion.id}
                  style={[
                    styles.actionTile,
                    promotion.status === 'active' ? styles.metricCardWarm : styles.statusPanel,
                  ]}
                >
                  <View style={styles.splitHeaderRow}>
                    <View style={styles.splitHeaderCopy}>
                      <Text style={styles.actionTileMeta}>{promotion.status.toUpperCase()}</Text>
                      <Text style={styles.actionTileTitle}>{promotion.title}</Text>
                      <Text style={styles.actionTileBody}>{promotion.description}</Text>
                    </View>
                    <AppUiIcon name="pricetag-outline" size={20} color="#F5C86A" />
                  </View>

                  <View style={styles.tagRow}>
                    <View style={styles.tag}>
                      <Text style={styles.tagText}>{formatPromotionValue(promotion.cardTone)}</Text>
                    </View>
                    <View style={styles.tag}>
                      <Text style={styles.tagText}>
                        {formatPromotionPlacementScope(promotion.placementScope)}
                      </Text>
                    </View>
                    {(promotion.badges.length ? promotion.badges : ['No badges']).map((badge) => (
                      <View key={`${promotion.id}-${badge}`} style={styles.tag}>
                        <Text style={styles.tagText}>{badge}</Text>
                      </View>
                    ))}
                  </View>

                  <Text style={styles.resultMeta}>
                    Starts{' '}
                    {new Date(promotion.startsAt).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true,
                    })}{' '}
                    and ends{' '}
                    {new Date(promotion.endsAt).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true,
                    })}
                    .
                  </Text>
                  <Text style={styles.resultMeta}>
                    {formatPromotionPlacementSurfaces(promotion.placementSurfaces)}
                  </Text>

                  <View style={styles.promotionActionsRow}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={
                        isAndroid
                          ? `Edit update ${promotion.title}`
                          : `Edit promotion ${promotion.title}`
                      }
                      accessibilityHint={
                        isAndroid
                          ? 'Loads this update into the editor.'
                          : 'Loads this offer into the editor.'
                      }
                      onPress={() => {
                        setEditingPromotionId(promotion.id);
                        applyPlannerState(getPromotionPlannerStateFromPromotion(promotion));
                      }}
                      style={[styles.secondaryButton, styles.promotionActionFlex]}
                    >
                      <Text style={styles.secondaryButtonText}>
                        Edit This {isAndroid ? 'Update' : 'Offer'}
                      </Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={
                        isAndroid
                          ? `Delete update ${promotion.title}`
                          : `Delete promotion ${promotion.title}`
                      }
                      accessibilityHint={
                        isAndroid
                          ? 'Permanently removes this update.'
                          : 'Permanently removes this promotion.'
                      }
                      onPress={() => {
                        if (
                          typeof confirm === 'function' &&
                          !confirm(
                            isAndroid
                              ? 'Delete this update? This cannot be undone.'
                              : 'Delete this promotion? This cannot be undone.',
                          )
                        ) {
                          return;
                        }
                        void deletePromotion(promotion.id).catch((err: unknown) => {
                          const message =
                            err instanceof Error
                              ? err.message
                              : isAndroid
                                ? 'Failed to delete update.'
                                : 'Failed to delete promotion.';
                          if (typeof alert === 'function') {
                            alert(message);
                          }
                        });
                      }}
                      style={[styles.secondaryButton, styles.promotionDeleteButton]}
                    >
                      <Text style={[styles.secondaryButtonText, styles.promotionDeleteText]}>
                        Delete
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyStateCard}>
              <Text style={styles.emptyStateTitle}>
                {isAndroid ? 'No updates scheduled yet' : 'No promotions scheduled yet'}
              </Text>
              <Text style={styles.emptyStateBody}>
                {isAndroid
                  ? 'Create the first update above. Once it is saved, it will appear here for quick edits.'
                  : 'Create the first offer above. Once it is saved, it will appear here for quick edits.'}
              </Text>
            </View>
          )}
        </SectionCard>
      </MotionInView>

      <MotionInView delay={300}>
        <SectionCard
          title={isAndroid ? 'Update performance' : 'Offer performance'}
          body={
            isAndroid
              ? 'These results use the live update analytics tied to update IDs, so you can compare featured updates against owner highlights by visibility, taps, and route intent.'
              : 'These results use the live promotion analytics tied to promotion IDs, so you can compare hot deals against owner highlights by visibility, taps, and route intent.'
          }
        >
          {promotionPerformance.length ? (
            <View style={styles.sectionStack}>
              <View style={styles.summaryStrip}>
                <View style={styles.summaryTile}>
                  <Text style={styles.summaryTileValue}>
                    {formatCount(promotionPerformance.length)}
                  </Text>
                  <Text style={styles.summaryTileLabel}>
                    {isAndroid ? 'Tracked Updates' : 'Tracked Offers'}
                  </Text>
                  <Text style={styles.summaryTileBody}>
                    {isAndroid
                      ? 'Updates with measurable performance data.'
                      : 'Offers with measurable performance data.'}
                  </Text>
                </View>
                <View style={styles.summaryTile}>
                  <Text style={styles.summaryTileValue}>{formatCount(totalImpressions)}</Text>
                  <Text style={styles.summaryTileLabel}>Total Impressions</Text>
                  <Text style={styles.summaryTileBody}>
                    {isAndroid
                      ? 'Combined visibility across tracked updates.'
                      : 'Combined visibility across tracked promotions.'}
                  </Text>
                </View>
                <View style={styles.summaryTile}>
                  <Text style={styles.summaryTileValue}>{formatCount(totalTrackedActions)}</Text>
                  <Text style={styles.summaryTileLabel}>Tracked Actions</Text>
                  <Text style={styles.summaryTileBody}>
                    Route, website, menu, and phone intent combined.
                  </Text>
                </View>
                <View style={styles.summaryTile}>
                  <Text style={styles.summaryTileValue}>{formatRate(bestActionRate)}</Text>
                  <Text style={styles.summaryTileLabel}>Best Action Rate</Text>
                  <Text style={styles.summaryTileBody}>
                    {isAndroid
                      ? 'Highest update-level action rate in the set.'
                      : 'Highest offer-level action rate in the set.'}
                  </Text>
                </View>
              </View>

              {topPerformance ? (
                <View style={styles.analyticsSpotlightCard}>
                  <View style={styles.analyticsSpotlightHeader}>
                    <View style={styles.splitHeaderCopy}>
                      <Text style={styles.sectionEyebrow}>Current leader</Text>
                      <Text style={styles.splitHeaderTitle}>{topPerformance.title}</Text>
                      <Text style={styles.analyticsSpotlightBody}>
                        {isAndroid
                          ? 'This update is setting the pace on action rate right now while still carrying meaningful storefront visibility.'
                          : 'This promotion is setting the pace on action rate right now while still carrying meaningful storefront visibility.'}
                      </Text>
                    </View>
                    <AppUiIcon name="ribbon-outline" size={22} color="#F5C86A" />
                  </View>
                  <Text style={styles.analyticsSpotlightValue}>
                    {formatRate(topPerformance.metrics.actionRate)}
                  </Text>
                  <View style={styles.metricProgressTrack}>
                    <View
                      style={[
                        styles.metricProgressFill,
                        styles.metricProgressFillWarm,
                        {
                          width: `${Math.max(clampProgress(topPerformance.metrics.actionRate / 100) * 100, topPerformance.metrics.actionRate > 0 ? 12 : 0)}%`,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.metricProgressLabel}>
                    {isAndroid
                      ? 'Action rate against the best update in the current set'
                      : 'Action rate against the best promotion in the current set'}
                  </Text>
                  <View style={styles.analyticsInlineStats}>
                    <View style={styles.analyticsInlineStat}>
                      <Text style={styles.analyticsInlineStatValue}>
                        {formatCount(topPerformance.metrics.impressions)}
                      </Text>
                      <Text style={styles.analyticsInlineStatLabel}>Impressions</Text>
                    </View>
                    <View style={styles.analyticsInlineStat}>
                      <Text style={styles.analyticsInlineStatValue}>
                        {formatCount(topPerformance.metrics.opens)}
                      </Text>
                      <Text style={styles.analyticsInlineStatLabel}>Opens</Text>
                    </View>
                    <View style={styles.analyticsInlineStat}>
                      <Text style={styles.analyticsInlineStatValue}>
                        {formatCount(getPromotionTrackedActions(topPerformance.metrics))}
                      </Text>
                      <Text style={styles.analyticsInlineStatLabel}>Tracked Actions</Text>
                    </View>
                    <View style={styles.analyticsInlineStat}>
                      <Text style={styles.analyticsInlineStatValue}>
                        {topPerformance.status.toUpperCase()}
                      </Text>
                      <Text style={styles.analyticsInlineStatLabel}>Status</Text>
                    </View>
                  </View>
                </View>
              ) : null}

              <View style={styles.analyticsSectionCard}>
                <View style={styles.analyticsSectionHeader}>
                  <Text style={styles.analyticsSectionEyebrow}>
                    {isAndroid ? 'Update comparison grid' : 'Offer comparison grid'}
                  </Text>
                  <Text style={styles.analyticsSectionTitle}>
                    Each card balances visibility, click-through strength, and downstream action.
                  </Text>
                  <Text style={styles.analyticsSectionBody}>
                    {isAndroid
                      ? 'The cards stay horizontal so the owner can compare multiple updates quickly without changing how metrics are calculated.'
                      : 'The cards stay horizontal so the owner can compare multiple promotions quickly without changing how metrics are calculated.'}
                  </Text>
                </View>

                <View style={styles.analyticsScrollFrame}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={[styles.metricGrid, metricGridMinWidthStyle]}>
                      {promotionPerformance.map((performance, index) => {
                        const presentation = getPromotionPerformancePresentation(index);

                        return (
                          <OwnerPortalAnalyticsCard
                            body={`${formatCount(performance.metrics.impressions)} impressions, ${formatCount(performance.metrics.opens)} opens, and ${formatCount(performance.metrics.saves)} saves across the selected ${isAndroid ? 'update' : 'offer'} window.`}
                            eyebrow={`#${index + 1} / ${performance.status.toUpperCase()}`}
                            footer={`Website ${formatCount(performance.metrics.websiteTaps)} | ${isAndroid ? 'Website' : 'Menu'} ${formatCount(performance.metrics.menuTaps)} | Phone ${formatCount(performance.metrics.phoneTaps)} | Redemptions ${formatCount(performance.metrics.redeemed)}`}
                            icon={presentation.icon}
                            key={performance.promotionId}
                            progress={clampProgress(performance.metrics.actionRate / 100)}
                            progressLabel={`Action rate ${formatRate(performance.metrics.actionRate)}`}
                            stats={[
                              {
                                label: 'CTR',
                                value: formatRate(performance.metrics.clickThroughRate),
                              },
                              {
                                label: 'Impr share',
                                value: formatRate(
                                  getRelativeProgress(
                                    performance.metrics.impressions,
                                    maxPromotionImpressions,
                                  ) * 100,
                                ),
                              },
                              {
                                label: 'Action share',
                                value: formatRate(
                                  getRelativeProgress(
                                    getPromotionTrackedActions(performance.metrics),
                                    maxPromotionActions,
                                  ) * 100,
                                ),
                              },
                            ]}
                            title={performance.title}
                            tone={presentation.tone}
                            value={formatRate(performance.metrics.clickThroughRate)}
                          />
                        );
                      })}
                    </View>
                  </ScrollView>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.emptyStateCard}>
              <Text style={styles.emptyStateTitle}>
                Analytics will populate after live activity
              </Text>
              <Text style={styles.emptyStateBody}>
                {isAndroid
                  ? 'Once updates begin receiving visibility and customer interaction, this section will show a calmer analytics overview first and then the deeper per-update cards.'
                  : 'Once promotions begin receiving visibility and customer interaction, this section will show a calmer analytics overview first and then the deeper per-offer cards.'}
              </Text>
            </View>
          )}
        </SectionCard>
      </MotionInView>
    </ScreenShell>
  );
}

export const OwnerPortalPromotionsScreen = withScreenErrorBoundary(
  OwnerPortalPromotionsScreenInner,
  'owner-portal-promotions',
);

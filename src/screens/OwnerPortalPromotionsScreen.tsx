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
  OwnerPromotionAudience,
  OwnerPromotionCardTone,
  OwnerPromotionPlacementScope,
  OwnerPromotionPlacementSurface,
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
  const _route = useRoute<OwnerPortalPromotionsRoute>();
  const preview = false;
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
    draftPromotionWithAi,
  } = useOwnerPortalWorkspace(preview);
  const [editingPromotionId, setEditingPromotionId] = React.useState<string | null>(null);
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [badgesInput, setBadgesInput] = React.useState('');
  const [startsAt, setStartsAt] = React.useState(createDefaultPromotionStart());
  const [endsAt, setEndsAt] = React.useState(createDefaultPromotionEnd());
  const [audience, setAudience] = React.useState<OwnerPromotionAudience>('all_followers');
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
    setAudience(nextState.audience);
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
      title={Platform.OS === 'android' ? 'Updates and results.' : 'Promotions and results.'}
      subtitle={
        Platform.OS === 'android'
          ? 'Plan updates, reserve owner highlights for premium placement, and compare performance over time.'
          : 'Plan the lead specials lane, reserve owner highlights for premium placement, and compare offer performance over time.'
      }
      headerPill={Platform.OS === 'android' ? 'Updates' : 'Specials'}
    >
      <MotionInView delay={70}>
        <View style={styles.portalHeroCard}>
          <View style={styles.portalHeroGlow} />
          <Text style={styles.portalHeroKicker}>
            {Platform.OS === 'android' ? 'Update studio' : 'Offer studio'}
          </Text>
          <Text style={styles.portalHeroTitle}>
            {Platform.OS === 'android'
              ? 'Lead with updates. Save owner highlights for premium placement.'
              : 'Lead with specials. Save owner highlights for premium placement.'}
          </Text>
          <Text style={styles.portalHeroBody}>
            {Platform.OS === 'android'
              ? 'The planner now treats updates as the primary content lane while keeping owner-highlight cards reserved for curated premium storytelling.'
              : 'The planner now treats specials as the primary urgency lane while keeping owner-highlight cards reserved for curated premium storytelling.'}
          </Text>
          <View style={styles.portalHeroMetricRow}>
            <View style={styles.portalHeroMetricCard}>
              <Text style={styles.portalHeroMetricValue}>{activePromotions}</Text>
              <Text style={styles.portalHeroMetricLabel}>
                {Platform.OS === 'android' ? 'Active Updates' : 'Active Offers'}
              </Text>
            </View>
            <View style={styles.portalHeroMetricCard}>
              <Text style={styles.portalHeroMetricValue}>{promotionPerformance.length}</Text>
              <Text style={styles.portalHeroMetricLabel}>
                {Platform.OS === 'android' ? 'Tracked Updates' : 'Tracked Offers'}
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
                  ? 'Updates lead, owner highlights stay selective'
                  : 'Hot deals lead, owner highlights stay selective'}
              </Text>
            </View>
          </View>
        </View>
      </MotionInView>

      <MotionInView delay={120}>
        <SectionCard
          title={Platform.OS === 'android' ? 'Update planner' : 'Promotion planner'}
          body={
            Platform.OS === 'android'
              ? 'Use ISO-style dates for exact scheduling. Default to a featured update when the card should drive engagement, then switch to owner highlight when the message should read as a premium curated feature. Each storefront can keep up to five scheduled or active updates at once.'
              : 'Use ISO-style dates for exact scheduling. Default to a featured special when the card should drive urgency, then switch to owner highlight only when the message should read as a premium curated feature. Each storefront can keep up to five scheduled or active offers at once.'
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
                  <Text style={styles.sectionEyebrow}>Planner status</Text>
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
                      ? Platform.OS === 'android'
                        ? 'A saved update is loaded into the planner.'
                        : 'A saved promotion is loaded into the planner.'
                      : preview
                        ? Platform.OS === 'android'
                          ? 'Preview update changes save locally to this workspace.'
                          : 'Preview promotion changes save locally to this workspace.'
                        : Platform.OS === 'android'
                          ? 'No saved update is loaded yet.'
                          : 'No saved promotion is loaded yet.'}
                  </Text>
                </View>
                <View style={styles.summaryTile}>
                  <Text style={styles.summaryTileValue}>{formatPromotionValue(audience)}</Text>
                  <Text style={styles.summaryTileLabel}>Audience</Text>
                  <Text style={styles.summaryTileBody}>
                    {Platform.OS === 'android'
                      ? 'Which customer segment should see this update first.'
                      : 'Which customer segment should see this offer first.'}
                  </Text>
                </View>
                <View style={styles.summaryTile}>
                  <Text style={styles.summaryTileValue}>{placementSurfaces.length}</Text>
                  <Text style={styles.summaryTileLabel}>Priority Surfaces</Text>
                  <Text style={styles.summaryTileBody}>
                    Lanes currently set to boost this campaign.
                  </Text>
                </View>
              </View>
              {aiErrorText ? <Text style={styles.errorText}>{aiErrorText}</Text> : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  Platform.OS === 'android' ? 'Draft update with AI' : 'Draft promotion with AI'
                }
                accessibilityHint={
                  Platform.OS === 'android'
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
                      setAudience(nextDraftState.audience);
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
                {Platform.OS === 'android' ? 'Loading updates...' : 'Loading promotions...'}
              </Text>
            ) : null}
            {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}

            <View style={styles.plannerPanel}>
              <View style={styles.splitHeaderRow}>
                <View style={styles.splitHeaderCopy}>
                  <Text style={styles.sectionEyebrow}>Creative</Text>
                  <Text style={styles.splitHeaderTitle}>
                    {Platform.OS === 'android'
                      ? 'Update headline and storefront card copy'
                      : 'Offer headline and storefront card copy'}
                  </Text>
                  <Text style={styles.splitHeaderBody}>
                    Keep the message tight enough to scan in one pass whether it lands as a featured{' '}
                    {Platform.OS === 'android' ? 'update' : 'special'} or an owner highlight.
                  </Text>
                </View>
                <AppUiIcon name="megaphone-outline" size={20} color="#F5C86A" />
              </View>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>
                  {Platform.OS === 'android' ? 'Update title' : 'Promotion title'}
                </Text>
                <TextInput
                  accessibilityLabel={
                    Platform.OS === 'android' ? 'Update title' : 'Promotion title'
                  }
                  accessibilityHint={
                    Platform.OS === 'android'
                      ? 'Sets the headline shown for this update.'
                      : 'Sets the headline shown for this promotion.'
                  }
                  value={title}
                  onChangeText={setTitle}
                  placeholder={Platform.OS === 'android' ? 'Update title' : 'Promotion title'}
                  placeholderTextColor="#738680"
                  style={styles.inputPremium}
                />
              </View>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Customer-facing card copy</Text>
                <TextInput
                  accessibilityLabel="Customer-facing card copy"
                  accessibilityHint={
                    Platform.OS === 'android'
                      ? 'Sets the text customers see on the storefront card.'
                      : 'Sets the deal text customers see on the storefront card.'
                  }
                  value={description}
                  onChangeText={setDescription}
                  placeholder="What should customers see on the card?"
                  placeholderTextColor="#738680"
                  multiline={true}
                  style={[styles.inputPremium, styles.textAreaPremium]}
                />
              </View>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Badge set</Text>
                <TextInput
                  accessibilityLabel={
                    Platform.OS === 'android' ? 'Update badges' : 'Promotion badges'
                  }
                  accessibilityHint={
                    Platform.OS === 'android'
                      ? 'Enter comma-separated badges for this update.'
                      : 'Enter comma-separated badges for this promotion.'
                  }
                  value={badgesInput}
                  onChangeText={setBadgesInput}
                  placeholder="Badges, comma separated"
                  placeholderTextColor="#738680"
                  style={styles.inputPremium}
                />
              </View>
            </View>

            <View style={styles.plannerPanel}>
              <View style={styles.splitHeaderRow}>
                <View style={styles.splitHeaderCopy}>
                  <Text style={styles.sectionEyebrow}>Audience and placement</Text>
                  <Text style={styles.splitHeaderTitle}>
                    Control the lane, reach, and extra weight
                  </Text>
                  <Text style={styles.splitHeaderBody}>
                    {Platform.OS === 'android'
                      ? 'Featured updates are the main content state. Owner highlights stay reserved for premium placement.'
                      : 'Hot deals are the main promotional state. Owner highlights stay reserved for premium placement without deal urgency.'}
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
                  placeholderTextColor="#738680"
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
                  placeholderTextColor="#738680"
                  style={styles.inputPremium}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Audience</Text>
                <View style={styles.wrapRow}>
                  {PROMOTION_AUDIENCE_OPTIONS.map((option) => (
                    <Pressable
                      key={option.value}
                      accessibilityRole="button"
                      accessibilityLabel={`Set audience to ${option.label}`}
                      accessibilityHint={
                        Platform.OS === 'android'
                          ? `Selects the ${option.label.toLowerCase()} audience for this update.`
                          : `Selects the ${option.label.toLowerCase()} audience for this promotion.`
                      }
                      accessibilityState={audience === option.value ? { selected: true } : {}}
                      onPress={() => setAudience(option.value)}
                      style={[
                        styles.choiceChip,
                        audience === option.value && styles.choiceChipSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.choiceChipText,
                          audience === option.value && styles.choiceChipTextSelected,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  ))}
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
                        Platform.OS === 'android'
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
                    ? Platform.OS === 'android'
                      ? 'Use Featured Update when this content should drive engagement and feel timely.'
                      : 'Use Featured Special when this offer should own the urgency lane and feel time-sensitive.'
                    : cardTone === 'owner_featured'
                      ? Platform.OS === 'android'
                        ? 'Use Owner Highlight when the card should feel premium, curated, and showcase value over promotions.'
                        : 'Use Owner Highlight when the card should feel premium, curated, and less discount-driven.'
                      : Platform.OS === 'android'
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
                          Platform.OS === 'android'
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
                  {Platform.OS === 'android'
                    ? 'Updates is the primary content lane. Nearby and Browse keep the update visible in the standard discovery feeds.'
                    : 'Specials is the primary promotions lane. Nearby and Browse keep the campaign visible in the standard discovery feeds.'}
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
                        Platform.OS === 'android'
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
                  Platform.OS === 'android'
                    ? 'Alert followers when update starts'
                    : 'Alert followers when promotion starts'
                }
                accessibilityHint={
                  Platform.OS === 'android'
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
                      {Platform.OS === 'android'
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
                    ? Platform.OS === 'android'
                      ? 'Updates require the Growth plan or higher. Upgrade to create updates.'
                      : 'Promotions require the Growth plan or higher. Upgrade to create specials.'
                    : Platform.OS === 'android'
                      ? `You've reached the limit of ${maxPromotions} active or scheduled updates. Let one expire or remove it to create a new one.`
                      : `You've reached the limit of ${maxPromotions} active or scheduled promotions. Let one expire or remove it to create a new deal.`}
                </Text>
              ) : null}

              <View style={styles.buttonRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    isAtPromotionLimit
                      ? Platform.OS === 'android'
                        ? 'Update limit reached'
                        : 'Promotion limit reached'
                      : saveButtonLabel
                  }
                  accessibilityHint={
                    isAtPromotionLimit
                      ? maxPromotions === 0
                        ? Platform.OS === 'android'
                          ? 'Updates require a plan upgrade.'
                          : 'Promotions require a plan upgrade.'
                        : Platform.OS === 'android'
                          ? `You have reached the maximum of ${maxPromotions} updates.`
                          : `You have reached the maximum of ${maxPromotions} promotions.`
                      : Platform.OS === 'android'
                        ? 'Saves the current update planner changes.'
                        : 'Saves the current promotion planner changes.'
                  }
                  disabled={ctaDisabled}
                  onPress={() => {
                    const input = buildPromotionPlannerInput({
                      title,
                      description,
                      badgesInput,
                      startsAt,
                      endsAt,
                      audience,
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
                      .catch(ignoreAsyncError);
                  }}
                  style={[styles.primaryButton, ctaDisabled && styles.buttonDisabled]}
                >
                  <Text style={styles.primaryButtonText}>{saveButtonLabel}</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    Platform.OS === 'android' ? 'Reset update form' : 'Reset promotion form'
                  }
                  accessibilityHint="Clears the planner and returns it to the default state."
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
          title={
            Platform.OS === 'android'
              ? 'Live and scheduled updates'
              : 'Live and scheduled promotions'
          }
          body={
            Platform.OS === 'android'
              ? 'Load any update into the planner to edit timing, placement, badge mix, or move it between the featured updates lane and the owner-highlight lane.'
              : 'Load any promotion into the planner to edit timing, placement, badge mix, or move it between the featured specials lane and the owner-highlight lane.'
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
                    Starts {new Date(promotion.startsAt).toLocaleString()} and ends{' '}
                    {new Date(promotion.endsAt).toLocaleString()}.
                  </Text>
                  <Text style={styles.resultMeta}>
                    {formatPromotionPlacementSurfaces(promotion.placementSurfaces)}
                  </Text>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      Platform.OS === 'android'
                        ? `Edit update ${promotion.title}`
                        : `Edit promotion ${promotion.title}`
                    }
                    accessibilityHint={
                      Platform.OS === 'android'
                        ? 'Loads this update into the planner for editing.'
                        : 'Loads this promotion into the planner for editing.'
                    }
                    onPress={() => {
                      setEditingPromotionId(promotion.id);
                      applyPlannerState(getPromotionPlannerStateFromPromotion(promotion));
                    }}
                    style={styles.secondaryButton}
                  >
                    <Text style={styles.secondaryButtonText}>Load Into Planner</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyStateCard}>
              <Text style={styles.emptyStateTitle}>
                {Platform.OS === 'android'
                  ? 'No updates scheduled yet'
                  : 'No promotions scheduled yet'}
              </Text>
              <Text style={styles.emptyStateBody}>
                {Platform.OS === 'android'
                  ? 'Build the first update in the planner above. Once an update is saved, it will appear here with a calmer summary card and a quick path back into editing.'
                  : 'Build the first campaign in the planner above. Once an offer is saved, it will appear here with a calmer summary card and a quick path back into editing.'}
              </Text>
            </View>
          )}
        </SectionCard>
      </MotionInView>

      <MotionInView delay={300}>
        <SectionCard
          title={Platform.OS === 'android' ? 'Update performance' : 'Offer performance'}
          body={
            Platform.OS === 'android'
              ? 'These results use the live update analytics tied to update IDs, so you can compare featured updates against owner highlights by visibility, taps, and route intent.'
              : 'These results use the live promotion analytics tied to promotion IDs, so you can compare featured specials against owner highlights by visibility, taps, and route intent.'
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
                    {Platform.OS === 'android' ? 'Tracked Updates' : 'Tracked Offers'}
                  </Text>
                  <Text style={styles.summaryTileBody}>
                    {Platform.OS === 'android'
                      ? 'Updates with measurable performance data.'
                      : 'Offers with measurable performance data.'}
                  </Text>
                </View>
                <View style={styles.summaryTile}>
                  <Text style={styles.summaryTileValue}>{formatCount(totalImpressions)}</Text>
                  <Text style={styles.summaryTileLabel}>Total Impressions</Text>
                  <Text style={styles.summaryTileBody}>
                    {Platform.OS === 'android'
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
                    {Platform.OS === 'android'
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
                        {Platform.OS === 'android'
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
                    {Platform.OS === 'android'
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
                    {Platform.OS === 'android' ? 'Update comparison grid' : 'Offer comparison grid'}
                  </Text>
                  <Text style={styles.analyticsSectionTitle}>
                    Each card balances visibility, click-through strength, and downstream action.
                  </Text>
                  <Text style={styles.analyticsSectionBody}>
                    {Platform.OS === 'android'
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
                            body={`${formatCount(performance.metrics.impressions)} impressions, ${formatCount(performance.metrics.opens)} opens, and ${formatCount(performance.metrics.saves)} saves across the selected ${Platform.OS === 'android' ? 'update' : 'offer'} window.`}
                            eyebrow={`#${index + 1} / ${performance.status.toUpperCase()}`}
                            footer={`Website ${formatCount(performance.metrics.websiteTaps)} | ${Platform.OS === 'android' ? 'Website' : 'Menu'} ${formatCount(performance.metrics.menuTaps)} | Phone ${formatCount(performance.metrics.phoneTaps)} | Redemptions ${formatCount(performance.metrics.redeemed)}`}
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
                {Platform.OS === 'android'
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

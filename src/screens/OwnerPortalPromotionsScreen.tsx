import React from 'react';
import { RouteProp, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { MotionInView } from '../components/MotionInView';
import { ScreenShell } from '../components/ScreenShell';
import { SectionCard } from '../components/SectionCard';
import { ownerPortalPreviewEnabled } from '../config/ownerPortalConfig';
import { RootStackParamList } from '../navigation/RootNavigator';
import {
  OwnerPromotionAudience,
  OwnerPromotionCardTone,
  OwnerPromotionPlacementScope,
  OwnerPromotionPlacementSurface,
} from '../types/ownerPortal';
import { OwnerPortalAnalyticsCard } from './ownerPortal/OwnerPortalAnalyticsCard';
import { ownerPortalStyles as styles } from './ownerPortal/ownerPortalStyles';
import { useOwnerPortalWorkspace } from './ownerPortal/useOwnerPortalWorkspace';

type OwnerPortalPromotionsRoute = RouteProp<RootStackParamList, 'OwnerPortalPromotions'>;

const AUDIENCE_OPTIONS: Array<{
  value: OwnerPromotionAudience;
  label: string;
}> = [
  { value: 'all_followers', label: 'All Followers' },
  { value: 'frequent_visitors', label: 'Frequent Visitors' },
  { value: 'new_customers', label: 'New Customers' },
];

const CARD_TONE_OPTIONS: Array<{
  value: OwnerPromotionCardTone;
  label: string;
}> = [
  { value: 'standard', label: 'Standard' },
  { value: 'owner_featured', label: 'Featured' },
  { value: 'hot_deal', label: 'Hot Deal' },
];

const PLACEMENT_SURFACE_OPTIONS: Array<{
  value: OwnerPromotionPlacementSurface;
  label: string;
}> = [
  { value: 'nearby', label: 'Nearby' },
  { value: 'browse', label: 'Browse' },
  { value: 'hot_deals', label: 'Hot Deals' },
];

const PLACEMENT_SCOPE_OPTIONS: Array<{
  value: OwnerPromotionPlacementScope;
  label: string;
}> = [
  { value: 'storefront_area', label: 'My Area' },
  { value: 'statewide', label: 'Statewide' },
];

function createDefaultStart() {
  const now = new Date();
  now.setMinutes(now.getMinutes() + 15);
  return now.toISOString().slice(0, 16);
}

function createDefaultEnd() {
  const now = new Date();
  now.setHours(now.getHours() + 24);
  return now.toISOString().slice(0, 16);
}

function formatRate(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return '0%';
  }

  const rounded = Math.round(value * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}%`;
}

function formatCount(value: number) {
  return Math.round(value).toLocaleString();
}

function clampProgress(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(1, value));
}

function getRelativeProgress(value: number, max: number) {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) {
    return 0;
  }

  return clampProgress(value / max);
}

export function OwnerPortalPromotionsScreen() {
  const route = useRoute<OwnerPortalPromotionsRoute>();
  const preview = ownerPortalPreviewEnabled && Boolean(route.params?.preview);
  const { workspace, isLoading, isSaving, errorText, createPromotion, updatePromotion } =
    useOwnerPortalWorkspace(preview);
  const [editingPromotionId, setEditingPromotionId] = React.useState<string | null>(null);
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [badgesInput, setBadgesInput] = React.useState('');
  const [startsAt, setStartsAt] = React.useState(createDefaultStart());
  const [endsAt, setEndsAt] = React.useState(createDefaultEnd());
  const [audience, setAudience] = React.useState<OwnerPromotionAudience>('all_followers');
  const [cardTone, setCardTone] = React.useState<OwnerPromotionCardTone>('owner_featured');
  const [alertFollowersOnStart, setAlertFollowersOnStart] = React.useState(true);
  const [placementSurfaces, setPlacementSurfaces] = React.useState<
    OwnerPromotionPlacementSurface[]
  >(['nearby', 'browse', 'hot_deals']);
  const [placementScope, setPlacementScope] =
    React.useState<OwnerPromotionPlacementScope>('storefront_area');

  const resetForm = React.useCallback(() => {
    setEditingPromotionId(null);
    setTitle('');
    setDescription('');
    setBadgesInput('');
    setStartsAt(createDefaultStart());
    setEndsAt(createDefaultEnd());
    setAudience('all_followers');
    setCardTone('owner_featured');
    setAlertFollowersOnStart(true);
    setPlacementSurfaces(['nearby', 'browse', 'hot_deals']);
    setPlacementScope('storefront_area');
  }, []);

  const promotions = workspace?.promotions ?? [];
  const promotionPerformance = workspace?.promotionPerformance ?? [];
  const activePromotions = promotions.filter((promotion) => promotion.status === 'active').length;
  const totalImpressions = promotionPerformance.reduce(
    (sum, promotion) => sum + promotion.metrics.impressions,
    0
  );
  const totalTrackedActions = promotionPerformance.reduce(
    (sum, promotion) =>
      sum +
      promotion.metrics.redeemStarts +
      promotion.metrics.websiteTaps +
      promotion.metrics.menuTaps +
      promotion.metrics.phoneTaps,
    0
  );
  const bestActionRate = promotionPerformance.reduce(
    (best, promotion) => Math.max(best, promotion.metrics.actionRate),
    0
  );
  const topPerformance =
    [...promotionPerformance].sort((left, right) => {
      if (right.metrics.actionRate !== left.metrics.actionRate) {
        return right.metrics.actionRate - left.metrics.actionRate;
      }

      return right.metrics.impressions - left.metrics.impressions;
    })[0] ?? null;
  const maxPromotionImpressions = Math.max(
    ...promotionPerformance.map((promotion) => promotion.metrics.impressions),
    1
  );
  const maxPromotionActions = Math.max(
    ...promotionPerformance.map(
      (promotion) =>
        promotion.metrics.redeemStarts +
        promotion.metrics.websiteTaps +
        promotion.metrics.menuTaps +
        promotion.metrics.phoneTaps
    ),
    1
  );
  const plannerTitle = editingPromotionId ? 'Editing selected promotion' : 'Create a new promotion';
  const plannerBody = editingPromotionId
    ? 'Update timing, surfaces, or card presentation without losing the existing promotion state.'
    : 'Build the next campaign with clearer planning blocks and a stronger final call to action.';
  const ctaDisabled =
    preview ||
    isSaving ||
    !title.trim() ||
    !description.trim() ||
    !startsAt.trim() ||
    !endsAt.trim();

  return (
    <ScreenShell
      eyebrow="Owner Portal"
      title="Promotions and results."
      subtitle="Schedule deals, control how they appear on cards, and compare offer performance over time."
      headerPill={preview ? 'Demo' : 'Deals'}
    >
      <MotionInView delay={70}>
        <View style={styles.portalHeroCard}>
          <View style={styles.portalHeroGlow} />
          <Text style={styles.portalHeroKicker}>Offer studio</Text>
          <Text style={styles.portalHeroTitle}>
            Build premium deal campaigns with cleaner placement and faster readouts.
          </Text>
          <Text style={styles.portalHeroBody}>
            This pass keeps the workflow identical, but gives the promotions workspace clearer
            rhythm between planning, live offers, and analytics.
          </Text>
          <View style={styles.portalHeroMetricRow}>
            <View style={styles.portalHeroMetricCard}>
              <Text style={styles.portalHeroMetricValue}>{activePromotions}</Text>
              <Text style={styles.portalHeroMetricLabel}>Active Offers</Text>
            </View>
            <View style={styles.portalHeroMetricCard}>
              <Text style={styles.portalHeroMetricValue}>{promotionPerformance.length}</Text>
              <Text style={styles.portalHeroMetricLabel}>Tracked Offers</Text>
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
              <Text style={styles.metaChipText}>
                {preview ? 'Preview-safe campaign planning' : 'Live owner workspace'}
              </Text>
            </View>
            <View style={styles.metaChip}>
              <Text style={styles.metaChipText}>Planner + analytics in one surface</Text>
            </View>
          </View>
        </View>
      </MotionInView>

      <MotionInView delay={120}>
        <SectionCard
          title="Promotion planner"
          body="Use ISO-style dates for now so scheduling is exact. Example: 2026-03-29T15:00."
        >
          <View style={styles.sectionStack}>
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
                <Ionicons
                  name={editingPromotionId ? 'create-outline' : 'sparkles-outline'}
                  size={20}
                  color={editingPromotionId ? '#00F58C' : '#F5C86A'}
                />
              </View>
              <View style={styles.summaryStrip}>
                <View style={styles.summaryTile}>
                  <Text style={styles.summaryTileValue}>
                    {editingPromotionId ? 'Editing' : preview ? 'Preview' : 'Draft'}
                  </Text>
                  <Text style={styles.summaryTileLabel}>Mode</Text>
                  <Text style={styles.summaryTileBody}>
                    {editingPromotionId
                      ? 'A saved promotion is loaded into the planner.'
                      : 'No saved promotion is loaded yet.'}
                  </Text>
                </View>
                <View style={styles.summaryTile}>
                  <Text style={styles.summaryTileValue}>{audience.replace(/_/g, ' ')}</Text>
                  <Text style={styles.summaryTileLabel}>Audience</Text>
                  <Text style={styles.summaryTileBody}>
                    Which customer segment should see this offer first.
                  </Text>
                </View>
                <View style={styles.summaryTile}>
                  <Text style={styles.summaryTileValue}>{placementSurfaces.length}</Text>
                  <Text style={styles.summaryTileLabel}>Priority Surfaces</Text>
                  <Text style={styles.summaryTileBody}>
                    Surfaces currently set to boost this campaign.
                  </Text>
                </View>
              </View>
            </View>

            {isLoading ? <Text style={styles.helperText}>Loading promotions...</Text> : null}
            {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}

            <View style={styles.plannerPanel}>
              <View style={styles.splitHeaderRow}>
                <View style={styles.splitHeaderCopy}>
                  <Text style={styles.sectionEyebrow}>Creative</Text>
                  <Text style={styles.splitHeaderTitle}>Offer headline and card copy</Text>
                  <Text style={styles.splitHeaderBody}>
                    Keep the message tight enough to scan well on storefront cards.
                  </Text>
                </View>
                <Ionicons name="megaphone-outline" size={20} color="#F5C86A" />
              </View>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Promotion title</Text>
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Promotion title"
                  placeholderTextColor="#738680"
                  style={styles.inputPremium}
                />
              </View>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Customer-facing card copy</Text>
                <TextInput
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
                  <Text style={styles.splitHeaderTitle}>Control where the offer gets extra weight</Text>
                  <Text style={styles.splitHeaderBody}>
                    Tune audience, card treatment, placement surfaces, and featured scope.
                  </Text>
                </View>
                <Ionicons name="options-outline" size={20} color="#8EDCFF" />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Schedule window</Text>
                <Text style={styles.fieldHint}>
                  ISO-style timestamps are still used so scheduling stays exact.
                </Text>
                <TextInput
                  value={startsAt}
                  onChangeText={setStartsAt}
                  placeholder="Starts at"
                  placeholderTextColor="#738680"
                  style={styles.inputPremium}
                />
                <TextInput
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
                  {AUDIENCE_OPTIONS.map((option) => (
                    <Pressable
                      key={option.value}
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
                <Text style={styles.fieldLabel}>Card style</Text>
                <View style={styles.wrapRow}>
                  {CARD_TONE_OPTIONS.map((option) => (
                    <Pressable
                      key={option.value}
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
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Priority placement surfaces</Text>
                <View style={styles.wrapRow}>
                  {PLACEMENT_SURFACE_OPTIONS.map((option) => {
                    const isSelected = placementSurfaces.includes(option.value);
                    return (
                      <Pressable
                        key={option.value}
                        onPress={() =>
                          setPlacementSurfaces((current) =>
                            isSelected
                              ? current.filter((value) => value !== option.value)
                              : current.concat(option.value)
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
                  Matching surfaces are boosted higher while the promotion is active.
                </Text>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Featured area</Text>
                <View style={styles.wrapRow}>
                  {PLACEMENT_SCOPE_OPTIONS.map((option) => (
                    <Pressable
                      key={option.value}
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
                <Ionicons
                  name={alertFollowersOnStart ? 'notifications' : 'notifications-off-outline'}
                  size={20}
                  color={alertFollowersOnStart ? '#00F58C' : '#9CC5B4'}
                />
              </View>

              <Pressable
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
                      Trigger owner follower notifications when this promotion starts.
                    </Text>
                  </View>
                  <Ionicons
                    name={alertFollowersOnStart ? 'radio-button-on' : 'radio-button-off-outline'}
                    size={20}
                    color={alertFollowersOnStart ? '#00F58C' : '#9CC5B4'}
                  />
                </View>
              </Pressable>

              <View style={styles.buttonRow}>
                <Pressable
                  disabled={ctaDisabled}
                  onPress={() => {
                    const input = {
                      title: title.trim(),
                      description: description.trim(),
                      badges: badgesInput
                        .split(',')
                        .map((badge) => badge.trim())
                        .filter(Boolean),
                      startsAt: new Date(startsAt).toISOString(),
                      endsAt: new Date(endsAt).toISOString(),
                      audience,
                      alertFollowersOnStart,
                      cardTone,
                      placementSurfaces,
                      placementScope,
                    };

                    void (editingPromotionId
                      ? updatePromotion(editingPromotionId, input)
                      : createPromotion(input)
                    ).then(() => {
                      resetForm();
                    });
                  }}
                  style={[styles.primaryButton, ctaDisabled && styles.buttonDisabled]}
                >
                  <Text style={styles.primaryButtonText}>
                    {preview
                      ? 'Preview Only'
                      : isSaving
                        ? 'Saving...'
                        : editingPromotionId
                          ? 'Update Promotion'
                          : 'Create Promotion'}
                  </Text>
                </Pressable>
                <Pressable onPress={resetForm} style={styles.secondaryButton}>
                  <Text style={styles.secondaryButtonText}>Reset Form</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </SectionCard>
      </MotionInView>

      <MotionInView delay={220}>
        <SectionCard
          title="Live and scheduled promotions"
          body="Load any promotion into the planner to edit timing, placement, badge mix, or the card treatment."
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
                    <Ionicons name="pricetag-outline" size={20} color="#F5C86A" />
                  </View>

                  <View style={styles.tagRow}>
                    <View style={styles.tag}>
                      <Text style={styles.tagText}>{promotion.cardTone.replace(/_/g, ' ')}</Text>
                    </View>
                    <View style={styles.tag}>
                      <Text style={styles.tagText}>
                        {promotion.placementScope === 'statewide' ? 'Statewide' : 'My area'}
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
                    {promotion.placementSurfaces.length
                      ? `Boosted on ${promotion.placementSurfaces.join(', ')}.`
                      : 'No boosted placement surfaces selected.'}
                  </Text>

                  <Pressable
                    onPress={() => {
                      setEditingPromotionId(promotion.id);
                      setTitle(promotion.title);
                      setDescription(promotion.description);
                      setBadgesInput(promotion.badges.join(', '));
                      setStartsAt(promotion.startsAt.slice(0, 16));
                      setEndsAt(promotion.endsAt.slice(0, 16));
                      setAudience(promotion.audience);
                      setCardTone(promotion.cardTone);
                      setAlertFollowersOnStart(promotion.alertFollowersOnStart);
                      setPlacementSurfaces(promotion.placementSurfaces);
                      setPlacementScope(promotion.placementScope);
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
              <Text style={styles.emptyStateTitle}>No promotions scheduled yet</Text>
              <Text style={styles.emptyStateBody}>
                Build the first campaign in the planner above. Once an offer is saved, it will
                appear here with a calmer summary card and a quick path back into editing.
              </Text>
            </View>
          )}
        </SectionCard>
      </MotionInView>

      <MotionInView delay={300}>
        <SectionCard
          title="Offer performance"
          body="These results use the live deal analytics tied to promotion IDs, so you can compare one offer against another by visibility, taps, and route intent."
        >
          {promotionPerformance.length ? (
            <View style={styles.sectionStack}>
              <View style={styles.summaryStrip}>
                <View style={styles.summaryTile}>
                  <Text style={styles.summaryTileValue}>{formatCount(promotionPerformance.length)}</Text>
                  <Text style={styles.summaryTileLabel}>Tracked Offers</Text>
                  <Text style={styles.summaryTileBody}>Offers with measurable performance data.</Text>
                </View>
                <View style={styles.summaryTile}>
                  <Text style={styles.summaryTileValue}>{formatCount(totalImpressions)}</Text>
                  <Text style={styles.summaryTileLabel}>Total Impressions</Text>
                  <Text style={styles.summaryTileBody}>Combined visibility across tracked promotions.</Text>
                </View>
                <View style={styles.summaryTile}>
                  <Text style={styles.summaryTileValue}>{formatCount(totalTrackedActions)}</Text>
                  <Text style={styles.summaryTileLabel}>Tracked Actions</Text>
                  <Text style={styles.summaryTileBody}>Route, website, menu, and phone intent combined.</Text>
                </View>
                <View style={styles.summaryTile}>
                  <Text style={styles.summaryTileValue}>{formatRate(bestActionRate)}</Text>
                  <Text style={styles.summaryTileLabel}>Best Action Rate</Text>
                  <Text style={styles.summaryTileBody}>Highest offer-level action rate in the set.</Text>
                </View>
              </View>

              {topPerformance ? (
                <View style={styles.analyticsSpotlightCard}>
                  <View style={styles.analyticsSpotlightHeader}>
                    <View style={styles.splitHeaderCopy}>
                      <Text style={styles.sectionEyebrow}>Current leader</Text>
                      <Text style={styles.splitHeaderTitle}>{topPerformance.title}</Text>
                      <Text style={styles.analyticsSpotlightBody}>
                        This promotion is setting the pace on action rate right now while still
                        carrying meaningful storefront visibility.
                      </Text>
                    </View>
                    <Ionicons name="ribbon-outline" size={22} color="#F5C86A" />
                  </View>
                  <Text style={styles.analyticsSpotlightValue}>
                    {formatRate(topPerformance.metrics.actionRate)}
                  </Text>
                  <View style={styles.metricProgressTrack}>
                    <View
                      style={[
                        styles.metricProgressFill,
                        styles.metricProgressFillWarm,
                        { width: `${Math.max(clampProgress(topPerformance.metrics.actionRate / 100) * 100, topPerformance.metrics.actionRate > 0 ? 12 : 0)}%` },
                      ]}
                    />
                  </View>
                  <Text style={styles.metricProgressLabel}>
                    Action rate against the best promotion in the current set
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
                        {formatCount(
                          topPerformance.metrics.redeemStarts +
                            topPerformance.metrics.websiteTaps +
                            topPerformance.metrics.menuTaps +
                            topPerformance.metrics.phoneTaps
                        )}
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
                  <Text style={styles.analyticsSectionEyebrow}>Offer comparison grid</Text>
                  <Text style={styles.analyticsSectionTitle}>
                    Each card balances visibility, click-through strength, and downstream action.
                  </Text>
                  <Text style={styles.analyticsSectionBody}>
                    The cards stay horizontal so the owner can compare multiple promotions quickly
                    without changing how metrics are calculated.
                  </Text>
                </View>

              <View style={styles.analyticsScrollFrame}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={[styles.metricGrid, { minWidth: 920 }]}>
                    {promotionPerformance.map((performance, index) => (
                      <OwnerPortalAnalyticsCard
                        body={`${formatCount(performance.metrics.impressions)} impressions, ${formatCount(performance.metrics.opens)} opens, and ${formatCount(performance.metrics.saves)} saves across the selected offer window.`}
                        eyebrow={`#${index + 1} / ${performance.status.toUpperCase()}`}
                        footer={`Website ${formatCount(performance.metrics.websiteTaps)} | Menu ${formatCount(performance.metrics.menuTaps)} | Phone ${formatCount(performance.metrics.phoneTaps)} | Redemptions ${formatCount(performance.metrics.redeemed)}`}
                        icon={
                          index % 4 === 0
                            ? 'sparkles-outline'
                            : index % 4 === 1
                              ? 'flash-outline'
                              : index % 4 === 2
                                ? 'layers-outline'
                                : 'stats-chart-outline'
                        }
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
                              getRelativeProgress(performance.metrics.impressions, maxPromotionImpressions) *
                                100
                            ),
                          },
                          {
                            label: 'Action share',
                            value: formatRate(
                              getRelativeProgress(
                                performance.metrics.redeemStarts +
                                  performance.metrics.websiteTaps +
                                  performance.metrics.menuTaps +
                                  performance.metrics.phoneTaps,
                                maxPromotionActions
                              ) * 100
                            ),
                          },
                        ]}
                        title={performance.title}
                        tone={
                          index % 4 === 0
                            ? 'warm'
                            : index % 4 === 1
                              ? 'success'
                              : index % 4 === 2
                                ? 'cyan'
                                : 'rose'
                        }
                        value={formatRate(performance.metrics.clickThroughRate)}
                      />
                    ))}
                  </View>
                </ScrollView>
              </View>
              </View>
            </View>
          ) : (
            <View style={styles.emptyStateCard}>
              <Text style={styles.emptyStateTitle}>Analytics will populate after live activity</Text>
              <Text style={styles.emptyStateBody}>
                Once promotions begin receiving visibility and customer interaction, this section
                will show a calmer analytics overview first and then the deeper per-offer cards.
              </Text>
            </View>
          )}
        </SectionCard>
      </MotionInView>
    </ScreenShell>
  );
}

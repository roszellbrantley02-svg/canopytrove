import React from 'react';
import { Text, View } from 'react-native';
import { SectionCard } from '../../components/SectionCard';
import type { AppUiIconName } from '../../icons/AppUiIcon';
import { AppUiIcon } from '../../icons/AppUiIcon';
import { CANOPYTROVE_POINTS } from '../../services/canopyTroveGamificationService';
import { colors } from '../../theme/tokens';
import type { GamificationBadgeDefinition } from '../../types/storefront';
import type { BadgeProgressItem } from './profileUtils';
import { styles } from './profileStyles';

const POINTS_PLAYBOOK = [
  {
    label: 'Visit a new shop',
    detail: 'First verified route to a storefront you have not visited yet.',
    value: `+${CANOPYTROVE_POINTS.visit_new}`,
  },
  {
    label: 'Write a review',
    detail: 'Base activity credit for sharing an honest storefront review.',
    value: `+${CANOPYTROVE_POINTS.review_submit}`,
  },
  {
    label: 'Add real detail',
    detail: 'Additional activity credit for reviews with 100 or more characters.',
    value: `+${CANOPYTROVE_POINTS.review_detailed}`,
  },
  {
    label: 'Add photos',
    detail: 'Additional activity credit when a review includes storefront photos.',
    value: `+${CANOPYTROVE_POINTS.review_with_photo}`,
  },
  {
    label: 'Helpful votes',
    detail: 'Counted when other people mark one of your reviews as helpful.',
    value: `+${CANOPYTROVE_POINTS.review_helpful}`,
  },
  {
    label: 'Invite a friend',
    detail: 'Shared when a new member joins from your invite flow.',
    value: `+${CANOPYTROVE_POINTS.friend_invited}`,
  },
  {
    label: 'Reports and flags',
    detail: 'Tracked for moderation and quality control, but not rewarded.',
    value: 'No points',
  },
] as const;

const FEATURED_BADGE_LIMIT = 4;
const NEXT_UNLOCK_LIMIT = 3;

type ProfileRewardsSectionProps = {
  featuredBadges: readonly GamificationBadgeDefinition[];
  earnedBadges: readonly GamificationBadgeDefinition[];
  nextBadges: readonly BadgeProgressItem[];
};

export function ProfileRewardsSection({
  featuredBadges,
  earnedBadges,
  nextBadges,
}: ProfileRewardsSectionProps) {
  const visibleFeaturedBadges = featuredBadges.slice(0, FEATURED_BADGE_LIMIT);
  const visibleNextBadges = nextBadges.slice(0, NEXT_UNLOCK_LIMIT);

  return (
    <SectionCard
      title="Progress overview"
      body="Milestones, nearest unlocks, and activity signals."
    >
      <View style={styles.progressList}>
        <View style={styles.progressCard}>
          <View style={styles.progressRow}>
            <View style={styles.progressText}>
              <Text style={styles.progressCardTitle}>Featured highlights</Text>
              <Text style={styles.progressCardBody}>
                {featuredBadges.length
                  ? `${earnedBadges.length} milestones earned.`
                  : 'Highlights appear as you earn milestones.'}
              </Text>
            </View>
            <Text style={styles.progressValue}>{`${visibleFeaturedBadges.length} shown`}</Text>
          </View>
          {visibleFeaturedBadges.length ? (
            <View style={styles.badgeGrid}>
              {visibleFeaturedBadges.map((badge) => (
                <View
                  key={badge.id}
                  style={[
                    styles.featuredBadgeCard,
                    { borderColor: `${badge.color}55`, backgroundColor: `${badge.color}12` },
                  ]}
                >
                  <View style={[styles.badgeIcon, { backgroundColor: badge.color }]}>
                    <AppUiIcon
                      name={badge.icon as AppUiIconName}
                      size={24}
                      color={colors.background}
                    />
                  </View>
                  <Text style={styles.badgeName} numberOfLines={2}>
                    {badge.name}
                  </Text>
                  <View style={styles.badgeTierPill}>
                    <Text style={styles.badgeTierPillText}>
                      {badge.tier ? badge.tier : badge.category}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>No highlights unlocked yet.</Text>
          )}
        </View>

        <View style={styles.progressCard}>
          <View style={styles.progressRow}>
            <View style={styles.progressText}>
              <Text style={styles.progressCardTitle}>Nearest milestones</Text>
              <Text style={styles.progressCardBody}>Closest measurable milestones.</Text>
            </View>
            <Text style={styles.progressValue}>{`${visibleNextBadges.length} nearby`}</Text>
          </View>
          {visibleNextBadges.length ? (
            <View style={styles.progressList}>
              {visibleNextBadges.map((item) => (
                <View key={item.badge.id} style={styles.progressCard}>
                  <View style={styles.progressRow}>
                    <View style={styles.progressText}>
                      <Text style={styles.progressCardTitle}>{item.badge.name}</Text>
                      <Text style={styles.progressCardBody}>{item.badge.description}</Text>
                    </View>
                    <Text style={styles.progressValue}>{item.label}</Text>
                  </View>
                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${Math.max(6, item.progress * 100)}%`,
                          backgroundColor: item.badge.color,
                        },
                      ]}
                    />
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>All measurable milestones are already unlocked.</Text>
          )}
        </View>

        <View style={styles.progressCard}>
          <Text style={styles.progressCardTitle}>Activity signals</Text>
          <Text style={styles.progressCardBody}>
            Quality reviews, visits, and community engagement earn points. Reports don't reward
            points.
          </Text>
          <View style={styles.playbookList}>
            {POINTS_PLAYBOOK.map((item) => (
              <View key={item.label} style={styles.playbookRow}>
                <View style={styles.playbookText}>
                  <Text style={styles.playbookTitle}>{item.label}</Text>
                  <Text style={styles.playbookBody}>{item.detail}</Text>
                </View>
                <Text
                  style={[
                    styles.playbookValue,
                    item.value === 'No points' && styles.playbookValueMuted,
                  ]}
                >
                  {item.value}
                </Text>
              </View>
            ))}
          </View>
          <Text style={styles.playbookFootnote}>
            Profile milestones include first reviews, repeat visits, helpful votes, and streaks.
          </Text>
        </View>
      </View>
    </SectionCard>
  );
}

export function TrophyCaseSection({
  featuredBadges,
}: {
  featuredBadges: readonly GamificationBadgeDefinition[];
}) {
  return (
    <SectionCard
      title="Highlights"
      body={
        featuredBadges.length
          ? 'Top unlocked highlights.'
          : 'Highlights appear as you earn milestones.'
      }
    >
      {featuredBadges.length ? (
        <View style={styles.badgeGrid}>
          {featuredBadges.map((badge) => (
            <View
              key={badge.id}
              style={[
                styles.featuredBadgeCard,
                { borderColor: `${badge.color}55`, backgroundColor: `${badge.color}12` },
              ]}
            >
              <View style={[styles.badgeIcon, { backgroundColor: badge.color }]}>
                <AppUiIcon name={badge.icon as AppUiIconName} size={24} color={colors.background} />
              </View>
              <Text style={styles.badgeName} numberOfLines={2}>
                {badge.name}
              </Text>
              <View style={styles.badgeTierPill}>
                <Text style={styles.badgeTierPillText}>
                  {badge.tier ? badge.tier : badge.category}
                </Text>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.emptyText}>No highlights unlocked yet.</Text>
      )}
    </SectionCard>
  );
}

export function BadgeGallerySection({
  earnedBadges,
}: {
  earnedBadges: readonly GamificationBadgeDefinition[];
}) {
  return (
    <SectionCard
      title="Unlocked badges"
      body={
        earnedBadges.length
          ? 'Long-term profile milestones.'
          : 'Badges appear as you build activity.'
      }
    >
      {earnedBadges.length ? (
        <View style={styles.badgeGrid}>
          {earnedBadges.map((badge) => (
            <View
              key={badge.id}
              style={[
                styles.badgeCard,
                { borderColor: `${badge.color}55`, backgroundColor: `${badge.color}12` },
              ]}
            >
              <View style={[styles.badgeIcon, { backgroundColor: badge.color }]}>
                <AppUiIcon name={badge.icon as AppUiIconName} size={24} color={colors.background} />
              </View>
              <Text style={styles.badgeName} numberOfLines={2}>
                {badge.name}
              </Text>
              <Text style={styles.badgeDescription} numberOfLines={3}>
                {badge.description}
              </Text>
              <View style={styles.badgeTierPill}>
                <Text style={styles.badgeTierPillText}>
                  {badge.tier ? badge.tier : badge.category}
                </Text>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.emptyText}>No badges unlocked yet.</Text>
      )}
    </SectionCard>
  );
}

export function NextUnlocksSection({ nextBadges }: { nextBadges: readonly BadgeProgressItem[] }) {
  return (
    <SectionCard title="Nearest milestones" body="Closest measurable milestones.">
      {nextBadges.length ? (
        <View style={styles.progressList}>
          {nextBadges.map((item) => (
            <View key={item.badge.id} style={styles.progressCard}>
              <View style={styles.progressRow}>
                <View style={styles.progressText}>
                  <Text style={styles.progressCardTitle}>{item.badge.name}</Text>
                  <Text style={styles.progressCardBody}>{item.badge.description}</Text>
                </View>
                <Text style={styles.progressValue}>{item.label}</Text>
              </View>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.max(6, item.progress * 100)}%`,
                      backgroundColor: item.badge.color,
                    },
                  ]}
                />
              </View>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.emptyText}>All measurable milestones are already unlocked.</Text>
      )}
    </SectionCard>
  );
}

export function PointsPlaybookSection() {
  return (
    <SectionCard
      title="Activity signals"
      body="Quality reviews, visits, and engagement earn points. Reports don't."
    >
      <View style={styles.playbookList}>
        {POINTS_PLAYBOOK.map((item) => (
          <View key={item.label} style={styles.playbookRow}>
            <View style={styles.playbookText}>
              <Text style={styles.playbookTitle}>{item.label}</Text>
              <Text style={styles.playbookBody}>{item.detail}</Text>
            </View>
            <Text
              style={[
                styles.playbookValue,
                item.value === 'No points' && styles.playbookValueMuted,
              ]}
            >
              {item.value}
            </Text>
          </View>
        ))}
      </View>
      <Text style={styles.playbookFootnote}>
        Profile milestones include first reviews, repeat visits, helpful votes, and streaks.
      </Text>
    </SectionCard>
  );
}

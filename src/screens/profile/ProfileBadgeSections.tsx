import React from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SectionCard } from '../../components/SectionCard';
import { CANOPYTROVE_POINTS } from '../../services/canopyTroveGamificationService';
import { colors } from '../../theme/tokens';
import { GamificationBadgeDefinition } from '../../types/storefront';
import { BadgeProgressItem } from './profileUtils';
import { styles } from './profileStyles';

const POINTS_PLAYBOOK = [
  {
    label: 'Visit a new shop',
    detail: 'First verified route to a storefront you have not visited yet.',
    value: `+${CANOPYTROVE_POINTS.visit_new}`,
  },
  {
    label: 'Write a review',
    detail: 'Base reward for sharing an honest storefront review.',
    value: `+${CANOPYTROVE_POINTS.review_submit}`,
  },
  {
    label: 'Add real detail',
    detail: 'Extra points for reviews with 100 or more characters.',
    value: `+${CANOPYTROVE_POINTS.review_detailed}`,
  },
  {
    label: 'Add photos',
    detail: 'Extra points when a review includes storefront photos.',
    value: `+${CANOPYTROVE_POINTS.review_with_photo}`,
  },
  {
    label: 'Helpful votes',
    detail: 'Earned when other people mark one of your reviews as helpful.',
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

export function TrophyCaseSection({ featuredBadges }: { featuredBadges: readonly GamificationBadgeDefinition[] }) {
  return (
    <SectionCard
      title="Trophy case"
      body={
        featuredBadges.length
          ? 'Top unlocked achievements on this profile.'
          : 'Trophies land here as reviews, visits, and community actions accumulate.'
      }
    >
      {featuredBadges.length ? (
        <View style={styles.badgeGrid}>
          {featuredBadges.map((badge) => (
            <View key={badge.id} style={styles.featuredBadgeCard}>
              <View style={[styles.badgeIcon, { backgroundColor: badge.color }]}>
                <Ionicons name={badge.icon as keyof typeof Ionicons.glyphMap} size={18} color={colors.background} />
              </View>
              <Text style={styles.badgeName}>{badge.name}</Text>
              <Text style={styles.badgeMeta}>{`${badge.tier ?? 'badge'} - ${badge.category}`}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.emptyText}>No trophies unlocked yet.</Text>
      )}
    </SectionCard>
  );
}

export function BadgeGallerySection({ earnedBadges }: { earnedBadges: readonly GamificationBadgeDefinition[] }) {
  return (
    <SectionCard
      title="Badge gallery"
      body={
        earnedBadges.length
          ? 'Unlocked badges stay visible here as the permanent achievement layer.'
          : 'Badge unlocks will appear here as this profile progresses.'
      }
    >
      {earnedBadges.length ? (
        <View style={styles.badgeGrid}>
          {earnedBadges.map((badge) => (
            <View key={badge.id} style={styles.badgeCard}>
              <View style={[styles.badgeIcon, { backgroundColor: badge.color }]}>
                <Ionicons name={badge.icon as keyof typeof Ionicons.glyphMap} size={18} color={colors.background} />
              </View>
              <Text style={styles.badgeName}>{badge.name}</Text>
              <Text style={styles.badgeDescription}>{badge.description}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.emptyText}>No badges earned yet.</Text>
      )}
    </SectionCard>
  );
}

export function NextUnlocksSection({ nextBadges }: { nextBadges: readonly BadgeProgressItem[] }) {
  return (
    <SectionCard title="Next unlocks" body="These are the nearest measurable badge targets for this profile.">
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
                    { width: `${Math.max(6, item.progress * 100)}%`, backgroundColor: item.badge.color },
                  ]}
                />
              </View>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.emptyText}>All measurable badges are already unlocked.</Text>
      )}
    </SectionCard>
  );
}

export function PointsPlaybookSection() {
  return (
    <SectionCard
      title="How points work"
      body="Canopy Trove rewards quality reviews, real visits, and helpful community activity. Reports stay important, but they are not gamified."
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
        Badges unlock from milestones like first reviews, repeat visits, helpful votes, and streaks.
      </Text>
    </SectionCard>
  );
}

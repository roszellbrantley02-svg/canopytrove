import React from 'react';
import { Text, View } from 'react-native';
import { ownerPortalStyles as styles } from './ownerPortalStyles';

export function OwnerPortalHomeHero({
  preview,
  managedStorefrontCount,
  savedFollowers,
  trackedActions7d,
  chips,
}: {
  preview: boolean;
  managedStorefrontCount: number;
  savedFollowers: number;
  trackedActions7d: number;
  chips: string[];
}) {
  return (
    <View style={styles.portalHeroCard}>
      <View style={styles.portalHeroGlow} />
      <Text style={styles.portalHeroKicker}>Owner workspace</Text>
      <Text style={styles.portalHeroTitle}>
        {preview
          ? 'Review the owner workspace with preview data.'
          : 'Run storefront readiness, visibility, and growth from one dashboard.'}
      </Text>
      <Text style={styles.portalHeroBody}>
        {preview
          ? 'Use this workspace to review deals, media, and profile tools without touching live records.'
          : 'Manage listing health, promotions, compliance, and plan access from one private workspace.'}
      </Text>
      <View style={styles.portalHeroMetricRow}>
        <View style={styles.portalHeroMetricCard}>
          <Text style={styles.portalHeroMetricValue}>{managedStorefrontCount}</Text>
          <Text style={styles.portalHeroMetricLabel}>Managed Storefronts</Text>
        </View>
        <View style={styles.portalHeroMetricCard}>
          <Text style={styles.portalHeroMetricValue}>{savedFollowers}</Text>
          <Text style={styles.portalHeroMetricLabel}>Saved Followers</Text>
        </View>
        <View style={styles.portalHeroMetricCard}>
          <Text style={styles.portalHeroMetricValue}>{trackedActions7d}</Text>
          <Text style={styles.portalHeroMetricLabel}>Tracked Actions 7D</Text>
        </View>
      </View>
      <View style={styles.portalHeroMetaRow}>
        {chips.map((chip) => (
          <View key={chip} style={styles.metaChip}>
            <Text style={styles.metaChipText}>{chip}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

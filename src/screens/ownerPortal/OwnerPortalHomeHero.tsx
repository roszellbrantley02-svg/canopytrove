import React from 'react';
import { Platform, Text, View } from 'react-native';
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
  const isAndroid = Platform.OS === 'android';

  return (
    <View style={styles.portalHeroCard}>
      <View style={styles.portalHeroGlow} />
      <Text style={styles.portalHeroKicker}>Business profile</Text>
      <Text style={styles.portalHeroTitle}>
        {preview
          ? 'Preview how your owner space reads before you publish anything live.'
          : 'Keep your storefront sharp, trusted, and easy for customers to open.'}
      </Text>
      <Text style={styles.portalHeroBody}>
        {preview
          ? isAndroid
            ? 'Review gallery photos, updates, and profile details without touching live records.'
            : 'Review gallery photos, offers, and profile details without touching live records.'
          : isAndroid
            ? 'Manage gallery photos, reviews, updates, hours, and billing from one private space.'
            : 'Manage gallery photos, reviews, offers, hours, and billing from one private space.'}
      </Text>
      <View style={styles.portalHeroMetricRow}>
        <View style={styles.portalHeroMetricCard}>
          <Text style={styles.portalHeroMetricValue}>{managedStorefrontCount}</Text>
          <Text style={styles.portalHeroMetricLabel}>Locations</Text>
        </View>
        <View style={styles.portalHeroMetricCard}>
          <Text style={styles.portalHeroMetricValue}>{savedFollowers}</Text>
          <Text style={styles.portalHeroMetricLabel}>Saved Followers</Text>
        </View>
        <View style={styles.portalHeroMetricCard}>
          <Text style={styles.portalHeroMetricValue}>{trackedActions7d}</Text>
          <Text style={styles.portalHeroMetricLabel}>Actions This Week</Text>
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

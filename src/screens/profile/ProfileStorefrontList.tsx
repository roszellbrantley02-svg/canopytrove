import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CustomerStateCard } from '../../components/CustomerStateCard';
import type { AppUiIconName } from '../../icons/AppUiIcon';
import { AppUiIcon } from '../../icons/AppUiIcon';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import type { StorefrontSummary } from '../../types/storefront';
import { colors, radii, spacing, typography } from '../../theme/tokens';

type ProfileStorefrontListProps = {
  storefronts: StorefrontSummary[];
  navigation: NativeStackNavigationProp<RootStackParamList>;
  emptyText: string;
  iconName: AppUiIconName;
};

export function ProfileStorefrontList({
  storefronts,
  navigation,
  emptyText,
  iconName,
}: ProfileStorefrontListProps) {
  if (!storefronts.length) {
    return (
      <CustomerStateCard
        title="No storefronts here yet"
        body={emptyText}
        tone="neutral"
        iconName={iconName}
        eyebrow="Collection state"
        note="This list fills in naturally as you save storefronts or open storefront detail pages."
      />
    );
  }

  return (
    <View style={styles.storefrontList}>
      {storefronts.map((storefront) => (
        <Pressable
          key={storefront.id}
          onPress={() => navigation.navigate('StorefrontDetail', { storefront })}
          style={styles.storefrontRow}
          accessibilityRole="button"
          accessibilityLabel={storefront.displayName}
          accessibilityHint={`Opens the detail page for ${storefront.displayName}`}
        >
          <View style={styles.storefrontBody}>
            <Text style={styles.storefrontTitle}>{storefront.displayName}</Text>
            <Text style={styles.storefrontMeta}>
              {`${storefront.city}, ${storefront.state} - ${storefront.distanceMiles.toFixed(1)} mi`}
            </Text>
          </View>
          <View style={styles.storefrontIconWrap}>
            <AppUiIcon name={iconName} size={18} color={colors.goldSoft} />
          </View>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  storefrontList: {
    gap: spacing.sm,
  },
  storefrontRow: {
    borderRadius: radii.lg,
    backgroundColor: 'rgba(8, 14, 19, 0.72)',
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    shadowColor: colors.shadow,
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },
  storefrontBody: {
    flex: 1,
    gap: spacing.xs,
  },
  storefrontTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '800',
  },
  storefrontMeta: {
    color: colors.textSoft,
    fontSize: typography.caption,
    fontWeight: '700',
  },
  storefrontIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(245, 200, 106, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(245, 200, 106, 0.20)',
  },
});

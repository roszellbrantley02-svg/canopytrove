import React from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { AppUiIcon } from '../icons/AppUiIcon';
import type { OwnerLocationSummary } from '../types/ownerPortal';
import { colors, radii, spacing, typography } from '../theme/tokens';

type Props = {
  locations: OwnerLocationSummary[];
  activeLocationId: string | null;
  onSelectLocation: (storefrontId: string) => void;
};

export function OwnerLocationSwitcher({ locations, activeLocationId, onSelectLocation }: Props) {
  const [expanded, setExpanded] = React.useState(false);

  if (!locations || locations.length <= 1) {
    return null;
  }

  const activeLocation = locations.find((loc) => loc.storefrontId === activeLocationId);
  const otherLocations = locations.filter((loc) => loc.storefrontId !== activeLocationId);

  return (
    <View style={switcherStyles.container}>
      <Pressable style={switcherStyles.activeRow} onPress={() => setExpanded(!expanded)}>
        <View style={switcherStyles.locationInfo}>
          <AppUiIcon name="location-outline" size={18} color={colors.accent} />
          <View style={switcherStyles.flexContent}>
            <Text style={switcherStyles.activeName} numberOfLines={1}>
              {activeLocation?.displayName ?? 'Select Location'}
            </Text>
            {activeLocation ? (
              <Text style={switcherStyles.activeAddress} numberOfLines={1}>
                {activeLocation.addressLine1}, {activeLocation.city}
                {activeLocation.isPrimary ? ' (Primary)' : ''}
              </Text>
            ) : null}
          </View>
        </View>
        <View style={switcherStyles.chevronWrap}>
          <AppUiIcon
            name={expanded ? 'chevron-down' : 'chevron-forward'}
            size={18}
            color={colors.textSoft}
          />
          <Text style={switcherStyles.countBadge}>{locations.length}</Text>
        </View>
      </Pressable>

      {expanded ? (
        <View style={switcherStyles.dropdown}>
          {otherLocations.map((location) => (
            <Pressable
              key={location.storefrontId}
              style={switcherStyles.dropdownRow}
              onPress={() => {
                onSelectLocation(location.storefrontId);
                setExpanded(false);
              }}
            >
              <AppUiIcon name="location-outline" size={16} color={colors.textMuted} />
              <View style={switcherStyles.flexContent}>
                <Text style={switcherStyles.dropdownName} numberOfLines={1}>
                  {location.displayName}
                </Text>
                <Text style={switcherStyles.dropdownAddress} numberOfLines={1}>
                  {location.addressLine1}, {location.city}
                  {location.isPrimary ? ' (Primary)' : ''}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const switcherStyles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  activeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(46, 204, 113, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(46, 204, 113, 0.2)',
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 48,
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  flexContent: {
    flex: 1,
  },
  activeName: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '700',
  },
  activeAddress: {
    color: colors.textSoft,
    fontSize: typography.caption,
    fontWeight: '500',
  },
  chevronWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  countBadge: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '800',
    backgroundColor: 'rgba(46, 204, 113, 0.15)',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  dropdown: {
    marginTop: 4,
    backgroundColor: 'rgba(8, 14, 19, 0.92)',
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  dropdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 48,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSoft,
  },
  dropdownName: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '600',
  },
  dropdownAddress: {
    color: colors.textMuted,
    fontSize: typography.caption,
  },
});

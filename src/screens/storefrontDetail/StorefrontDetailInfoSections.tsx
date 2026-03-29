import React from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CustomerStateCard } from '../../components/CustomerStateCard';
import { SectionCard } from '../../components/SectionCard';
import { colors } from '../../theme/tokens';
import { styles } from './storefrontDetailStyles';

function splitHoursLine(line: string) {
  const separatorIndex = line.indexOf(':');
  if (separatorIndex === -1) {
    return {
      day: 'Hours',
      value: line,
    };
  }

  return {
    day: line.slice(0, separatorIndex).trim(),
    value: line.slice(separatorIndex + 1).trim(),
  };
}

export function DetailOfficialRecordCard({ error }: { error: string | null }) {
  return (
    <SectionCard
      title="Official storefront record"
      body={
        error
          ? 'Canopy Trove could not load a live detail refresh right now. The official storefront listing is still available.'
          : 'This storefront is confirmed on the official OCM list, but richer public storefront details have not been connected yet.'
      }
    >
      <CustomerStateCard
        title="Official record is still intact"
        body="Even without richer supplemental data, the official storefront listing stays visible and can still be used as the customer-facing baseline."
        tone="warm"
        iconName="shield-checkmark-outline"
        eyebrow="Fallback state"
        note="Canopy Trove will keep showing the verified official record instead of dropping the storefront detail surface entirely."
      />
    </SectionCard>
  );
}

export function DetailLiveUpdateUnavailableCard() {
  return (
    <SectionCard
      title="Live update unavailable"
      body="Showing the storefront details currently available on-device. A live refresh did not complete."
    >
      <CustomerStateCard
        title="Using the last available detail state"
        body="Hours, website, and community data are being shown from the best currently available local detail payload until the next successful refresh."
        tone="info"
        iconName="cloud-offline-outline"
        eyebrow="Unavailable right now"
        note="The detail screen stays usable while live refresh catches up."
      />
    </SectionCard>
  );
}

export function DetailStoreSummarySection({
  editorialSummary,
  displayAmenities,
}: {
  editorialSummary: string | null;
  displayAmenities: string[];
}) {
  return (
    <SectionCard title="Storefront summary" body={editorialSummary || undefined}>
      <View style={styles.amenityWrap}>
        {displayAmenities.map((amenity) => (
          <View key={amenity} style={styles.amenityChip}>
            <Text style={styles.amenityText}>{amenity}</Text>
          </View>
        ))}
      </View>
    </SectionCard>
  );
}

export function DetailHoursSection({ hours }: { hours: string[] }) {
  return (
    <SectionCard title="Hours" body="Public business hours from the detail payload.">
      <View style={styles.listBlock}>
        {hours.map((line) => {
          const { day, value } = splitHoursLine(line);
          const isClosed = value.toLowerCase().includes('closed');

          return (
            <View key={line} style={styles.hoursCard}>
              <Text style={styles.hoursDay}>{day}</Text>
              <Text style={[styles.hoursValue, isClosed && styles.hoursValueMuted]}>{value}</Text>
            </View>
          );
        })}
      </View>
    </SectionCard>
  );
}

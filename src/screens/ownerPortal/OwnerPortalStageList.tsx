import React from 'react';
import { Text, View } from 'react-native';
import { AppUiIcon } from '../../icons/AppUiIcon';
import { ownerPortalStyles as styles } from './ownerPortalStyles';

export type OwnerPortalStageTone = 'complete' | 'current' | 'pending' | 'attention';

export type OwnerPortalStageItem = {
  label: string;
  body: string;
  tone: OwnerPortalStageTone;
};

function getToneIcon(tone: OwnerPortalStageTone) {
  switch (tone) {
    case 'complete':
      return { name: 'checkmark-circle' as const, color: '#00F58C', label: 'Complete' };
    case 'current':
      return { name: 'radio-button-on' as const, color: '#F5C86A', label: 'Current' };
    case 'attention':
      return { name: 'alert-circle-outline' as const, color: '#FF9F92', label: 'Attention' };
    case 'pending':
    default:
      return { name: 'radio-button-off-outline' as const, color: '#9CC5B4', label: 'Pending' };
  }
}

export function OwnerPortalStageList({ items }: { items: OwnerPortalStageItem[] }) {
  return (
    <View style={styles.stageList}>
      {items.map((item) => {
        const tone = getToneIcon(item.tone);
        return (
          <View key={item.label} style={styles.stageRow}>
            <View style={styles.stageIconWrap}>
              <AppUiIcon name={tone.name} size={18} color={tone.color} />
            </View>
            <View style={styles.stageCopy}>
              <Text style={styles.stageLabel}>{item.label}</Text>
              <Text style={styles.stageBody}>{item.body}</Text>
            </View>
            <View style={styles.stageBadge}>
              <Text style={styles.stageBadgeText}>{tone.label}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

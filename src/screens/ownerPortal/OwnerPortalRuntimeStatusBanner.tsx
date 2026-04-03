import React from 'react';
import { Text, View } from 'react-native';
import { AppUiIcon } from '../../icons/AppUiIcon';
import type { RuntimeOpsStatus } from '../../types/runtimeOps';
import { ownerPortalStyles as styles } from './ownerPortalStyles';

export function OwnerPortalRuntimeStatusBanner({
  runtimeStatus,
}: {
  runtimeStatus: RuntimeOpsStatus;
}) {
  const { policy, incidentCounts } = runtimeStatus;
  const isPaused = !policy.ownerPortalWritesEnabled || policy.safeModeEnabled;

  return (
    <View style={[styles.actionTile, isPaused ? styles.resultWarning : styles.metricCardCyan]}>
      <View style={styles.splitHeaderRow}>
        <View style={styles.splitHeaderCopy}>
          <Text style={styles.actionTileMeta}>Runtime protection</Text>
          <Text style={styles.actionTileTitle}>
            {isPaused ? 'Protective safe mode is active' : 'Owner workspace is writable'}
          </Text>
          <Text style={styles.actionTileBody}>
            {isPaused
              ? (policy.reason ??
                'Write actions are temporarily paused while the backend stabilizes.')
              : 'No protective write pause is active. Promotions, replies, and profile tools can save normally.'}
          </Text>
        </View>
        <AppUiIcon
          name={isPaused ? 'shield-outline' : 'checkmark-done-circle-outline'}
          size={20}
          color={isPaused ? '#FFB4A8' : '#8EDCFF'}
        />
      </View>
      <Text style={styles.resultMeta}>
        Critical incidents in last 15 minutes: {runtimeStatus.incidentCounts.criticalLast15Minutes}
      </Text>
      <Text style={styles.resultMeta}>
        Client incidents 24H: {incidentCounts.clientLast24Hours} | Server incidents 24H:{' '}
        {incidentCounts.serverLast24Hours}
      </Text>
    </View>
  );
}

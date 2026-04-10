import React from 'react';
import { Platform, Text, View } from 'react-native';
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
  const recentIssues =
    incidentCounts.criticalLast15Minutes > 0 ||
    incidentCounts.clientLast24Hours > 0 ||
    incidentCounts.serverLast24Hours > 0;

  return (
    <View style={[styles.actionTile, isPaused ? styles.resultWarning : styles.metricCardCyan]}>
      <View style={styles.splitHeaderRow}>
        <View style={styles.splitHeaderCopy}>
          <Text style={styles.actionTileMeta}>Update status</Text>
          <Text style={styles.actionTileTitle}>
            {isPaused ? 'Edits are temporarily paused' : 'Everything is ready to update'}
          </Text>
          <Text style={styles.actionTileBody}>
            {isPaused
              ? (policy.reason ??
                'We temporarily paused updates while we smooth things out behind the scenes.')
              : Platform.OS === 'android'
                ? 'You can keep updating your storefront, updates, and replies normally.'
                : 'You can keep updating your storefront, offers, and replies normally.'}
          </Text>
        </View>
        <AppUiIcon
          name={isPaused ? 'shield-outline' : 'checkmark-done-circle-outline'}
          size={20}
          color={isPaused ? '#FFB4A8' : '#8EDCFF'}
        />
      </View>
      <Text style={styles.resultMeta}>
        {isPaused
          ? 'You can still review everything here while saving is paused.'
          : recentIssues
            ? 'We are keeping a closer eye on things right now, but storefront updates are still available.'
            : 'No action needed right now.'}
      </Text>
    </View>
  );
}

import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { AppUiIcon } from '../../icons/AppUiIcon';
import type { OwnerAiActionPlan } from '../../types/ownerPortal';
import { ownerPortalStyles as styles } from './ownerPortalStyles';

export function OwnerPortalAiActionPlanCard({
  actionPlan,
  isLoading,
  onRefresh,
}: {
  actionPlan: OwnerAiActionPlan | null;
  isLoading: boolean;
  onRefresh: () => void;
}) {
  return (
    <View style={styles.sectionStack}>
      <View style={styles.actionTile}>
        <View style={styles.splitHeaderRow}>
          <View style={styles.splitHeaderCopy}>
            <Text style={styles.actionTileMeta}>AI operator</Text>
            <Text style={styles.actionTileTitle}>
              {actionPlan?.headline ?? 'Generate the next owner action plan'}
            </Text>
            <Text style={styles.actionTileBody}>
              {actionPlan?.summary ??
                'This generates a short operating plan from storefront metrics, reviews, promotions, and live owner signals.'}
            </Text>
          </View>
          <AppUiIcon name="sparkles-outline" size={20} color="#F5C86A" />
        </View>
        {actionPlan?.priorities?.length ? (
          <View style={styles.cardStack}>
            {actionPlan.priorities.map((priority, index) => (
              <View
                key={`${priority.title}-${index}`}
                style={[
                  styles.actionTile,
                  priority.tone === 'warning'
                    ? styles.resultWarning
                    : priority.tone === 'success'
                      ? styles.resultSuccess
                      : styles.metricCardCyan,
                ]}
              >
                <Text style={styles.resultTitle}>{priority.title}</Text>
                <Text style={styles.helperText}>{priority.body}</Text>
              </View>
            ))}
          </View>
        ) : null}
        <Text style={styles.resultMeta}>
          {actionPlan
            ? `${actionPlan.usedFallback ? 'Fallback' : 'Model'} draft generated ${new Date(actionPlan.generatedAt).toLocaleString()}.`
            : 'No AI action plan generated yet.'}
        </Text>
        <Pressable
          onPress={onRefresh}
          style={[styles.secondaryButton, isLoading && styles.buttonDisabled]}
        >
          <Text style={styles.secondaryButtonText}>
            {isLoading ? 'Generating...' : actionPlan ? 'Refresh AI Plan' : 'Generate AI Plan'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

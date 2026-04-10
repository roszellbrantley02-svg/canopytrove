import React from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
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
  const isAndroid = Platform.OS === 'android';

  return (
    <View style={styles.sectionStack}>
      <View style={styles.actionTile}>
        <View style={styles.splitHeaderRow}>
          <View style={styles.splitHeaderCopy}>
            <Text style={styles.actionTileMeta}>Suggestions</Text>
            <Text style={styles.actionTileTitle}>
              {actionPlan?.headline ?? 'Get a few smart next steps'}
            </Text>
            <Text style={styles.actionTileBody}>
              {actionPlan?.summary ??
                (isAndroid
                  ? 'We will pull together a short set of ideas based on your storefront activity, reviews, and updates.'
                  : 'We will pull together a short set of ideas based on your storefront activity, reviews, and offers.')}
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
            ? `Updated ${new Date(actionPlan.generatedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}.`
            : 'No suggestions yet.'}
        </Text>
        <Pressable
          onPress={onRefresh}
          disabled={isLoading}
          style={[styles.secondaryButton, isLoading && styles.buttonDisabled]}
          accessibilityRole="button"
          accessibilityLabel={
            isLoading
              ? 'Loading suggestions'
              : actionPlan
                ? 'Refresh suggestions'
                : 'Get suggestions'
          }
          accessibilityHint="Loads a fresh set of suggestions for your storefront."
        >
          <Text style={styles.secondaryButtonText}>
            {isLoading ? 'Loading...' : actionPlan ? 'Refresh Suggestions' : 'Get Suggestions'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

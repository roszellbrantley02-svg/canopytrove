import React from 'react';
import { Text, View } from 'react-native';
import { ownerPortalStyles as styles } from './ownerPortalStyles';

export type OwnerPortalHeroMetric = {
  label: string;
  value: React.ReactNode;
  body: string;
};

type OwnerPortalHeroPanelProps = {
  kicker: string;
  title: string;
  body: string;
  metrics?: readonly OwnerPortalHeroMetric[];
  steps?: readonly string[];
  activeStepIndex?: number;
};

export function OwnerPortalHeroPanel({
  kicker,
  title,
  body,
  metrics = [],
  steps,
  activeStepIndex = -1,
}: OwnerPortalHeroPanelProps) {
  return (
    <View style={styles.portalHeroCard}>
      <View style={styles.portalHeroGlow} />
      <Text style={styles.portalHeroKicker}>{kicker}</Text>
      <Text style={styles.portalHeroTitle}>{title}</Text>
      <Text style={styles.portalHeroBody}>{body}</Text>

      {metrics.length ? (
        <View style={styles.summaryStrip}>
          {metrics.map((metric) => (
            <View key={metric.label} style={styles.summaryTile}>
              <Text style={styles.summaryTileValue}>{metric.value}</Text>
              <Text style={styles.summaryTileLabel}>{metric.label}</Text>
              <Text style={styles.summaryTileBody}>{metric.body}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {steps?.length ? (
        <View style={styles.onboardingStepRow}>
          {steps.map((step, index) => {
            const isActive = index === activeStepIndex;

            return (
              <View
                key={step}
                style={[styles.onboardingStepChip, isActive && styles.onboardingStepChipActive]}
              >
                <Text
                  style={[
                    styles.onboardingStepChipText,
                    isActive && styles.onboardingStepChipTextActive,
                  ]}
                >
                  {step}
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

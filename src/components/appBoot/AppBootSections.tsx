import React from 'react';
import { Animated, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { brand } from '../../config/brand';
import { BrandMarkIcon } from '../../icons/BrandMarkIcon';
import { radii } from '../../theme/tokens';
import { MotionInView } from '../MotionInView';
import { ShimmerBlock } from '../ShimmerBlock';
import { styles } from './appBootStyles';

export function AppBootLayout({ children }: { children: React.ReactNode }) {
  return (
    <LinearGradient colors={['#020304', '#040607', '#020304']} style={styles.screen}>
      <View pointerEvents="none" style={styles.ambientWrap}>
        <View style={[styles.ambientOrb, styles.ambientOrbPrimary]} />
        <View style={[styles.ambientOrb, styles.ambientOrbWarm]} />
        <LinearGradient
          colors={['rgba(143, 255, 209, 0.10)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0.9 }}
          style={styles.ambientBeam}
        />
      </View>
      <View style={styles.content}>
        <View style={styles.shell}>{children}</View>
      </View>
    </LinearGradient>
  );
}

export function AppBootHeader({
  pulse,
  sweep,
}: {
  pulse: Animated.Value;
  sweep: Animated.Value;
}) {
  return (
    <MotionInView delay={0} distance={12}>
      <View style={styles.header}>
        <View style={styles.logoRow}>
          <Animated.View
            style={[
              styles.logoPulse,
              {
                opacity: pulse.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.2, 0.42],
                }),
                transform: [
                  {
                    scale: pulse.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.9, 1.18],
                    }),
                  },
                ],
              },
            ]}
          />
          <View style={styles.logoCore}>
            <BrandMarkIcon size={220} />
          </View>
        </View>
        <View style={styles.brandLockup}>
          <View style={styles.kickerRow}>
            <Text style={styles.eyebrow}>{brand.productName}</Text>
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveBadgeText}>Secure startup</Text>
            </View>
          </View>
          <Text style={styles.title}>Booting a warm storefront session.</Text>
        </View>
        <Text style={styles.subtitle}>
          Restoring your last market, favorites, profile, and storefront context.
        </Text>
        <View style={styles.statusChipRow}>
          <View style={styles.statusChip}>
            <Text style={styles.statusChipText}>Nearby</Text>
          </View>
          <View style={styles.statusChip}>
            <Text style={styles.statusChipText}>Saved</Text>
          </View>
          <View style={styles.statusChip}>
            <Text style={styles.statusChipText}>Profile</Text>
          </View>
        </View>
        <View style={styles.progressRail}>
          <Animated.View
            style={[
              styles.progressSweep,
              {
                transform: [
                  {
                    translateX: sweep.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-240, 240],
                    }),
                  },
                  { rotate: '14deg' },
                ],
              },
            ]}
          />
        </View>
        <View style={styles.bootNoteCard}>
          <Text style={styles.bootNoteTitle}>Preparing your customer entry state</Text>
          <Text style={styles.bootNoteBody}>
            Canopy Trove is restoring storefront surfaces and member context before the app opens.
          </Text>
        </View>
      </View>
    </MotionInView>
  );
}

export function AppBootHero({ pulse }: { pulse: Animated.Value }) {
  return (
    <MotionInView delay={90}>
      <View style={styles.heroCard}>
        <View style={styles.heroHeader}>
          <Text style={styles.heroEyebrow}>Restoring browsing context</Text>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>Member-ready</Text>
          </View>
        </View>
        <Animated.View
          style={[
            styles.heroMapWrap,
            {
              transform: [
                {
                  scale: pulse.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.015],
                  }),
                },
              ],
            },
          ]}
        >
          <ShimmerBlock style={styles.heroMap} borderRadius={radii.md} shimmerWidth={240} />
        </Animated.View>
        <Text style={styles.heroTitle}>Loading the surfaces you left behind.</Text>
        <Text style={styles.heroBody}>
          Favorites, recent storefronts, and profile progress are being staged for a smoother return.
        </Text>
        <ShimmerBlock style={styles.heroLineShort} borderRadius={radii.pill} shimmerWidth={110} />
        <ShimmerBlock style={styles.heroLineLong} borderRadius={radii.pill} shimmerWidth={160} />
        <View style={styles.heroChipRow}>
          <ShimmerBlock style={styles.heroChip} borderRadius={radii.pill} shimmerWidth={70} />
          <ShimmerBlock style={styles.heroChip} borderRadius={radii.pill} shimmerWidth={70} />
          <ShimmerBlock style={styles.heroChipWide} borderRadius={radii.pill} shimmerWidth={90} />
        </View>
      </View>
    </MotionInView>
  );
}

export function AppBootCardStack() {
  return (
    <View style={styles.cardStack}>
      {Array.from({ length: 2 }).map((_, index) => (
        <MotionInView key={`boot-card-${index}`} delay={160 + index * 70}>
          <View style={styles.card}>
            <ShimmerBlock style={styles.cardMap} borderRadius={0} shimmerWidth={220} />
            <View style={styles.cardBody}>
              <ShimmerBlock style={styles.cardLineStrong} borderRadius={radii.pill} shimmerWidth={120} />
              <ShimmerBlock style={styles.cardLineSoft} borderRadius={radii.pill} shimmerWidth={148} />
              <View style={styles.cardChipRow}>
                <ShimmerBlock style={styles.cardChip} borderRadius={radii.pill} shimmerWidth={72} />
                <ShimmerBlock style={styles.cardChip} borderRadius={radii.pill} shimmerWidth={72} />
              </View>
            </View>
          </View>
        </MotionInView>
      ))}
    </View>
  );
}

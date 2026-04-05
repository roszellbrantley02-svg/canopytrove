import React from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStorefrontRewardsController } from '../context/StorefrontController';
import type { AppUiIconName } from '../icons/AppUiIcon';
import { AppUiIcon } from '../icons/AppUiIcon';
import { colors, radii, spacing, typography } from '../theme/tokens';

const TOAST_LIFETIME_MS = 4200;

export function GamificationRewardToastHost() {
  const insets = useSafeAreaInsets();
  const { lastRewardResult, clearLastRewardResult } = useStorefrontRewardsController();
  const translateY = React.useRef(new Animated.Value(-28)).current;
  const opacity = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (!lastRewardResult) {
      return;
    }

    const enter = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.spring(translateY, {
        toValue: 0,
        tension: 90,
        friction: 10,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]);

    const exit = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(translateY, {
        toValue: -20,
        duration: 180,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]);

    enter.start();

    const timeoutId = setTimeout(() => {
      exit.start(({ finished }) => {
        if (finished) {
          clearLastRewardResult();
          translateY.setValue(-28);
        }
      });
    }, TOAST_LIFETIME_MS);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [clearLastRewardResult, lastRewardResult, opacity, translateY]);

  if (!lastRewardResult) {
    return null;
  }

  const primaryBadge = lastRewardResult.badgesEarned[0] ?? null;
  const leveledUp = lastRewardResult.levelAfter > lastRewardResult.levelBefore;
  const badgeSummary = primaryBadge
    ? `, ${lastRewardResult.badgesEarned.length} badge${lastRewardResult.badgesEarned.length > 1 ? 's' : ''}`
    : '';

  return (
    <View
      pointerEvents="box-none"
      style={[styles.container, { paddingTop: insets.top + spacing.md }]}
    >
      <Animated.View
        style={[
          styles.toast,
          {
            opacity,
            transform: [{ translateY }],
          },
        ]}
      >
        <Pressable onPress={clearLastRewardResult} style={styles.pressable}>
          <View style={styles.iconWrap}>
            <AppUiIcon
              name={primaryBadge ? (primaryBadge.icon as AppUiIconName) : 'trophy-outline'}
              size={20}
              color={colors.backgroundDeep}
            />
          </View>
          <View style={styles.content}>
            <Text style={styles.title}>
              {leveledUp
                ? `Profile level ${lastRewardResult.levelAfter} reached`
                : primaryBadge
                  ? `Profile update: ${primaryBadge.name}`
                  : 'Profile updated'}
            </Text>
            <Text style={styles.body}>
              +{lastRewardResult.pointsEarned} activity points{badgeSummary}
            </Text>
          </View>
          <AppUiIcon name="close" size={18} color={colors.textMuted} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
    paddingHorizontal: spacing.lg,
  },
  toast: {
    borderRadius: radii.lg,
    backgroundColor: colors.cardMuted,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 8,
  },
  pressable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gold,
  },
  content: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '800',
  },
  body: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '700',
  },
});

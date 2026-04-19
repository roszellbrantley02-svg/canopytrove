import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { MotionInView } from '../components/MotionInView';
import { ScreenShell } from '../components/ScreenShell';
import { StorefrontRouteCard } from '../components/StorefrontRouteCard';
import { StorefrontRouteCardSkeleton } from '../components/StorefrontRouteCardSkeleton';
import { withScreenErrorBoundary } from '../components/withScreenErrorBoundary';
import { useStorefrontRouteController } from '../context/StorefrontController';
import { useSavedSummaries } from '../hooks/useStorefrontSummaryData';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { colors, spacing, textStyles, motion } from '../theme/tokens';

/**
 * Hard cap on rendered cards. Saved lists are expected to be small (tens),
 * not hundreds, so rendering all of them is fine and avoids FlatList-inside-
 * ScrollView virtualization bugs (items clipped by removeClippedSubviews when
 * the outer ScrollView's viewport differs from the inner FlatList's).
 */
const SAVED_RENDER_CAP = 100;

function SavedStorefrontsScreenInner() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { savedStorefrontIds } = useStorefrontRouteController();
  const { data: savedStorefronts, isLoading } = useSavedSummaries(savedStorefrontIds);

  const handleStorefrontPress = (storefront: (typeof savedStorefronts)[0]) => {
    navigation.navigate('StorefrontDetail', { storefrontId: storefront.id, storefront });
  };

  const renderStorefrontCard = ({
    item,
    index,
  }: {
    item: (typeof savedStorefronts)[0];
    index: number;
  }) => (
    <MotionInView key={item.id} dense delay={Math.min(index, 8) * 40}>
      <StorefrontRouteCard
        storefront={item}
        variant="list"
        onPress={() => handleStorefrontPress(item)}
      />
    </MotionInView>
  );

  return (
    <ScreenShell
      eyebrow="Profile"
      title="Saved Storefronts"
      subtitle={`${savedStorefrontIds.length} saved`}
      showHero={false}
    >
      {isLoading ? (
        <View style={styles.list}>
          {Array.from({ length: Math.max(1, Math.min(savedStorefrontIds.length || 4, 8)) }).map(
            (_, index) => (
              <MotionInView key={`saved-skeleton-${index}`} dense delay={Math.min(index, 8) * 60}>
                <StorefrontRouteCardSkeleton variant="list" />
              </MotionInView>
            ),
          )}
        </View>
      ) : savedStorefronts.length === 0 ? (
        <MotionInView delay={motion.quick}>
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>No saved storefronts</Text>
            <Text style={styles.emptyBody}>Save storefronts while browsing to see them here.</Text>
          </View>
        </MotionInView>
      ) : (
        // Render as a plain View+map rather than a FlatList.
        //
        // The previous version used FlatList with scrollEnabled={false} +
        // removeClippedSubviews + windowSize — every one of those props
        // assumes the FlatList itself scrolls. Nested inside ScreenShell's
        // ScrollView they interact poorly: the FlatList's virtualization
        // can't measure the parent's viewport, so removeClippedSubviews
        // occasionally unmounts cards that are actually visible, producing
        // blank gaps. A saved list is small (users save tens, not thousands),
        // so plain render is both simpler and correct.
        <View style={styles.list}>
          {savedStorefronts.slice(0, SAVED_RENDER_CAP).map((item, index) => (
            <React.Fragment key={item.id}>{renderStorefrontCard({ item, index })}</React.Fragment>
          ))}
          {savedStorefronts.length > SAVED_RENDER_CAP && (
            <Text style={styles.moreItemsNote}>
              Showing {SAVED_RENDER_CAP} of {savedStorefronts.length} saved storefronts
            </Text>
          )}
        </View>
      )}
    </ScreenShell>
  );
}

export const SavedStorefrontsScreen = withScreenErrorBoundary(
  SavedStorefrontsScreenInner,
  'saved-storefronts-screen',
);

const styles = StyleSheet.create({
  list: {
    gap: spacing.md,
  },
  emptyContainer: {
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
  },
  emptyTitle: {
    ...textStyles.section,
    color: colors.text,
  },
  emptyBody: {
    ...textStyles.body,
    color: colors.textMuted,
    textAlign: 'center',
  },
  moreItemsNote: {
    ...textStyles.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.md,
  },
});

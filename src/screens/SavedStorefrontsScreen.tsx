import React from 'react';
import { FlatList, Platform, StyleSheet, Text, View } from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { MotionInView } from '../components/MotionInView';
import { ScreenShell } from '../components/ScreenShell';
import { StorefrontRouteCard } from '../components/StorefrontRouteCard';
import { withScreenErrorBoundary } from '../components/withScreenErrorBoundary';
import { useStorefrontRouteController } from '../context/StorefrontController';
import { useSavedSummaries } from '../hooks/useStorefrontSummaryData';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { colors, spacing, textStyles, motion } from '../theme/tokens';

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
        <MotionInView delay={motion.quick}>
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading saved storefronts...</Text>
          </View>
        </MotionInView>
      ) : savedStorefronts.length === 0 ? (
        <MotionInView delay={motion.quick}>
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>No saved storefronts</Text>
            <Text style={styles.emptyBody}>Save storefronts while browsing to see them here.</Text>
          </View>
        </MotionInView>
      ) : Platform.OS === 'web' ? (
        <View style={styles.list}>
          {savedStorefronts.map((item, index) => (
            <React.Fragment key={item.id}>{renderStorefrontCard({ item, index })}</React.Fragment>
          ))}
        </View>
      ) : (
        <FlatList
          data={savedStorefronts}
          renderItem={renderStorefrontCard}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          initialNumToRender={8}
          maxToRenderPerBatch={6}
          windowSize={5}
          removeClippedSubviews
          contentContainerStyle={styles.list}
        />
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
  loadingContainer: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
  },
  loadingText: {
    ...textStyles.body,
    color: colors.textMuted,
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
});

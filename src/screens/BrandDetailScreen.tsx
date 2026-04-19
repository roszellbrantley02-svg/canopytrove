import React, { useEffect } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MotionInView } from '../components/MotionInView';
import { ScreenShell } from '../components/ScreenShell';
import { SectionCard } from '../components/SectionCard';
import { withScreenErrorBoundary } from '../components/withScreenErrorBoundary';
import { useStorefrontProfileController } from '../context/StorefrontController';
import { trackAnalyticsEvent } from '../services/analyticsService';
import {
  addFavoriteBrand,
  fetchBrandProfile,
  isFavoriteBrand,
  removeFavoriteBrand,
} from '../services/brandService';
import { getCanopyTroveAuthIdToken } from '../services/canopyTroveAuthService';
import { colors, radii, spacing, textStyles } from '../theme/tokens';
import type { RootStackParamList } from '../navigation/rootNavigatorConfig';
import type { BrandProfile } from '../types/brandTypes';

type BrandDetailScreenProps = NativeStackScreenProps<RootStackParamList, 'BrandDetail'>;

function BrandDetailScreenInner({ navigation, route }: BrandDetailScreenProps) {
  const { brandId } = route.params;
  const { authSession, profileId } = useStorefrontProfileController();
  const isAuthenticated = authSession.status === 'authenticated';
  const [brand, setBrand] = React.useState<BrandProfile | null>(null);
  const [isSaved, setIsSaved] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  // Distinguish "still loading" from "load finished, brand not found / errored".
  // Without this flag we can't tell the three cases apart with a single
  // (loading, brand) pair — a null brand looks identical to a loading one,
  // so the screen would spin forever on a bad brandId or network error.
  const [loadError, setLoadError] = React.useState<'not-found' | 'error' | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const profilePromise = fetchBrandProfile(brandId);
        const savedPromise =
          isAuthenticated && profileId
            ? getCanopyTroveAuthIdToken().then((token) =>
                isFavoriteBrand(brandId, { profileId, token: token ?? undefined }),
              )
            : Promise.resolve(false);
        const [profile, saved] = await Promise.all([profilePromise, savedPromise]);
        if (cancelled) return;
        setBrand(profile);
        setIsSaved(saved);
        if (profile) {
          setLoadError(null);
          trackAnalyticsEvent('brand_detail_opened', { brandId });
        } else {
          // fetchBrandProfile returns null when the document is missing.
          // Surface that as an explicit "not-found" rather than letting the
          // screen sit on a loading shell forever.
          setLoadError('not-found');
          trackAnalyticsEvent('brand_detail_missing', { brandId });
        }
      } catch (error) {
        if (cancelled) return;
        console.warn('Failed to load brand detail', error);
        setBrand(null);
        setLoadError('error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [brandId, isAuthenticated, profileId]);

  const handleToggleSave = async () => {
    if (!isAuthenticated || !profileId) {
      console.warn('Cannot toggle favorite without authenticated profile');
      return;
    }
    try {
      const token = await getCanopyTroveAuthIdToken();
      const authOptions = { profileId, token: token ?? undefined };
      if (isSaved) {
        await removeFavoriteBrand(brandId, authOptions);
        setIsSaved(false);
        trackAnalyticsEvent('brand_detail_unsaved', { brandId });
      } else {
        await addFavoriteBrand(brandId, authOptions);
        setIsSaved(true);
        trackAnalyticsEvent('brand_detail_saved', { brandId });
      }
    } catch (error) {
      console.warn('Failed to toggle favorite', error);
    }
  };

  const handleWebsiteTap = () => {
    if (brand?.website) {
      void Linking.openURL(brand.website);
      trackAnalyticsEvent('brand_detail_website_tapped', { brandId });
    }
  };

  if (loading) {
    return (
      <ScreenShell eyebrow="Brand" title="Loading..." subtitle="">
        <View style={{ padding: spacing.lg }} />
      </ScreenShell>
    );
  }

  if (!brand) {
    const title = loadError === 'not-found' ? 'Brand not found' : "Couldn't load brand";
    const message =
      loadError === 'not-found'
        ? "This brand isn't in our catalog yet. It may have been removed, or the link is out of date."
        : 'Something went wrong loading this brand. Check your connection and try again.';
    return (
      <ScreenShell eyebrow="Brand" title={title} subtitle="">
        <View style={styles.content}>
          <SectionCard title={title} body={message}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              style={styles.backButton}
              onPress={() => {
                if (navigation.canGoBack()) {
                  navigation.goBack();
                } else {
                  // Fallback: land users on the main tab stack if the detail
                  // screen was opened without a back stack (e.g. deep link).
                  navigation.navigate('Tabs');
                }
              }}
            >
              <Text style={styles.backButtonText}>Go back</Text>
            </Pressable>
          </SectionCard>
        </View>
      </ScreenShell>
    );
  }

  const passRatePercent = Math.round(brand.contaminantPassRate * 100);

  return (
    <ScreenShell
      eyebrow="Brand"
      title={brand.displayName}
      subtitle={brand.aggregateDominantTerpene || 'Unscanned'}
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <MotionInView delay={0} distance={12}>
          <SectionCard title={brand.displayName} body={brand.aggregateDominantTerpene ?? undefined}>
            <View style={styles.heroContent}>
              {brand.aggregateDominantTerpene ? (
                <View style={styles.terpeneChip}>
                  <Text style={styles.terpeneChipText}>{brand.aggregateDominantTerpene}</Text>
                </View>
              ) : (
                <View />
              )}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={isSaved ? 'Remove from saved brands' : 'Save brand'}
                style={[styles.saveButton, isSaved && styles.saveButtonSaved]}
                onPress={handleToggleSave}
              >
                <Text style={styles.saveButtonText}>{isSaved ? '♥' : '♡'}</Text>
              </Pressable>
            </View>
          </SectionCard>
        </MotionInView>

        <MotionInView delay={50} distance={12}>
          <SectionCard title="Aggregate Potency">
            <View style={styles.statRow}>
              <View>
                <Text style={styles.statValue}>{brand.avgThcPercent}%</Text>
                <Text style={styles.statLabel}>Average THC</Text>
              </View>
              <View>
                <Text style={styles.statValue}>{brand.totalScans}</Text>
                <Text style={styles.statLabel}>Scans</Text>
              </View>
            </View>
          </SectionCard>
        </MotionInView>

        {(brand.smellTags.length > 0 || brand.tasteTags.length > 0) && (
          <MotionInView delay={100} distance={12}>
            <SectionCard title="Smell & Taste">
              {brand.smellTags.length > 0 && (
                <View style={styles.tagSection}>
                  <Text style={styles.tagLabel}>Smell</Text>
                  <View style={styles.tagRow}>
                    {brand.smellTags.map((tag) => (
                      <View key={`smell-${tag}`} style={styles.tag}>
                        <Text style={styles.tagText}>{tag}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
              {brand.tasteTags.length > 0 && (
                <View style={styles.tagSection}>
                  <Text style={styles.tagLabel}>Taste</Text>
                  <View style={styles.tagRow}>
                    {brand.tasteTags.map((tag) => (
                      <View key={`taste-${tag}`} style={styles.tag}>
                        <Text style={styles.tagText}>{tag}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </SectionCard>
          </MotionInView>
        )}

        <MotionInView delay={150} distance={12}>
          <SectionCard title="Contaminant Record">
            <View style={styles.statRow}>
              <View>
                <Text style={styles.statValue}>{passRatePercent}%</Text>
                <Text style={styles.statLabel}>Pass Rate</Text>
              </View>
              <View style={styles.flex1}>
                <Text style={styles.statLabel}>
                  {passRatePercent === 100
                    ? 'All scanned batches passed testing'
                    : `${100 - passRatePercent}% failed contaminant checks`}
                </Text>
              </View>
            </View>
          </SectionCard>
        </MotionInView>

        <MotionInView delay={200} distance={12}>
          <SectionCard title="Carried By">
            <Text style={styles.emptyStateText}>Shop matching coming soon</Text>
          </SectionCard>
        </MotionInView>

        {(brand.description || brand.website) && (
          <MotionInView delay={250} distance={12}>
            <SectionCard title="About">
              {brand.description ? (
                <Text style={styles.descriptionText}>{brand.description}</Text>
              ) : null}
              {brand.website ? (
                <Pressable
                  accessibilityRole="link"
                  style={styles.websiteLink}
                  onPress={handleWebsiteTap}
                >
                  <Text style={styles.websiteLinkText}>{brand.website}</Text>
                </Pressable>
              ) : null}
            </SectionCard>
          </MotionInView>
        )}

        <View style={{ height: spacing.lg }} />
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
  },
  heroContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  terpeneChip: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    alignSelf: 'flex-start',
  },
  terpeneChipText: {
    ...textStyles.caption,
    color: colors.background,
    fontWeight: '600',
  },
  saveButton: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  saveButtonSaved: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  saveButtonText: {
    fontSize: 24,
    color: colors.text,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xl,
  },
  statValue: {
    ...textStyles.title,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  statLabel: {
    ...textStyles.caption,
    color: colors.textMuted,
  },
  flex1: {
    flex: 1,
    marginLeft: spacing.lg,
  },
  tagSection: {
    marginBottom: spacing.md,
  },
  tagLabel: {
    ...textStyles.caption,
    color: colors.textMuted,
    marginBottom: spacing.sm,
    fontWeight: '600',
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tag: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tagText: {
    ...textStyles.caption,
    color: colors.text,
  },
  emptyStateText: {
    ...textStyles.body,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  descriptionText: {
    ...textStyles.body,
    color: colors.text,
    marginBottom: spacing.md,
  },
  websiteLink: {
    paddingVertical: spacing.sm,
  },
  websiteLinkText: {
    ...textStyles.body,
    color: colors.primary,
    textDecorationLine: 'underline',
  },
  backButton: {
    marginTop: spacing.md,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
  },
  backButtonText: {
    ...textStyles.body,
    color: colors.background,
    fontWeight: '600',
  },
});

export const BrandDetailScreen = withScreenErrorBoundary(BrandDetailScreenInner, 'brand-detail');
export default BrandDetailScreen;

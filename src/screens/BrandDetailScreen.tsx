import React, { useEffect } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MotionInView } from '../components/MotionInView';
import { ScreenShell } from '../components/ScreenShell';
import { SectionCard } from '../components/SectionCard';
import { withScreenErrorBoundary } from '../components/withScreenErrorBoundary';
import { trackAnalyticsEvent } from '../services/analyticsService';
import {
  addFavoriteBrand,
  fetchBrandProfile,
  isFavoriteBrand,
  removeFavoriteBrand,
} from '../services/brandService';
import { colors, radii, spacing, textStyles } from '../theme/tokens';
import type { RootStackParamList } from '../navigation/rootNavigatorConfig';
import type { BrandProfile } from '../types/brandTypes';

type BrandDetailScreenProps = NativeStackScreenProps<RootStackParamList, 'BrandDetail'>;

function BrandDetailScreenInner({ route }: BrandDetailScreenProps) {
  const { brandId } = route.params;
  const [brand, setBrand] = React.useState<BrandProfile | null>(null);
  const [isSaved, setIsSaved] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [profile, saved] = await Promise.all([
          fetchBrandProfile(brandId),
          isFavoriteBrand(brandId),
        ]);
        setBrand(profile);
        setIsSaved(saved);
        if (profile) {
          trackAnalyticsEvent('brand_detail_opened', { brandId });
        }
      } catch (error) {
        console.warn('Failed to load brand detail', error);
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [brandId]);

  const handleToggleSave = async () => {
    try {
      if (isSaved) {
        await removeFavoriteBrand(brandId);
        setIsSaved(false);
        trackAnalyticsEvent('brand_detail_unsaved', { brandId });
      } else {
        await addFavoriteBrand(brandId);
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

  if (loading || !brand) {
    return (
      <ScreenShell eyebrow="Brand" title="Loading..." subtitle="">
        <View style={{ padding: spacing.lg }} />
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
});

export const BrandDetailScreen = withScreenErrorBoundary(BrandDetailScreenInner, 'brand-detail');
export default BrandDetailScreen;

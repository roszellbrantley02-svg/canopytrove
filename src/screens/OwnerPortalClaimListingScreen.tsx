import React from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MotionInView } from '../components/MotionInView';
import { ScreenShell } from '../components/ScreenShell';
import { SectionCard } from '../components/SectionCard';
import { AppUiIcon } from '../icons/AppUiIcon';
import {
  useStorefrontProfileController,
  useStorefrontQueryController,
} from '../context/StorefrontController';
import { ownerPortalPreviewEnabled } from '../config/ownerPortalConfig';
import { useBrowseSummaries } from '../hooks/useStorefrontSummaryData';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { submitOwnerDispensaryClaim } from '../services/ownerPortalService';
import { OwnerPortalHeroPanel } from './ownerPortal/OwnerPortalHeroPanel';
import { ownerPortalStyles as styles } from './ownerPortal/ownerPortalStyles';
import { ownerPortalPreviewSearchResults } from './ownerPortal/ownerPortalPreviewData';

type ClaimListingRoute = RouteProp<RootStackParamList, 'OwnerPortalClaimListing'>;

const ONBOARDING_STEPS = ['Account', 'Business Details', 'Claim Listing', 'Verification'];

export function OwnerPortalClaimListingScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<ClaimListingRoute>();
  const preview = ownerPortalPreviewEnabled && Boolean(route.params?.preview);
  const { authSession } = useStorefrontProfileController();
  const { activeLocation, activeLocationLabel } = useStorefrontQueryController();
  const [draftQuery, setDraftQuery] = React.useState('');
  const [submittedQuery, setSubmittedQuery] = React.useState('');
  const [isSubmittingClaimId, setIsSubmittingClaimId] = React.useState<string | null>(null);
  const [statusText, setStatusText] = React.useState<string | null>(null);
  const { data, isLoading } = useBrowseSummaries(
    {
      areaId: '',
      searchQuery: submittedQuery,
      origin: activeLocation,
      locationLabel: activeLocationLabel,
    },
    'distance',
    8,
    0,
  );

  const results = preview
    ? ownerPortalPreviewSearchResults.filter((storefront) => {
        const query = submittedQuery.trim().toLowerCase();
        if (!query) {
          return true;
        }

        return [storefront.displayName, storefront.addressLine1, storefront.city, storefront.zip]
          .join(' ')
          .toLowerCase()
          .includes(query);
      })
    : submittedQuery.trim()
      ? data.items
      : [];

  const handleSubmitSearch = () => {
    setStatusText(null);
    setSubmittedQuery(draftQuery.trim());
  };

  const handleClaim = async (storefrontId: string, displayName: string) => {
    if (preview) {
      navigation.replace('OwnerPortalBusinessVerification', { preview: true });
      return;
    }

    if (!authSession.uid || isSubmittingClaimId) {
      return;
    }

    setIsSubmittingClaimId(storefrontId);
    setStatusText(null);
    try {
      await submitOwnerDispensaryClaim(authSession.uid, {
        id: storefrontId,
        displayName,
      });
      setStatusText(
        'Claim submitted. Your owner workspace is now linked to this listing for verification review.',
      );
      navigation.replace('OwnerPortalHome');
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : 'Unable to submit claim.');
    } finally {
      setIsSubmittingClaimId(null);
    }
  };

  return (
    <ScreenShell
      eyebrow="Owner Portal"
      title="Claim dispensary listing."
      subtitle={
        preview
          ? 'Preview mode shows safe claim search results.'
          : 'Search the Canopy Trove directory and claim the storefront your team manages.'
      }
      headerPill={preview ? 'Preview' : 'Onboarding'}
    >
      <MotionInView delay={70}>
        <OwnerPortalHeroPanel
          kicker="Owner onboarding"
          title="Match the owner account to the right storefront."
          body="Search connects owner workspace to the real listing record."
          metrics={[
            {
              value: submittedQuery.trim() ? results.length : 0,
              label: 'Matches',
              body: '',
            },
            {
              value: activeLocationLabel,
              label: 'Search area',
              body: '',
            },
          ]}
          steps={ONBOARDING_STEPS}
          activeStepIndex={2}
        />
      </MotionInView>

      <MotionInView delay={120}>
        <SectionCard title="Search listings" body="">
          <View style={styles.sectionStack}>
            <View style={styles.plannerPanel}>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Storefront search</Text>
                <TextInput
                  value={draftQuery}
                  onChangeText={setDraftQuery}
                  onSubmitEditing={handleSubmitSearch}
                  placeholder="Search storefront, address, city, or ZIP"
                  placeholderTextColor="#738680"
                  style={styles.inputPremium}
                />
              </View>
              <Pressable
                disabled={!draftQuery.trim()}
                onPress={handleSubmitSearch}
                style={[styles.primaryButton, !draftQuery.trim() && styles.buttonDisabled]}
              >
                <Text style={styles.primaryButtonText}>Search Listings</Text>
              </Pressable>
              {statusText ? (
                <Text
                  style={statusText.includes('submitted') ? styles.successText : styles.errorText}
                >
                  {statusText}
                </Text>
              ) : null}
            </View>
          </View>
        </SectionCard>
      </MotionInView>

      <MotionInView delay={180}>
        <SectionCard title="Search results" body="">
          {!submittedQuery.trim() ? (
            <View style={styles.emptyStateCard}>
              <Text style={styles.emptyStateTitle}>Search the directory first</Text>
              <Text style={styles.emptyStateBody}>
                Start with a storefront name, address, city, or ZIP. The matching claim cards will
                appear here once a search is submitted.
              </Text>
            </View>
          ) : isLoading ? (
            <View style={styles.emptyStateCard}>
              <Text style={styles.emptyStateTitle}>Searching storefront records</Text>
              <Text style={styles.emptyStateBody}>
                Looking through the directory for the nearest dispensary records that match your
                query.
              </Text>
            </View>
          ) : !results.length ? (
            <View style={styles.emptyStateCard}>
              <Text style={styles.emptyStateTitle}>No matching storefronts found</Text>
              <Text style={styles.emptyStateBody}>
                Try a broader storefront name, address fragment, city, or ZIP to continue the
                listing-claim step.
              </Text>
            </View>
          ) : (
            <View style={styles.actionGrid}>
              {results.map((storefront) => (
                <View key={storefront.id} style={styles.actionTile}>
                  <View style={styles.splitHeaderRow}>
                    <View style={styles.splitHeaderCopy}>
                      <Text style={styles.actionTileMeta}>Claim candidate</Text>
                      <Text style={styles.actionTileTitle}>{storefront.displayName}</Text>
                      <Text style={styles.actionTileBody}>{storefront.addressLine1}</Text>
                      <Text style={styles.actionTileBody}>
                        {storefront.city}, {storefront.state} {storefront.zip}
                      </Text>
                    </View>
                    <AppUiIcon name="storefront-outline" size={20} color="#F5C86A" />
                  </View>
                  <Pressable
                    disabled={!preview && isSubmittingClaimId === storefront.id}
                    onPress={() => {
                      if (isSubmittingClaimId) return;
                      void handleClaim(storefront.id, storefront.displayName);
                    }}
                    style={[
                      styles.secondaryButton,
                      !preview && isSubmittingClaimId === storefront.id && styles.buttonDisabled,
                    ]}
                  >
                    <Text style={styles.secondaryButtonText}>
                      {preview
                        ? 'Continue With This Listing'
                        : isSubmittingClaimId === storefront.id
                          ? 'Submitting...'
                          : 'Claim Listing'}
                    </Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </SectionCard>
      </MotionInView>
    </ScreenShell>
  );
}

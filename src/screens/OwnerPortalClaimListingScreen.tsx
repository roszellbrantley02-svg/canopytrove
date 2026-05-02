import { colors } from '../theme/tokens';
import React from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MotionInView } from '../components/MotionInView';
import { ScreenShell } from '../components/ScreenShell';
import { SectionCard } from '../components/SectionCard';
import { withScreenErrorBoundary } from '../components/withScreenErrorBoundary';
import { AppUiIcon } from '../icons/AppUiIcon';
import {
  useStorefrontProfileController,
  useStorefrontQueryController,
} from '../context/StorefrontController';

import { useBrowseSummaries } from '../hooks/useStorefrontSummaryData';
import { BULK_CLAIM_MAX_SLOTS, useBulkClaimSubmission } from '../hooks/useBulkClaimSubmission';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { submitOwnerDispensaryClaim } from '../services/ownerPortalService';
import { ownerPortalBulkClaimQueueEnabled } from '../config/ownerPortalConfig';
import { BulkClaimQueueChips } from './ownerPortal/BulkClaimQueueChips';
import { OwnerPortalHeroPanel } from './ownerPortal/OwnerPortalHeroPanel';
import { ownerPortalStyles as styles } from './ownerPortal/ownerPortalStyles';
import { ownerPortalPreviewSearchResults } from './ownerPortal/ownerPortalPreviewData';

type ClaimListingRoute = RouteProp<RootStackParamList, 'OwnerPortalClaimListing'>;

const ONBOARDING_STEPS = ['Account', 'Business Details', 'Claim Listing', 'Verification'];

function OwnerPortalClaimListingScreenInner() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<ClaimListingRoute>();
  const preview = route.params?.preview ?? false;
  const { authSession } = useStorefrontProfileController();
  const { activeLocation, activeLocationLabel } = useStorefrontQueryController();
  const [draftQuery, setDraftQuery] = React.useState('');
  const [submittedQuery, setSubmittedQuery] = React.useState('');
  const [isSubmittingClaimId, setIsSubmittingClaimId] = React.useState<string | null>(null);
  const [statusText, setStatusText] = React.useState<string | null>(null);
  const bulkQueue = useBulkClaimSubmission();
  const bulkModeAvailable = ownerPortalBulkClaimQueueEnabled && !preview;
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

  const handleSubmitBulk = async () => {
    if (!authSession.uid) return;
    setStatusText(null);
    await bulkQueue.submitAll(authSession.uid);
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
      // Offer the optional shop-ownership fast-path right after the
      // claim lands. Owners who can answer the published shop phone get
      // verified instantly. Skip routes them straight to OwnerPortalHome
      // and admin review handles the claim — see the screen's own skip
      // path for that.
      navigation.replace('OwnerPortalShopOwnershipVerification', {
        storefrontId,
        storefrontDisplayName: displayName,
      });
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
      subtitle="Search the Canopy Trove directory and pick the storefront your team manages."
      headerPill="Onboarding"
    >
      <MotionInView delay={70}>
        <OwnerPortalHeroPanel
          kicker="Owner onboarding"
          title="Match the owner account to the right storefront."
          body="Find the right storefront so we can connect it to your business account."
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
                  placeholderTextColor={colors.textSoft}
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
              {results.map((storefront) => {
                const isInQueue = bulkQueue.selectedIds.includes(storefront.id);
                const queueDisabled = bulkModeAvailable && !isInQueue && bulkQueue.isAtCapacity;
                return (
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
                      <AppUiIcon
                        name={
                          bulkModeAvailable && isInQueue ? 'checkmark-circle' : 'storefront-outline'
                        }
                        size={20}
                        color={bulkModeAvailable && isInQueue ? '#2ECC71' : '#F5C86A'}
                      />
                    </View>
                    {bulkModeAvailable ? (
                      <Pressable
                        disabled={queueDisabled}
                        onPress={() =>
                          bulkQueue.toggleSelection({
                            id: storefront.id,
                            displayName: storefront.displayName,
                          })
                        }
                        style={[styles.secondaryButton, queueDisabled && styles.buttonDisabled]}
                      >
                        <Text style={styles.secondaryButtonText}>
                          {isInQueue
                            ? 'Remove from queue'
                            : queueDisabled
                              ? `Queue full (${BULK_CLAIM_MAX_SLOTS} max)`
                              : 'Add to queue'}
                        </Text>
                      </Pressable>
                    ) : (
                      <Pressable
                        disabled={!preview && isSubmittingClaimId === storefront.id}
                        onPress={() => {
                          if (isSubmittingClaimId) return;
                          void handleClaim(storefront.id, storefront.displayName);
                        }}
                        style={[
                          styles.secondaryButton,
                          !preview &&
                            isSubmittingClaimId === storefront.id &&
                            styles.buttonDisabled,
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
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </SectionCard>
      </MotionInView>

      {bulkModeAvailable && bulkQueue.slots.length > 0 ? (
        <MotionInView delay={210}>
          <SectionCard
            title="Verification queue"
            body="Each shop's phone rings independently. Enter the codes as you hear them."
          >
            <View style={styles.sectionStack}>
              {bulkQueue.slots.some((slot) => slot.phase === 'idle') ? (
                <Pressable
                  disabled={bulkQueue.hasInFlightWork || !authSession.uid}
                  onPress={() => {
                    void handleSubmitBulk();
                  }}
                  style={[
                    styles.primaryButton,
                    (bulkQueue.hasInFlightWork || !authSession.uid) && styles.buttonDisabled,
                  ]}
                >
                  <Text style={styles.primaryButtonText}>
                    {`Submit ${bulkQueue.slots.filter((s) => s.phase === 'idle').length} ${
                      bulkQueue.slots.filter((s) => s.phase === 'idle').length === 1
                        ? 'claim'
                        : 'claims'
                    }`}
                  </Text>
                </Pressable>
              ) : null}
              <BulkClaimQueueChips
                slots={bulkQueue.slots}
                onSubmitCode={bulkQueue.submitCodeFor}
                onResetSlot={bulkQueue.resetSlot}
              />
              {bulkQueue.slots.every((slot) => slot.phase === 'verified') ? (
                <Pressable
                  onPress={() => navigation.replace('OwnerPortalHome')}
                  style={styles.primaryButton}
                >
                  <Text style={styles.primaryButtonText}>Continue to Owner Home</Text>
                </Pressable>
              ) : null}
            </View>
          </SectionCard>
        </MotionInView>
      ) : null}
    </ScreenShell>
  );
}

export const OwnerPortalClaimListingScreen = withScreenErrorBoundary(
  OwnerPortalClaimListingScreenInner,
  'owner-portal-claim-listing',
);

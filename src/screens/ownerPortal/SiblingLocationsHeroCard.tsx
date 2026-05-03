/**
 * Hero card shown after a successful shop-OTP verification when the
 * verified storefront's OCM legal entity has additional licensed
 * locations. Surfaces "Add N sibling locations?" CTA and wires through
 * to POST /owner-portal/claims/bulk on confirm.
 *
 * Self-hides when:
 *   - GET /claims/siblings/:id returns feature_disabled (flag off)
 *   - GET returns successfully with 0 siblings (single-location entity)
 *   - GET returns ocm_match_not_found / storefront_not_found
 *   - Owner has already submitted a bulk batch from this card (one-shot)
 *
 * After successful POST, the card collapses into a confirmation message
 * and the parent screen can route the owner back to the listing screen
 * to verify the new siblings via Phase 1's parallel OTP queue.
 */

import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { AppUiIcon } from '../../icons/AppUiIcon';
import { colors } from '../../theme/tokens';
import {
  ADDITIONAL_LOCATION_PRICE_LABEL,
  formatAdditionalLocationCost,
} from '../../config/ownerBilling';
import {
  fetchSiblingLocations,
  submitBulkClaim,
  type SiblingCandidate,
} from '../../services/ownerPortalBulkClaimService';
import { ownerPortalStyles as styles } from './ownerPortalStyles';

type Props = {
  /** The dispensary the owner just verified — used to discover siblings. */
  primaryDispensaryId: string;
  /** Called when owner has finished bulk submission — parent typically navigates onward. */
  onBulkSubmissionComplete?: (batchId: string, siblingDispensaryIds: string[]) => void;
};

type State =
  | { phase: 'loading' }
  | { phase: 'hidden' }
  | { phase: 'siblings_offered'; siblings: SiblingCandidate[]; entityName: string | null }
  | { phase: 'submitting'; siblings: SiblingCandidate[] }
  | { phase: 'submitted'; batchId: string; siblingCount: number }
  | { phase: 'error'; message: string };

export function SiblingLocationsHeroCard({ primaryDispensaryId, onBulkSubmissionComplete }: Props) {
  const [state, setState] = React.useState<State>({ phase: 'loading' });

  React.useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await fetchSiblingLocations(primaryDispensaryId);
        if (!active) return;

        if (!response.ok) {
          // feature_disabled, etc. — hide silently.
          setState({ phase: 'hidden' });
          return;
        }

        // Filter to only addable siblings: must be in our directory (have
        // dispensaryId) AND active. PR-A always returns dispensaryId=null
        // (resolution deferred); when the resolver lands those cards become
        // tappable. Until then the card hides itself.
        const addable = response.siblings.filter(
          (sibling) => sibling.active && sibling.dispensaryId !== null,
        );

        if (addable.length === 0) {
          setState({ phase: 'hidden' });
          return;
        }

        setState({
          phase: 'siblings_offered',
          siblings: addable,
          entityName: response.primaryLicenseeName,
        });
      } catch {
        // Network error — hide silently. Sibling discovery is opportunistic;
        // failing to load it should never disrupt the verification flow.
        if (active) setState({ phase: 'hidden' });
      }
    })();
    return () => {
      active = false;
    };
  }, [primaryDispensaryId]);

  const handleAddAll = async () => {
    if (state.phase !== 'siblings_offered') return;
    const siblings = state.siblings;
    setState({ phase: 'submitting', siblings });

    try {
      const result = await submitBulkClaim({
        primaryDispensaryId,
        siblingDispensaryIds: siblings
          .map((sibling) => sibling.dispensaryId)
          .filter((id): id is string => id !== null),
      });

      if (!result.ok) {
        setState({
          phase: 'error',
          message:
            result.message ?? 'Unable to add sibling locations right now. Try again in a moment.',
        });
        return;
      }

      setState({
        phase: 'submitted',
        batchId: result.batchId,
        siblingCount: result.siblingClaimIds.length,
      });
      onBulkSubmissionComplete?.(result.batchId, result.siblingClaimIds);
    } catch (error) {
      setState({
        phase: 'error',
        message: error instanceof Error ? error.message : 'Bulk submission failed.',
      });
    }
  };

  if (state.phase === 'hidden' || state.phase === 'loading') {
    return null;
  }

  if (state.phase === 'submitted') {
    return (
      <View style={styles.actionTile}>
        <View style={styles.splitHeaderRow}>
          <View style={styles.splitHeaderCopy}>
            <Text style={styles.actionTileMeta}>Locations added</Text>
            <Text style={styles.actionTileTitle}>
              Added {state.siblingCount}{' '}
              {state.siblingCount === 1 ? 'sibling location' : 'sibling locations'}.
            </Text>
            <Text style={styles.actionTileBody}>
              Your subscription was updated by {formatAdditionalLocationCost(state.siblingCount)}{' '}
              (pro-rated for the partial billing period).
            </Text>
            <Text style={styles.actionTileBody}>
              Verify each shop&apos;s phone next so the cluster can auto-approve.
            </Text>
          </View>
          <AppUiIcon name="checkmark-circle" size={20} color={colors.primary} />
        </View>
      </View>
    );
  }

  if (state.phase === 'error') {
    return (
      <View style={styles.actionTile}>
        <View style={styles.splitHeaderRow}>
          <View style={styles.splitHeaderCopy}>
            <Text style={styles.actionTileMeta}>Couldn&apos;t add siblings</Text>
            <Text style={styles.errorText} accessibilityLiveRegion="polite">
              {state.message}
            </Text>
          </View>
          <AppUiIcon name="alert-circle-outline" size={20} color={colors.danger} />
        </View>
      </View>
    );
  }

  const siblings = state.phase === 'submitting' ? state.siblings : state.siblings;
  const entityName = state.phase === 'siblings_offered' ? state.entityName : null;
  const isSubmitting = state.phase === 'submitting';

  return (
    <View style={styles.actionTile}>
      <View style={styles.splitHeaderRow}>
        <View style={styles.splitHeaderCopy}>
          <Text style={styles.actionTileMeta}>OCM cluster detected</Text>
          <Text style={styles.actionTileTitle}>
            {siblings.length === 1
              ? 'Add 1 sibling location?'
              : `Add ${siblings.length} sibling locations?`}
          </Text>
          {entityName ? (
            <Text style={styles.actionTileBody}>
              All licensed under {entityName} per OCM public records.
            </Text>
          ) : null}
        </View>
        <AppUiIcon name="storefront-outline" size={20} color={colors.gold} />
      </View>
      <View style={styles.fieldGroup}>
        {siblings.slice(0, 4).map((sibling) => (
          <Text key={sibling.licenseNumber} style={styles.actionTileBody}>
            • {sibling.dbaName ?? sibling.licenseeName}
            {sibling.city ? ` — ${sibling.city}` : ''}
          </Text>
        ))}
        {siblings.length > 4 ? (
          <Text style={styles.actionTileBody}>…and {siblings.length - 4} more</Text>
        ) : null}
      </View>

      {/* Pricing preview — shown before the Add button so the cost is never
          a surprise. Per-location seat is metered separately from the base
          subscription tier; pro-rated for the partial period at the moment
          of confirm. */}
      <View style={styles.statusPanel}>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Per location</Text>
          <Text style={styles.statusValue}>{ADDITIONAL_LOCATION_PRICE_LABEL}</Text>
        </View>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>
            {siblings.length === 1
              ? 'Adds to your subscription'
              : `Adds to your subscription (${siblings.length} × ${ADDITIONAL_LOCATION_PRICE_LABEL})`}
          </Text>
          <Text style={styles.statusValue}>{formatAdditionalLocationCost(siblings.length)}</Text>
        </View>
        <Text style={styles.fieldHint}>
          Charged on top of your current base plan. Pro-rated for the partial billing period.
        </Text>
      </View>

      <Pressable
        disabled={isSubmitting}
        onPress={() => {
          void handleAddAll();
        }}
        style={[styles.primaryButton, isSubmitting && styles.buttonDisabled]}
      >
        <Text style={styles.primaryButtonText}>
          {isSubmitting
            ? 'Adding...'
            : siblings.length === 1
              ? `Add this location · ${ADDITIONAL_LOCATION_PRICE_LABEL}`
              : `Add all ${siblings.length} locations · ${formatAdditionalLocationCost(siblings.length)}`}
        </Text>
      </Pressable>
    </View>
  );
}

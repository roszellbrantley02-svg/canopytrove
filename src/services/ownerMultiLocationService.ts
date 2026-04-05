import { requestJson } from './storefrontBackendHttp';
import type { OwnerLocationSummary } from '../types/ownerPortal';
import type { OwnerSubscriptionTier } from '../types/ownerTiers';

export type OwnerMultiLocationState = {
  ownerUid: string;
  tier: OwnerSubscriptionTier;
  primaryLocationId: string | null;
  additionalLocationIds: string[];
  allLocationIds: string[];
  locations: OwnerLocationSummary[];
  canAddLocations: boolean;
};

/**
 * Fetch all locations managed by this owner.
 */
export async function getOwnerLocations(): Promise<OwnerMultiLocationState> {
  return requestJson<OwnerMultiLocationState>('/owner-portal/locations');
}

/**
 * Add an additional storefront location. Requires Pro tier + approved claim.
 */
export async function addOwnerLocation(storefrontId: string): Promise<OwnerMultiLocationState> {
  return requestJson<OwnerMultiLocationState>('/owner-portal/locations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ storefrontId }),
  });
}

/**
 * Remove an additional location. Cannot remove primary.
 */
export async function removeOwnerLocation(storefrontId: string): Promise<OwnerMultiLocationState> {
  return requestJson<OwnerMultiLocationState>(`/owner-portal/locations/${storefrontId}`, {
    method: 'DELETE',
  });
}

import { Linking, Platform } from 'react-native';
import type { StorefrontSummary } from '../types/storefront';
import { startPostVisitJourney } from './postVisitPromptService';

type RouteMode = 'preview' | 'verified';

/**
 * Build a human-readable address string for maps apps to resolve.
 * Maps apps resolve addresses to the actual building entrance, which is
 * far more accurate than raw geocoded lat/lng coordinates (which often
 * land in the middle of a road or field).
 */
function buildAddressDestination(
  storefront: Pick<StorefrontSummary, 'displayName' | 'addressLine1' | 'city' | 'state' | 'zip'>
): string {
  const parts = [
    storefront.displayName,
    storefront.addressLine1,
    storefront.city,
    `${storefront.state} ${storefront.zip}`,
  ].filter(Boolean);
  return parts.join(', ');
}

async function tryOpenUrl(url: string) {
  if (!(await Linking.canOpenURL(url))) {
    return false;
  }

  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

export async function openStorefrontRoute(
  storefront: Pick<
    StorefrontSummary,
    'displayName' | 'addressLine1' | 'city' | 'state' | 'zip' | 'coordinates' | 'placeId'
  >,
  routeMode: RouteMode,
  trackingOptions?: {
    profileId: string;
    accountId?: string | null;
    isAuthenticated: boolean;
    sourceScreen?: string | null;
    storefront: StorefrontSummary;
  },
) {
  if (trackingOptions?.profileId) {
    try {
      await startPostVisitJourney({
        profileId: trackingOptions.profileId,
        accountId: trackingOptions.accountId,
        isAuthenticated: trackingOptions.isAuthenticated,
        routeMode,
        sourceScreen: trackingOptions.sourceScreen ?? null,
        storefront: trackingOptions.storefront,
      });
    } catch {
      // Route launch should continue even if visit tracking is unavailable.
    }
  }

  const addressDestination = buildAddressDestination(storefront);
  const encodedAddress = encodeURIComponent(addressDestination);
  const coordinateFallback = `${storefront.coordinates.latitude},${storefront.coordinates.longitude}`;
  const coordinateFallbackUrl = `https://www.google.com/maps/dir/?api=1&destination=${coordinateFallback}&travelmode=driving`;

  // Prefer address-based destination so the maps app resolves the actual
  // building location rather than relying on our geocoded coordinates.
  const nativeRouteUrl =
    Platform.OS === 'ios'
      ? `http://maps.apple.com/?daddr=${encodedAddress}&dirflg=d`
      : `geo:0,0?q=${encodedAddress}`;

  // For Google Maps web, use place_id when available for the most precise
  // result. Fall back to address string, then coordinates as last resort.
  let webRouteUrl: string;
  if (routeMode === 'verified' && storefront.placeId) {
    webRouteUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}&destination_place_id=${encodeURIComponent(storefront.placeId)}&travelmode=driving`;
  } else if (routeMode === 'verified') {
    webRouteUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}&travelmode=driving`;
  } else {
    webRouteUrl = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
  }

  const preferredUrl = routeMode === 'verified' ? nativeRouteUrl : webRouteUrl;

  if (await tryOpenUrl(preferredUrl)) {
    return;
  }

  // Address-based web route as second attempt.
  if (preferredUrl !== webRouteUrl && (await tryOpenUrl(webRouteUrl))) {
    return;
  }

  // Final fallback: use raw coordinates if address-based URLs fail.
  await Linking.openURL(coordinateFallbackUrl);
}
 
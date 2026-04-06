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
  storefront: Pick<StorefrontSummary, 'displayName' | 'addressLine1' | 'city' | 'state' | 'zip'>,
): string {
  const parts = [
    storefront.displayName,
    storefront.addressLine1,
    storefront.city,
    `${storefront.state} ${storefront.zip}`,
  ].filter(Boolean);
  return parts.join(', ');
}

/**
 * Open a URL on web. Uses `window.open` first, then falls back to
 * `window.location.href`. Mobile browsers (Safari, Chrome) block
 * `window.open` when called outside the synchronous user-gesture
 * context — which happens as soon as the call stack crosses an
 * `await` boundary. The `location.href` fallback always works
 * because it navigates the current tab instead of opening a popup.
 */
function openWebUrl(url: string): boolean {
  try {
    const popup = window.open(url, '_blank', 'noopener,noreferrer');
    if (popup) {
      return true;
    }
    // popup was blocked — navigate in the same tab instead.
    window.location.href = url;
    return true;
  } catch {
    try {
      window.location.href = url;
      return true;
    } catch {
      return false;
    }
  }
}

async function tryOpenUrl(url: string) {
  if (Platform.OS === 'web') {
    return openWebUrl(url);
  }

  // Skip `canOpenURL` — it adds latency (requires an async bridge call) and
  // can return false negatives on iOS when `LSApplicationQueriesSchemes`
  // doesn't list the scheme. Instead, attempt the open directly and catch
  // failures. This makes the "Directions" tap feel instant.
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
  // Fire post-visit tracking in the background — never block navigation.
  // The user expects maps to open instantly when they tap "Directions".
  if (trackingOptions?.profileId) {
    void startPostVisitJourney({
      profileId: trackingOptions.profileId,
      accountId: trackingOptions.accountId,
      isAuthenticated: trackingOptions.isAuthenticated,
      routeMode,
      sourceScreen: trackingOptions.sourceScreen ?? null,
      storefront: trackingOptions.storefront,
    }).catch(() => {
      // Visit tracking should never block or crash navigation.
    });
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

  // On web, detect iOS devices to prefer Apple Maps over Google Maps.
  if (Platform.OS === 'web') {
    const isIOSWeb =
      typeof navigator !== 'undefined' &&
      (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

    if (isIOSWeb) {
      // Apple Maps URLs open directly in the Maps app on iOS — no re-entry needed.
      const appleMapsUrl = `https://maps.apple.com/?daddr=${encodedAddress}&dirflg=d`;
      if (await tryOpenUrl(appleMapsUrl)) {
        return;
      }
    }

    // Non-iOS web or Apple Maps failed — use Google Maps.
    if (await tryOpenUrl(webRouteUrl)) {
      return;
    }
    await tryOpenUrl(coordinateFallbackUrl);
    return;
  }

  // Native: always try the platform-native maps app first (Apple Maps on iOS,
  // geo: intent on Android), regardless of route mode. This gives the user a
  // one-tap "Go" experience instead of bouncing through a browser.
  if (await tryOpenUrl(nativeRouteUrl)) {
    return;
  }

  // Address-based web route as second attempt.
  if (await tryOpenUrl(webRouteUrl)) {
    return;
  }

  // Final fallback: use raw coordinates if address-based URLs fail.
  await Linking.openURL(coordinateFallbackUrl);
}

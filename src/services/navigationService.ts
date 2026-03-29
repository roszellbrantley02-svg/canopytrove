import { Linking, Platform } from 'react-native';
import { StorefrontSummary } from '../types/storefront';
import { startPostVisitJourney } from './postVisitPromptService';

type RouteMode = 'preview' | 'verified';

export async function openStorefrontRoute(
  storefront: Pick<StorefrontSummary, 'displayName' | 'coordinates'>,
  routeMode: RouteMode,
  trackingOptions?: {
    profileId: string;
    accountId?: string | null;
    isAuthenticated: boolean;
    sourceScreen?: string | null;
    storefront: StorefrontSummary;
  }
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

  const destination = `${storefront.coordinates.latitude},${storefront.coordinates.longitude}`;
  const label = encodeURIComponent(storefront.displayName);
  const nativeRouteUrl =
    Platform.OS === 'ios'
      ? `http://maps.apple.com/?daddr=${destination}&dirflg=d`
      : `geo:0,0?q=${destination}(${label})`;
  const webRouteUrl =
    routeMode === 'verified'
      ? `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`
      : `https://www.google.com/maps/search/?api=1&query=${destination}`;
  const preferredUrl = routeMode === 'verified' ? nativeRouteUrl : webRouteUrl;

  if (await Linking.canOpenURL(preferredUrl)) {
    await Linking.openURL(preferredUrl);
    return;
  }

  await Linking.openURL(webRouteUrl);
}

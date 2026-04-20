import { Platform } from 'react-native';

/**
 * The Android build stays on a narrower storefront-directory + verification
 * surface while Google Play policy remains the main review risk.
 */
export const isAndroidPlayStoreBuild = Platform.OS === 'android';
export const supportsStorefrontPromotionUi = !isAndroidPlayStoreBuild;
export const supportsProductDiscoveryUi = !isAndroidPlayStoreBuild;
export const supportsOwnerWorkspaceUi = !isAndroidPlayStoreBuild;

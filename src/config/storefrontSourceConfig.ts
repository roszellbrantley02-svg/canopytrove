export type StorefrontSourceMode = 'mock' | 'firebase' | 'api';

function readSourceMode(): StorefrontSourceMode {
  const rawMode = process.env.EXPO_PUBLIC_STOREFRONT_SOURCE?.trim().toLowerCase();

  if (rawMode === 'api') {
    return 'api';
  }

  if (rawMode === 'firebase') {
    return 'firebase';
  }

  return 'mock';
}

export const storefrontSourceMode = readSourceMode();
export const storefrontApiBaseUrl = process.env.EXPO_PUBLIC_STOREFRONT_API_BASE_URL?.trim() || null;

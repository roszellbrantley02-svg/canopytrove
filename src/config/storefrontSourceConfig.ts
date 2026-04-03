import { publicClientConfig } from './publicClientConfig';

export type StorefrontSourceMode = 'mock' | 'firebase' | 'api';

function readSourceMode(): StorefrontSourceMode {
  const rawMode = publicClientConfig.storefrontSource.trim().toLowerCase();
  const apiBaseUrl = publicClientConfig.storefrontApiBaseUrl.trim();

  if (rawMode === 'api') {
    return 'api';
  }

  if (rawMode === 'firebase') {
    return 'firebase';
  }

  if (rawMode === 'mock') {
    return 'mock';
  }

  if (apiBaseUrl) {
    return 'api';
  }

  return 'mock';
}

export const storefrontSourceMode = readSourceMode();
export const storefrontApiBaseUrl = publicClientConfig.storefrontApiBaseUrl.trim() || null;

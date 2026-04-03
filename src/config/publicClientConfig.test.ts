import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('publicClientConfig', () => {
  it('falls back to the shipped public storefront and Firebase config when EAS env is missing', async () => {
    vi.stubEnv('EXPO_PUBLIC_STOREFRONT_SOURCE', '');
    vi.stubEnv('EXPO_PUBLIC_STOREFRONT_API_BASE_URL', '');
    vi.stubEnv('EXPO_PUBLIC_FIREBASE_API_KEY', '');
    vi.stubEnv('EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN', '');
    vi.stubEnv('EXPO_PUBLIC_FIREBASE_PROJECT_ID', '');
    vi.stubEnv('EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET', '');
    vi.stubEnv('EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID', '');
    vi.stubEnv('EXPO_PUBLIC_FIREBASE_APP_ID', '');

    const { publicClientConfig } = await import('./publicClientConfig');

    expect(publicClientConfig.storefrontSource).toBe('api');
    expect(publicClientConfig.storefrontApiBaseUrl).toBe('https://api.canopytrove.com');
    expect(publicClientConfig.firebase.projectId).toBe('canopy-trove');
    expect(publicClientConfig.firebase.storageBucket).toBe('canopy-trove.firebasestorage.app');
  });

  it('prefers explicit EXPO_PUBLIC overrides when they are present', async () => {
    vi.stubEnv('EXPO_PUBLIC_STOREFRONT_SOURCE', 'mock');
    vi.stubEnv('EXPO_PUBLIC_STOREFRONT_API_BASE_URL', 'https://example.com/api');
    vi.stubEnv('EXPO_PUBLIC_FIREBASE_PROJECT_ID', 'demo-project');

    const { publicClientConfig } = await import('./publicClientConfig');

    expect(publicClientConfig.storefrontSource).toBe('mock');
    expect(publicClientConfig.storefrontApiBaseUrl).toBe('https://example.com/api');
    expect(publicClientConfig.firebase.projectId).toBe('demo-project');
  });
});

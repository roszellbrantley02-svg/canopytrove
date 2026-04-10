import { describe, expect, it } from 'vitest';
import { getPlatformSafeStorefrontOutboundLinks } from './storefrontDetailHelpers';

describe('getPlatformSafeStorefrontOutboundLinks', () => {
  it('keeps website and menu links on non-android platforms', () => {
    expect(
      getPlatformSafeStorefrontOutboundLinks({
        platform: 'ios',
        website: 'https://store.example.com',
        menuUrl: 'https://store.example.com/menu',
      }),
    ).toEqual({
      websiteUrl: 'https://store.example.com',
      menuUrl: 'https://store.example.com/menu',
    });
  });

  it('removes menu links on android even when provided', () => {
    expect(
      getPlatformSafeStorefrontOutboundLinks({
        platform: 'android',
        website: 'https://store.example.com',
        menuUrl: 'https://store.example.com/menu',
      }),
    ).toEqual({
      websiteUrl: 'https://store.example.com',
      menuUrl: null,
    });
  });

  it('keeps informational storefront homepages on android', () => {
    expect(
      getPlatformSafeStorefrontOutboundLinks({
        platform: 'android',
        website: 'https://store.example.com/about',
        menuUrl: null,
      }),
    ).toEqual({
      websiteUrl: 'https://store.example.com/about',
      menuUrl: null,
    });
  });

  it('blocks menu-style website paths on android', () => {
    expect(
      getPlatformSafeStorefrontOutboundLinks({
        platform: 'android',
        website: 'https://store.example.com/menu',
        menuUrl: null,
      }),
    ).toEqual({
      websiteUrl: null,
      menuUrl: null,
    });
  });

  it('blocks known third-party cannabis shopping domains on android', () => {
    expect(
      getPlatformSafeStorefrontOutboundLinks({
        platform: 'android',
        website: 'https://dutchie.com/stores/example-dispensary',
        menuUrl: null,
      }),
    ).toEqual({
      websiteUrl: null,
      menuUrl: null,
    });
  });
});

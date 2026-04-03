import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import type { OwnerStorefrontProfileToolsDocument } from '../../../src/types/ownerPortal';
import {
  clearStorefrontMediaAccessStateForTests,
  hydrateOwnerStorefrontProfileToolsMedia,
} from './storefrontMediaAccessService';

function createProfileTools(
  overrides: Partial<OwnerStorefrontProfileToolsDocument> = {}
): OwnerStorefrontProfileToolsDocument {
  return {
    storefrontId: 'storefront-1',
    ownerUid: 'owner-1',
    menuUrl: 'https://owner.example/menu',
    featuredPhotoUrls: ['https://owner.example/existing-featured.jpg'],
    cardPhotoUrl: 'https://owner.example/existing-card.jpg',
    featuredPhotoPaths: [
      'dispensary-media/storefront-1/featured-one.jpg',
      'dispensary-media/storefront-1/featured-two.jpg',
    ],
    cardPhotoPath: 'dispensary-media/storefront-1/card.jpg',
    verifiedBadgeLabel: 'Verified owner',
    featuredBadges: ['Women-owned'],
    cardSummary: 'Fresh owner summary.',
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

afterEach(() => {
  clearStorefrontMediaAccessStateForTests();
});

test('falls back to the existing card photo url when signed card resolution fails', async () => {
  const warnings: string[] = [];
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    warnings.push(args.map((value) => String(value)).join(' '));
  };

  try {
    const profileTools = createProfileTools();
    const hydrated = await hydrateOwnerStorefrontProfileToolsMedia(profileTools, {
      resolveReadUrl: async ({ storagePath, fallbackUrl }) => {
        if (storagePath === profileTools.cardPhotoPath) {
          throw new Error('card signing failed');
        }

        return fallbackUrl ?? `https://signed.example/${encodeURIComponent(storagePath ?? 'unknown')}`;
      },
    });

    assert.ok(hydrated);
    assert.equal(hydrated?.cardPhotoUrl, profileTools.cardPhotoUrl);
    assert.deepEqual(hydrated?.featuredPhotoUrls, [
      profileTools.cardPhotoUrl,
      `https://signed.example/${encodeURIComponent(profileTools.featuredPhotoPaths?.[0] ?? '')}`,
      `https://signed.example/${encodeURIComponent(profileTools.featuredPhotoPaths?.[1] ?? '')}`,
      profileTools.featuredPhotoUrls[0],
    ]);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0] ?? '', /card photo/i);
  } finally {
    console.warn = originalWarn;
  }
});

test('keeps successful featured photo urls when one featured path fails', async () => {
  const warnings: string[] = [];
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    warnings.push(args.map((value) => String(value)).join(' '));
  };

  try {
    const profileTools = createProfileTools();
    const hydrated = await hydrateOwnerStorefrontProfileToolsMedia(profileTools, {
      resolveReadUrl: async ({ storagePath, fallbackUrl }) => {
        if (storagePath === profileTools.featuredPhotoPaths?.[1]) {
          throw new Error('featured signing failed');
        }

        if (storagePath) {
          return `https://signed.example/${encodeURIComponent(storagePath)}`;
        }

        return fallbackUrl ?? null;
      },
    });

    assert.ok(hydrated);
    assert.equal(
      hydrated?.cardPhotoUrl,
      `https://signed.example/${encodeURIComponent(profileTools.cardPhotoPath ?? '')}`
    );
    assert.deepEqual(hydrated?.featuredPhotoUrls, [
      `https://signed.example/${encodeURIComponent(profileTools.cardPhotoPath ?? '')}`,
      `https://signed.example/${encodeURIComponent(profileTools.featuredPhotoPaths?.[0] ?? '')}`,
      profileTools.featuredPhotoUrls[0],
    ]);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0] ?? '', /featured photo/i);
  } finally {
    console.warn = originalWarn;
  }
});

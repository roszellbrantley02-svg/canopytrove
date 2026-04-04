import { OwnerStorefrontProfileToolsDocument } from '../../../src/types/ownerPortal';
import { getBackendFirebaseStorage } from '../firebase';

const STOREFRONT_MEDIA_READ_URL_TTL_MS = 24 * 60 * 60 * 1000;
const STOREFRONT_MEDIA_CACHE_TTL_MS = 15 * 60 * 1000;

const signedStorefrontMediaUrlCache = new Map<
  string,
  {
    expiresAt: number;
    url: string;
  }
>();

type StorefrontMediaAccessDeps = {
  resolveReadUrl: typeof resolveStorefrontMediaReadUrl;
};

function normalizeOptionalHttpUrl(value: string | null | undefined) {
  if (typeof value !== 'string') {
    return null;
  }

  const normalizedValue = value.trim();
  if (!normalizedValue) {
    return null;
  }

  try {
    const url = new URL(normalizedValue);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }

    return normalizedValue;
  } catch {
    return null;
  }
}

function normalizeStoragePath(value: string | null | undefined) {
  if (typeof value !== 'string') {
    return null;
  }

  const normalizedValue = value.trim();
  if (
    !normalizedValue ||
    normalizedValue.includes('..') ||
    normalizedValue.includes('?') ||
    normalizedValue.startsWith('/') ||
    !normalizedValue.startsWith('dispensary-media/')
  ) {
    return null;
  }

  return normalizedValue;
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values.filter(
        (value): value is string => typeof value === 'string' && value.trim().length > 0,
      ),
    ),
  );
}

function buildMockStorefrontMediaUrl(storagePath: string) {
  const encodedPath = storagePath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return `https://media.canopytrove.local/${encodedPath}`;
}

async function createSignedStorefrontMediaReadUrl(storagePath: string) {
  const normalizedPath = normalizeStoragePath(storagePath);
  if (!normalizedPath) {
    return null;
  }

  const cached = signedStorefrontMediaUrlCache.get(normalizedPath);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.url;
  }

  const bucket = getBackendFirebaseStorage()?.bucket() ?? null;
  if (!bucket) {
    const fallbackUrl = buildMockStorefrontMediaUrl(normalizedPath);
    signedStorefrontMediaUrlCache.set(normalizedPath, {
      url: fallbackUrl,
      expiresAt: Date.now() + STOREFRONT_MEDIA_CACHE_TTL_MS,
    });
    return fallbackUrl;
  }

  const [signedUrl] = await bucket.file(normalizedPath).getSignedUrl({
    action: 'read',
    version: 'v4',
    expires: Date.now() + STOREFRONT_MEDIA_READ_URL_TTL_MS,
  });

  signedStorefrontMediaUrlCache.set(normalizedPath, {
    url: signedUrl,
    expiresAt: Date.now() + STOREFRONT_MEDIA_CACHE_TTL_MS,
  });

  return signedUrl;
}

export async function resolveStorefrontMediaReadUrl(input: {
  storagePath?: string | null;
  fallbackUrl?: string | null;
}) {
  const signedUrl = input.storagePath
    ? await createSignedStorefrontMediaReadUrl(input.storagePath)
    : null;

  return signedUrl ?? normalizeOptionalHttpUrl(input.fallbackUrl) ?? null;
}

export async function hydrateOwnerStorefrontProfileToolsMedia(
  profileTools: OwnerStorefrontProfileToolsDocument | null,
  deps: StorefrontMediaAccessDeps = {
    resolveReadUrl: resolveStorefrontMediaReadUrl,
  },
) {
  if (!profileTools) {
    return null;
  }

  const cardPhotoResult = await Promise.allSettled([
    deps.resolveReadUrl({
      storagePath: profileTools.cardPhotoPath ?? null,
      fallbackUrl: profileTools.cardPhotoUrl,
    }),
  ]);
  const cardPhotoUrl =
    cardPhotoResult[0]?.status === 'fulfilled'
      ? cardPhotoResult[0].value
      : normalizeOptionalHttpUrl(profileTools.cardPhotoUrl);
  if (cardPhotoResult[0]?.status === 'rejected') {
    console.warn(
      `[storefrontMediaAccess] failed to resolve card photo URL for path ${profileTools.cardPhotoPath ?? 'unknown'}:`,
      cardPhotoResult[0].reason,
    );
  }

  const featuredPhotoResults = await Promise.allSettled(
    (profileTools.featuredPhotoPaths ?? []).map((storagePath) =>
      deps.resolveReadUrl({
        storagePath,
        fallbackUrl: null,
      }),
    ),
  );
  const resolvedFeaturedPhotos = featuredPhotoResults.flatMap((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value ? [result.value] : [];
    }
    console.warn(
      `[storefrontMediaAccess] failed to resolve featured photo URL for path ${(profileTools.featuredPhotoPaths ?? [])[index] ?? 'unknown'}:`,
      result.reason,
    );
    return [];
  });
  const featuredPhotoUrls = uniqueStrings([
    cardPhotoUrl,
    ...resolvedFeaturedPhotos,
    ...(profileTools.featuredPhotoUrls ?? []).map((url) => normalizeOptionalHttpUrl(url)),
  ]).slice(0, 8);

  return {
    ...profileTools,
    cardPhotoUrl,
    featuredPhotoUrls,
  } satisfies OwnerStorefrontProfileToolsDocument;
}

export function clearStorefrontMediaAccessStateForTests() {
  signedStorefrontMediaUrlCache.clear();
}

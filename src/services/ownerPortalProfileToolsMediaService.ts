import type { OwnerPortalProfileToolsInput } from '../types/ownerPortal';

export type UploadedStorefrontMediaType = 'storefront-card' | 'storefront-gallery';

function uniqueValues(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.map((value) => (typeof value === 'string' ? value.trim() : '')).filter(Boolean)),
  );
}

export function mergeUploadedStorefrontMediaIntoProfileTools(
  input: OwnerPortalProfileToolsInput,
  options: {
    mediaType: UploadedStorefrontMediaType;
    filePath: string | null;
    downloadUrl: string | null;
  },
): OwnerPortalProfileToolsInput {
  const filePath = options.filePath?.trim() || null;
  const downloadUrl = options.downloadUrl?.trim() || null;
  if (!filePath && !downloadUrl) {
    return {
      ...input,
      featuredPhotoUrls: [...(input.featuredPhotoUrls ?? [])],
      featuredPhotoPaths: [...(input.featuredPhotoPaths ?? [])],
    };
  }

  const nextFeaturedPhotoUrls =
    options.mediaType === 'storefront-card'
      ? uniqueValues([downloadUrl, input.cardPhotoUrl, ...(input.featuredPhotoUrls ?? [])]).slice(
          0,
          8,
        )
      : uniqueValues([...(input.featuredPhotoUrls ?? []), downloadUrl]).slice(0, 8);
  const nextFeaturedPhotoPaths =
    options.mediaType === 'storefront-card'
      ? uniqueValues([filePath, input.cardPhotoPath, ...(input.featuredPhotoPaths ?? [])]).slice(
          0,
          8,
        )
      : uniqueValues([...(input.featuredPhotoPaths ?? []), filePath]).slice(0, 8);

  return {
    ...input,
    cardPhotoUrl:
      options.mediaType === 'storefront-card'
        ? (downloadUrl ?? input.cardPhotoUrl ?? null)
        : (input.cardPhotoUrl ?? null),
    featuredPhotoUrls: nextFeaturedPhotoUrls,
    cardPhotoPath:
      options.mediaType === 'storefront-card'
        ? (filePath ?? input.cardPhotoPath ?? null)
        : (input.cardPhotoPath ?? null),
    featuredPhotoPaths: nextFeaturedPhotoPaths,
  };
}

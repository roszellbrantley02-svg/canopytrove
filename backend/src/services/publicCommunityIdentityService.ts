import { createHash } from 'node:crypto';

const PUBLIC_AUTHOR_ID_NAMESPACE = 'canopytrove:public-review-author:';

export function createPublicCommunityAuthorId(
  profileId: string | null | undefined,
  storefrontId: string | null | undefined,
) {
  const normalizedProfileId = typeof profileId === 'string' ? profileId.trim() : '';
  const normalizedStorefrontId = typeof storefrontId === 'string' ? storefrontId.trim() : '';
  if (!normalizedProfileId || !normalizedStorefrontId) {
    return null;
  }

  const digest = createHash('sha256')
    .update(`${PUBLIC_AUTHOR_ID_NAMESPACE}${normalizedStorefrontId}:${normalizedProfileId}`, 'utf8')
    .digest('hex');

  return `author_${digest.slice(0, 24)}`;
}

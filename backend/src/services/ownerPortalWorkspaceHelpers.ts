import { randomUUID } from 'node:crypto';
import {
  OwnerPromotionPlacementScope,
  OwnerPortalProfileToolsInput,
  OwnerPortalPromotionInput,
  OwnerStorefrontProfileToolsDocument,
  OwnerStorefrontPromotionDocument,
} from '../../../src/types/ownerPortal';
import { normalizeOwnerPromotionPlacementSurfaces } from '../../../src/utils/ownerPromotionPlacement';
import { normalizeOwnerHours } from './ownerHoursService';

export function getNowIso() {
  return new Date().toISOString();
}

export function createId(prefix: string) {
  return `${prefix}-${randomUUID()}`;
}

export function parseIsoDate(value: string) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function isPromotionActive(
  promotion: OwnerStorefrontPromotionDocument,
  nowIso = getNowIso(),
) {
  return (
    parseIsoDate(promotion.startsAt) <= parseIsoDate(nowIso) &&
    parseIsoDate(promotion.endsAt) > parseIsoDate(nowIso)
  );
}

export function derivePromotionStatus(
  promotion: OwnerStorefrontPromotionDocument,
  nowIso = getNowIso(),
): OwnerStorefrontPromotionDocument['status'] {
  if (parseIsoDate(promotion.endsAt) <= parseIsoDate(nowIso)) {
    return 'expired';
  }

  if (isPromotionActive(promotion, nowIso)) {
    return 'active';
  }

  if (parseIsoDate(promotion.startsAt) > parseIsoDate(nowIso)) {
    return 'scheduled';
  }

  return promotion.status ?? 'draft';
}

export function normalizeBadges(badges: string[] | undefined, maxItems = 5) {
  return Array.from(new Set((badges ?? []).map((badge) => badge.trim()).filter(Boolean))).slice(
    0,
    maxItems,
  );
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function isStorefrontMediaPath(value: string) {
  return (
    value.startsWith('dispensary-media/') &&
    !value.includes('..') &&
    !value.includes('?') &&
    !value.startsWith('/')
  );
}

export function normalizeOptionalHttpUrl(value: string | null | undefined) {
  const normalizedValue = value?.trim();
  if (!normalizedValue || !isHttpUrl(normalizedValue)) {
    return null;
  }

  return normalizedValue;
}

export function assertOptionalHttpUrl(value: string | null | undefined, field: string) {
  const normalizedValue = value?.trim();
  if (!normalizedValue) {
    return null;
  }

  if (!isHttpUrl(normalizedValue)) {
    throw new Error(`${field} must be a valid http or https URL.`);
  }

  return normalizedValue;
}

export function normalizeOptionalStorefrontMediaPath(value: string | null | undefined) {
  const normalizedValue = value?.trim();
  if (!normalizedValue || !isStorefrontMediaPath(normalizedValue)) {
    return null;
  }

  return normalizedValue;
}

export function normalizeStorefrontMediaPathList(values: string[] | undefined | null) {
  return Array.from(
    new Set(
      (values ?? [])
        .map((value) => value.trim())
        .filter((value) => value && isStorefrontMediaPath(value)),
    ),
  ).slice(0, 8);
}

export function normalizeHttpUrlList(values: string[] | undefined | null) {
  return Array.from(
    new Set(
      (values ?? []).map((value) => value.trim()).filter((value) => value && isHttpUrl(value)),
    ),
  ).slice(0, 8);
}

export function collectProfileAttachmentUrls(
  profileTools: OwnerStorefrontProfileToolsDocument | null,
) {
  if (!profileTools) {
    return [];
  }

  return Array.from(
    new Set([
      ...normalizeHttpUrlList(profileTools.cardPhotoUrl ? [profileTools.cardPhotoUrl] : []),
      ...normalizeHttpUrlList(profileTools.featuredPhotoUrls),
    ]),
  );
}

export function sanitizeProfileToolsRecord(record: OwnerStorefrontProfileToolsDocument) {
  const cardPhotoPath = normalizeOptionalStorefrontMediaPath(record.cardPhotoPath);
  return {
    ...record,
    menuUrl: normalizeOptionalHttpUrl(record.menuUrl),
    featuredPhotoUrls: normalizeHttpUrlList(record.featuredPhotoUrls),
    cardPhotoUrl: normalizeOptionalHttpUrl(record.cardPhotoUrl),
    featuredPhotoPaths: normalizeStorefrontMediaPathList([
      ...(cardPhotoPath ? [cardPhotoPath] : []),
      ...(record.featuredPhotoPaths ?? []),
    ]),
    cardPhotoPath,
    verifiedBadgeLabel:
      typeof record.verifiedBadgeLabel === 'string' && record.verifiedBadgeLabel.trim()
        ? record.verifiedBadgeLabel.trim()
        : null,
    featuredBadges: normalizeBadges(record.featuredBadges),
    cardSummary:
      typeof record.cardSummary === 'string' && record.cardSummary.trim()
        ? record.cardSummary.trim()
        : null,
    updatedAt:
      typeof record.updatedAt === 'string' && record.updatedAt.trim()
        ? record.updatedAt.trim()
        : getNowIso(),
  };
}

export function normalizeProfileTools(
  storefrontId: string,
  ownerUid: string,
  input: OwnerPortalProfileToolsInput & Partial<OwnerStorefrontProfileToolsDocument>,
): OwnerStorefrontProfileToolsDocument {
  const cardPhotoPath = normalizeOptionalStorefrontMediaPath(input.cardPhotoPath);
  return {
    storefrontId,
    ownerUid,
    menuUrl: assertOptionalHttpUrl(input.menuUrl, 'menuUrl'),
    featuredPhotoUrls: normalizeHttpUrlList(input.featuredPhotoUrls),
    cardPhotoUrl: assertOptionalHttpUrl(input.cardPhotoUrl, 'cardPhotoUrl'),
    featuredPhotoPaths: normalizeStorefrontMediaPathList([
      ...(cardPhotoPath ? [cardPhotoPath] : []),
      ...(input.featuredPhotoPaths ?? []),
    ]),
    cardPhotoPath,
    verifiedBadgeLabel:
      typeof input.verifiedBadgeLabel === 'string' && input.verifiedBadgeLabel.trim()
        ? input.verifiedBadgeLabel.trim()
        : null,
    featuredBadges: normalizeBadges(input.featuredBadges),
    cardSummary:
      typeof input.cardSummary === 'string' && input.cardSummary.trim()
        ? input.cardSummary.trim()
        : null,
    ownerHours: normalizeOwnerHours(input.ownerHours),
    updatedAt:
      typeof input.updatedAt === 'string' && input.updatedAt.trim() ? input.updatedAt : getNowIso(),
  };
}

function normalizePlacementScope(
  value: OwnerPromotionPlacementScope | null | undefined,
): OwnerPromotionPlacementScope {
  return value === 'statewide' ? 'statewide' : 'storefront_area';
}

export function normalizePromotion(
  ownerUid: string,
  storefrontId: string,
  input: OwnerPortalPromotionInput & Partial<OwnerStorefrontPromotionDocument>,
): OwnerStorefrontPromotionDocument {
  const now = getNowIso();
  const normalized: OwnerStorefrontPromotionDocument = {
    id: input.id?.trim() || createId('promotion'),
    storefrontId,
    ownerUid,
    title: input.title.trim(),
    description: input.description.trim(),
    badges: normalizeBadges(input.badges),
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    status: input.status ?? 'draft',
    audiences: Array.isArray(input.audiences)
      ? input.audiences
      : [(input as any).audience].filter(Boolean),
    alertFollowersOnStart: input.alertFollowersOnStart === true,
    cardTone: input.cardTone ?? 'owner_featured',
    placementSurfaces: normalizeOwnerPromotionPlacementSurfaces(input.placementSurfaces),
    placementScope: normalizePlacementScope(input.placementScope),
    followersAlertedAt:
      typeof input.followersAlertedAt === 'string' && input.followersAlertedAt.trim()
        ? input.followersAlertedAt.trim()
        : null,
    createdAt: input.createdAt ?? now,
    updatedAt: now,
  };

  return {
    ...normalized,
    status: derivePromotionStatus(normalized, now),
  };
}

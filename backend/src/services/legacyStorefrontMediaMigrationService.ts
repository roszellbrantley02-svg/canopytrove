import { randomUUID } from 'node:crypto';
import type { Storage } from 'firebase-admin/storage';
import type { OwnerStorefrontProfileToolsDocument } from '../../../src/types/ownerPortal';
import { getBackendFirebaseDb, getBackendFirebaseStorage, hasBackendFirebaseConfig } from '../firebase';

const PROFILE_TOOLS_COLLECTION = 'owner_storefront_profile_tools';

type ParsedLegacyUrl = {
  bucket: string;
  path: string;
};

type MigrationPlan = {
  storefrontId: string;
  ownerUid: string;
  stageRecord: OwnerStorefrontProfileToolsDocument;
  cleanRecord: OwnerStorefrontProfileToolsDocument;
  migratedRefs: ParsedLegacyUrl[];
  changedFields: string[];
};

type TokenRotationResult = ParsedLegacyUrl & {
  rotated: boolean;
  hadToken?: boolean;
  error?: string;
};

export type LegacyStorefrontMediaMigrationOptions = {
  apply?: boolean;
  limit?: number | null;
  storefrontId?: string | null;
};

export type LegacyStorefrontMediaMigrationResult = {
  mode: 'dry-run' | 'apply';
  inspectedDocumentCount: number;
  documentsToUpdate: number;
  tokenRotationTargets: number;
  storefronts: Array<{
    storefrontId: string;
    ownerUid: string;
    changedFields: string[];
    migratedPathCount: number;
  }>;
  updatedDocumentCount?: number;
  rotatedTokenCount?: number;
  failedRotations?: TokenRotationResult[];
};

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => (typeof value === 'string' ? value.trim() : ''))
        .filter(Boolean)
    )
  );
}

function normalizeOptionalStorefrontMediaPath(value: string | null | undefined) {
  if (typeof value !== 'string') {
    return null;
  }

  const normalizedValue = value.trim();
  if (
    !normalizedValue ||
    !normalizedValue.startsWith('dispensary-media/') ||
    normalizedValue.includes('..') ||
    normalizedValue.includes('?') ||
    normalizedValue.startsWith('/')
  ) {
    return null;
  }

  return normalizedValue;
}

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

function parseLegacyFirebaseDownloadUrl(value: string | null | undefined): ParsedLegacyUrl | null {
  const normalizedValue = normalizeOptionalHttpUrl(value);
  if (!normalizedValue) {
    return null;
  }

  try {
    const url = new URL(normalizedValue);
    const bucketFromV0Path =
      url.hostname === 'firebasestorage.googleapis.com'
        ? url.pathname.match(/^\/(?:v0|download\/storage\/v1)\/b\/([^/]+)\/o\/(.+)$/i)
        : null;
    const bucketFromStoragePath =
      url.hostname === 'storage.googleapis.com'
        ? url.pathname.match(/^\/([^/]+)\/(.+)$/)
        : null;

    const bucket = bucketFromV0Path?.[1] ?? bucketFromStoragePath?.[1] ?? null;
    const encodedPath = bucketFromV0Path?.[2] ?? bucketFromStoragePath?.[2] ?? null;
    if (!bucket || !encodedPath) {
      return null;
    }

    const path = decodeURIComponent(encodedPath);
    const normalizedPath = normalizeOptionalStorefrontMediaPath(path);
    if (!normalizedPath) {
      return null;
    }

    return {
      bucket,
      path: normalizedPath,
    };
  } catch {
    return null;
  }
}

function analyzeLegacyUrls(urls: Array<string | null | undefined>) {
  const migratedRefs: ParsedLegacyUrl[] = [];
  const resolvedPaths: string[] = [];
  const preservedUrls: string[] = [];

  urls.forEach((url) => {
    const normalizedUrl = normalizeOptionalHttpUrl(url);
    if (!normalizedUrl) {
      return;
    }

    const legacyRef = parseLegacyFirebaseDownloadUrl(normalizedUrl);
    if (legacyRef) {
      migratedRefs.push(legacyRef);
      resolvedPaths.push(legacyRef.path);
      return;
    }

    preservedUrls.push(normalizedUrl);
  });

  return {
    migratedRefs,
    resolvedPaths,
    preservedUrls,
  };
}

function valuesEqual(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function buildMigrationPlan(
  record: OwnerStorefrontProfileToolsDocument
): MigrationPlan | null {
  const cardPhotoPath = normalizeOptionalStorefrontMediaPath(record.cardPhotoPath);
  const featuredPhotoPaths = uniqueStrings(
    (record.featuredPhotoPaths ?? []).map((value) => normalizeOptionalStorefrontMediaPath(value))
  ).slice(0, 8);

  const cardUrlAnalysis = analyzeLegacyUrls([record.cardPhotoUrl]);
  const galleryUrlAnalysis = analyzeLegacyUrls(record.featuredPhotoUrls ?? []);

  const nextCardPhotoPath = cardPhotoPath ?? cardUrlAnalysis.resolvedPaths[0] ?? null;
  const nextFeaturedPhotoPaths = uniqueStrings([
    nextCardPhotoPath,
    ...featuredPhotoPaths,
    ...galleryUrlAnalysis.resolvedPaths,
    ...cardUrlAnalysis.resolvedPaths,
  ]).slice(0, 8);

  const nextCardPhotoUrl = cardPhotoPath ? null : cardUrlAnalysis.preservedUrls[0] ?? null;
  const nextFeaturedPhotoUrls = uniqueStrings([
    ...galleryUrlAnalysis.preservedUrls,
    ...(nextCardPhotoUrl ? [nextCardPhotoUrl] : []),
  ]).slice(0, 8);

  const stageRecord: OwnerStorefrontProfileToolsDocument = {
    ...record,
    cardPhotoPath: nextCardPhotoPath,
    featuredPhotoPaths: nextFeaturedPhotoPaths,
    cardPhotoUrl: normalizeOptionalHttpUrl(record.cardPhotoUrl),
    featuredPhotoUrls: uniqueStrings(
      (record.featuredPhotoUrls ?? []).map((value) => normalizeOptionalHttpUrl(value))
    ).slice(0, 8),
    updatedAt: new Date().toISOString(),
  };

  const cleanRecord: OwnerStorefrontProfileToolsDocument = {
    ...stageRecord,
    cardPhotoUrl: nextCardPhotoUrl,
    featuredPhotoUrls: nextFeaturedPhotoUrls,
  };

  const fieldChanges: Array<[string, unknown, unknown]> = [
    ['cardPhotoPath', record.cardPhotoPath ?? null, cleanRecord.cardPhotoPath ?? null],
    ['featuredPhotoPaths', record.featuredPhotoPaths ?? [], cleanRecord.featuredPhotoPaths ?? []],
    ['cardPhotoUrl', record.cardPhotoUrl ?? null, cleanRecord.cardPhotoUrl ?? null],
    ['featuredPhotoUrls', record.featuredPhotoUrls ?? [], cleanRecord.featuredPhotoUrls ?? []],
  ];
  const changedFields = fieldChanges
    .filter(([, left, right]) => !valuesEqual(left, right))
    .map(([field]) => field);

  const migratedRefs = uniqueStrings(
    [...cardUrlAnalysis.migratedRefs, ...galleryUrlAnalysis.migratedRefs].map(
      (ref) => `${ref.bucket}::${ref.path}`
    )
  ).map((value) => {
    const separatorIndex = value.indexOf('::');
    return {
      bucket: value.slice(0, separatorIndex),
      path: value.slice(separatorIndex + 2),
    };
  });

  if (changedFields.length === 0 && migratedRefs.length === 0) {
    return null;
  }

  return {
    storefrontId: record.storefrontId,
    ownerUid: record.ownerUid,
    stageRecord,
    cleanRecord,
    migratedRefs,
    changedFields,
  };
}

async function rotateLegacyDownloadTokens(storage: Storage, refs: ParsedLegacyUrl[]) {
  const results: TokenRotationResult[] = [];
  for (const ref of refs) {
    const file = storage.bucket(ref.bucket).file(ref.path);

    try {
      const [metadata] = await file.getMetadata();
      const existingMetadata = metadata.metadata ?? {};
      const existingToken = existingMetadata.firebaseStorageDownloadTokens ?? null;
      const nextToken = randomUUID();

      await file.setMetadata({
        metadata: {
          ...existingMetadata,
          firebaseStorageDownloadTokens: nextToken,
        },
      });

      results.push({
        ...ref,
        rotated: true,
        hadToken: Boolean(existingToken),
      });
    } catch (error) {
      results.push({
        ...ref,
        rotated: false,
        error: error instanceof Error ? error.message : 'Unknown storage metadata error.',
      });
    }
  }

  return results;
}

export async function runLegacyStorefrontMediaMigration(
  options: LegacyStorefrontMediaMigrationOptions = {}
): Promise<LegacyStorefrontMediaMigrationResult> {
  if (!hasBackendFirebaseConfig) {
    throw new Error('Backend Firebase config is not available in this environment.');
  }

  const db = getBackendFirebaseDb();
  const storage = getBackendFirebaseStorage();
  if (!db || !storage) {
    throw new Error('Firestore or Storage admin access is not configured.');
  }

  const collectionRef =
    db.collection(
      PROFILE_TOOLS_COLLECTION
    ) as FirebaseFirestore.CollectionReference<OwnerStorefrontProfileToolsDocument>;
  let query: FirebaseFirestore.Query<OwnerStorefrontProfileToolsDocument> = collectionRef;

  if (options.storefrontId?.trim()) {
    query = query.where('storefrontId', '==', options.storefrontId.trim());
  }
  if (
    typeof options.limit === 'number' &&
    Number.isFinite(options.limit) &&
    options.limit > 0
  ) {
    query = query.limit(Math.floor(options.limit));
  }

  const snapshot = await query.get();
  const originalRecordsById = new Map(
    snapshot.docs.map((documentSnapshot) => [documentSnapshot.id, documentSnapshot.data()])
  );
  const plans = snapshot.docs
    .map((documentSnapshot) => buildMigrationPlan(documentSnapshot.data()))
    .filter((plan): plan is MigrationPlan => Boolean(plan));

  const tokenRotationTargets = uniqueStrings(
    plans.flatMap((plan) => plan.migratedRefs.map((ref) => `${ref.bucket}::${ref.path}`))
  ).map((value) => {
    const separatorIndex = value.indexOf('::');
    return {
      bucket: value.slice(0, separatorIndex),
      path: value.slice(separatorIndex + 2),
    };
  });

  const summary: LegacyStorefrontMediaMigrationResult = {
    mode: options.apply === true ? 'apply' : 'dry-run',
    inspectedDocumentCount: snapshot.size,
    documentsToUpdate: plans.length,
    tokenRotationTargets: tokenRotationTargets.length,
    storefronts: plans.map((plan) => ({
      storefrontId: plan.storefrontId,
      ownerUid: plan.ownerUid,
      changedFields: plan.changedFields,
      migratedPathCount: plan.migratedRefs.length,
    })),
  };

  if (options.apply !== true || plans.length === 0) {
    return summary;
  }

  for (const plan of plans) {
    const originalRecord = originalRecordsById.get(plan.storefrontId);
    if (!valuesEqual(plan.stageRecord, originalRecord)) {
      await db.collection(PROFILE_TOOLS_COLLECTION).doc(plan.storefrontId).set(plan.stageRecord, {
        merge: false,
      });
    }
  }

  const rotationResults = await rotateLegacyDownloadTokens(storage, tokenRotationTargets);
  const failedRotations = rotationResults.filter((result) => result.rotated !== true);
  const failedRotationKeys = new Set(
    failedRotations.map((result) => `${result.bucket}::${result.path}`)
  );

  for (const plan of plans) {
    const hasFailedRotation = plan.migratedRefs.some((ref) =>
      failedRotationKeys.has(`${ref.bucket}::${ref.path}`)
    );

    if (hasFailedRotation || valuesEqual(plan.stageRecord, plan.cleanRecord)) {
      continue;
    }

    await db.collection(PROFILE_TOOLS_COLLECTION).doc(plan.storefrontId).set(plan.cleanRecord, {
      merge: false,
    });
  }

  return {
    ...summary,
    updatedDocumentCount: plans.length,
    rotatedTokenCount: rotationResults.filter((result) => result.rotated === true).length,
    failedRotations,
  };
}

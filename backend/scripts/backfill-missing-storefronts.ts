/* eslint-disable no-console */
// Backfill: write Firestore `storefront_summaries` docs for the 33 OCM-licensed
// storefronts that exist in `src/data/ocmVerifiedStorefrontRecords.generated.ts`
// but are missing from production Firestore. After this runs, the browse footer
// should show 644 instead of 612.
//
// Mirrors the existing 612 docs' field shape (displayName, addressLine1, hours,
// coordinates, isVerified=true, ingestSource='registry', publishedAt=now). Does
// NOT touch any docs that already exist (idempotent — safe to re-run).
//
// Default = dry run. Pass `--execute` to actually write.
//
//   FIREBASE_DATABASE_ID=canopytrove npx tsx \
//     backend/scripts/backfill-missing-storefronts.ts [--execute]

import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const projectId = process.env.GCP_PROJECT || 'canopy-trove';
const databaseId = process.env.FIREBASE_DATABASE_ID || 'canopytrove';
const execute = process.argv.includes('--execute');
if (!getApps().length) {
  initializeApp({ credential: applicationDefault(), projectId });
}
const db = getFirestore(databaseId);

type RawRecord = {
  id: string;
  licenseId?: string;
  marketId?: string;
  displayName?: string;
  legalName?: string;
  addressLine1?: string;
  city?: string;
  state?: string;
  zip?: string;
  coordinates?: { latitude?: number; longitude?: number };
  hours?: string[];
  menuUrl?: string | null;
  placeId?: string | null;
  thumbnailUrl?: string | null;
  isVerified?: boolean;
  mapPreviewLabel?: string | null;
  premiumCardVariant?: string;
};

function loadDataset(): Record<string, RawRecord> {
  const filepath = path.resolve(
    __dirname,
    '..',
    '..',
    'src',
    'data',
    'ocmVerifiedStorefrontRecords.generated.ts',
  );
  const source = readFileSync(filepath, 'utf8');
  const exportMarker = source.indexOf('ocmVerifiedStorefrontRecords');
  const arrayStart = source.indexOf('[', source.indexOf('=', exportMarker));
  const arrayEnd = source.lastIndexOf('];');
  const arrayCode = source.slice(arrayStart, arrayEnd + 1);
  // The TS file uses unquoted keys + single-quote strings, so JSON.parse fails.
  // Run it through Node's vm sandbox to handle JS object literal syntax.
  const records = vm.runInNewContext(arrayCode) as RawRecord[];
  const byId: Record<string, RawRecord> = {};
  for (const r of records) byId[r.id] = r;
  return byId;
}

// Shape a backfill summary doc to match what the registry-ingest pipeline
// would have produced. Critically: `isVerified: true` so the patched
// LicensedBadge fallback shows the badge for these shops, and
// `ingestSource: 'registry'` so any downstream filtering treats them like
// every other registry-ingested doc.
function shapeSummary(record: RawRecord, nowIso: string) {
  return {
    id: record.id,
    licenseId: record.licenseId ?? null,
    marketId: record.marketId ?? null,
    displayName: record.displayName ?? null,
    legalName: record.legalName ?? record.displayName ?? null,
    addressLine1: record.addressLine1 ?? null,
    city: record.city ?? null,
    state: record.state ?? 'NY',
    zip: record.zip ?? null,
    latitude: record.coordinates?.latitude ?? null,
    longitude: record.coordinates?.longitude ?? null,
    distanceMiles: 0,
    travelMinutes: 0,
    rating: 0,
    reviewCount: 0,
    openNow: true,
    hours: record.hours ?? [],
    isVerified: record.isVerified ?? true,
    mapPreviewLabel: record.mapPreviewLabel ?? 'Verified OCM storefront',
    promotionText: null,
    promotionBadges: [],
    promotionExpiresAt: null,
    activePromotionId: null,
    favoriteFollowerCount: null,
    menuUrl: record.menuUrl ?? null,
    verifiedOwnerBadgeLabel: null,
    ownerFeaturedBadges: [],
    ownerCardSummary: null,
    premiumCardVariant: record.premiumCardVariant ?? 'standard',
    promotionPlacementSurfaces: [],
    promotionPlacementScope: null,
    placeId: record.placeId ?? null,
    thumbnailUrl: record.thumbnailUrl ?? null,
    ingestSource: 'registry',
    publishedAt: nowIso,
  };
}

async function main() {
  console.log('='.repeat(80));
  console.log(`Mode: ${execute ? '*** EXECUTE — writes will happen ***' : 'DRY RUN'}`);
  console.log('='.repeat(80));

  const dataset = loadDataset();
  const datasetIds = new Set(Object.keys(dataset));
  console.log(`\nDataset records loaded:                 ${datasetIds.size}`);

  const existing = await db.collection('storefront_summaries').get();
  const existingIds = new Set(existing.docs.map((d) => d.id));
  console.log(`Existing storefront_summaries in DB:    ${existingIds.size}`);

  const missing = [...datasetIds].filter((id) => !existingIds.has(id)).sort();
  console.log(`Missing from Firestore:                 ${missing.length}\n`);

  if (!missing.length) {
    console.log('Nothing to backfill. Exiting.');
    return;
  }

  const nowIso = new Date().toISOString();
  let written = 0;
  let skipped = 0;

  for (const id of missing) {
    const record = dataset[id];
    if (!record) {
      console.log(`  ! ${id}: missing from loaded dataset map (impossible — skipping)`);
      skipped += 1;
      continue;
    }
    const doc = shapeSummary(record, nowIso);
    if (!execute) {
      console.log(`  ⌛ would write  storefront_summaries/${id}  ("${doc.displayName}")`);
      continue;
    }
    try {
      await db.collection('storefront_summaries').doc(id).set(doc);
      written += 1;
      console.log(`  ✔ wrote  ${id}  ("${doc.displayName}")`);
    } catch (err) {
      console.log(`  ✖ FAILED  ${id}: ${err instanceof Error ? err.message : String(err)}`);
      skipped += 1;
    }
  }

  console.log('');
  console.log('-'.repeat(80));
  if (execute) {
    console.log(`Backfill complete:  ${written} written, ${skipped} skipped/failed`);
  } else {
    console.log(`Dry run complete:  ${missing.length} would be written. Re-run with --execute.`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('FAILED', err);
    process.exit(1);
  });

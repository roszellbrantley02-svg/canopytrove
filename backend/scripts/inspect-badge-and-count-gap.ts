/* eslint-disable no-console */
// Diagnose two bugs the founder is seeing:
//   1) Some storefronts show the verified badge, some don't
//   2) Browse footer shows "612" total but the OCM dataset has 644
//
// Reads only. Outputs:
//   - Total storefront_summaries docs in Firestore
//   - How many have ocmVerification attached (badge-eligible)
//   - The set difference between the 644-record generated dataset and what's
//     actually in Firestore (which OCM IDs are missing)
//   - For docs in Firestore but missing badges: address vs name match status
//
// Run:
//   FIREBASE_DATABASE_ID=canopytrove npx tsx \
//     backend/scripts/inspect-badge-and-count-gap.ts

import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const projectId = process.env.GCP_PROJECT || 'canopy-trove';
const databaseId = process.env.FIREBASE_DATABASE_ID || 'canopytrove';
if (!getApps().length) {
  initializeApp({ credential: applicationDefault(), projectId });
}
const db = getFirestore(databaseId);

type SummaryDoc = {
  id?: string;
  storefrontId?: string;
  name?: string;
  addressLine1?: string;
  address?: string;
  zip?: string;
  city?: string;
  region?: string;
  state?: string;
  publicationStatus?: string;
  hidden?: boolean;
  isDemo?: boolean;
  ocmVerification?: {
    licensed?: boolean;
    confidence?: string;
    licenseNumber?: string | null;
  } | null;
};

function rule(label = '') {
  console.log('\n' + label);
  console.log('-'.repeat(80));
}

// Pull the canonical 644-record list of OCM IDs from the generated file
function loadDatasetIds(): { ids: Set<string>; total: number } {
  const filepath = path.resolve(
    __dirname,
    '..',
    '..',
    'src',
    'data',
    'ocmVerifiedStorefrontRecords.generated.ts',
  );
  const source = readFileSync(filepath, 'utf8');
  const matches = source.matchAll(/id:\s*'(ocm-[^']+)'/g);
  const ids = new Set<string>();
  for (const m of matches) ids.add(m[1]!);
  return { ids, total: ids.size };
}

async function loadAllSummaries(): Promise<SummaryDoc[]> {
  const snap = await db.collection('storefront_summaries').get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as SummaryDoc) }));
}

async function main() {
  console.log('='.repeat(80));
  console.log('Badge + count gap diagnosis');
  console.log(`canopy-trove / ${databaseId}    as of ${new Date().toISOString()}`);
  console.log('='.repeat(80));

  const dataset = loadDatasetIds();
  console.log(`\nDataset (ocmVerifiedStorefrontRecords.generated.ts): ${dataset.total} OCM IDs`);

  const summaries = await loadAllSummaries();
  console.log(`Firestore storefront_summaries:                       ${summaries.length} docs`);

  rule('[1] Set difference: 644 dataset IDs vs Firestore IDs');
  const firestoreIds = new Set(summaries.map((s) => s.id ?? '').filter(Boolean));
  const inDatasetNotInFirestore = [...dataset.ids].filter((id) => !firestoreIds.has(id));
  const inFirestoreNotInDataset = [...firestoreIds].filter((id) => !dataset.ids.has(id));

  console.log(`  in dataset but NOT in Firestore:  ${inDatasetNotInFirestore.length}`);
  console.log(`  in Firestore but NOT in dataset:  ${inFirestoreNotInDataset.length}`);
  console.log(
    `  in both:                          ${[...dataset.ids].filter((id) => firestoreIds.has(id)).length}`,
  );

  if (inDatasetNotInFirestore.length > 0 && inDatasetNotInFirestore.length <= 50) {
    console.log(
      `\n  Missing from Firestore (first ${Math.min(inDatasetNotInFirestore.length, 50)}):`,
    );
    inDatasetNotInFirestore.slice(0, 50).forEach((id, i) => {
      console.log(`    ${String(i + 1).padStart(3)}.  ${id}`);
    });
  } else if (inDatasetNotInFirestore.length > 50) {
    console.log(
      `\n  Missing from Firestore (showing first 25 of ${inDatasetNotInFirestore.length}):`,
    );
    inDatasetNotInFirestore.slice(0, 25).forEach((id, i) => {
      console.log(`    ${String(i + 1).padStart(3)}.  ${id}`);
    });
  }

  if (inFirestoreNotInDataset.length > 0 && inFirestoreNotInDataset.length <= 20) {
    console.log(`\n  In Firestore but NOT in 644 dataset (i.e. extras):`);
    inFirestoreNotInDataset.forEach((id) => console.log(`    - ${id}`));
  }

  rule('[2] Verified-badge eligibility breakdown');
  let withVerification = 0;
  let withoutVerification = 0;
  let licensedTrue = 0;
  let licensedFalse = 0;
  const byConfidence = new Map<string, number>();
  for (const s of summaries) {
    if (s.ocmVerification && Object.keys(s.ocmVerification).length > 0) {
      withVerification += 1;
      if (s.ocmVerification.licensed === true) licensedTrue += 1;
      else if (s.ocmVerification.licensed === false) licensedFalse += 1;
      const conf = String(s.ocmVerification.confidence ?? 'undefined');
      byConfidence.set(conf, (byConfidence.get(conf) ?? 0) + 1);
    } else {
      withoutVerification += 1;
    }
  }
  console.log(`  with ocmVerification field:       ${withVerification}`);
  console.log(`    licensed=true (badge shows):    ${licensedTrue}`);
  console.log(`    licensed=false (no badge):      ${licensedFalse}`);
  console.log(`    confidence breakdown:`);
  for (const [c, n] of [...byConfidence.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`      ${c.padEnd(20)} ${n}`);
  }
  console.log(`  without ocmVerification field:    ${withoutVerification}`);

  rule('[3] Sample storefronts WITHOUT a verified badge (why?)');
  const noBadge = summaries
    .filter((s) => s.id && s.id.startsWith('ocm-'))
    .filter((s) => !s.ocmVerification || s.ocmVerification.licensed !== true)
    .slice(0, 15);
  console.log(`  showing ${noBadge.length} ocm- prefixed summaries with no badge:\n`);
  for (const s of noBadge) {
    const v = s.ocmVerification;
    console.log(
      `    ${s.id?.padEnd(50)}  name="${(s.name ?? '—').slice(0, 30)}"  addr="${(s.addressLine1 ?? s.address ?? '—').slice(0, 30)}"  zip=${s.zip ?? '—'}  conf=${v?.confidence ?? '(no verif)'}`,
    );
  }

  rule('[4] Filter / hidden flags on summaries (anything that could exclude from browse)');
  let hiddenTrue = 0;
  let isDemoTrue = 0;
  const pubStatusCounts = new Map<string, number>();
  let withName = 0;
  let withoutName = 0;
  for (const s of summaries) {
    if (s.hidden === true) hiddenTrue += 1;
    if (s.isDemo === true) isDemoTrue += 1;
    const ps = String(s.publicationStatus ?? 'undefined');
    pubStatusCounts.set(ps, (pubStatusCounts.get(ps) ?? 0) + 1);
    if (s.name && s.name.trim()) withName += 1;
    else withoutName += 1;
  }
  console.log(`  hidden = true:        ${hiddenTrue}`);
  console.log(`  isDemo = true:        ${isDemoTrue}`);
  console.log(`  with name:            ${withName}`);
  console.log(
    `  WITHOUT name:         ${withoutName}   ← if browse filters by name, these would be hidden`,
  );
  console.log(`  publicationStatus breakdown:`);
  for (const [s, n] of [...pubStatusCounts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${s.padEnd(28)} ${n}`);
  }

  console.log('');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('FAILED', err);
    process.exit(1);
  });

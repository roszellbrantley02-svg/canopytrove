/* eslint-disable no-console */
// One-shot refresh of the production `events` collection on 2026-05-03:
//   - Delete 4 too-far-out 2027 events that cluttered the Travel & Events tab
//   - Delete 3 synthetic-date events (Yerba Buena synthetic, ESNORML synthetic,
//     OCM CCB synthetic) and replace with real-dated entries verified via
//     yerbabuena.nyc/events and cannabis.ny.gov/cannabis-control-board-meetings
//
// Default = dry run. Pass `--execute` to apply.
//
//   FIREBASE_DATABASE_ID=canopytrove npx tsx \
//     backend/scripts/refresh-events-may-2026.ts [--execute]

import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { EVENTS_COLLECTION_NAME } from '../src/constants/collections';
import type { EventDoc } from '../src/services/eventsService';

const projectId = process.env.GCP_PROJECT || 'canopy-trove';
const databaseId = process.env.FIREBASE_DATABASE_ID || 'canopytrove';
const execute = process.argv.includes('--execute');

if (!getApps().length) {
  initializeApp({ credential: applicationDefault(), projectId });
}
const db = getFirestore(databaseId);

const NOW_ISO = new Date().toISOString();

// IDs to delete from production. The 4 next-year ones cluttered "happening
// this month"; the 3 synthetic-date ones are being replaced with real
// confirmed dates from the official sources below.
const IDS_TO_DELETE = [
  'nyc-cannabis-parade-2027-05',
  'kannafest-2027-04-20',
  'wamb-fest-2027-04-20',
  'washington-square-420-2027',
  'yerba-buena-brand-night-may-2026', // replaced by real Birdies + Jaunty entries
  'esnorml-monthly-meet', // synthetic date — no published schedule
  'ocm-cannabis-control-board', // synthetic — replaced with real May 7 + June 4
];

function event(partial: Omit<EventDoc, 'createdAt' | 'updatedAt' | 'source' | 'hidden'>): EventDoc {
  return { ...partial, source: 'curated', hidden: false, createdAt: NOW_ISO, updatedAt: NOW_ISO };
}

const NEW_EVENTS: EventDoc[] = [
  event({
    id: 'yerba-buena-birdies-2026-05-07',
    title: 'Birdies @ Yerba Buena',
    summary:
      'In-store brand activation at Yerba Buena Brooklyn — meet the Birdies pre-roll team, sample, and shop with reps on-site.',
    description:
      "Yerba Buena (292 Atlantic Ave, Brooklyn) is hosting Birdies for an in-store activation. Discover a premium pre-roll brand newly available on shelves, ask the brand reps your questions, and pick up product the same night.\n\nGreat way to learn what's on NY shelves right now and meet the people behind the product.",
    category: 'brand_activation',
    startsAt: '2026-05-07T15:30:00-04:00',
    endsAt: '2026-05-07T18:30:00-04:00',
    timezone: 'America/New_York',
    allDay: false,
    isMultiDay: false,
    venueName: 'Yerba Buena Dispensary',
    addressLine1: '292 Atlantic Avenue',
    city: 'Brooklyn',
    region: 'Brooklyn',
    state: 'NY',
    zip: '11201',
    placeId: null,
    latitude: 40.6904,
    longitude: -73.9926,
    hasDrivableLocation: true,
    organizerName: 'Yerba Buena',
    websiteUrl: 'https://yerbabuena.nyc/events',
    ticketUrl: null,
    isFree: true,
    priceLabel: 'Free entry',
    ageRestriction: '21+',
    photoUrl: null,
    tags: ['Brand activation', 'Brooklyn', 'Consumer', 'Free', 'Birdies'],
  }),
  event({
    id: 'yerba-buena-jaunty-2026-05-16',
    title: 'Jaunty @ Yerba Buena',
    summary:
      'Saturday brand activation at Yerba Buena Brooklyn — explore the Jaunty production process and product offerings with the brand team.',
    description:
      "Saturday in-store activation at Yerba Buena (292 Atlantic Ave, Brooklyn) featuring Jaunty. Explore the production process and product offerings of one of NY's popular brands, talk to reps, and pick up product the same day.",
    category: 'brand_activation',
    startsAt: '2026-05-16T11:00:00-04:00',
    endsAt: '2026-05-16T14:00:00-04:00',
    timezone: 'America/New_York',
    allDay: false,
    isMultiDay: false,
    venueName: 'Yerba Buena Dispensary',
    addressLine1: '292 Atlantic Avenue',
    city: 'Brooklyn',
    region: 'Brooklyn',
    state: 'NY',
    zip: '11201',
    placeId: null,
    latitude: 40.6904,
    longitude: -73.9926,
    hasDrivableLocation: true,
    organizerName: 'Yerba Buena',
    websiteUrl: 'https://yerbabuena.nyc/events',
    ticketUrl: null,
    isFree: true,
    priceLabel: 'Free entry',
    ageRestriction: '21+',
    photoUrl: null,
    tags: ['Brand activation', 'Brooklyn', 'Consumer', 'Free', 'Jaunty', 'Saturday'],
  }),
  event({
    id: 'ocm-ccb-2026-05-07-long-island',
    title: 'NY Cannabis Control Board — Long Island Public Meeting',
    summary:
      "OCM's monthly public board meeting, this month at Nassau Community College on Long Island. Open to the public + public comment period.",
    description:
      "The Cannabis Control Board (CCB) is the public body that votes on regulatory updates, licensing decisions, and policy direction for New York's adult-use cannabis market. Meetings are open to the public and include a public comment period.\n\nThis month's meeting is on Long Island at Nassau Community College in Garden City. Pre-register to attend in person or submit written public comment via cannabis.ny.gov.\n\nWatching even one CCB meeting gives you the clearest read on where NY policy is heading. The CCB meets monthly and rotates locations across the state — May = Long Island, June = NYC, July = Albany, etc.",
    category: 'advocacy',
    startsAt: '2026-05-07T11:00:00-04:00',
    endsAt: '2026-05-07T14:00:00-04:00',
    timezone: 'America/New_York',
    allDay: false,
    isMultiDay: false,
    venueName: 'Nassau Community College',
    addressLine1: '1 Education Drive',
    city: 'Garden City',
    region: 'Long Island',
    state: 'NY',
    zip: '11530',
    placeId: null,
    latitude: 40.7264,
    longitude: -73.6011,
    hasDrivableLocation: true,
    organizerName: 'NY Office of Cannabis Management',
    websiteUrl: 'https://cannabis.ny.gov/cannabis-control-board-meetings',
    ticketUrl: null,
    isFree: true,
    priceLabel: 'Free / public meeting',
    ageRestriction: 'All ages',
    photoUrl: null,
    tags: ['Public meeting', 'OCM', 'Policy', 'Free', 'Long Island', 'Live-streamed'],
  }),
  event({
    id: 'ocm-ccb-2026-06-04-nyc',
    title: 'NY Cannabis Control Board — NYC Public Meeting',
    summary:
      "OCM's monthly public board meeting, this month in New York City. Open to the public + public comment period.",
    description:
      "The Cannabis Control Board (CCB) holds its monthly public meeting in New York City this month. Agenda items include regulatory updates, licensing decisions, and policy direction for New York's adult-use cannabis market. Public comment period included.\n\nExact NYC venue and time-of-day are announced on cannabis.ny.gov a few days before the meeting. Live-streamed; in-person attendance is also welcome (pre-register via the OCM site).",
    category: 'advocacy',
    startsAt: '2026-06-04T10:00:00-04:00',
    endsAt: '2026-06-04T13:00:00-04:00',
    timezone: 'America/New_York',
    allDay: false,
    isMultiDay: false,
    venueName: 'NY Office of Cannabis Management — NYC',
    addressLine1: null,
    city: 'New York',
    region: 'NYC',
    state: 'NY',
    zip: null,
    placeId: null,
    latitude: null,
    longitude: null,
    hasDrivableLocation: false,
    organizerName: 'NY Office of Cannabis Management',
    websiteUrl: 'https://cannabis.ny.gov/cannabis-control-board-meetings',
    ticketUrl: null,
    isFree: true,
    priceLabel: 'Free / public meeting',
    ageRestriction: 'All ages',
    photoUrl: null,
    tags: ['Public meeting', 'OCM', 'Policy', 'Free', 'NYC', 'Live-streamed'],
  }),
];

async function main() {
  console.log('='.repeat(80));
  console.log(`Mode: ${execute ? '*** EXECUTE — writes will happen ***' : 'DRY RUN'}`);
  console.log(`Target: canopy-trove / ${databaseId} / ${EVENTS_COLLECTION_NAME}`);
  console.log('='.repeat(80));

  console.log(`\n[1] Delete ${IDS_TO_DELETE.length} stale events:`);
  for (const id of IDS_TO_DELETE) {
    if (!execute) {
      console.log(`  [dry] would delete  ${id}`);
      continue;
    }
    try {
      await db.collection(EVENTS_COLLECTION_NAME).doc(id).delete();
      console.log(`  [ok]  deleted     ${id}`);
    } catch (err) {
      console.log(`  [fail] ${id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log(`\n[2] Add ${NEW_EVENTS.length} real-dated events:`);
  for (const e of NEW_EVENTS) {
    if (!execute) {
      console.log(`  [dry] would write   ${e.id}  ("${e.title}")`);
      continue;
    }
    try {
      await db.collection(EVENTS_COLLECTION_NAME).doc(e.id).set(e);
      console.log(`  [ok]  wrote       ${e.id}  ("${e.title}")`);
    } catch (err) {
      console.log(`  [fail] ${e.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log('');
  console.log('-'.repeat(80));
  if (execute) {
    console.log('Refresh complete.');
  } else {
    console.log('Dry run complete. Re-run with --execute to apply.');
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('FAILED', err);
    process.exit(1);
  });

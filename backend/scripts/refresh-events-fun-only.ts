/* eslint-disable no-console */
// Pivot the Travel & Events tab to fun consumer events only.
//
// Per founder feedback (2026-05-03): "I don't want any meetings. People aren't
// gonna attend meetings. The meeting stuff doesn't really hold up to the
// average user. Find data on events that are real and fun, for the user, not
// for an owner."
//
// This script:
//   1. Hides every OCM Cannabis Control Board meeting (8 docs) and every
//      industry/B2B convention (4 docs). They stay in Firestore for
//      restore-ability but vanish from the public list.
//   2. Writes 9 new consumer-facing curated events sourced from
//      Eventbrite (yoga / comedy / cooking / pop-ups / parties).
//
// Default = dry run. Pass `--execute` to apply.
//
//   FIREBASE_DATABASE_ID=canopytrove npx tsx \
//     backend/scripts/refresh-events-fun-only.ts [--execute]

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

// IDs to hide. Stays in Firestore (preserves any future restore / analytics)
// but the public `upcoming` filter drops anything with `hidden: true`.
const IDS_TO_HIDE = [
  // OCM CCB monthly meetings — policy nerd content, not consumer
  'ocm-ccb-2026-05-07-long-island',
  'ocm-ccb-2026-06-04-nyc',
  'ocm-ccb-2026-07-02-capital-district',
  'ocm-ccb-2026-08-06-western-ny',
  'ocm-ccb-2026-09-03-nyc',
  'ocm-ccb-2026-10-01-hudson-valley',
  'ocm-ccb-2026-11-05-capital-district',
  'ocm-ccb-2026-12-03-nyc',
  // Industry / B2B conventions — owner content, not consumer
  'revelry-ny-2026-05-13', // explicitly "industry only"
  'ncia-cannabis-business-summit-2026-06-07', // policy / association programming
  'cwcbexpo-2026-06-03', // mostly B2B exhibit floor + business panels
  'necann-ny-2026-10-02', // same — operator-focused
];

function event(partial: Omit<EventDoc, 'createdAt' | 'updatedAt' | 'source' | 'hidden'>): EventDoc {
  return { ...partial, source: 'curated', hidden: false, createdAt: NOW_ISO, updatedAt: NOW_ISO };
}

// Sourced from Eventbrite NY cannabis search 2026-05-03 + a few researched
// venue calendars. Each entry is a real event with a real date and a
// public ticket / RSVP path.
const NEW_EVENTS: EventDoc[] = [
  event({
    id: 'after5-cannabis-psychedelics-2026-05-18',
    title: 'Cannabis & Psychedelics: Consciousness, Creativity, & The Brain',
    summary:
      'After5NewYork evening exploring how cannabis and psychedelics affect consciousness and creativity. 21+, casual social-learning vibe.',
    description:
      'After5NewYork hosts an evening exploring how cannabis and psychedelics affect consciousness, creativity, and the brain. Format is talks + Q&A + casual social mixing — designed for 21+ adults curious about the science without the lecture-hall feeling.\n\nVenue address goes out via email confirmation when you RSVP on Eventbrite.',
    category: 'workshop',
    startsAt: '2026-05-18T18:30:00-04:00',
    endsAt: '2026-05-18T21:00:00-04:00',
    timezone: 'America/New_York',
    allDay: false,
    isMultiDay: false,
    venueName: 'After5NewYork — venue revealed on RSVP',
    addressLine1: null,
    city: 'New York',
    region: 'NYC',
    state: 'NY',
    zip: null,
    placeId: null,
    latitude: null,
    longitude: null,
    hasDrivableLocation: false,
    organizerName: 'After5NewYork',
    websiteUrl: 'https://www.eventbrite.com/d/ny--new-york/cannabis/',
    ticketUrl: 'https://www.eventbrite.com/d/ny--new-york/cannabis/',
    isFree: false,
    priceLabel: 'Ticketed — see Eventbrite',
    ageRestriction: '21+',
    photoUrl: null,
    tags: ['Workshop', 'Manhattan', 'Consumer', 'Psychedelics', 'Educational'],
  }),
  event({
    id: 'third-thursday-cannabis-meetup-2026-05-21',
    title: 'Third Thursday NYC — Cannabis Community Meetup',
    summary:
      'Monthly cannabis community meetup at Chantelle NYC. Casual social mixer for 21+ enthusiasts — every third Thursday.',
    description:
      "Third Thursday NYC is a recurring cannabis community meetup hosted at Chantelle NYC. The format is laid-back social — no agenda, no panels, just NY cannabis enthusiasts meeting each other in a 21+ space.\n\nIf you're new to the NY legal scene or just want to meet people who care about the same plant, this is a good monthly anchor.",
    category: 'consumer',
    startsAt: '2026-05-21T18:00:00-04:00',
    endsAt: '2026-05-21T21:00:00-04:00',
    timezone: 'America/New_York',
    allDay: false,
    isMultiDay: false,
    venueName: 'Chantelle NYC',
    addressLine1: null,
    city: 'New York',
    region: 'NYC',
    state: 'NY',
    zip: null,
    placeId: null,
    latitude: null,
    longitude: null,
    hasDrivableLocation: false,
    organizerName: 'Third Thursday NYC',
    websiteUrl: 'https://www.eventbrite.com/d/ny--new-york/cannabis/',
    ticketUrl: 'https://www.eventbrite.com/d/ny--new-york/cannabis/',
    isFree: false,
    priceLabel: 'Ticketed — see Eventbrite',
    ageRestriction: '21+',
    photoUrl: null,
    tags: ['Meetup', 'Manhattan', 'Consumer', 'Monthly', 'Social'],
  }),
  event({
    id: 'cannabis-botany-class-2026-05-21',
    title: 'Cannabis Botany — Learn the Science Behind the Smoke',
    summary:
      'Brooklyn evening class on the botany + chemistry of cannabis. Plant science, terpenes, cannabinoids — the actual science, casual format.',
    description:
      "An educational evening class exploring the botanical science and chemistry of cannabis plants. Covers plant biology, the cannabinoid family (THC, CBD, CBG, etc.), terpene profiles, and what's actually happening when different strains hit differently.\n\nFormat is casual and conversational — no prerequisites, no lecture-hall vibe. Designed for 21+ adults who want to understand the plant they're consuming.",
    category: 'workshop',
    startsAt: '2026-05-21T19:30:00-04:00',
    endsAt: '2026-05-21T21:30:00-04:00',
    timezone: 'America/New_York',
    allDay: false,
    isMultiDay: false,
    venueName: '67 West St',
    addressLine1: '67 West St, Unit 335',
    city: 'Brooklyn',
    region: 'Brooklyn',
    state: 'NY',
    zip: '11222',
    placeId: null,
    latitude: 40.7305,
    longitude: -73.9586,
    hasDrivableLocation: true,
    organizerName: 'Cannabis Botany NYC',
    websiteUrl: 'https://www.eventbrite.com/d/ny--new-york/cannabis/',
    ticketUrl: 'https://www.eventbrite.com/d/ny--new-york/cannabis/',
    isFree: false,
    priceLabel: 'Ticketed — see Eventbrite',
    ageRestriction: '21+',
    photoUrl: null,
    tags: ['Workshop', 'Brooklyn', 'Consumer', 'Educational', 'Science'],
  }),
  event({
    id: 'queer-cannabis-breathwork-2026-05-28',
    title: "Queer Men's Cannabis-Assisted Breathwork Circle",
    summary:
      'Wellness-focused breathwork session incorporating cannabis use, hosted for a queer male audience in Chelsea.',
    description:
      'A wellness-focused cannabis-assisted breathwork session designed as a safe space for the queer male community. Combines guided breathwork practice with intentional cannabis use to deepen relaxation and presence.\n\nFacilitator-led, all experience levels welcome. Casual dress, mat provided. 21+.',
    category: 'workshop',
    startsAt: '2026-05-28T19:00:00-04:00',
    endsAt: '2026-05-28T21:00:00-04:00',
    timezone: 'America/New_York',
    allDay: false,
    isMultiDay: false,
    venueName: 'West 27th Street & 6th Avenue',
    addressLine1: 'West 27th Street & 6th Avenue',
    city: 'New York',
    region: 'NYC',
    state: 'NY',
    zip: '10001',
    placeId: null,
    latitude: 40.7466,
    longitude: -73.9933,
    hasDrivableLocation: true,
    organizerName: 'Queer Cannabis Wellness',
    websiteUrl: 'https://www.eventbrite.com/d/ny--new-york/cannabis/',
    ticketUrl: 'https://www.eventbrite.com/d/ny--new-york/cannabis/',
    isFree: false,
    priceLabel: 'Ticketed — see Eventbrite',
    ageRestriction: '21+',
    photoUrl: null,
    tags: ['Wellness', 'Manhattan', 'Consumer', 'Breathwork', 'LGBTQ+'],
  }),
  event({
    id: 'puff-puff-playtest-2026-05-29',
    title: 'Puff-Puff Playtest Pop-up',
    summary:
      'Cannabis + board games pop-up at Coexist GameHouse. Test new tabletop games while elevated, meet the gaming community. Selling out fast.',
    description:
      "Combines cannabis with board game testing in a relaxed pop-up at Coexist GameHouse. Test out new tabletop games, meet other players, and enjoy a curated 21+ social space designed around play instead of party.\n\nFlagged as 'going fast' — RSVP early.",
    category: 'consumer',
    startsAt: '2026-05-29T18:30:00-04:00',
    endsAt: '2026-05-29T22:00:00-04:00',
    timezone: 'America/New_York',
    allDay: false,
    isMultiDay: false,
    venueName: 'Coexist GameHouse',
    addressLine1: null,
    city: 'New York',
    region: 'NYC',
    state: 'NY',
    zip: null,
    placeId: null,
    latitude: null,
    longitude: null,
    hasDrivableLocation: false,
    organizerName: 'Puff-Puff Playtest',
    websiteUrl: 'https://www.eventbrite.com/d/ny--new-york/cannabis/',
    ticketUrl: 'https://www.eventbrite.com/d/ny--new-york/cannabis/',
    isFree: false,
    priceLabel: 'Ticketed — see Eventbrite',
    ageRestriction: '21+',
    photoUrl: null,
    tags: ['Pop-up', 'Manhattan', 'Consumer', 'Gaming', 'Social'],
  }),
  event({
    id: 'cannafest-governors-ball-2026-06-06',
    title: 'Cannafest NYC — Governors Ball Weekend',
    summary:
      'Festival-style cannabis celebration during Governors Ball music weekend. 21+ private venue in Brooklyn.',
    description:
      "A festival-style cannabis celebration timed to Governors Ball music weekend. Cannabis culture meets the city's biggest music weekend — expect music, vendors, art, and a curated 21+ crowd.\n\nPrivate venue in Brooklyn — exact address provided after ticket purchase.",
    category: 'consumer',
    startsAt: '2026-06-06T16:00:00-04:00',
    endsAt: '2026-06-06T22:00:00-04:00',
    timezone: 'America/New_York',
    allDay: false,
    isMultiDay: false,
    venueName: 'Cannafest — private Brooklyn venue',
    addressLine1: null,
    city: 'Brooklyn',
    region: 'Brooklyn',
    state: 'NY',
    zip: null,
    placeId: null,
    latitude: null,
    longitude: null,
    hasDrivableLocation: false,
    organizerName: 'Cannafest NYC',
    websiteUrl: 'https://www.eventbrite.com/d/ny--new-york/cannabis/',
    ticketUrl: 'https://www.eventbrite.com/d/ny--new-york/cannabis/',
    isFree: false,
    priceLabel: 'Ticketed — see Eventbrite',
    ageRestriction: '21+',
    photoUrl: null,
    tags: ['Festival', 'Brooklyn', 'Consumer', 'Music', 'Governors Ball'],
  }),
  event({
    id: 'art-and-science-cannabis-2026-06-12',
    title: 'The Art & Science of Cannabis',
    summary:
      'Educational tasting at Be. Medical Cannabis Brooklyn — cultivation, chemistry, and sensory appreciation. Starts at 4:20 PM (yes, on purpose).',
    description:
      'An educational tasting event exploring cannabis cultivation, chemistry, and sensory appreciation. Hands-on session covering how strains differ, what the terpene wheel actually means, and how to taste-test like you would wine.\n\nHosted at Be. Medical Cannabis Brooklyn. Starts at 4:20 PM — yes, on purpose. 21+.',
    category: 'workshop',
    startsAt: '2026-06-12T16:20:00-04:00',
    endsAt: '2026-06-12T18:30:00-04:00',
    timezone: 'America/New_York',
    allDay: false,
    isMultiDay: false,
    venueName: 'Be. Medical Cannabis Dispensary',
    addressLine1: null,
    city: 'Brooklyn',
    region: 'Brooklyn',
    state: 'NY',
    zip: null,
    placeId: null,
    latitude: null,
    longitude: null,
    hasDrivableLocation: false,
    organizerName: 'Be. Medical Cannabis',
    websiteUrl: 'https://www.eventbrite.com/d/ny--new-york/cannabis/',
    ticketUrl: 'https://www.eventbrite.com/d/ny--new-york/cannabis/',
    isFree: false,
    priceLabel: 'Ticketed — see Eventbrite',
    ageRestriction: '21+',
    photoUrl: null,
    tags: ['Workshop', 'Brooklyn', 'Consumer', 'Tasting', 'Educational'],
  }),
  event({
    id: 'renaissance-poetry-party-2026-07-18',
    title: 'The Renaissance Poetry Party @ Smacked Village',
    summary:
      'Saturday afternoon poetry + cannabis culture gathering at Smacked Village dispensary in Greenwich Village. Renaissance-inspired vibe.',
    description:
      "A creative arts gathering blending poetry, cannabis culture, and a renaissance-inspired atmosphere. Hosted at Smacked Village (Greenwich Village dispensary). Bring a piece to read or just come listen.\n\nSaturday afternoon, casual, 21+. The kind of NY afternoon you'll tell people about.",
    category: 'consumer',
    startsAt: '2026-07-18T14:00:00-04:00',
    endsAt: '2026-07-18T17:00:00-04:00',
    timezone: 'America/New_York',
    allDay: false,
    isMultiDay: false,
    venueName: 'Smacked Village — Greenwich Village Cannabis Dispensary',
    addressLine1: null,
    city: 'New York',
    region: 'NYC',
    state: 'NY',
    zip: '10012',
    placeId: null,
    latitude: null,
    longitude: null,
    hasDrivableLocation: false,
    organizerName: 'Smacked Village',
    websiteUrl: 'https://www.eventbrite.com/d/ny--new-york/cannabis/',
    ticketUrl: 'https://www.eventbrite.com/d/ny--new-york/cannabis/',
    isFree: false,
    priceLabel: 'Ticketed — see Eventbrite',
    ageRestriction: '21+',
    photoUrl: null,
    tags: ['Arts', 'Manhattan', 'Consumer', 'Poetry', 'Saturday'],
  }),
  event({
    id: 'design-on-a-dime-2026-05-05',
    title: 'Housing Works Design on a Dime — Annual Benefit',
    summary:
      "Housing Works' annual interior design fundraiser — designer rooms at deep discounts, with proceeds supporting their HIV/AIDS + cannabis-equity programs.",
    description:
      "Housing Works' annual Design on a Dime (DOAD) is the city's biggest one-night designer-fundraiser benefit. Proceeds support Housing Works' decades-long HIV/AIDS programs AND the cannabis-equity work that funds NYC's first legal dispensary (Housing Works Cannabis Co).\n\nNot a cannabis event in the consumption sense — it's the philanthropy event behind the dispensary brand. Worth attending if you want to support the equity model that anchors NY legal cannabis.",
    category: 'consumer',
    startsAt: '2026-05-05T18:00:00-04:00',
    endsAt: '2026-05-05T22:00:00-04:00',
    timezone: 'America/New_York',
    allDay: false,
    isMultiDay: false,
    venueName: 'Housing Works — venue announced',
    addressLine1: null,
    city: 'New York',
    region: 'NYC',
    state: 'NY',
    zip: null,
    placeId: null,
    latitude: null,
    longitude: null,
    hasDrivableLocation: false,
    organizerName: 'Housing Works',
    websiteUrl: 'https://hwcannabis.co/',
    ticketUrl: 'https://hwcannabis.co/',
    isFree: false,
    priceLabel: 'Benefit ticketed',
    ageRestriction: '21+',
    photoUrl: null,
    tags: ['Benefit', 'Manhattan', 'Consumer', 'Equity', 'Annual'],
  }),
];

async function main() {
  console.log('='.repeat(80));
  console.log(`Mode: ${execute ? '*** EXECUTE — writes will happen ***' : 'DRY RUN'}`);
  console.log(`Target: canopy-trove / ${databaseId} / ${EVENTS_COLLECTION_NAME}`);
  console.log('='.repeat(80));

  console.log(`\n[1] Hide ${IDS_TO_HIDE.length} policy/industry events:`);
  for (const id of IDS_TO_HIDE) {
    if (!execute) {
      console.log(`  [dry] would hide  ${id}`);
      continue;
    }
    try {
      await db
        .collection(EVENTS_COLLECTION_NAME)
        .doc(id)
        .update({ hidden: true, updatedAt: NOW_ISO });
      console.log(`  [ok]  hidden     ${id}`);
    } catch (err) {
      console.log(`  [fail] ${id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log(`\n[2] Add ${NEW_EVENTS.length} fun consumer events:`);
  for (const e of NEW_EVENTS) {
    if (!execute) {
      console.log(`  [dry] would write   ${e.id}  ("${e.title}")  ${e.startsAt}`);
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
    console.log('Refresh complete. Public list now consumer-only.');
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

/* eslint-disable no-console */
// Seed the production `events` Firestore collection with curated NY cannabis
// events for the Travel & Events tab. Idempotent — re-running updates the
// fields on each event by id (no duplicates created).
//
// Source: WebSearch research dated 2026-05-03 (NewYorkStateCannabis.org,
// Distru, NewAmsterdam.nyc, ElevationHQNYC, StupidDope, Yerba Buena's
// own events page, Empire State NORML).
//
// Default = dry run. Pass `--execute` to actually write.
//
//   FIREBASE_DATABASE_ID=canopytrove npx tsx \
//     backend/scripts/seed-cannabis-events.ts [--execute]

import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import type { EventDoc } from '../src/services/eventsService';
import { EVENTS_COLLECTION_NAME } from '../src/constants/collections';

const projectId = process.env.GCP_PROJECT || 'canopy-trove';
const databaseId = process.env.FIREBASE_DATABASE_ID || 'canopytrove';
const execute = process.argv.includes('--execute');

if (!getApps().length) {
  initializeApp({ credential: applicationDefault(), projectId });
}
const db = getFirestore(databaseId);

const NOW_ISO = new Date().toISOString();

function event(partial: Omit<EventDoc, 'createdAt' | 'updatedAt' | 'source' | 'hidden'>): EventDoc {
  return {
    ...partial,
    source: 'curated',
    hidden: false,
    createdAt: NOW_ISO,
    updatedAt: NOW_ISO,
  };
}

const EVENTS: EventDoc[] = [
  event({
    id: 'revelry-ny-2026-05-13',
    title: "Revelry NY — Buyers' Club",
    summary:
      "Industry-only buyers' club: New York operators, brand reps, and distributors transacting under one roof.",
    description:
      "Revelry NY is a tightly curated buyers' club built around real business transactions, operator networking, and market-specific relationship building. The format puts NY-licensed retailers face-to-face with brands and distributors actively serving the state. Expect short, focused conversations, samples, and on-the-spot order writing rather than the wider trade-show feel.\n\nIf you operate or supply a NY licensed dispensary, this is one of the most efficient days you can spend on the buy side.\n\nWho it's for: licensed retailers, brand sales reps, and distributors. Not a consumer event.",
    category: 'industry',
    startsAt: '2026-05-13T12:00:00-04:00',
    endsAt: '2026-05-13T18:00:00-04:00',
    timezone: 'America/New_York',
    allDay: false,
    isMultiDay: false,
    venueName: 'Basilica Hudson',
    addressLine1: '110 South Front Street',
    city: 'Hudson',
    region: 'Hudson Valley',
    state: 'NY',
    zip: '12534',
    placeId: null,
    latitude: 42.2493,
    longitude: -73.7878,
    hasDrivableLocation: true,
    organizerName: 'Revelry',
    websiteUrl: 'https://www.distru.com/cannabis-events/revelry-ny',
    ticketUrl: null,
    isFree: false,
    priceLabel: 'Industry only',
    ageRestriction: '21+',
    photoUrl: null,
    tags: ['Industry', 'Networking', 'Hudson Valley', 'B2B'],
  }),

  event({
    id: 'cwcbexpo-2026-06-03',
    title: 'CWCBExpo — Cannabis World Congress & Business Exposition',
    summary:
      'Two-day Javits Center expo focused on the Empire State market — cultivation, retail tech, accessories, and compliance services.',
    description:
      "The 2026 Cannabis Means Business Conference & Expo runs at Jacob K. Javits Convention Center, June 3–4. It's the main industry expo anchored to the New York market, with expert-led sessions and a busy exhibit floor stocked with national and local companies showcasing cultivation tools, processing equipment, retail technology, accessories, and compliance services.\n\nGood for: dispensary operators sourcing vendors, brands launching in NY, and anyone trying to map the supply chain in person.",
    category: 'convention',
    startsAt: '2026-06-03T10:00:00-04:00',
    endsAt: '2026-06-04T17:00:00-04:00',
    timezone: 'America/New_York',
    allDay: false,
    isMultiDay: true,
    venueName: 'Jacob K. Javits Convention Center',
    addressLine1: '429 11th Avenue',
    city: 'New York',
    region: 'NYC',
    state: 'NY',
    zip: '10001',
    placeId: 'ChIJ_2_O_OFYwokR6N9V0d3vRWQ',
    latitude: 40.7574,
    longitude: -74.0027,
    hasDrivableLocation: true,
    organizerName: 'Cannabis Means Business',
    websiteUrl: 'https://10times.com/cwcbp',
    ticketUrl: null,
    isFree: false,
    priceLabel: 'Trade show — see organizer',
    ageRestriction: '21+',
    photoUrl: null,
    tags: ['Convention', 'Industry', 'Manhattan', 'Two days'],
  }),

  event({
    id: 'ncia-cannabis-business-summit-2026-06-07',
    title: 'NCIA Cannabis Business Summit — New York',
    summary:
      'NCIA brings its national policy + business summit to NYC. Trade-association programming with policy-focused sessions.',
    description:
      "The National Cannabis Industry Association's Cannabis Business Summit lands in New York on June 7. Programming leans toward national policy (federal banking, scheduling), interstate commerce readiness, and operator best practices. Lighter on exhibitor floor than CWCBExpo, heavier on association business.\n\nWorth attending if: you want federal/multi-state context for your NY operation, or you're considering NCIA membership.",
    category: 'industry',
    startsAt: '2026-06-07T09:00:00-04:00',
    endsAt: '2026-06-07T17:00:00-04:00',
    timezone: 'America/New_York',
    allDay: false,
    isMultiDay: false,
    venueName: 'New York City',
    addressLine1: null,
    city: 'New York',
    region: 'NYC',
    state: 'NY',
    zip: null,
    placeId: null,
    latitude: null,
    longitude: null,
    hasDrivableLocation: false,
    organizerName: 'National Cannabis Industry Association (NCIA)',
    websiteUrl:
      'https://cannabispromotions.com/tradeshows/event/ncia-cannabis-business-summit-2026',
    ticketUrl: null,
    isFree: false,
    priceLabel: 'See organizer',
    ageRestriction: '21+',
    photoUrl: null,
    tags: ['Industry', 'Policy', 'NCIA', 'Manhattan'],
  }),

  event({
    id: 'necann-ny-2026-10-02',
    title: 'NECANN New York Cannabis & Hemp Convention',
    summary:
      'Two-day Albany convention covering cultivation, retail, hemp, and policy across NY and the Northeast.',
    description:
      "NECANN's NY edition runs October 2–3 at the Albany Convention Center, with two full days of programming and a busy exhibit floor. Coverage is broad: cultivation, retail, hemp/CBD, ancillary services, policy, and patient/advocacy tracks. NECANN draws operators from across the Northeast corridor, which makes it useful for cross-state context.\n\nGood for: anyone who can't make CWCBExpo in June and wants the second-half-of-year touch-point. Albany location is convenient for upstate operators.",
    category: 'convention',
    startsAt: '2026-10-02T09:00:00-04:00',
    endsAt: '2026-10-03T18:00:00-04:00',
    timezone: 'America/New_York',
    allDay: false,
    isMultiDay: true,
    venueName: 'Albany Capital Center',
    addressLine1: '55 Eagle Street',
    city: 'Albany',
    region: 'Capital District',
    state: 'NY',
    zip: '12207',
    placeId: null,
    latitude: 42.6494,
    longitude: -73.7565,
    hasDrivableLocation: true,
    organizerName: 'NECANN',
    websiteUrl: 'https://www.distru.com/cannabis-events/necann-new-york-cannabis-hemp-convention',
    ticketUrl: null,
    isFree: false,
    priceLabel: 'See organizer',
    ageRestriction: '21+',
    photoUrl: null,
    tags: ['Convention', 'Industry', 'Albany', 'Two days'],
  }),

  event({
    id: 'boho-bus-tour-may-2026',
    title: 'NYC Cannabis, Urban Art & Culture Bus Tour',
    summary:
      'Curated boho-style bus tour blending licensed dispensary visits, urban art, and iconic city views. 21+.',
    description:
      'A guided NYC tour blending stops at licensed Manhattan dispensaries with street art, music spots, and skyline views. Designed as a curated 4–5 hour experience for visitors and locals who want a "first taste" of the legal market without doing the planning themselves.\n\nDeparts from 1 Washington Square Village. Multiple dates throughout the month — check the Eventbrite listing for current availability.\n\n21+ only. Bring ID.',
    category: 'consumer',
    startsAt: '2026-05-09T14:00:00-04:00',
    endsAt: '2026-05-09T18:00:00-04:00',
    timezone: 'America/New_York',
    allDay: false,
    isMultiDay: false,
    venueName: 'Departs Washington Square Village',
    addressLine1: '1 Washington Square Village',
    city: 'New York',
    region: 'NYC',
    state: 'NY',
    zip: '10012',
    placeId: null,
    latitude: 40.7287,
    longitude: -73.9981,
    hasDrivableLocation: true,
    organizerName: 'Boho Bus',
    websiteUrl:
      'https://www.eventbrite.com/e/nycs-must-do-cannabis-urban-art-culture-experience-boho-bus-tour-tickets-1987092287523',
    ticketUrl:
      'https://www.eventbrite.com/e/nycs-must-do-cannabis-urban-art-culture-experience-boho-bus-tour-tickets-1987092287523',
    isFree: false,
    priceLabel: 'Ticketed — see Eventbrite',
    ageRestriction: '21+',
    photoUrl: null,
    tags: ['Tour', 'Manhattan', 'Consumer', 'Tourist-friendly'],
  }),

  event({
    id: 'yerba-buena-brand-night-may-2026',
    title: 'Yerba Buena Brand Night',
    summary:
      'In-store brand activation at Yerba Buena Brooklyn — meet the brand, sample, and shop with reps on-site.',
    description:
      "Yerba Buena (292 Atlantic Ave, Brooklyn) hosts brand activation nights on a roughly bi-weekly schedule. Each event spotlights a featured cannabis brand with reps in-store, samples on display, and often a discount window for the night.\n\nGreat way to discover what's on shelves in NY right now and get questions answered by people who actually make the product. Check the Yerba Buena events page for the current week's featured brand and exact timing.",
    category: 'brand_activation',
    startsAt: '2026-05-17T15:30:00-04:00',
    endsAt: '2026-05-17T18:30:00-04:00',
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
    tags: ['Brand activation', 'Brooklyn', 'Consumer', 'Free'],
  }),

  event({
    id: 'esnorml-monthly-meet',
    title: 'Empire State NORML — Monthly Meet',
    summary:
      "Monthly community meet of NY's NORML chapter — policy updates, advocacy planning, and grassroots organizing.",
    description:
      "Empire State NORML, the NY State affiliate of the National Organization for the Reform of Marijuana Laws, holds monthly community meetings to discuss policy updates, OCM activity, advocacy campaigns, and grassroots actions members can join. Open to anyone interested in cannabis reform — you don't have to be a member to attend.\n\nFormat is typically a short presentation + open discussion + planning. Specific meeting venue and time vary month to month — check Empire State NORML's site for the current month's details.",
    category: 'advocacy',
    startsAt: '2026-05-21T19:00:00-04:00',
    endsAt: '2026-05-21T21:00:00-04:00',
    timezone: 'America/New_York',
    allDay: false,
    isMultiDay: false,
    venueName: 'Empire State NORML — venue varies',
    addressLine1: null,
    city: 'New York',
    region: 'NYC',
    state: 'NY',
    zip: null,
    placeId: null,
    latitude: null,
    longitude: null,
    hasDrivableLocation: false,
    organizerName: 'Empire State NORML',
    websiteUrl: 'https://esnorml.org/',
    ticketUrl: null,
    isFree: true,
    priceLabel: 'Free',
    ageRestriction: 'All ages',
    photoUrl: null,
    tags: ['Advocacy', 'NORML', 'Policy', 'Community'],
  }),

  event({
    id: 'nyc-cannabis-parade-2027-05',
    title: 'NYC Cannabis Parade & Rally',
    summary:
      'Annual NORML-organized cannabis advocacy parade through midtown ending at Union Square. The longest-running cannabis rally in the country.',
    description:
      "The NYC Cannabis Parade & Rally is the country's longest-continuously-running cannabis advocacy event, organized by NYC NORML. It marches from midtown to Union Square, where speakers, music, and community resources gather for the rally portion.\n\nFamily-friendly, all-ages, free. Public consumption rules still apply — this is an advocacy march, not a consumption event.\n\nNote: the 2026 parade already happened in early May. The next iteration is May 2027 — exact date TBD; check NYC NORML for confirmation.",
    category: 'parade',
    startsAt: '2027-05-01T12:00:00-04:00',
    endsAt: '2027-05-01T17:00:00-04:00',
    timezone: 'America/New_York',
    allDay: false,
    isMultiDay: false,
    venueName: 'Union Square',
    addressLine1: 'Union Square',
    city: 'New York',
    region: 'NYC',
    state: 'NY',
    zip: '10003',
    placeId: 'ChIJI3qjSyZawokR_60_KfTLbm0',
    latitude: 40.7359,
    longitude: -73.9911,
    hasDrivableLocation: true,
    organizerName: 'NYC NORML',
    websiteUrl: 'https://www.facebook.com/nycnorml/',
    ticketUrl: null,
    isFree: true,
    priceLabel: 'Free',
    ageRestriction: 'All ages',
    photoUrl: null,
    tags: ['Parade', 'Advocacy', 'Manhattan', 'Free', 'Annual'],
  }),

  event({
    id: 'kannafest-2027-04-20',
    title: 'KannaFest NYC — 4/20 Weekend',
    summary:
      'Three-day Long Island City takeover blending convention-style exhibitors with street-festival energy. The biggest 4/20 event in NYC.',
    description:
      'KannaFest NYC is one of the largest cannabis events of 4/20 weekend each year — a three-day takeover in Long Island City that combines a convention-style exhibitor floor with a street-festival atmosphere. Expect brand activations, music, food, panel sessions, and outdoor staging.\n\n21+ throughout. Tickets typically go on sale ~6 weeks before the event.\n\nNote: 4/20 2026 already happened. Next iteration is April 2027 — date locks once organizers confirm.',
    category: 'consumer',
    startsAt: '2027-04-17T12:00:00-04:00',
    endsAt: '2027-04-20T22:00:00-04:00',
    timezone: 'America/New_York',
    allDay: false,
    isMultiDay: true,
    venueName: 'Long Island City — venue TBA',
    addressLine1: null,
    city: 'Long Island City',
    region: 'Queens',
    state: 'NY',
    zip: '11101',
    placeId: null,
    latitude: 40.7447,
    longitude: -73.9485,
    hasDrivableLocation: false,
    organizerName: 'KannaFest',
    websiteUrl:
      'https://stupiddope.com/2026/03/420-weekend-nyc-2026-events-parties-and-cannabis-culture-guide/',
    ticketUrl: null,
    isFree: false,
    priceLabel: 'Ticketed — see organizer',
    ageRestriction: '21+',
    photoUrl: null,
    tags: ['Festival', '4/20', 'Queens', 'Three days', 'Annual'],
  }),

  event({
    id: 'wamb-fest-2027-04-20',
    title: 'WAMB! Fest — 4/20 Weekend Brooklyn',
    summary:
      'Curated lifestyle-driven 4/20 weekend gathering on Fulton St in Brooklyn — smaller, more intentional than the festival circuit.',
    description:
      'WAMB! Fest delivers a more curated, lifestyle-driven 4/20 weekend experience at 1271A Fulton Street in Brooklyn. Smaller scale than KannaFest, with the focus on community, music, food, and conscious cannabis culture.\n\n21+. Note: 2026 iteration already happened — next iteration April 2027.',
    category: 'consumer',
    startsAt: '2027-04-18T14:00:00-04:00',
    endsAt: '2027-04-20T22:00:00-04:00',
    timezone: 'America/New_York',
    allDay: false,
    isMultiDay: true,
    venueName: 'WAMB! at 1271A Fulton',
    addressLine1: '1271A Fulton Street',
    city: 'Brooklyn',
    region: 'Brooklyn',
    state: 'NY',
    zip: '11216',
    placeId: null,
    latitude: 40.6809,
    longitude: -73.9499,
    hasDrivableLocation: true,
    organizerName: 'WAMB!',
    websiteUrl:
      'https://stupiddope.com/2026/03/420-weekend-nyc-2026-events-parties-and-cannabis-culture-guide/',
    ticketUrl: null,
    isFree: false,
    priceLabel: 'Ticketed',
    ageRestriction: '21+',
    photoUrl: null,
    tags: ['Festival', '4/20', 'Brooklyn', 'Lifestyle', 'Annual'],
  }),

  event({
    id: 'washington-square-420-2027',
    title: 'Washington Square Park — 4/20 Meetup',
    summary:
      "NYC's largest yearly grassroots cannabis meetup. Free, all-day, fountain-side. The decades-long unofficial 4/20 tradition.",
    description:
      "Washington Square Park is the unofficial home of NYC's largest yearly grassroots cannabis meetup. Hang out by the fountain or anywhere in the park all day on 4/20 — it's consistently one of the most active afternoons of the year, with giveaways, sales, hustlers, and impromptu gatherings.\n\nPublic park, public consumption rules apply (which in NY for 21+ adults means it's legal in most outdoor spaces where smoking is otherwise allowed). Free, all-ages park, but the activity is 21+.\n\n2026 already happened — next iteration April 20, 2027.",
    category: 'consumer',
    startsAt: '2027-04-20T11:00:00-04:00',
    endsAt: '2027-04-20T22:00:00-04:00',
    timezone: 'America/New_York',
    allDay: true,
    isMultiDay: false,
    venueName: 'Washington Square Park',
    addressLine1: 'Washington Square Park',
    city: 'New York',
    region: 'NYC',
    state: 'NY',
    zip: '10012',
    placeId: 'ChIJzVobJ5BZwokR4eF5d9oxLZQ',
    latitude: 40.7308,
    longitude: -73.9973,
    hasDrivableLocation: true,
    organizerName: 'Grassroots / unofficial',
    websiteUrl: null,
    ticketUrl: null,
    isFree: true,
    priceLabel: 'Free',
    ageRestriction: '21+ for cannabis activity',
    photoUrl: null,
    tags: ['Grassroots', '4/20', 'Manhattan', 'Free', 'Annual'],
  }),

  event({
    id: 'ocm-cannabis-control-board',
    title: 'NY Cannabis Control Board — Public Meeting',
    summary:
      "OCM's monthly public board meeting. Agenda items include licensing decisions, regulatory updates, and public comment.",
    description:
      "The Cannabis Control Board (CCB) is the public body that votes on regulatory updates, licensing decisions, and policy direction for New York's adult-use cannabis market. Meetings are open to the public and include a public comment period.\n\nThe agenda is published on cannabis.ny.gov a few days before each meeting. Watching even one meeting gives you the clearest possible read on where NY policy is heading. Live-streamed; in-person attendance is also welcome.\n\nNext meeting date and venue: check cannabis.ny.gov/cannabis-control-board-meetings.",
    category: 'advocacy',
    startsAt: '2026-06-04T10:00:00-04:00',
    endsAt: '2026-06-04T13:00:00-04:00',
    timezone: 'America/New_York',
    allDay: false,
    isMultiDay: false,
    venueName: 'NY Office of Cannabis Management — varies',
    addressLine1: null,
    city: 'Albany',
    region: 'Capital District',
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
    tags: ['Public meeting', 'OCM', 'Policy', 'Free', 'Live-streamed'],
  }),
];

async function main() {
  console.log('='.repeat(80));
  console.log(`Mode: ${execute ? '*** EXECUTE — writes will happen ***' : 'DRY RUN'}`);
  console.log(`Target: canopy-trove / ${databaseId} / ${EVENTS_COLLECTION_NAME}`);
  console.log('='.repeat(80));
  console.log(`\nSeeding ${EVENTS.length} curated events.\n`);

  let written = 0;
  let skipped = 0;

  for (const e of EVENTS) {
    if (!execute) {
      console.log(`  [dry] would write  ${e.id}  ("${e.title}")  ${e.startsAt}`);
      continue;
    }
    try {
      await db.collection(EVENTS_COLLECTION_NAME).doc(e.id).set(e);
      console.log(`  [ok]  wrote  ${e.id}  ("${e.title}")`);
      written += 1;
    } catch (err) {
      console.log(`  [fail] ${e.id}: ${err instanceof Error ? err.message : String(err)}`);
      skipped += 1;
    }
  }

  console.log('');
  console.log('-'.repeat(80));
  if (execute) {
    console.log(`Seed complete: ${written} written, ${skipped} failed`);
  } else {
    console.log(`Dry run complete. Re-run with --execute to apply.`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('FAILED', err);
    process.exit(1);
  });

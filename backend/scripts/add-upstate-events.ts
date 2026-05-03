/* eslint-disable no-console */
// Geographic-spread expansion for the Travel & Events tab.
//
// Per founder feedback (2026-05-04): "Can we do deep research on this and
// see if we can find things for, like, other places. There's nothing for
// upstate New Yorkers."
//
// Added 9 upstate consumer events sourced via WebSearch + venue calendars
// on 2026-05-04:
//   - Hudson Valley (Kingston): 3 brand pop-ups @ Domes Dispensary
//   - Finger Lakes / Ithaca: 5 events from FingerLakes CannaMarket
//   - Statewide: MFNY Riverway Live Rosin Tour (June-July multi-stop)
//
// Default = dry run. Pass `--execute` to apply.
//
//   FIREBASE_DATABASE_ID=canopytrove npx tsx \
//     backend/scripts/add-upstate-events.ts [--execute]

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

function event(partial: Omit<EventDoc, 'createdAt' | 'updatedAt' | 'source' | 'hidden'>): EventDoc {
  return { ...partial, source: 'curated', hidden: false, createdAt: NOW_ISO, updatedAt: NOW_ISO };
}

const NEW_EVENTS: EventDoc[] = [
  // ── Hudson Valley / Kingston ─────────────────────────────────
  event({
    id: 'domes-eureka-popup-2026-05-07',
    title: 'Eureka Brand Pop-up @ Domes Dispensary',
    summary:
      'Featured Eureka brand showcase at Domes Dispensary in Kingston. Sample, learn, and shop with reps on-site.',
    description:
      "Brand pop-up at Domes Dispensary in Kingston featuring Eureka — a chance to sample the line, ask the reps, and pick up product the same afternoon. Domes is right off Exit 19 in Kingston, easy from 87 + 28.\n\nGood weeknight stop if you're in the Hudson Valley.",
    category: 'brand_activation',
    startsAt: '2026-05-07T15:00:00-04:00',
    endsAt: '2026-05-07T17:00:00-04:00',
    timezone: 'America/New_York',
    allDay: false,
    isMultiDay: false,
    venueName: 'Domes Dispensary',
    addressLine1: '268 Forest Hill Drive',
    city: 'Kingston',
    region: 'Hudson Valley',
    state: 'NY',
    zip: '12401',
    placeId: null,
    latitude: 41.9379,
    longitude: -74.0285,
    hasDrivableLocation: true,
    organizerName: 'Domes Dispensary',
    websiteUrl: 'https://www.domesdispensary.com/events/',
    ticketUrl: null,
    isFree: true,
    priceLabel: 'Free entry',
    ageRestriction: '21+',
    photoUrl: null,
    tags: ['Brand activation', 'Hudson Valley', 'Kingston', 'Free', 'Eureka'],
  }),
  event({
    id: 'domes-ruby-farms-popup-2026-05-16',
    title: 'Ruby Farms Pop-up @ Domes Dispensary',
    summary:
      'Saturday brand showcase at Domes Kingston featuring Ruby Farms. Sampling + same-day pickup.',
    description:
      'Saturday afternoon brand pop-up at Domes Dispensary (268 Forest Hill Drive, Kingston) featuring Ruby Farms. Sample the line, talk to the brand reps about their cultivation approach, and pick up product the same day.',
    category: 'brand_activation',
    startsAt: '2026-05-16T16:00:00-04:00',
    endsAt: '2026-05-16T19:00:00-04:00',
    timezone: 'America/New_York',
    allDay: false,
    isMultiDay: false,
    venueName: 'Domes Dispensary',
    addressLine1: '268 Forest Hill Drive',
    city: 'Kingston',
    region: 'Hudson Valley',
    state: 'NY',
    zip: '12401',
    placeId: null,
    latitude: 41.9379,
    longitude: -74.0285,
    hasDrivableLocation: true,
    organizerName: 'Domes Dispensary',
    websiteUrl: 'https://www.domesdispensary.com/events/',
    ticketUrl: null,
    isFree: true,
    priceLabel: 'Free entry',
    ageRestriction: '21+',
    photoUrl: null,
    tags: ['Brand activation', 'Hudson Valley', 'Kingston', 'Free', 'Ruby Farms', 'Saturday'],
  }),
  event({
    id: 'domes-foy-popup-2026-05-29',
    title: 'Foy Brand Pop-up @ Domes Dispensary',
    summary: 'Late-day Foy pop-up in Kingston with a "buy any 20pk, get a 4pk for a penny" promo.',
    description:
      'Foy brand activation at Domes Dispensary in Kingston. The published promo: buy any Foy 20pk and get a Foy 4pk for one cent. Sample the line, talk to reps, and shop the deal the same afternoon.',
    category: 'brand_activation',
    startsAt: '2026-05-29T14:30:00-04:00',
    endsAt: '2026-05-29T18:30:00-04:00',
    timezone: 'America/New_York',
    allDay: false,
    isMultiDay: false,
    venueName: 'Domes Dispensary',
    addressLine1: '268 Forest Hill Drive',
    city: 'Kingston',
    region: 'Hudson Valley',
    state: 'NY',
    zip: '12401',
    placeId: null,
    latitude: 41.9379,
    longitude: -74.0285,
    hasDrivableLocation: true,
    organizerName: 'Domes Dispensary',
    websiteUrl: 'https://www.domesdispensary.com/events/',
    ticketUrl: null,
    isFree: true,
    priceLabel: 'Free entry',
    ageRestriction: '21+',
    photoUrl: null,
    tags: ['Brand activation', 'Hudson Valley', 'Kingston', 'Free', 'Foy', 'Deal'],
  }),

  // ── Finger Lakes / Ithaca ────────────────────────────────────
  event({
    id: 'fl-ithaca-cannamarket-2026-05-09',
    title: 'Ithaca CannaMarket',
    summary:
      'Saturday cannabis marketplace at NRE Space in Ithaca — local growers, brands, and community vendors all in one room.',
    description:
      "FingerLakes CannaMarket's flagship Ithaca event. A Saturday afternoon marketplace where local NY growers, brands, and craft vendors share one space. Browse, taste, talk shop, take stuff home. The community-anchored counterpart to NYC's brand-activation scene.",
    category: 'consumer',
    startsAt: '2026-05-09T12:00:00-04:00',
    endsAt: '2026-05-09T18:00:00-04:00',
    timezone: 'America/New_York',
    allDay: false,
    isMultiDay: false,
    venueName: 'NRE Space',
    addressLine1: null,
    city: 'Ithaca',
    region: 'Finger Lakes',
    state: 'NY',
    zip: '14850',
    placeId: null,
    latitude: 42.4406,
    longitude: -76.4969,
    hasDrivableLocation: true,
    organizerName: 'FingerLakes CannaMarket',
    websiteUrl: 'https://www.fingerlakescannamarket.org/events-1',
    ticketUrl: 'https://www.fingerlakescannamarket.org/events-1',
    isFree: false,
    priceLabel: 'See organizer',
    ageRestriction: '21+',
    photoUrl: null,
    tags: ['Marketplace', 'Finger Lakes', 'Ithaca', 'Saturday', 'Community'],
  }),
  event({
    id: 'fl-joints-and-jokes-2026-05-16',
    title: 'Joints And Jokes — Ithaca Comedy Night',
    summary: 'Saturday-night cannabis comedy at NRE Space in Ithaca. Comics + a lifted crowd. 21+.',
    description:
      "FingerLakes CannaMarket's recurring comedy night at NRE Space in Ithaca. Comics on stage + a lifted crowd in the audience — an honest 21+ comedy room with the cannabis side built in.\n\nIf you're in Ithaca on a Saturday night, this is the move.",
    category: 'consumer',
    startsAt: '2026-05-16T18:00:00-04:00',
    endsAt: '2026-05-16T21:30:00-04:00',
    timezone: 'America/New_York',
    allDay: false,
    isMultiDay: false,
    venueName: 'NRE Space',
    addressLine1: null,
    city: 'Ithaca',
    region: 'Finger Lakes',
    state: 'NY',
    zip: '14850',
    placeId: null,
    latitude: 42.4406,
    longitude: -76.4969,
    hasDrivableLocation: true,
    organizerName: 'FingerLakes CannaMarket',
    websiteUrl: 'https://www.fingerlakescannamarket.org/events-1',
    ticketUrl: 'https://www.fingerlakescannamarket.org/events-1',
    isFree: false,
    priceLabel: 'See organizer',
    ageRestriction: '21+',
    photoUrl: null,
    tags: ['Comedy', 'Finger Lakes', 'Ithaca', 'Saturday', 'Nightlife'],
  }),
  event({
    id: 'fl-floating-session-2026-06-04',
    title: 'The Floating Session — Vape on the Lake',
    summary:
      'Cannabis lake cruise on the Finger Lakes — a chill afternoon-into-evening on the water. 21+.',
    description:
      "FingerLakes CannaMarket's most distinctive event of the summer: a cannabis-friendly lake cruise on one of the Finger Lakes. Boarding mid-afternoon, you spend the next few hours on the water with food, music, and the lake doing what the lake does.\n\nLimited capacity. Ticketed via the organizer.",
    category: 'consumer',
    startsAt: '2026-06-04T17:00:00-04:00',
    endsAt: '2026-06-04T20:00:00-04:00',
    timezone: 'America/New_York',
    allDay: false,
    isMultiDay: false,
    venueName: 'Floating Sessions Lake Cruise',
    addressLine1: null,
    city: 'Ithaca',
    region: 'Finger Lakes',
    state: 'NY',
    zip: '14850',
    placeId: null,
    latitude: 42.4406,
    longitude: -76.4969,
    hasDrivableLocation: true,
    organizerName: 'FingerLakes CannaMarket',
    websiteUrl: 'https://www.fingerlakescannamarket.org/events-1',
    ticketUrl: 'https://www.fingerlakescannamarket.org/events-1',
    isFree: false,
    priceLabel: 'Ticketed — limited capacity',
    ageRestriction: '21+',
    photoUrl: null,
    tags: ['Cruise', 'Finger Lakes', 'Ithaca', 'Summer', 'Outdoor'],
  }),
  event({
    id: 'fl-green-saturday-2026-06-06',
    title: 'Green Saturday @ The Cherry Arts',
    summary:
      'Daytime cannabis market at The Cherry Arts in Ithaca. Local growers + brands + the Cherry Arts venue vibe.',
    description:
      "Daytime cannabis market hosted at The Cherry Arts in Ithaca. The Cherry is one of Ithaca's signature performing arts spaces, and Green Saturday brings the local cannabis community into that environment for an afternoon market.\n\nFamily of growers + brand reps + craft vendors. 21+.",
    category: 'consumer',
    startsAt: '2026-06-06T12:00:00-04:00',
    endsAt: '2026-06-06T17:00:00-04:00',
    timezone: 'America/New_York',
    allDay: false,
    isMultiDay: false,
    venueName: 'The Cherry Arts',
    addressLine1: null,
    city: 'Ithaca',
    region: 'Finger Lakes',
    state: 'NY',
    zip: '14850',
    placeId: null,
    latitude: 42.4406,
    longitude: -76.4969,
    hasDrivableLocation: true,
    organizerName: 'FingerLakes CannaMarket',
    websiteUrl: 'https://www.fingerlakescannamarket.org/events-1',
    ticketUrl: 'https://www.fingerlakescannamarket.org/events-1',
    isFree: false,
    priceLabel: 'See organizer',
    ageRestriction: '21+',
    photoUrl: null,
    tags: ['Marketplace', 'Finger Lakes', 'Ithaca', 'Saturday', 'Arts venue'],
  }),
  event({
    id: 'fl-puff-and-paint-2026-06-20',
    title: 'Puff and Paint — Ithaca',
    summary:
      'Saturday-night creative workshop at NRE Space in Ithaca. Painting, music, and a 21+ vibe.',
    description:
      "FingerLakes CannaMarket's recurring creative workshop. Bring nothing — they supply the canvas, paints, and the relaxed pacing. Music, light snacks, and the kind of room where you actually finish a painting.\n\nGreat for couples, friends, or going solo and meeting people. 21+.",
    category: 'workshop',
    startsAt: '2026-06-20T19:00:00-04:00',
    endsAt: '2026-06-20T22:00:00-04:00',
    timezone: 'America/New_York',
    allDay: false,
    isMultiDay: false,
    venueName: 'NRE Space',
    addressLine1: null,
    city: 'Ithaca',
    region: 'Finger Lakes',
    state: 'NY',
    zip: '14850',
    placeId: null,
    latitude: 42.4406,
    longitude: -76.4969,
    hasDrivableLocation: true,
    organizerName: 'FingerLakes CannaMarket',
    websiteUrl: 'https://www.fingerlakescannamarket.org/events-1',
    ticketUrl: 'https://www.fingerlakescannamarket.org/events-1',
    isFree: false,
    priceLabel: 'Ticketed — see organizer',
    ageRestriction: '21+',
    photoUrl: null,
    tags: ['Workshop', 'Finger Lakes', 'Ithaca', 'Saturday', 'Creative'],
  }),

  // ── Statewide multi-stop ─────────────────────────────────────
  event({
    id: 'mfny-riverway-rosin-tour-2026-06',
    title: 'MFNY Riverway Live Rosin Tour — Multi-stop',
    summary:
      "Marijuana Farms NY's solventless live rosin tour, June through July, with stops from Binghamton to Brooklyn. Tied to OIL Day (7/10).",
    description:
      "Marijuana Farms New York (MFNY) — one of NY's top single-source operators — is taking their new Riverway Live Rosin line on the road June through July, kicking off a multi-stop tour leading up to OIL Day (7/10).\n\nStops include dispensaries across the Hudson Valley, Brooklyn, and Binghamton. Each stop features the brand reps, samples of the line, and the chance to learn how live rosin extraction actually works.\n\nCheck the MFNY blog for the latest stop list — the tour is announced rolling.",
    category: 'brand_activation',
    startsAt: '2026-06-15T12:00:00-04:00',
    endsAt: '2026-07-10T20:00:00-04:00',
    timezone: 'America/New_York',
    allDay: false,
    isMultiDay: true,
    venueName: 'Multiple NY dispensaries — see MFNY blog for stops',
    addressLine1: null,
    city: 'New York',
    region: 'Statewide',
    state: 'NY',
    zip: null,
    placeId: null,
    latitude: null,
    longitude: null,
    hasDrivableLocation: false,
    organizerName: 'Marijuana Farms New York (MFNY)',
    websiteUrl: 'https://www.mfny.co/blog-posts/riverway-tm-live-rosin-tour-for-oil-day',
    ticketUrl: null,
    isFree: true,
    priceLabel: 'Free at participating dispensaries',
    ageRestriction: '21+',
    photoUrl: null,
    tags: ['Brand activation', 'Statewide', 'Tour', 'Live rosin', 'Multi-day', 'OIL Day'],
  }),
];

async function main() {
  console.log('='.repeat(80));
  console.log(`Mode: ${execute ? '*** EXECUTE — writes will happen ***' : 'DRY RUN'}`);
  console.log(`Target: canopy-trove / ${databaseId} / ${EVENTS_COLLECTION_NAME}`);
  console.log('='.repeat(80));
  console.log(`\nAdding ${NEW_EVENTS.length} upstate / multi-region events:\n`);

  for (const e of NEW_EVENTS) {
    const where = `${e.city}${e.region ? ' (' + e.region + ')' : ''}`;
    if (!execute) {
      console.log(`  [dry] would write   ${e.id.padEnd(50)}  ${where.padEnd(28)}  ${e.startsAt}`);
      continue;
    }
    try {
      await db.collection(EVENTS_COLLECTION_NAME).doc(e.id).set(e);
      console.log(`  [ok]  wrote       ${e.id.padEnd(50)}  ${where.padEnd(28)}  ${e.startsAt}`);
    } catch (err) {
      console.log(`  [fail] ${e.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log('');
  console.log('-'.repeat(80));
  if (execute) {
    console.log(`Done. ${NEW_EVENTS.length} upstate events added.`);
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

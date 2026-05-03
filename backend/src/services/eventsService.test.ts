import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';

const firebaseModulePath = require.resolve('../firebase');
const eventsServicePath = require.resolve('./eventsService');

const originalFirebaseCache = require.cache[firebaseModulePath];

function setCachedModule(modulePath: string, exports: unknown) {
  require.cache[modulePath] = {
    id: modulePath,
    filename: modulePath,
    loaded: true,
    exports,
    children: [],
    path: modulePath,
  } as unknown as NodeJS.Module;
}

function setFirestoreUnavailable() {
  setCachedModule(firebaseModulePath, { getBackendFirebaseDb: () => null });
}

function loadFreshService() {
  delete require.cache[eventsServicePath];
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('./eventsService') as typeof import('./eventsService');
}

function makeEvent(overrides: Partial<import('./eventsService').EventDoc> = {}) {
  const now = '2026-05-03T22:00:00-04:00';
  return {
    id: 'event-1',
    title: 'Test Event',
    summary: 'A summary',
    description: 'A long description',
    category: 'consumer' as const,
    startsAt: '2026-05-15T18:00:00-04:00',
    endsAt: '2026-05-15T22:00:00-04:00',
    timezone: 'America/New_York',
    allDay: false,
    isMultiDay: false,
    venueName: 'Test Venue',
    addressLine1: '123 Main St',
    city: 'New York',
    region: 'NYC',
    state: 'NY',
    zip: '10001',
    placeId: null,
    latitude: 40.75,
    longitude: -73.99,
    hasDrivableLocation: true,
    organizerName: 'Org',
    websiteUrl: null,
    ticketUrl: null,
    isFree: true,
    priceLabel: 'Free',
    ageRestriction: '21+',
    photoUrl: null,
    tags: ['test'],
    source: 'curated' as const,
    hidden: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

beforeEach(() => {
  setFirestoreUnavailable();
});

afterEach(() => {
  if (originalFirebaseCache) require.cache[firebaseModulePath] = originalFirebaseCache;
  else delete require.cache[firebaseModulePath];
  delete require.cache[eventsServicePath];
});

test('listEvents returns empty when no events seeded', async () => {
  const service = loadFreshService();
  service.__resetEventsForTests();
  const result = await service.listEvents();
  assert.deepEqual(result, { items: [], total: 0 });
});

test('listEvents default filter "upcoming" hides past events', async () => {
  const service = loadFreshService();
  service.__setEventsForTests([
    makeEvent({
      id: 'past-1',
      startsAt: '2026-04-01T18:00:00-04:00',
      endsAt: '2026-04-01T22:00:00-04:00',
    }),
    makeEvent({
      id: 'future-1',
      startsAt: '2026-06-01T18:00:00-04:00',
      endsAt: '2026-06-01T22:00:00-04:00',
    }),
  ]);
  const result = await service.listEvents({ now: '2026-05-15T00:00:00-04:00' });
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0]!.id, 'future-1');
});

test('listEvents with filter "past" returns only past events, sorted most-recent-first', async () => {
  const service = loadFreshService();
  service.__setEventsForTests([
    makeEvent({
      id: 'p1',
      startsAt: '2026-03-01T18:00:00-04:00',
      endsAt: '2026-03-01T22:00:00-04:00',
    }),
    makeEvent({
      id: 'p2',
      startsAt: '2026-04-01T18:00:00-04:00',
      endsAt: '2026-04-01T22:00:00-04:00',
    }),
    makeEvent({
      id: 'f1',
      startsAt: '2026-06-01T18:00:00-04:00',
      endsAt: '2026-06-01T22:00:00-04:00',
    }),
  ]);
  const result = await service.listEvents({ filter: 'past', now: '2026-05-15T00:00:00-04:00' });
  assert.equal(result.items.length, 2);
  assert.equal(result.items[0]!.id, 'p2'); // more recent first
  assert.equal(result.items[1]!.id, 'p1');
});

test('listEvents upcoming sorts soonest-first', async () => {
  const service = loadFreshService();
  service.__setEventsForTests([
    makeEvent({
      id: 'late',
      startsAt: '2026-08-01T18:00:00-04:00',
      endsAt: '2026-08-01T22:00:00-04:00',
    }),
    makeEvent({
      id: 'early',
      startsAt: '2026-06-01T18:00:00-04:00',
      endsAt: '2026-06-01T22:00:00-04:00',
    }),
    makeEvent({
      id: 'mid',
      startsAt: '2026-07-01T18:00:00-04:00',
      endsAt: '2026-07-01T22:00:00-04:00',
    }),
  ]);
  const result = await service.listEvents({ now: '2026-05-15T00:00:00-04:00' });
  assert.deepEqual(
    result.items.map((e) => e.id),
    ['early', 'mid', 'late'],
  );
});

test('listEvents respects limit cap', async () => {
  const service = loadFreshService();
  service.__setEventsForTests(
    Array.from({ length: 50 }, (_, i) =>
      makeEvent({
        id: `e${i}`,
        startsAt: `2026-06-${String((i % 28) + 1).padStart(2, '0')}T18:00:00-04:00`,
        endsAt: `2026-06-${String((i % 28) + 1).padStart(2, '0')}T22:00:00-04:00`,
      }),
    ),
  );
  const result = await service.listEvents({ limit: 10, now: '2026-05-15T00:00:00-04:00' });
  assert.equal(result.items.length, 10);
  assert.equal(result.total, 50);
});

test('listEvents excludes hidden events', async () => {
  const service = loadFreshService();
  service.__setEventsForTests([
    makeEvent({ id: 'visible', hidden: false }),
    makeEvent({ id: 'hidden', hidden: true }),
  ]);
  const result = await service.listEvents({ now: '2026-05-01T00:00:00-04:00' });
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0]!.id, 'visible');
});

test('listEvents filter "all" includes both past and upcoming', async () => {
  const service = loadFreshService();
  service.__setEventsForTests([
    makeEvent({
      id: 'past',
      startsAt: '2026-01-01T18:00:00-04:00',
      endsAt: '2026-01-01T22:00:00-04:00',
    }),
    makeEvent({
      id: 'future',
      startsAt: '2026-08-01T18:00:00-04:00',
      endsAt: '2026-08-01T22:00:00-04:00',
    }),
  ]);
  const result = await service.listEvents({ filter: 'all', now: '2026-05-15T00:00:00-04:00' });
  assert.equal(result.items.length, 2);
});

test('getEventById returns the seeded event', async () => {
  const service = loadFreshService();
  service.__setEventsForTests([makeEvent({ id: 'cwcb-2026' })]);
  const event = await service.getEventById('cwcb-2026');
  assert.ok(event);
  assert.equal(event!.id, 'cwcb-2026');
});

test('getEventById returns null for missing id', async () => {
  const service = loadFreshService();
  service.__setEventsForTests([makeEvent({ id: 'cwcb-2026' })]);
  const event = await service.getEventById('does-not-exist');
  assert.equal(event, null);
});

test('upsertEvent then getEventById round-trips', async () => {
  const service = loadFreshService();
  service.__resetEventsForTests();
  await service.upsertEvent(makeEvent({ id: 'roundtrip' }));
  const event = await service.getEventById('roundtrip');
  assert.ok(event);
  assert.equal(event!.title, 'Test Event');
});

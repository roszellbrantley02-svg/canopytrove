import { EVENTS_COLLECTION_NAME } from '../constants/collections';
import { getBackendFirebaseDb } from '../firebase';
import { logger } from '../observability/logger';

// Travel & Events tab data layer. Reads from a curated `events` Firestore
// collection (seeded by backend/scripts/seed-cannabis-events.ts and, in a
// later phase, also written by the owner portal). Pure server-side; the
// frontend hits GET /events for the list and GET /events/:id for detail.
//
// Schema lives here as `EventDoc`. Keep it backwards-compatible — every
// added field should be optional so older docs continue to parse.

export type EventCategory =
  | 'industry'
  | 'consumer'
  | 'advocacy'
  | 'parade'
  | 'convention'
  | 'brand_activation'
  | 'workshop'
  | 'other';

export type EventDoc = {
  id: string;
  title: string;
  /** 1–2 sentence card-friendly tagline. Renders below the title on the summary card. */
  summary: string;
  /** Long-form body for the detail screen. Plain text with paragraph breaks. */
  description: string;
  category: EventCategory;
  /** ISO 8601 with timezone offset, e.g. 2026-05-13T12:00:00-04:00 */
  startsAt: string;
  /** ISO 8601 with timezone offset. Equal to startsAt for single-moment events. */
  endsAt: string;
  /** IANA tz id, e.g. America/New_York. Used for "today/tomorrow" rendering. */
  timezone: string;
  allDay: boolean;
  /** Multi-day events render the date range; single-day shows date + time window. */
  isMultiDay: boolean;

  // Location
  venueName: string;
  addressLine1: string | null;
  city: string | null;
  region: string | null;
  state: string | null;
  zip: string | null;
  /** Google Place ID when available — yields the cleanest "open in Maps" deep-link. */
  placeId: string | null;
  latitude: number | null;
  longitude: number | null;
  /** True when we have enough address signal to drive there. Drives the "Drive there" button. */
  hasDrivableLocation: boolean;

  // Meta
  organizerName: string | null;
  websiteUrl: string | null;
  ticketUrl: string | null;
  isFree: boolean;
  /** Free-text price label, e.g. "Free", "$25", "$50–$200". Renders as a chip. */
  priceLabel: string | null;
  /** Free-text age restriction, e.g. "21+", "18+", "All ages". */
  ageRestriction: string | null;
  /** Optional hero image (https URL). Square or landscape. */
  photoUrl: string | null;
  /** Up to ~6 short tags, used for chips on the detail page. */
  tags: string[];

  // System
  /** 'curated' for hand-seeded; 'owner_submitted' for portal entries; 'imported' for future scrapers. */
  source: 'curated' | 'owner_submitted' | 'imported';
  /** When set, the event is excluded from list responses. Soft-delete. */
  hidden: boolean;
  createdAt: string;
  updatedAt: string;
};

export type EventListResult = {
  items: EventDoc[];
  total: number;
};

function getEventsCollection() {
  const db = getBackendFirebaseDb();
  if (!db) return null;
  return db.collection(EVENTS_COLLECTION_NAME);
}

function normalizeEvent(raw: Record<string, unknown> | undefined): EventDoc | null {
  if (!raw) return null;
  if (typeof raw.id !== 'string' || !raw.id) return null;
  if (typeof raw.title !== 'string' || !raw.title) return null;
  if (typeof raw.startsAt !== 'string' || !raw.startsAt) return null;

  return {
    id: raw.id,
    title: raw.title,
    summary: typeof raw.summary === 'string' ? raw.summary : '',
    description: typeof raw.description === 'string' ? raw.description : '',
    category: (typeof raw.category === 'string' ? raw.category : 'other') as EventCategory,
    startsAt: raw.startsAt,
    endsAt: typeof raw.endsAt === 'string' ? raw.endsAt : raw.startsAt,
    timezone: typeof raw.timezone === 'string' ? raw.timezone : 'America/New_York',
    allDay: raw.allDay === true,
    isMultiDay: raw.isMultiDay === true,

    venueName: typeof raw.venueName === 'string' ? raw.venueName : '',
    addressLine1: typeof raw.addressLine1 === 'string' ? raw.addressLine1 : null,
    city: typeof raw.city === 'string' ? raw.city : null,
    region: typeof raw.region === 'string' ? raw.region : null,
    state: typeof raw.state === 'string' ? raw.state : null,
    zip: typeof raw.zip === 'string' ? raw.zip : null,
    placeId: typeof raw.placeId === 'string' ? raw.placeId : null,
    latitude: typeof raw.latitude === 'number' ? raw.latitude : null,
    longitude: typeof raw.longitude === 'number' ? raw.longitude : null,
    hasDrivableLocation:
      raw.hasDrivableLocation === true ||
      typeof raw.addressLine1 === 'string' ||
      typeof raw.placeId === 'string',

    organizerName: typeof raw.organizerName === 'string' ? raw.organizerName : null,
    websiteUrl: typeof raw.websiteUrl === 'string' ? raw.websiteUrl : null,
    ticketUrl: typeof raw.ticketUrl === 'string' ? raw.ticketUrl : null,
    isFree: raw.isFree === true,
    priceLabel: typeof raw.priceLabel === 'string' ? raw.priceLabel : null,
    ageRestriction: typeof raw.ageRestriction === 'string' ? raw.ageRestriction : null,
    photoUrl: typeof raw.photoUrl === 'string' ? raw.photoUrl : null,
    tags: Array.isArray(raw.tags) ? raw.tags.filter((t): t is string => typeof t === 'string') : [],

    source: (typeof raw.source === 'string' ? raw.source : 'curated') as EventDoc['source'],
    hidden: raw.hidden === true,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date(0).toISOString(),
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date(0).toISOString(),
  };
}

// In-memory fallback for environments without Firestore (tests, local dev
// without credentials). Tests can preload this via __setEventsForTests.
const inMemoryEvents = new Map<string, EventDoc>();

export function __setEventsForTests(events: EventDoc[]) {
  inMemoryEvents.clear();
  for (const e of events) inMemoryEvents.set(e.id, e);
}

export function __resetEventsForTests() {
  inMemoryEvents.clear();
}

export type ListEventsOptions = {
  /** 'upcoming' = endsAt >= now; 'past' = endsAt < now; 'all' = no filter. Default 'upcoming'. */
  filter?: 'upcoming' | 'past' | 'all';
  /** Max items to return. Defaults to 100; cap 200. */
  limit?: number;
  /** ISO datetime to use as "now" — defaults to current server time. Test-injectable. */
  now?: string;
};

export async function listEvents(options: ListEventsOptions = {}): Promise<EventListResult> {
  const filter = options.filter ?? 'upcoming';
  const limit = Math.min(Math.max(options.limit ?? 100, 1), 200);
  const nowIso = options.now ?? new Date().toISOString();

  const all = await loadAllEvents();
  const visible = all.filter((e) => !e.hidden);

  let scoped: EventDoc[];
  if (filter === 'upcoming') {
    scoped = visible.filter((e) => (e.endsAt ?? e.startsAt) >= nowIso);
  } else if (filter === 'past') {
    scoped = visible.filter((e) => (e.endsAt ?? e.startsAt) < nowIso);
  } else {
    scoped = visible;
  }

  // Sort: upcoming and "all" → soonest first; past → most recent first.
  scoped.sort((a, b) => {
    const aT = a.startsAt;
    const bT = b.startsAt;
    if (filter === 'past') return aT < bT ? 1 : -1;
    return aT < bT ? -1 : 1;
  });

  return {
    items: scoped.slice(0, limit),
    total: scoped.length,
  };
}

export async function getEventById(eventId: string): Promise<EventDoc | null> {
  const collection = getEventsCollection();
  if (collection) {
    const snap = await collection.doc(eventId).get();
    if (!snap.exists) return null;
    return normalizeEvent({ id: snap.id, ...(snap.data() as Record<string, unknown>) });
  }
  return inMemoryEvents.get(eventId) ?? null;
}

async function loadAllEvents(): Promise<EventDoc[]> {
  const collection = getEventsCollection();
  if (collection) {
    try {
      const snap = await collection.get();
      return snap.docs
        .map((doc) => normalizeEvent({ id: doc.id, ...(doc.data() as Record<string, unknown>) }))
        .filter((e): e is EventDoc => e !== null);
    } catch (err) {
      logger.warn('[eventsService] failed to load events from Firestore', {
        message: err instanceof Error ? err.message : String(err),
      });
      return Array.from(inMemoryEvents.values());
    }
  }
  return Array.from(inMemoryEvents.values());
}

export async function upsertEvent(event: EventDoc): Promise<EventDoc> {
  const collection = getEventsCollection();
  if (collection) {
    await collection.doc(event.id).set(event);
    return event;
  }
  inMemoryEvents.set(event.id, event);
  return event;
}

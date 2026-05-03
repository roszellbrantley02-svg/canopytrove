// Travel & Events types — mirrors backend/src/services/eventsService.ts
// EventDoc shape. Keep field names in sync; the backend ships these
// directly across the wire as JSON.

export type EventCategory =
  | 'industry'
  | 'consumer'
  | 'advocacy'
  | 'parade'
  | 'convention'
  | 'brand_activation'
  | 'workshop'
  | 'other';

export type EventSource = 'curated' | 'owner_submitted' | 'imported';

export type CanopyEvent = {
  id: string;
  title: string;
  summary: string;
  description: string;
  category: EventCategory;
  startsAt: string;
  endsAt: string;
  timezone: string;
  allDay: boolean;
  isMultiDay: boolean;

  venueName: string;
  addressLine1: string | null;
  city: string | null;
  region: string | null;
  state: string | null;
  zip: string | null;
  placeId: string | null;
  latitude: number | null;
  longitude: number | null;
  hasDrivableLocation: boolean;

  organizerName: string | null;
  websiteUrl: string | null;
  ticketUrl: string | null;
  isFree: boolean;
  priceLabel: string | null;
  ageRestriction: string | null;
  photoUrl: string | null;
  tags: string[];

  source: EventSource;
  hidden: boolean;
  createdAt: string;
  updatedAt: string;
};

export type EventListResponse = {
  ok: true;
  items: CanopyEvent[];
  total: number;
};

export type EventDetailResponse = {
  ok: true;
  event: CanopyEvent;
};

export type EventErrorResponse = {
  ok: false;
  code: string;
  error: string;
};

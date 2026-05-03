import { Linking, Platform } from 'react-native';
import type { CanopyEvent, EventDetailResponse, EventListResponse } from '../types/events';
import { requestJson } from './storefrontBackendHttp';

// Frontend client for the Travel & Events tab. Hits the backend's
// public read-only routes (no auth, CDN-cached). The Drive-there helper
// builds platform-correct maps URLs from event coordinates / address.

export type ListEventsFilter = 'upcoming' | 'past' | 'all';

export async function listCanopyEvents(
  options: {
    filter?: ListEventsFilter;
    limit?: number;
  } = {},
): Promise<{ items: CanopyEvent[]; total: number }> {
  const params = new URLSearchParams();
  if (options.filter) params.set('filter', options.filter);
  if (options.limit) params.set('limit', String(options.limit));
  const query = params.toString();
  const path = query ? `/events?${query}` : '/events';
  const res = await requestJson<EventListResponse>(path);
  return { items: res.items, total: res.total };
}

export async function getCanopyEventById(eventId: string): Promise<CanopyEvent | null> {
  try {
    const res = await requestJson<EventDetailResponse>(`/events/${encodeURIComponent(eventId)}`);
    return res.event;
  } catch {
    return null;
  }
}

// Build the best available "drive there" URL for an event. Mirrors the
// platform conventions used by services/navigationService.ts for storefronts:
// - iOS:     http://maps.apple.com/?daddr=...
// - Android: geo:0,0?q=...
// - web:     google.com/maps/dir/?api=1&destination=...
//
// Returns null when the event has no drivable signal (no address, no place
// id, no coordinates) so the caller can hide the button.
export function buildEventDirectionsUrl(event: CanopyEvent): string | null {
  if (!event.hasDrivableLocation) {
    // belt + suspenders: also enforce we have something to navigate to
    if (
      !event.addressLine1 &&
      !event.placeId &&
      (event.latitude == null || event.longitude == null)
    ) {
      return null;
    }
  }

  const addressFragments = [event.addressLine1, event.city, event.state, event.zip].filter(
    (s): s is string => Boolean(s && s.trim()),
  );
  const addressString = addressFragments.length ? addressFragments.join(', ') : event.venueName;
  const encoded = encodeURIComponent(addressString);

  if (Platform.OS === 'ios') {
    if (event.placeId) {
      // Apple Maps doesn't accept Google place IDs — fall through to address.
    }
    return `http://maps.apple.com/?daddr=${encoded}&dirflg=d`;
  }

  if (Platform.OS === 'android') {
    return `geo:0,0?q=${encoded}`;
  }

  // Web (and any other platform) — Google Maps directions URL.
  if (event.placeId) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encoded}&destination_place_id=${encodeURIComponent(event.placeId)}`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${encoded}`;
}

export async function openEventDirections(event: CanopyEvent): Promise<boolean> {
  const url = buildEventDirectionsUrl(event);
  if (!url) return false;
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

import {
  GOOGLE_MAPS_API_KEY,
  hasGooglePlacesConfig,
  markGooglePlacesConfigHealthy,
  markGooglePlacesConfigTemporarilyUnavailable,
  REQUEST_TIMEOUT_MS,
} from './googlePlacesShared';

function isAllowedGooglePlacesUrl(url: string) {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.protocol === 'https:' && parsedUrl.hostname === 'places.googleapis.com';
  } catch {
    return false;
  }
}

export async function requestGoogleJson<T>(
  url: string,
  init: RequestInit,
  fieldMask: string,
): Promise<T | null> {
  if (!GOOGLE_MAPS_API_KEY || !hasGooglePlacesConfig()) {
    return null;
  }

  if (!isAllowedGooglePlacesUrl(url)) {
    return null;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    const headers = new Headers(init.headers);
    headers.set('Content-Type', 'application/json');
    headers.set('X-Goog-Api-Key', GOOGLE_MAPS_API_KEY);
    headers.set('X-Goog-FieldMask', fieldMask);

    const response = await fetch(url, {
      ...init,
      headers,
      signal: controller.signal,
    });
    if (!response.ok) {
      if (
        response.status === 401 ||
        response.status === 403 ||
        response.status === 429 ||
        response.status >= 500
      ) {
        markGooglePlacesConfigTemporarilyUnavailable(response.status);
      }
      return null;
    }

    const payload = (await response.json()) as T;
    markGooglePlacesConfigHealthy();
    return payload;
  } catch {
    markGooglePlacesConfigTemporarilyUnavailable(null);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

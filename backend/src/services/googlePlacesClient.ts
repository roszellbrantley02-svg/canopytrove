import {
  disableGooglePlacesConfig,
  GOOGLE_MAPS_API_KEY,
  hasGooglePlacesConfig,
  REQUEST_TIMEOUT_MS,
} from './googlePlacesShared';

export async function requestGoogleJson<T>(
  url: string,
  init: RequestInit,
  fieldMask: string
): Promise<T | null> {
  if (!GOOGLE_MAPS_API_KEY || !hasGooglePlacesConfig()) {
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
      if (response.status === 400 || response.status === 401 || response.status === 403) {
        disableGooglePlacesConfig();
      }
      return null;
    }

    return (await response.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

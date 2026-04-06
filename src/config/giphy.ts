/**
 * GIPHY configuration.
 *
 * The GIPHY API key is kept server-side only (backend gateway pattern).
 * The client calls /giphy/trending and /giphy/search on the backend,
 * which proxies to GIPHY using the key stored in GIPHY_API_KEY env var
 * on Cloud Run. This avoids exposing the API key in client bundles.
 *
 * hasGiphyConfig indicates whether the backend gateway is expected to
 * be available. When false, the app falls back to a built-in GIF catalog.
 */
export const giphyApiKey = null;
export const hasGiphyConfig = false;

import { Router } from 'express';
import { logger } from '../observability/logger';

const GIPHY_BASE_URL = 'https://api.giphy.com/v1/gifs';
const GIPHY_LIMIT = 18;

function getGiphyApiKey(): string | null {
  return process.env.GIPHY_API_KEY?.trim() || null;
}

export const giphyGatewayRoutes = Router();

giphyGatewayRoutes.get('/giphy/trending', async (_request, response) => {
  const apiKey = getGiphyApiKey();
  if (!apiKey) {
    response.status(503).json({ error: 'GIPHY service is not configured.' });
    return;
  }

  try {
    const params = new URLSearchParams({
      api_key: apiKey,
      rating: 'g',
      limit: String(GIPHY_LIMIT),
      bundle: 'messaging_non_clips',
    });

    const giphyResponse = await fetch(`${GIPHY_BASE_URL}/trending?${params.toString()}`);
    if (!giphyResponse.ok) {
      response.status(giphyResponse.status).json({ error: 'GIPHY request failed.' });
      return;
    }

    const data = await giphyResponse.json();
    response.json(data);
  } catch (error) {
    logger.error('GIPHY trending gateway error', {
      error: error instanceof Error ? error.message : String(error),
    });
    response.status(500).json({ error: 'GIPHY gateway request failed.' });
  }
});

giphyGatewayRoutes.get('/giphy/search', async (request, response) => {
  const apiKey = getGiphyApiKey();
  if (!apiKey) {
    response.status(503).json({ error: 'GIPHY service is not configured.' });
    return;
  }

  const query = typeof request.query.q === 'string' ? request.query.q.trim().slice(0, 50) : '';
  if (!query) {
    response.status(400).json({ error: 'Search query is required.' });
    return;
  }

  try {
    const params = new URLSearchParams({
      api_key: apiKey,
      rating: 'g',
      limit: String(GIPHY_LIMIT),
      bundle: 'messaging_non_clips',
      q: query,
      lang: 'en',
    });

    const giphyResponse = await fetch(`${GIPHY_BASE_URL}/search?${params.toString()}`);
    if (!giphyResponse.ok) {
      response.status(giphyResponse.status).json({ error: 'GIPHY search failed.' });
      return;
    }

    const data = await giphyResponse.json();
    response.json(data);
  } catch (error) {
    logger.error('GIPHY search gateway error', {
      error: error instanceof Error ? error.message : String(error),
    });
    response.status(500).json({ error: 'GIPHY gateway request failed.' });
  }
});

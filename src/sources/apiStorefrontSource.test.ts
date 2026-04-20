import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getCanopyTroveStorefrontReadIdToken = vi.fn();

vi.mock('react-native', () => ({
  Platform: { OS: 'android' },
}));

vi.mock('../services/canopyTroveAuthService', () => ({
  getCanopyTroveStorefrontReadIdToken,
}));

describe('apiStorefrontSource', () => {
  beforeEach(() => {
    vi.resetModules();
    getCanopyTroveStorefrontReadIdToken.mockReset();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('falls back to guest storefront reads when auth token refresh fails', async () => {
    getCanopyTroveStorefrontReadIdToken.mockRejectedValueOnce(new Error('token refresh failed'));
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [],
        total: 0,
        limit: 8,
        offset: 0,
      }),
    } as Response);

    const { apiStorefrontSource } = await import('./apiStorefrontSource');

    await expect(
      apiStorefrontSource.getSummaryPage({
        areaId: 'all',
        searchQuery: '',
        origin: { latitude: 40.7128, longitude: -74.006 },
      }),
    ).resolves.toMatchObject({
      items: [],
      total: 0,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      headers: expect.any(Headers),
    });

    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Headers;
    expect(headers.has('Authorization')).toBe(false);
    expect(headers.get('X-Client-Platform')).toBe('android');
  });

  it('does not send the areaId sentinel for statewide browse queries', async () => {
    getCanopyTroveStorefrontReadIdToken.mockResolvedValueOnce(null);
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [],
        total: 0,
        limit: 8,
        offset: 0,
      }),
    } as Response);

    const { apiStorefrontSource } = await import('./apiStorefrontSource');

    await apiStorefrontSource.getSummaryPage({
      areaId: 'all',
      searchQuery: '',
      origin: { latitude: 40.7128, longitude: -74.006 },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const requestUrl = String(fetchMock.mock.calls[0]?.[0] ?? '');
    expect(requestUrl).toContain('storefront-summaries');
    expect(requestUrl).not.toContain('areaId=all');
  });

  it('sends the member auth token when a public storefront read is member-scoped', async () => {
    getCanopyTroveStorefrontReadIdToken.mockResolvedValueOnce('member-token');
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [],
        total: 0,
        limit: 8,
        offset: 0,
      }),
    } as Response);

    const { apiStorefrontSource } = await import('./apiStorefrontSource');

    await apiStorefrontSource.getSummaryPage({
      areaId: 'nyc',
      searchQuery: '',
      origin: { latitude: 40.7128, longitude: -74.006 },
    });

    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Headers;
    expect(headers.get('Authorization')).toBe('Bearer member-token');
  });

  it('retries a transient 503 response before surfacing an error', async () => {
    getCanopyTroveStorefrontReadIdToken.mockResolvedValue(null);
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [],
          total: 0,
          limit: 8,
          offset: 0,
        }),
      } as Response);

    const { apiStorefrontSource } = await import('./apiStorefrontSource');

    await expect(
      apiStorefrontSource.getSummaryPage({
        areaId: 'nyc',
        searchQuery: '',
        origin: { latitude: 40.7128, longitude: -74.006 },
      }),
    ).resolves.toMatchObject({
      items: [],
      total: 0,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

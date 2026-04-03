import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getCanopyTroveAuthIdToken = vi.fn();

vi.mock('../services/canopyTroveAuthService', () => ({
  getCanopyTroveAuthIdToken,
}));

describe('apiStorefrontSource', () => {
  beforeEach(() => {
    vi.resetModules();
    getCanopyTroveAuthIdToken.mockReset();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('falls back to guest storefront reads when auth token refresh fails', async () => {
    getCanopyTroveAuthIdToken.mockRejectedValueOnce(new Error('token refresh failed'));
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
  });

  it('does not send the areaId sentinel for statewide browse queries', async () => {
    getCanopyTroveAuthIdToken.mockResolvedValueOnce(null);
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
});

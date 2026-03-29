const baseUrl = process.env.CANOPYTROVE_BENCHMARK_BASE_URL || 'http://127.0.0.1:4100';

function buildUrl(pathname, searchParams = {}) {
  const url = new URL(pathname, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);
  Object.entries(searchParams).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });
  return url.toString();
}

async function measure(label, pathname, searchParams) {
  const url = buildUrl(pathname, searchParams);
  const startedAt = performance.now();
  const response = await fetch(url);
  const elapsedMs = performance.now() - startedAt;
  const serverMs = response.headers.get('X-CanopyTrove-Response-Time-Ms');
  const payload = await response.json();

  return {
    label,
    status: response.status,
    elapsedMs: Number(elapsedMs.toFixed(1)),
    serverMs: serverMs ? Number(serverMs) : null,
    itemCount: Array.isArray(payload?.items) ? payload.items.length : null,
    total: typeof payload?.total === 'number' ? payload.total : null,
    url,
  };
}

function printResult(result) {
  const serverPart = result.serverMs === null ? 'n/a' : `${result.serverMs.toFixed(1)}ms`;
  const itemPart =
    result.itemCount === null
      ? ''
      : ` items=${result.itemCount}${typeof result.total === 'number' ? ` total=${result.total}` : ''}`;
  console.log(
    `${result.label.padEnd(28)} status=${result.status} client=${result.elapsedMs.toFixed(1)}ms server=${serverPart}${itemPart}`
  );
}

async function run() {
  const scenarios = [
    {
      label: 'health',
      pathname: '/health',
      searchParams: {},
    },
    {
      label: 'nearby cold',
      pathname: '/storefront-summaries',
      searchParams: {
        areaId: 'finger-lakes',
        originLat: 43.2174,
        originLng: -76.8148,
        radiusMiles: 35,
        sortKey: 'distance',
        limit: 3,
        offset: 0,
      },
    },
    {
      label: 'nearby warm',
      pathname: '/storefront-summaries',
      searchParams: {
        areaId: 'finger-lakes',
        originLat: 43.2174,
        originLng: -76.8148,
        radiusMiles: 35,
        sortKey: 'distance',
        limit: 3,
        offset: 0,
      },
    },
    {
      label: 'browse p1 cold',
      pathname: '/storefront-summaries',
      searchParams: {
        areaId: 'rochester',
        originLat: 43.2174,
        originLng: -76.8148,
        radiusMiles: 160,
        sortKey: 'distance',
        limit: 8,
        offset: 0,
        searchQuery: 'dispensary',
      },
    },
    {
      label: 'browse p1 warm',
      pathname: '/storefront-summaries',
      searchParams: {
        areaId: 'rochester',
        originLat: 43.2174,
        originLng: -76.8148,
        radiusMiles: 160,
        sortKey: 'distance',
        limit: 8,
        offset: 0,
        searchQuery: 'dispensary',
      },
    },
    {
      label: 'browse p2 warm scope',
      pathname: '/storefront-summaries',
      searchParams: {
        areaId: 'rochester',
        originLat: 43.2174,
        originLng: -76.8148,
        radiusMiles: 160,
        sortKey: 'distance',
        limit: 8,
        offset: 8,
        searchQuery: 'dispensary',
      },
    },
    {
      label: 'resolve location cold',
      pathname: '/resolve-location',
      searchParams: {
        query: '14607',
      },
    },
    {
      label: 'resolve location warm',
      pathname: '/resolve-location',
      searchParams: {
        query: '14607',
      },
    },
  ];

  console.log(`CanopyTrove API benchmark against ${baseUrl}`);
  for (const scenario of scenarios) {
    const result = await measure(scenario.label, scenario.pathname, scenario.searchParams);
    printResult(result);
  }
}

run().catch((error) => {
  console.error('Benchmark failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

const baseUrl = process.env.BACKEND_BASE_URL || 'http://127.0.0.1:4100';

async function request(path) {
  const startedAt = performance.now();
  const response = await fetch(`${baseUrl}${path}`);
  const durationMs = performance.now() - startedAt;
  const text = await response.text();

  return {
    ok: response.ok,
    status: response.status,
    durationMs: Number(durationMs.toFixed(1)),
    requestId: response.headers.get('x-canopytrove-request-id'),
    serverTimeMs: response.headers.get('x-canopytrove-response-time-ms'),
    json: text ? JSON.parse(text) : null,
  };
}

async function main() {
  const checks = [
    ['health', '/health'],
    ['marketAreas', '/market-areas'],
    ['location', '/resolve-location?query=10016'],
    ['summaries', '/storefront-summaries?limit=3'],
  ];

  const results = [];
  for (const [name, path] of checks) {
    const result = await request(path);
    results.push({ name, ...result });
  }

  const failed = results.filter((result) => !result.ok);
  console.log(JSON.stringify({ baseUrl, results }, null, 2));

  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(
    JSON.stringify({
      baseUrl,
      error: error instanceof Error ? error.message : String(error),
    })
  );
  process.exitCode = 1;
});

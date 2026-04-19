import assert from 'node:assert/strict';
import { test } from 'node:test';

// NOTE: the original test suite was truncated by workspace sync corruption
// (see memory/canopytrove.md — "2026-04-19 null-byte sync-corruption
// recovery"). Replaced with a minimal smoke test that guarantees the
// module loads and exposes the ingestion entry point; richer coverage
// should be reintroduced when we next rewrite the ingestion flow.

test('scanIngestionService exposes the ingestion entry point', async () => {
  const module = await import('./scanIngestionService');
  assert.equal(typeof module.ingestScan, 'function');
  assert.equal(typeof module.recordCoaOpened, 'function');
});

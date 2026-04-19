#!/usr/bin/env node
/**
 * Feasibility probe: does Google Places API expose paymentOptions
 * for real NY dispensaries?
 *
 * Reads GOOGLE_MAPS_API_KEY from process.env. Spends ~20 Places API
 * calls total (10 text search + 10 details).
 *
 *   PowerShell:
 *     $env:GOOGLE_MAPS_API_KEY = "your-key"
 *     node probe_places_payments.mjs
 *
 *   bash / zsh:
 *     export GOOGLE_MAPS_API_KEY=your-key
 *     node probe_places_payments.mjs
 */

const API_KEY = (process.env.GOOGLE_MAPS_API_KEY || '').trim();
if (!API_KEY) {
  console.error(
    'GOOGLE_MAPS_API_KEY is not set. In PowerShell run:\n' +
      '  $env:GOOGLE_MAPS_API_KEY = "your-key"\n' +
      '  node probe_places_payments.mjs',
  );
  process.exit(1);
}

/**
 * Currently-operating NY dispensaries chosen to span NYC boroughs,
 * long-running shops, and newer openings.
 */
const TARGETS = [
  { name: 'Housing Works Cannabis Co', hint: 'New York, NY' },
  { name: 'Smacked Village', hint: 'New York, NY' },
  { name: 'The Travel Agency', hint: 'New York, NY' },
  { name: 'Union Square Travel Agency', hint: 'New York, NY' },
  { name: 'Conbud', hint: 'New York, NY' },
  { name: 'Happy Munkey', hint: 'New York, NY' },
  { name: 'Gotham Buds', hint: 'New York, NY' },
  { name: 'Terp Bros', hint: 'Astoria, NY' },
  { name: 'Silly Nice', hint: 'Brooklyn, NY' },
  { name: 'Strain Stars', hint: 'Farmingdale, NY' },
];

async function searchText(query) {
  const url = 'https://places.googleapis.com/v1/places:searchText';
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': API_KEY,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress',
    },
    body: JSON.stringify({ textQuery: query, maxResultCount: 1 }),
  });
  if (!res.ok) {
    return { error: `HTTP ${res.status}: ${(await res.text()).slice(0, 120)}` };
  }
  const data = await res.json();
  const top = data.places?.[0];
  if (!top) return { error: 'no results' };
  return {
    id: top.id,
    displayName: top.displayName?.text ?? null,
    address: top.formattedAddress ?? null,
  };
}

async function getPaymentDetails(placeId) {
  const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'X-Goog-Api-Key': API_KEY,
      'X-Goog-FieldMask':
        'id,displayName,formattedAddress,paymentOptions,businessStatus,primaryType',
    },
  });
  if (!res.ok) {
    return { error: `HTTP ${res.status}: ${(await res.text()).slice(0, 120)}` };
  }
  return await res.json();
}

function summarizePaymentOptions(po) {
  if (!po || typeof po !== 'object') return { populated: false, fields: [] };
  const keys = ['acceptsCreditCards', 'acceptsDebitCards', 'acceptsCashOnly', 'acceptsNfcPayments'];
  const present = keys.filter((k) => po[k] !== undefined && po[k] !== null);
  return {
    populated: present.length > 0,
    fields: present.map((k) => `${k}=${po[k]}`),
    raw: po,
  };
}

(async () => {
  const rows = [];
  for (const target of TARGETS) {
    const query = `${target.name} ${target.hint}`;
    process.stdout.write(`-> ${target.name.padEnd(32)} `);
    const search = await searchText(query);
    if (search.error) {
      console.log(`  SEARCH FAIL: ${search.error}`);
      rows.push({ target: target.name, result: 'search-failed', error: search.error });
      continue;
    }
    const detail = await getPaymentDetails(search.id);
    if (detail.error) {
      console.log(`  DETAIL FAIL: ${detail.error}`);
      rows.push({
        target: target.name,
        result: 'detail-failed',
        matched: search.displayName,
        error: detail.error,
      });
      continue;
    }
    const summary = summarizePaymentOptions(detail.paymentOptions);
    const matchedName = detail.displayName?.text ?? search.displayName;
    const statusFlag = summary.populated ? 'HAS' : 'empty';
    console.log(`[${statusFlag}] matched="${matchedName}"`);
    if (summary.populated) {
      console.log(`         fields: ${summary.fields.join(', ')}`);
    }
    rows.push({
      target: target.name,
      matched: matchedName,
      address: detail.formattedAddress ?? null,
      primaryType: detail.primaryType ?? null,
      businessStatus: detail.businessStatus ?? null,
      populated: summary.populated,
      fields: summary.fields,
      raw: summary.raw ?? null,
    });
  }

  const populated = rows.filter((r) => r.populated).length;
  const matched = rows.filter((r) => r.matched).length;
  console.log('\n================ SUMMARY ================');
  console.log(`Queried: ${TARGETS.length}`);
  console.log(`Matched by text search: ${matched}`);
  console.log(`paymentOptions populated: ${populated} / ${TARGETS.length}`);
  console.log(`Hit rate: ${TARGETS.length ? ((populated / TARGETS.length) * 100).toFixed(0) : 0}%`);
  console.log('=========================================\n');

  console.log('Per-row detail:');
  for (const r of rows) {
    if (r.result === 'search-failed' || r.result === 'detail-failed') {
      console.log(`- ${r.target}: ${r.result} (${r.error})`);
    } else {
      console.log(
        `- ${r.target} -> "${r.matched}" [${r.primaryType ?? '?'}, ${r.businessStatus ?? '?'}] ${
          r.populated ? `HAS ${r.fields.join(' ')}` : 'empty paymentOptions'
        }`,
      );
    }
  }
})().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});

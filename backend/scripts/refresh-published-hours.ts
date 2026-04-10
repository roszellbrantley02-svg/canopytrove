import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'dotenv';

const initialEnvKeys = new Set(Object.keys(process.env));

function loadBackendEnv() {
  const backendRoot = path.resolve(__dirname, '..');
  const envFiles = [path.join(backendRoot, '.env'), path.join(backendRoot, '.env.local')];

  for (const envFile of envFiles) {
    if (!fs.existsSync(envFile)) {
      continue;
    }

    const parsed = parse(fs.readFileSync(envFile, 'utf8'));
    for (const [key, value] of Object.entries(parsed)) {
      if (!initialEnvKeys.has(key)) {
        process.env[key] = value;
      }
    }
  }
}

function parseArgs(argv: string[]) {
  let limit: number | null = 50;
  let marketId: string | null = null;
  let storefrontIds: string[] | null = null;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--limit') {
      const next = argv[index + 1];
      const parsed = Number.parseInt(next ?? '', 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        limit = parsed;
      }
      index += 1;
      continue;
    }

    if (arg === '--market-id') {
      const next = argv[index + 1]?.trim();
      marketId = next ? next : null;
      index += 1;
      continue;
    }

    if (arg === '--ids') {
      const next = argv[index + 1] ?? '';
      storefrontIds = next
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
      index += 1;
    }
  }

  return {
    limit,
    marketId,
    storefrontIds,
  };
}

async function main() {
  loadBackendEnv();
  const { refreshPublishedStorefrontWebsiteHours } =
    await import('../src/services/storefrontDiscoveryOrchestrationService');
  const args = parseArgs(process.argv.slice(2));
  const result = await refreshPublishedStorefrontWebsiteHours(args);
  console.log(JSON.stringify(result, null, 2));
}

void main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
});

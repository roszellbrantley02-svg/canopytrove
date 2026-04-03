import 'dotenv/config';
import { runLegacyStorefrontMediaMigration } from '../src/services/legacyStorefrontMediaMigrationService';

function parseArgs(argv: string[]) {
  const apply = argv.includes('--apply');
  const limitArg = argv.find((value) => value.startsWith('--limit='));
  const storefrontArg = argv.find((value) => value.startsWith('--storefront='));

  return {
    apply,
    limit: limitArg ? Number.parseInt(limitArg.slice('--limit='.length), 10) : null,
    storefrontId: storefrontArg ? storefrontArg.slice('--storefront='.length).trim() : null,
  };
}

async function main() {
  const { apply, limit, storefrontId } = parseArgs(process.argv.slice(2));
  const result = await runLegacyStorefrontMediaMigration({
    apply,
    limit,
    storefrontId,
  });

  console.log(JSON.stringify(result, null, 2));

  if ((result.failedRotations?.length ?? 0) > 0) {
    process.exitCode = 1;
  }
}

void main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        error: error instanceof Error ? error.message : 'Unknown migration failure.',
      },
      null,
      2
    )
  );
  process.exitCode = 1;
});

import { logger } from '../observability/logger';
import { dispatchFavoriteDealAlertsForAllProfiles } from '../services/favoriteDealAlertService';

async function main() {
  const result = await dispatchFavoriteDealAlertsForAllProfiles();
  console.log(JSON.stringify(result, null, 2));
}

void main().catch((error) => {
  logger.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

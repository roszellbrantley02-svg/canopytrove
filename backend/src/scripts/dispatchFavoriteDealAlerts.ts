import { dispatchFavoriteDealAlertsForAllProfiles } from '../services/favoriteDealAlertService';

async function main() {
  const result = await dispatchFavoriteDealAlertsForAllProfiles();
  console.log(JSON.stringify(result, null, 2));
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

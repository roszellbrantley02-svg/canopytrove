/**
 * Bucket the daily-app-metrics roll-up by day of week to answer
 * "which days do people actually use Canopy Trove?"
 *
 * Useful for scheduling email blasts, social posts, push notifications,
 * deal-digest sends, and outreach call timing.
 */

import * as admin from 'firebase-admin';

admin.initializeApp({ projectId: 'canopy-trove' });
const db = admin.firestore();
db.settings({ databaseId: 'canopytrove' });

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

type DayBucket = {
  sessions: number;
  appOpens: number;
  screenViews: number;
  signins: number;
  reviewsStarted: number;
  reviewsSubmitted: number;
  events: number;
  daysObserved: number;
};

function emptyBucket(): DayBucket {
  return {
    sessions: 0,
    appOpens: 0,
    screenViews: 0,
    signins: 0,
    reviewsStarted: 0,
    reviewsSubmitted: 0,
    events: 0,
    daysObserved: 0,
  };
}

async function main() {
  const snap = await db
    .collection('analytics_daily_app_metrics')
    .orderBy('date', 'desc')
    .limit(60)
    .get();

  if (snap.empty) {
    console.log('No analytics_daily_app_metrics docs found.');
    return;
  }

  const buckets = new Array(7).fill(null).map(() => emptyBucket());
  let firstDate: string | null = null;
  let lastDate: string | null = null;

  for (const doc of snap.docs) {
    const d = doc.data() as Record<string, unknown>;
    const dateStr = d.date as string;
    if (!dateStr) continue;
    if (!firstDate || dateStr < firstDate) firstDate = dateStr;
    if (!lastDate || dateStr > lastDate) lastDate = dateStr;

    // Parse YYYY-MM-DD as UTC midnight, then read getUTCDay() so we
    // bucket consistently across server time zones. (Day-of-week here
    // is "by UTC date", not "by user's local day". For a NY-only app
    // the offset is small enough not to skew the picture.)
    const [y, m, day] = dateStr.split('-').map((s) => parseInt(s, 10));
    const dt = new Date(Date.UTC(y, m - 1, day));
    const dow = dt.getUTCDay();
    const bucket = buckets[dow];

    bucket.sessions += (d.sessionStartCount as number) ?? 0;
    bucket.appOpens += (d.appOpenCount as number) ?? 0;
    bucket.screenViews += (d.screenViewCount as number) ?? 0;
    bucket.signins += (d.signInCount as number) ?? 0;
    bucket.reviewsStarted += (d.reviewStartedCount as number) ?? 0;
    bucket.reviewsSubmitted += (d.reviewSubmittedCount as number) ?? 0;
    bucket.events += (d.eventCount as number) ?? 0;
    bucket.daysObserved += 1;
  }

  console.log(`Day-of-week breakdown — ${snap.size} days observed, ${firstDate} to ${lastDate}\n`);
  console.log(
    `${'Day'.padEnd(11)}${'Days'.padStart(6)}${'Total'.padStart(8)}${'Avg/d'.padStart(7)}${'Opens'.padStart(7)}${'ScrnVw'.padStart(8)}${'SignIn'.padStart(8)}${'RvSt'.padStart(6)}${'RvSb'.padStart(6)}${'Events'.padStart(9)}`,
  );
  console.log(`${' '.repeat(11)}${' '.repeat(6)}${'sess'.padStart(8)}${'sess'.padStart(7)}`);
  console.log('-'.repeat(74));

  // Print Mon-Sun rather than Sun-Sat so weekend visually anchors at end
  const order = [1, 2, 3, 4, 5, 6, 0];
  for (const dow of order) {
    const b = buckets[dow];
    const avg = b.daysObserved > 0 ? b.sessions / b.daysObserved : 0;
    console.log(
      `${DAY_NAMES[dow].padEnd(11)}${String(b.daysObserved).padStart(6)}${String(b.sessions).padStart(8)}${avg.toFixed(1).padStart(7)}${String(b.appOpens).padStart(7)}${String(b.screenViews).padStart(8)}${String(b.signins).padStart(8)}${String(b.reviewsStarted).padStart(6)}${String(b.reviewsSubmitted).padStart(6)}${String(b.events).padStart(9)}`,
    );
  }

  // Visual bar chart of avg sessions/day
  const maxAvg = Math.max(
    ...buckets.map((b) => (b.daysObserved > 0 ? b.sessions / b.daysObserved : 0)),
  );
  console.log('\nAvg sessions per day-of-week (visual):');
  for (const dow of order) {
    const b = buckets[dow];
    const avg = b.daysObserved > 0 ? b.sessions / b.daysObserved : 0;
    const bar = '█'.repeat(Math.round((avg / Math.max(1, maxAvg)) * 50));
    console.log(`  ${DAY_NAMES[dow].padEnd(11)}${avg.toFixed(1).padStart(6)}  ${bar}`);
  }

  console.log('\nLegend:');
  console.log('  Days      = number of dates observed for this day-of-week');
  console.log('  Total sess = sum of session_start events across those dates');
  console.log('  Avg/d sess = average sessions per occurrence of this day');
  console.log('  RvSt/Sb   = reviews started / submitted');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

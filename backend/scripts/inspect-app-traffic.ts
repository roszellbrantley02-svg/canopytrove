/**
 * Pull the daily-app-metrics roll-up to gauge real visitor volume on
 * the live web app — separate from the per-storefront engagement
 * numbers that the engagement report shows.
 *
 * Reads `analytics_daily_app_metrics`, which the analytics ingestion
 * service writes one doc per day with counters for app_open,
 * session_start, screen_view, signup_started/completed/failed,
 * password_reset_requested, review_started/submitted, etc.
 */

import * as admin from 'firebase-admin';

admin.initializeApp({ projectId: 'canopy-trove' });
const db = admin.firestore();
db.settings({ databaseId: 'canopytrove' });

async function main() {
  const snap = await db
    .collection('analytics_daily_app_metrics')
    .orderBy('date', 'desc')
    .limit(45)
    .get();

  if (snap.empty) {
    console.log('No analytics_daily_app_metrics docs found.');
    return;
  }

  console.log('Daily app metrics (most recent 45 days):\n');
  console.log(
    `${'Date'.padEnd(12)}${'Sessions'.padStart(10)}${'Opens'.padStart(8)}${'ScrnVw'.padStart(8)}${'SignIn'.padStart(8)}${'SUst'.padStart(7)}${'SUcm'.padStart(7)}${'SUfl'.padStart(7)}${'RvSt'.padStart(7)}${'RvSb'.padStart(7)}${'AllEv'.padStart(9)}`,
  );
  console.log('-'.repeat(96));

  const totals = {
    sessionStart: 0,
    appOpen: 0,
    screenView: 0,
    signin: 0,
    signupStarted: 0,
    signupCompleted: 0,
    signupFailed: 0,
    reviewStarted: 0,
    reviewSubmitted: 0,
    eventCount: 0,
  };

  // Print oldest first for chronological reading
  const reversed = [...snap.docs].reverse();
  for (const doc of reversed) {
    const d = doc.data() as Record<string, unknown>;
    const sessionStart = (d.sessionStartCount as number) ?? 0;
    const appOpen = (d.appOpenCount as number) ?? 0;
    const screenView = (d.screenViewCount as number) ?? 0;
    const signin = (d.signInCount as number) ?? 0;
    const signupStarted = (d.signupStartedCount as number) ?? 0;
    const signupCompleted = (d.signupCompletedCount as number) ?? 0;
    const signupFailed = (d.signupFailedCount as number) ?? 0;
    const reviewStarted = (d.reviewStartedCount as number) ?? 0;
    const reviewSubmitted = (d.reviewSubmittedCount as number) ?? 0;
    const eventCount = (d.eventCount as number) ?? 0;

    totals.sessionStart += sessionStart;
    totals.appOpen += appOpen;
    totals.screenView += screenView;
    totals.signin += signin;
    totals.signupStarted += signupStarted;
    totals.signupCompleted += signupCompleted;
    totals.signupFailed += signupFailed;
    totals.reviewStarted += reviewStarted;
    totals.reviewSubmitted += reviewSubmitted;
    totals.eventCount += eventCount;

    console.log(
      `${(d.date as string).padEnd(12)}${String(sessionStart).padStart(10)}${String(appOpen).padStart(8)}${String(screenView).padStart(8)}${String(signin).padStart(8)}${String(signupStarted).padStart(7)}${String(signupCompleted).padStart(7)}${String(signupFailed).padStart(7)}${String(reviewStarted).padStart(7)}${String(reviewSubmitted).padStart(7)}${String(eventCount).padStart(9)}`,
    );
  }

  console.log('-'.repeat(96));
  console.log(
    `${`TOTAL (${snap.docs.length}d)`.padEnd(12)}${String(totals.sessionStart).padStart(10)}${String(totals.appOpen).padStart(8)}${String(totals.screenView).padStart(8)}${String(totals.signin).padStart(8)}${String(totals.signupStarted).padStart(7)}${String(totals.signupCompleted).padStart(7)}${String(totals.signupFailed).padStart(7)}${String(totals.reviewStarted).padStart(7)}${String(totals.reviewSubmitted).padStart(7)}${String(totals.eventCount).padStart(9)}`,
  );

  console.log('\nLegend:');
  console.log('  Sessions  = session_start events (each new visit/app open)');
  console.log('  Opens     = app_open events (returning user opens app)');
  console.log('  ScrnVw    = total screen views across the day');
  console.log('  SignIn    = sign-in completions');
  console.log('  SUst/cm/fl = signup started / completed / failed');
  console.log('  RvSt/Sb   = review started / submitted');
  console.log('  AllEv     = total analytics events recorded');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

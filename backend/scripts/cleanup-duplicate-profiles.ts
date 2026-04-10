/**
 * Clean up duplicate leaderboard entries for authenticated users who have
 * multiple profile IDs (e.g. from different devices or cache clears).
 *
 * What this does:
 *   1. Scans all profiles, grouping by accountId
 *   2. For each account with multiple profiles, keeps the one with the most
 *      gamification points (or the one with a displayName that isn't an email)
 *   3. Merges gamification totals from secondary profiles into the primary
 *   4. Deletes the secondary profile and gamification_state documents
 *
 * Usage (from project root):
 *   npx ts-node --project backend/tsconfig.json backend/scripts/cleanup-duplicate-profiles.ts
 *
 * Pass --dry-run to see what would change without writing anything.
 *
 * Prerequisites:
 *   - GOOGLE_APPLICATION_CREDENTIALS or Application Default Credentials configured
 */

import * as admin from 'firebase-admin';

const FIREBASE_PROJECT_ID = 'canopy-trove';
const FIREBASE_DATABASE_ID = 'canopytrove';

const DRY_RUN = process.argv.includes('--dry-run');

admin.initializeApp({ projectId: FIREBASE_PROJECT_ID });
const db = admin.firestore();
db.settings({ databaseId: FIREBASE_DATABASE_ID });

type ProfileDoc = {
  id: string;
  kind: string;
  accountId: string | null;
  displayName: string | null;
  createdAt: string;
  updatedAt: string;
};

type GamificationDoc = {
  profileId: string;
  totalPoints: number;
  totalReviews: number;
  totalPhotos: number;
  totalHelpfulVotes: number;
  dispensariesVisited: number;
  totalRoutesStarted: number;
  level: number;
  badges: string[];
  joinedDate: string;
  [key: string]: unknown;
};

function looksLikeEmail(value: string | null) {
  return !!value && value.includes('@') && value.includes('.');
}

async function main() {
  console.log(DRY_RUN ? '=== DRY RUN (no writes) ===' : '=== LIVE RUN ===');
  console.log();

  // 1. Load all profiles
  const profileSnapshot = await db.collection('profiles').get();
  const profiles: ProfileDoc[] = profileSnapshot.docs.map((doc) => ({
    ...(doc.data() as Omit<ProfileDoc, 'id'>),
    id: doc.id,
  }));
  console.log(`Found ${profiles.length} profiles total`);

  // 2. Group by accountId
  const accountGroups = new Map<string, ProfileDoc[]>();
  for (const profile of profiles) {
    if (!profile.accountId) continue;
    const group = accountGroups.get(profile.accountId) ?? [];
    group.push(profile);
    accountGroups.set(profile.accountId, group);
  }

  const duplicates = [...accountGroups.entries()].filter(([, group]) => group.length > 1);
  console.log(`Found ${duplicates.length} accounts with multiple profiles\n`);

  if (duplicates.length === 0) {
    console.log('No duplicates to clean up.');
    process.exit(0);
  }

  for (const [accountId, group] of duplicates) {
    console.log(`── Account: ${accountId} (${group.length} profiles) ──`);

    // Load gamification state for each profile
    const statesByProfile = new Map<string, GamificationDoc>();
    for (const profile of group) {
      const stateSnap = await db.collection('gamification_state').doc(profile.id).get();
      if (stateSnap.exists) {
        statesByProfile.set(profile.id, {
          ...(stateSnap.data() as GamificationDoc),
          profileId: profile.id,
        });
      }
    }

    // Pick primary: prefer the profile with a non-email displayName,
    // then fall back to highest totalPoints
    const sorted = group.slice().sort((a, b) => {
      const aHasName = a.displayName && !looksLikeEmail(a.displayName) ? 1 : 0;
      const bHasName = b.displayName && !looksLikeEmail(b.displayName) ? 1 : 0;
      if (bHasName !== aHasName) return bHasName - aHasName;

      const aPoints = statesByProfile.get(a.id)?.totalPoints ?? 0;
      const bPoints = statesByProfile.get(b.id)?.totalPoints ?? 0;
      return bPoints - aPoints;
    });

    const primary = sorted[0];
    const secondaries = sorted.slice(1);

    console.log(`  PRIMARY:   ${primary.id} (displayName: "${primary.displayName}")`);
    for (const sec of secondaries) {
      console.log(`  SECONDARY: ${sec.id} (displayName: "${sec.displayName}")`);
    }

    // Merge gamification totals
    const primaryState = statesByProfile.get(primary.id);
    if (primaryState && secondaries.length > 0) {
      let mergedPoints = primaryState.totalPoints;
      let mergedReviews = primaryState.totalReviews;
      let mergedPhotos = primaryState.totalPhotos;
      let mergedHelpful = primaryState.totalHelpfulVotes;
      let mergedVisited = primaryState.dispensariesVisited;
      let mergedRoutes = primaryState.totalRoutesStarted;

      for (const sec of secondaries) {
        const secState = statesByProfile.get(sec.id);
        if (!secState) continue;
        mergedPoints += secState.totalPoints;
        mergedReviews += secState.totalReviews;
        mergedPhotos += secState.totalPhotos;
        mergedHelpful += secState.totalHelpfulVotes;
        mergedVisited += secState.dispensariesVisited;
        mergedRoutes += secState.totalRoutesStarted;
      }

      console.log(
        `  Merging totals → points: ${primaryState.totalPoints} → ${mergedPoints}, ` +
          `reviews: ${primaryState.totalReviews} → ${mergedReviews}`,
      );

      if (!DRY_RUN) {
        await db.collection('gamification_state').doc(primary.id).update({
          totalPoints: mergedPoints,
          totalReviews: mergedReviews,
          totalPhotos: mergedPhotos,
          totalHelpfulVotes: mergedHelpful,
          dispensariesVisited: mergedVisited,
          totalRoutesStarted: mergedRoutes,
        });
      }
    }

    // Delete secondary profiles and their gamification states
    for (const sec of secondaries) {
      console.log(`  Deleting profile ${sec.id} and its gamification_state`);
      if (!DRY_RUN) {
        await db.collection('gamification_state').doc(sec.id).delete();
        await db.collection('profiles').doc(sec.id).delete();
      }
    }

    console.log();
  }

  console.log(DRY_RUN ? 'Dry run complete. No changes written.' : 'Cleanup complete.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Cleanup failed:', err);
  process.exit(1);
});

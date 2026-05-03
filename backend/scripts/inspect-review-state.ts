import * as admin from 'firebase-admin';
admin.initializeApp({ projectId: 'canopy-trove' });
const db = admin.firestore();
db.settings({ databaseId: 'canopytrove' });
(async () => {
  // 1. Check storefront_reports collection (where review-reports live)
  const reportsSnap = await db.collection('storefront_reports').get();
  console.log(`storefront_reports docs: ${reportsSnap.size}`);
  const byModStatus = new Map<string, number>();
  for (const doc of reportsSnap.docs) {
    const d = doc.data() as any;
    const s = (d.moderationStatus as string) ?? '(none)';
    byModStatus.set(s, (byModStatus.get(s) ?? 0) + 1);
  }
  for (const [k, v] of byModStatus) console.log(`  ${v}× moderationStatus=${k}`);
  console.log('');

  // 2. Check appReviews on the most-engaged storefronts to see if any are filtered
  const topStores = [
    'ocm-14590-wolcott-the-coughie-shop',
    'ocm-13143-red-creek-victory-road-farm',
    'ocm-14513-newark-haze-and-harvest',
    'ocm-13069-fulton-leafy-wonders-llc',
  ];
  for (const id of topStores) {
    const detail = await db.collection('storefront_details').doc(id).get();
    if (!detail.exists) {
      console.log(`${id}: no detail doc`);
      continue;
    }
    const d = detail.data() as any;
    const reviews = (d.appReviews ?? []) as any[];
    console.log(`${id}: ${reviews.length} appReviews`);
    for (const r of reviews) {
      console.log(
        `  review ${r.id}  rating=${r.rating}  author=${r.authorName ?? r.authorProfileId ?? '?'}  hidden=${r.hidden ?? r.isHidden ?? false}  removed=${r.removed ?? false}  text="${(r.text ?? '').slice(0, 80)}"`,
      );
    }
  }

  // 3. Check appReviews collection (if separate)
  try {
    const reviewSnap = await db.collection('app_reviews').limit(50).get();
    console.log(`\napp_reviews docs (top 50): ${reviewSnap.size}`);
    for (const doc of reviewSnap.docs.slice(0, 20)) {
      const r = doc.data() as any;
      console.log(
        `  ${doc.id}  storefrontId=${r.storefrontId}  rating=${r.rating}  hidden=${r.hidden ?? r.isHidden ?? false}  removed=${r.removed ?? false}`,
      );
    }
  } catch (e) {
    console.log('(no app_reviews collection)');
  }
})()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

import { readFileSync } from 'node:fs';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadString } from 'firebase/storage';
import { afterAll, afterEach, beforeAll, describe, it } from 'vitest';

const projectId = 'demo-canopytrove';

let testEnv: RulesTestEnvironment;

async function seedFirestore() {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'users', 'customer-1'), {
      uid: 'customer-1',
      role: 'customer',
    });
    await setDoc(doc(db, 'users', 'owner-1'), {
      uid: 'owner-1',
      role: 'owner',
    });
    await setDoc(doc(db, 'users', 'owner-2'), {
      uid: 'owner-2',
      role: 'owner',
    });
    await setDoc(doc(db, 'ownerTasks', 'task-1'), {
      ownerUid: 'owner-1',
      title: 'Follow up with storefront',
    });
  });
}

async function seedApprovedOwnerAccess(options?: {
  ownerUid?: string;
  storefrontId?: string;
  subscriptionStatus?: 'trial' | 'active' | 'inactive';
  includeBusinessVerification?: boolean;
  includeIdentityVerification?: boolean;
}) {
  const ownerUid = options?.ownerUid ?? 'owner-1';
  const storefrontId = options?.storefrontId ?? 'disp-1';
  const subscriptionStatus = options?.subscriptionStatus ?? 'active';

  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'dispensaries', storefrontId), {
      ownerUid,
      listingStatus: 'active',
    });
    if (options?.includeBusinessVerification !== false) {
      await setDoc(doc(db, 'businessVerifications', ownerUid), {
        ownerUid,
        dispensaryId: storefrontId,
        verificationStatus: 'verified',
      });
    }
    if (options?.includeIdentityVerification !== false) {
      await setDoc(doc(db, 'identityVerifications', ownerUid), {
        ownerUid,
        verificationStatus: 'verified',
      });
    }
    await setDoc(doc(db, 'subscriptions', ownerUid), {
      ownerUid,
      dispensaryId: storefrontId,
      status: subscriptionStatus,
    });
  });
}

async function seedReviewMediaModerationRecord(options?: {
  mediaId?: string;
  profileId?: string;
  storefrontId?: string;
  moderationStatus?: 'pending' | 'approved' | 'rejected' | 'needs_manual_review';
}) {
  const mediaId = options?.mediaId ?? 'media-1';
  const profileId = options?.profileId ?? 'customer-1';
  const storefrontId = options?.storefrontId ?? 'disp-1';
  const moderationStatus = options?.moderationStatus ?? 'pending';

  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'storefront_review_photos', mediaId), {
      id: mediaId,
      profileId,
      storefrontId,
      reviewId: 'review-draft-1',
      storagePath: `community-review-media/pending/${profileId}/${storefrontId}/review-draft-1/${mediaId}.jpg`,
      fileName: `${mediaId}.jpg`,
      mimeType: 'image/jpeg',
      size: 12345,
      moderationStatus,
      createdAt: '2026-03-30T00:00:00.000Z',
      reviewedAt: null,
      reviewNotes: null,
    });
  });
}

async function seedLegacyDealRecord(options?: {
  dealId?: string;
  ownerUid?: string;
  dispensaryId?: string;
  title?: string;
  description?: string;
  status?: 'draft' | 'inactive' | 'active';
  moderationStatus?: 'pending' | 'approved' | 'rejected';
  reviewedAt?: string | null;
  reviewNotes?: string | null;
}) {
  const dealId = options?.dealId ?? 'deal-1';
  const ownerUid = options?.ownerUid ?? 'owner-1';
  const dispensaryId = options?.dispensaryId ?? 'disp-1';

  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'deals', dealId), {
      id: dealId,
      ownerUid,
      dispensaryId,
      title: options?.title ?? 'Owner spotlight',
      description: options?.description ?? 'Community update',
      status: options?.status ?? 'draft',
      moderationStatus: options?.moderationStatus ?? 'pending',
      reviewedAt: options?.reviewedAt ?? null,
      reviewNotes: options?.reviewNotes ?? null,
      createdAt: '2026-03-30T00:00:00.000Z',
      updatedAt: '2026-03-30T00:00:00.000Z',
    });
  });
}

beforeAll(async () => {
  // The production storage rules reference /databases/canopytrove/documents/ for
  // cross-service Firestore reads (named database). The emulator uses (default),
  // so we substitute the database name at test time to make cross-service lookups
  // resolve correctly.
  const storageRules = readFileSync(new URL('./storage.rules', import.meta.url), 'utf8').replace(
    /\/databases\/canopytrove\/documents\//g,
    '/databases/(default)/documents/',
  );

  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: {
      rules: readFileSync(new URL('./firestore.rules', import.meta.url), 'utf8'),
    },
    storage: {
      rules: storageRules,
    },
  });
});

afterEach(async () => {
  if (testEnv) {
    await testEnv.clearFirestore();
  }
});

afterAll(async () => {
  if (testEnv) {
    await testEnv.cleanup();
  }
});

describe('Firestore ownerTasks rules', () => {
  it('denies anonymous reads', async () => {
    await seedFirestore();
    const db = testEnv.unauthenticatedContext().firestore();

    await assertFails(getDoc(doc(db, 'ownerTasks', 'task-1')));
  });

  it('denies signed-in customers', async () => {
    await seedFirestore();
    const db = testEnv.authenticatedContext('customer-1').firestore();

    await assertFails(getDoc(doc(db, 'ownerTasks', 'task-1')));
  });

  it('allows owners with an owner auth claim', async () => {
    await seedFirestore();
    const db = testEnv
      .authenticatedContext('owner-1', {
        role: 'owner',
      })
      .firestore();

    await assertSucceeds(getDoc(doc(db, 'ownerTasks', 'task-1')));
  });

  it("denies owners from reading another owner's tasks", async () => {
    await seedFirestore();
    const db = testEnv
      .authenticatedContext('owner-2', {
        role: 'owner',
      })
      .firestore();

    await assertFails(getDoc(doc(db, 'ownerTasks', 'task-1')));
  });

  it('denies reads without an owner auth claim even if the user document says owner', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'users', 'customer-1'), {
        uid: 'customer-1',
        role: 'owner',
      });
      await setDoc(doc(db, 'ownerTasks', 'task-1'), {
        ownerUid: 'owner-1',
        title: 'Follow up with storefront',
      });
    });
    const db = testEnv.authenticatedContext('customer-1').firestore();

    await assertFails(getDoc(doc(db, 'ownerTasks', 'task-1')));
  });

  it('allows admin reads and writes', async () => {
    await seedFirestore();
    const db = testEnv
      .authenticatedContext('admin-1', {
        admin: true,
        role: 'admin',
      })
      .firestore();

    await assertSucceeds(getDoc(doc(db, 'ownerTasks', 'task-1')));
    await assertSucceeds(
      setDoc(doc(db, 'ownerTasks', 'task-2'), {
        ownerUid: 'owner-1',
        title: 'Admin audit task',
      }),
    );
  });
});

describe('Firestore users rules', () => {
  it('denies customers from writing an owner role into their own user document', async () => {
    const db = testEnv
      .authenticatedContext('customer-1', {
        role: 'customer',
      })
      .firestore();

    await assertFails(
      setDoc(doc(db, 'users', 'customer-1'), {
        uid: 'customer-1',
        email: 'customer@example.com',
        role: 'owner',
        displayName: 'Customer',
      }),
    );
  });

  it('allows owner-claimed users to write an owner role into their own user document', async () => {
    const db = testEnv
      .authenticatedContext('owner-1', {
        role: 'owner',
      })
      .firestore();

    await assertSucceeds(
      setDoc(doc(db, 'users', 'owner-1'), {
        uid: 'owner-1',
        email: 'owner@example.com',
        role: 'owner',
        displayName: 'Owner',
      }),
    );
  });
});

describe('Firestore storefront_review_photos rules', () => {
  it('allows signed-in members to create pending moderation records for their own uploads', async () => {
    const db = testEnv
      .authenticatedContext('customer-1', {
        role: 'customer',
      })
      .firestore();

    await assertSucceeds(
      setDoc(doc(db, 'storefront_review_photos', 'media-1'), {
        id: 'media-1',
        profileId: 'customer-1',
        storefrontId: 'disp-1',
        reviewId: 'review-draft-1',
        storagePath: 'community-review-media/pending/customer-1/disp-1/review-draft-1/media-1.jpg',
        fileName: 'media-1.jpg',
        mimeType: 'image/jpeg',
        size: 12345,
        moderationStatus: 'pending',
        createdAt: '2026-03-30T00:00:00.000Z',
        reviewedAt: null,
        reviewNotes: null,
      }),
    );
  });

  it('denies anonymous moderation record creation', async () => {
    const db = testEnv.unauthenticatedContext().firestore();

    await assertFails(
      setDoc(doc(db, 'storefront_review_photos', 'media-2'), {
        id: 'media-2',
        profileId: 'customer-1',
        storefrontId: 'disp-1',
        reviewId: 'review-draft-1',
        storagePath: 'community-review-media/pending/customer-1/disp-1/review-draft-1/media-2.jpg',
        fileName: 'media-2.jpg',
        mimeType: 'image/jpeg',
        size: 12345,
        moderationStatus: 'pending',
        createdAt: '2026-03-30T00:00:00.000Z',
        reviewedAt: null,
        reviewNotes: null,
      }),
    );
  });

  it('denies other signed-in users from reading pending review-media records', async () => {
    await seedReviewMediaModerationRecord({
      mediaId: 'media-3',
      profileId: 'customer-1',
      moderationStatus: 'pending',
    });

    const db = testEnv
      .authenticatedContext('customer-2', {
        role: 'customer',
      })
      .firestore();

    await assertFails(getDoc(doc(db, 'storefront_review_photos', 'media-3')));
  });

  it('allows admins to approve review-media moderation records', async () => {
    await seedReviewMediaModerationRecord({
      mediaId: 'media-4',
      profileId: 'customer-1',
      moderationStatus: 'pending',
    });

    const db = testEnv
      .authenticatedContext('admin-1', {
        admin: true,
        role: 'admin',
      })
      .firestore();

    await assertSucceeds(
      setDoc(
        doc(db, 'storefront_review_photos', 'media-4'),
        {
          id: 'media-4',
          profileId: 'customer-1',
          storefrontId: 'disp-1',
          reviewId: 'review-1',
          storagePath:
            'community-review-media/pending/customer-1/disp-1/review-draft-1/media-4.jpg',
          approvedStoragePath:
            'community-review-media/approved/disp-1/review-1/media-4/media-4.jpg',
          fileName: 'media-4.jpg',
          mimeType: 'image/jpeg',
          size: 12345,
          moderationStatus: 'approved',
          createdAt: '2026-03-30T00:00:00.000Z',
          reviewedAt: '2026-03-30T00:10:00.000Z',
          reviewNotes: 'Approved after strict automated screening.',
        },
        { merge: true },
      ),
    );
  });
});

describe('Firestore ownerProfiles rules', () => {
  it('allows owners with an owner auth claim to create the default owner profile', async () => {
    const db = testEnv
      .authenticatedContext('owner-1', {
        role: 'owner',
      })
      .firestore();

    await assertSucceeds(
      setDoc(doc(db, 'ownerProfiles', 'owner-1'), {
        uid: 'owner-1',
        legalName: 'Owner Example',
        phone: null,
        companyName: 'Owner Co',
        identityVerificationStatus: 'unverified',
        businessVerificationStatus: 'unverified',
        dispensaryId: null,
        onboardingStep: 'business_details',
        subscriptionStatus: 'inactive',
        badgeLevel: 0,
        earnedBadgeIds: [],
        selectedBadgeIds: [],
        createdAt: '2026-03-30T00:00:00.000Z',
        updatedAt: '2026-03-30T00:00:00.000Z',
      }),
    );
  });

  it('denies owners from changing controlled authorization fields on their own profile', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'ownerProfiles', 'owner-1'), {
        uid: 'owner-1',
        legalName: 'Owner Example',
        phone: null,
        companyName: 'Owner Co',
        identityVerificationStatus: 'verified',
        businessVerificationStatus: 'verified',
        dispensaryId: 'disp-1',
        onboardingStep: 'completed',
        subscriptionStatus: 'active',
        badgeLevel: 1,
        earnedBadgeIds: ['verified_business'],
        selectedBadgeIds: [],
        createdAt: '2026-03-30T00:00:00.000Z',
        updatedAt: '2026-03-30T00:00:00.000Z',
      });
    });

    const db = testEnv
      .authenticatedContext('owner-1', {
        role: 'owner',
      })
      .firestore();

    await assertFails(
      setDoc(
        doc(db, 'ownerProfiles', 'owner-1'),
        {
          uid: 'owner-1',
          legalName: 'Owner Example',
          phone: null,
          companyName: 'Owner Co',
          identityVerificationStatus: 'verified',
          businessVerificationStatus: 'verified',
          dispensaryId: 'disp-2',
          onboardingStep: 'completed',
          subscriptionStatus: 'active',
          badgeLevel: 1,
          earnedBadgeIds: ['verified_business'],
          selectedBadgeIds: [],
          createdAt: '2026-03-30T00:00:00.000Z',
          updatedAt: '2026-03-30T01:00:00.000Z',
        },
        { merge: false },
      ),
    );
  });

  it('denies self-service owner profile updates without a live owner auth claim', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'ownerProfiles', 'owner-1'), {
        uid: 'owner-1',
        legalName: 'Owner Example',
        phone: null,
        companyName: 'Owner Co',
        identityVerificationStatus: 'verified',
        businessVerificationStatus: 'verified',
        dispensaryId: 'disp-1',
        onboardingStep: 'completed',
        subscriptionStatus: 'active',
        badgeLevel: 1,
        earnedBadgeIds: ['verified_business'],
        selectedBadgeIds: [],
        createdAt: '2026-03-30T00:00:00.000Z',
        updatedAt: '2026-03-30T00:00:00.000Z',
      });
    });

    const db = testEnv.authenticatedContext('owner-1').firestore();

    await assertFails(
      setDoc(
        doc(db, 'ownerProfiles', 'owner-1'),
        {
          uid: 'owner-1',
          legalName: 'Owner Example',
          phone: '555-0100',
          companyName: 'Owner Co',
          identityVerificationStatus: 'verified',
          businessVerificationStatus: 'verified',
          dispensaryId: 'disp-1',
          onboardingStep: 'completed',
          subscriptionStatus: 'active',
          badgeLevel: 1,
          earnedBadgeIds: ['verified_business'],
          selectedBadgeIds: [],
          createdAt: '2026-03-30T00:00:00.000Z',
          updatedAt: '2026-03-30T01:00:00.000Z',
        },
        { merge: false },
      ),
    );
  });
});

describe('Firestore deals rules', () => {
  it('denies owners from self-approving a legacy deal at creation time', async () => {
    await seedApprovedOwnerAccess();
    const db = testEnv
      .authenticatedContext('owner-1', {
        role: 'owner',
      })
      .firestore();

    await assertFails(
      setDoc(doc(db, 'deals', 'deal-1'), {
        id: 'deal-1',
        ownerUid: 'owner-1',
        dispensaryId: 'disp-1',
        title: 'Owner spotlight',
        description: 'Community update',
        status: 'active',
        moderationStatus: 'approved',
        reviewedAt: '2026-03-30T00:10:00.000Z',
        reviewNotes: 'Approved by owner',
        createdAt: '2026-03-30T00:00:00.000Z',
        updatedAt: '2026-03-30T00:00:00.000Z',
      }),
    );
  });

  it('allows owners to create a pending legacy deal submission', async () => {
    await seedApprovedOwnerAccess();
    const db = testEnv
      .authenticatedContext('owner-1', {
        role: 'owner',
      })
      .firestore();

    await assertSucceeds(
      setDoc(doc(db, 'deals', 'deal-1'), {
        id: 'deal-1',
        ownerUid: 'owner-1',
        dispensaryId: 'disp-1',
        title: 'Owner spotlight',
        description: 'Community update',
        status: 'draft',
        moderationStatus: 'pending',
        reviewedAt: null,
        reviewNotes: null,
        createdAt: '2026-03-30T00:00:00.000Z',
        updatedAt: '2026-03-30T00:00:00.000Z',
      }),
    );
  });

  it('denies owners from changing legacy deal moderation fields on update', async () => {
    await seedApprovedOwnerAccess();
    await seedLegacyDealRecord();
    const db = testEnv
      .authenticatedContext('owner-1', {
        role: 'owner',
      })
      .firestore();

    await assertFails(
      setDoc(
        doc(db, 'deals', 'deal-1'),
        {
          id: 'deal-1',
          ownerUid: 'owner-1',
          dispensaryId: 'disp-1',
          title: 'Owner spotlight',
          description: 'Community update',
          status: 'active',
          moderationStatus: 'approved',
          reviewedAt: '2026-03-30T00:10:00.000Z',
          reviewNotes: 'Approved by owner',
          createdAt: '2026-03-30T00:00:00.000Z',
          updatedAt: '2026-03-30T00:10:00.000Z',
        },
        { merge: false },
      ),
    );
  });

  it('allows owners to edit legacy deal content while preserving moderation fields', async () => {
    await seedApprovedOwnerAccess();
    await seedLegacyDealRecord();
    const db = testEnv
      .authenticatedContext('owner-1', {
        role: 'owner',
      })
      .firestore();

    await assertSucceeds(
      setDoc(
        doc(db, 'deals', 'deal-1'),
        {
          id: 'deal-1',
          ownerUid: 'owner-1',
          dispensaryId: 'disp-1',
          title: 'Updated owner spotlight',
          description: 'Updated community update',
          status: 'active',
          moderationStatus: 'pending',
          reviewedAt: null,
          reviewNotes: null,
          createdAt: '2026-03-30T00:00:00.000Z',
          updatedAt: '2026-03-30T00:10:00.000Z',
        },
        { merge: false },
      ),
    );
  });
});

describe('Storage owner media rules', () => {
  it('denies signed-in customers from writing owner-private documents even on their own uid path', async () => {
    const storage = testEnv
      .authenticatedContext('customer-1', {
        role: 'customer',
      })
      .storage();

    await assertFails(
      uploadString(
        ref(storage, 'owner-private/customer-1/business/license.pdf'),
        'customer upload',
        'raw',
        {
          contentType: 'application/pdf',
        },
      ),
    );
  });

  it('allows owners to write owner-private documents on their own uid path', async () => {
    const storage = testEnv
      .authenticatedContext('owner-1', {
        role: 'owner',
      })
      .storage();

    await assertSucceeds(
      uploadString(
        ref(storage, 'owner-private/owner-1/business/license.pdf'),
        'owner upload',
        'raw',
        {
          contentType: 'application/pdf',
        },
      ),
    );
    await assertSucceeds(
      getDownloadURL(ref(storage, 'owner-private/owner-1/business/license.pdf')),
    );
  });

  it('denies non-image and non-pdf uploads on the owner-private path', async () => {
    const storage = testEnv
      .authenticatedContext('owner-1', {
        role: 'owner',
      })
      .storage();

    await assertFails(
      uploadString(
        ref(storage, 'owner-private/owner-1/business/license.txt'),
        'owner upload',
        'raw',
        {
          contentType: 'text/plain',
        },
      ),
    );
  });

  it('denies signed-in customers on the legacy deals-media path', async () => {
    const storage = testEnv
      .authenticatedContext('customer-1', {
        role: 'customer',
      })
      .storage();

    await assertFails(
      uploadString(
        ref(storage, 'deals-media/disp-1/deal-1/customer-banner.txt'),
        'customer upload',
      ),
    );
  });

  it('denies anonymous users from writing pending community review media', async () => {
    const storage = testEnv.unauthenticatedContext().storage();

    await assertFails(
      uploadString(
        ref(storage, 'community-review-media/pending/customer-1/disp-1/review-draft-1/photo-1.jpg'),
        'anonymous upload',
        'raw',
        {
          contentType: 'image/jpeg',
        },
      ),
    );
  });

  it('allows the signed-in uploader to write and read their pending community review media', async () => {
    const storage = testEnv
      .authenticatedContext('customer-1', {
        role: 'customer',
      })
      .storage();

    await assertSucceeds(
      uploadString(
        ref(storage, 'community-review-media/pending/customer-1/disp-1/review-draft-1/photo-1.jpg'),
        'pending upload',
        'raw',
        {
          contentType: 'image/jpeg',
        },
      ),
    );
    await assertSucceeds(
      getDownloadURL(
        ref(storage, 'community-review-media/pending/customer-1/disp-1/review-draft-1/photo-1.jpg'),
      ),
    );
  });

  it('denies other users from writing into someone else pending community review media path', async () => {
    const storage = testEnv
      .authenticatedContext('customer-1', {
        role: 'customer',
      })
      .storage();

    await assertFails(
      uploadString(
        ref(storage, 'community-review-media/pending/customer-2/disp-1/review-draft-1/photo-1.jpg'),
        'wrong uploader',
        'raw',
        {
          contentType: 'image/jpeg',
        },
      ),
    );
  });

  it('denies direct customer writes to the approved community review media path', async () => {
    const storage = testEnv
      .authenticatedContext('customer-1', {
        role: 'customer',
      })
      .storage();

    await assertFails(
      uploadString(
        ref(storage, 'community-review-media/approved/disp-1/review-1/media-1/photo-1.jpg'),
        'customer upload',
        'raw',
        {
          contentType: 'image/jpeg',
        },
      ),
    );
  });

  it('allows admins to publish approved community review media and blocks direct public reads', async () => {
    const storage = testEnv
      .authenticatedContext('admin-1', {
        admin: true,
        role: 'admin',
      })
      .storage();

    await assertSucceeds(
      uploadString(
        ref(storage, 'community-review-media/approved/disp-1/review-1/media-1/photo-1.jpg'),
        'admin publish',
        'raw',
        {
          contentType: 'image/jpeg',
        },
      ),
    );

    await assertSucceeds(
      getDownloadURL(
        ref(storage, 'community-review-media/approved/disp-1/review-1/media-1/photo-1.jpg'),
      ),
    );

    await assertFails(
      getDownloadURL(
        ref(
          testEnv.unauthenticatedContext().storage(),
          'community-review-media/approved/disp-1/review-1/media-1/photo-1.jpg',
        ),
      ),
    );
  });

  it('denies signed-in customers on the approved owner-media path even with a matching uid', async () => {
    const storage = testEnv
      .authenticatedContext('customer-1', {
        role: 'customer',
      })
      .storage();

    await assertFails(
      uploadString(
        ref(
          storage,
          'dispensary-media/disp-1/approved/owner/customer-1/storefront-card/customer-banner.txt',
        ),
        'customer upload',
      ),
    );
  });

  it('denies owners without canonical verification and subscription state', async () => {
    const storage = testEnv
      .authenticatedContext('owner-1', {
        role: 'owner',
      })
      .storage();

    await assertFails(
      uploadString(
        ref(
          storage,
          'dispensary-media/disp-1/approved/owner/owner-1/storefront-card/owner-banner.txt',
        ),
        'owner upload',
      ),
    );
  });

  it('allows verified and subscribed owners on the approved owner-media path', async () => {
    await seedApprovedOwnerAccess();
    const storage = testEnv
      .authenticatedContext('owner-1', {
        role: 'owner',
      })
      .storage();

    await assertSucceeds(
      uploadString(
        ref(
          storage,
          'dispensary-media/disp-1/approved/owner/owner-1/storefront-card/owner-banner.txt',
        ),
        'owner upload',
        'raw',
        {
          contentType: 'image/png',
        },
      ),
    );

    await assertFails(
      getDownloadURL(
        ref(
          storage,
          'dispensary-media/disp-1/approved/owner/owner-1/storefront-card/owner-banner.txt',
        ),
      ),
    );

    await assertFails(
      getDownloadURL(
        ref(
          testEnv.unauthenticatedContext().storage(),
          'dispensary-media/disp-1/approved/owner/owner-1/storefront-card/owner-banner.txt',
        ),
      ),
    );
  });

  it('denies owners from writing media into another owner uid path', async () => {
    await seedApprovedOwnerAccess();
    const storage = testEnv
      .authenticatedContext('owner-1', {
        role: 'owner',
      })
      .storage();

    await assertFails(
      uploadString(
        ref(
          storage,
          'dispensary-media/disp-1/approved/owner/owner-2/storefront-card/owner-banner.txt',
        ),
        'owner upload',
      ),
    );
  });

  it('denies owners without an active subscription on the approved owner-media path', async () => {
    await seedApprovedOwnerAccess({
      subscriptionStatus: 'inactive',
    });
    const storage = testEnv
      .authenticatedContext('owner-1', {
        role: 'owner',
      })
      .storage();

    await assertFails(
      uploadString(
        ref(
          storage,
          'dispensary-media/disp-1/approved/owner/owner-1/storefront-gallery/owner-banner.txt',
        ),
        'owner upload',
      ),
    );
  });

  it('allows admins on both deals-media path shapes', async () => {
    const storage = testEnv
      .authenticatedContext('admin-1', {
        admin: true,
        role: 'admin',
      })
      .storage();

    await assertSucceeds(
      uploadString(ref(storage, 'deals-media/disp-1/deal-1/admin-banner.txt'), 'admin upload'),
    );
    await assertSucceeds(
      uploadString(
        ref(storage, 'deals-media/disp-1/owner-1/deal-1/admin-owner-banner.txt'),
        'admin upload',
      ),
    );
    await assertSucceeds(
      uploadString(
        ref(
          storage,
          'dispensary-media/disp-1/approved/owner/owner-1/storefront-card/admin-owner-banner.txt',
        ),
        'admin upload',
        'raw',
        {
          contentType: 'image/png',
        },
      ),
    );

    await assertSucceeds(
      getDownloadURL(ref(storage, 'deals-media/disp-1/deal-1/admin-banner.txt')),
    );
    await assertSucceeds(
      getDownloadURL(ref(storage, 'deals-media/disp-1/owner-1/deal-1/admin-owner-banner.txt')),
    );
    await assertSucceeds(
      getDownloadURL(
        ref(
          storage,
          'dispensary-media/disp-1/approved/owner/owner-1/storefront-card/admin-owner-banner.txt',
        ),
      ),
    );
  });

  it('blocks direct public and customer reads on both deals-media path shapes', async () => {
    const adminStorage = testEnv
      .authenticatedContext('admin-1', {
        admin: true,
        role: 'admin',
      })
      .storage();

    await assertSucceeds(
      uploadString(ref(adminStorage, 'deals-media/disp-1/deal-1/admin-banner.txt'), 'admin upload'),
    );
    await assertSucceeds(
      uploadString(
        ref(adminStorage, 'deals-media/disp-1/owner-1/deal-1/admin-owner-banner.txt'),
        'admin upload',
      ),
    );

    const customerStorage = testEnv
      .authenticatedContext('customer-1', {
        role: 'customer',
      })
      .storage();

    await assertFails(
      getDownloadURL(ref(customerStorage, 'deals-media/disp-1/deal-1/admin-banner.txt')),
    );
    await assertFails(
      getDownloadURL(
        ref(customerStorage, 'deals-media/disp-1/owner-1/deal-1/admin-owner-banner.txt'),
      ),
    );
    await assertFails(
      getDownloadURL(
        ref(
          testEnv.unauthenticatedContext().storage(),
          'deals-media/disp-1/deal-1/admin-banner.txt',
        ),
      ),
    );
    await assertFails(
      getDownloadURL(
        ref(
          testEnv.unauthenticatedContext().storage(),
          'deals-media/disp-1/owner-1/deal-1/admin-owner-banner.txt',
        ),
      ),
    );
  });
});

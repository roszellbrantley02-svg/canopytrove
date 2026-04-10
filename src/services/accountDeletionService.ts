import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, deleteDoc, doc, getDocs, query, where } from 'firebase/firestore';
import { brand } from '../config/brand';
import { getFirebaseDb } from '../config/firebase';
import { deleteStorefrontBackendProfile } from './storefrontBackendService';
import { createFreshAppProfile } from './appProfileService';
import { buildCanopyTroveAccountDeletionSummary } from './accountDeletionSummary';
import type { CanopyTroveAuthDeletionResult } from './canopyTroveAuthService';
import { deleteCanopyTroveAuthAccount, signOutCanopyTroveSession } from './canopyTroveAuthService';
import { replaceCommunitySafetyState } from './communitySafetyService';

export type CanopyTroveAccountDeletionResult = {
  ok: boolean;
  partial: boolean;
  reason: CanopyTroveAuthDeletionResult['reason'];
  nextProfile: Awaited<ReturnType<typeof createFreshAppProfile>>;
  message: string;
};

async function clearCanopyTroveLocalStorage() {
  const allKeys = await AsyncStorage.getAllKeys();
  const canopyTroveKeys = allKeys.filter((key) => key.startsWith(`${brand.storageNamespace}:`));
  if (canopyTroveKeys.length) {
    await AsyncStorage.multiRemove(canopyTroveKeys);
  }
}

async function deleteOwnerPortalAccountData(accountId: string | null) {
  const normalizedAccountId = accountId?.trim() || null;
  if (!normalizedAccountId) {
    return;
  }

  const db = getFirebaseDb();
  if (!db) {
    return;
  }

  const directDocCollections = [
    'ownerProfiles',
    'businessVerifications',
    'identityVerifications',
    'subscriptions',
  ];

  await Promise.all(
    directDocCollections.map((collectionName) =>
      deleteDoc(doc(db, collectionName, normalizedAccountId)).catch(() => undefined),
    ),
  );

  const dispensaryClaimsSnapshot = await getDocs(
    query(collection(db, 'dispensaryClaims'), where('ownerUid', '==', normalizedAccountId)),
  ).catch(() => null);

  if (dispensaryClaimsSnapshot) {
    await Promise.all(
      dispensaryClaimsSnapshot.docs.map((documentSnapshot) =>
        deleteDoc(documentSnapshot.ref).catch(() => undefined),
      ),
    );
  }
}

export async function deleteCanopyTroveAccount(options: {
  profileId: string;
  accountId: string | null;
  isAuthenticatedAccount: boolean;
  shouldDeleteBackendProfile: boolean;
}) {
  if (options.shouldDeleteBackendProfile) {
    try {
      await deleteStorefrontBackendProfile(options.profileId);
    } catch {
      // Best-effort backend cleanup. Local deletion still continues.
    }
  }

  await deleteOwnerPortalAccountData(options.accountId);

  const authDeletionResult = options.isAuthenticatedAccount
    ? await deleteCanopyTroveAuthAccount()
    : {
        ok: true,
        reason: null,
        message: null,
      };

  if (options.isAuthenticatedAccount && !authDeletionResult.ok) {
    await signOutCanopyTroveSession().catch(() => false);
  }

  await clearCanopyTroveLocalStorage();
  await replaceCommunitySafetyState(null, {
    persist: false,
    trackMutation: false,
  });
  const nextProfile = await createFreshAppProfile();
  const summary = buildCanopyTroveAccountDeletionSummary({
    isAuthenticatedAccount: options.isAuthenticatedAccount,
    authDeletionResult,
  });

  return {
    ok: summary.ok,
    partial: summary.partial,
    reason: summary.reason,
    nextProfile,
    message: summary.message,
  } satisfies CanopyTroveAccountDeletionResult;
}

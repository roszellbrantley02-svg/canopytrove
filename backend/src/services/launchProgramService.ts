import { getBackendFirebaseDb } from '../firebase';
import { StorefrontGamificationStateApiDocument } from '../types';
import { serverConfig } from '../config';

const EARLY_ADOPTER_BADGE_ID = 'early_adopter';
const LAUNCH_PROGRAM_META_COLLECTION = 'launch_program_meta';
const LAUNCH_PROGRAM_META_DOC_ID = 'primary';
const EARLY_ADOPTER_CLAIMS_COLLECTION = 'launch_program_early_adopters';
const OWNER_TRIAL_CLAIMS_COLLECTION = 'launch_program_owner_trials';
const DAY_MS = 24 * 60 * 60 * 1000;

type LaunchProgramMetaRecord = {
  earlyAdopterClaimCount: number;
  updatedAt: string;
};

type EarlyAdopterClaimRecord = {
  accountId: string;
  profileId: string;
  badgeId: typeof EARLY_ADOPTER_BADGE_ID;
  joinedDate: string;
  claimedAt: string;
};

type OwnerLaunchTrialClaimRecord = {
  ownerUid: string;
  storefrontId: string;
  claimedAt: string;
  trialDays: number;
  windowEndsAt: string;
};

type TrialEligibilitySubscription = {
  externalSubscriptionId?: string | null;
  status?: string | null;
};

type LaunchProgramWindow = {
  startsAt: string;
  endsAt: string;
  active: boolean;
};

const earlyAdopterClaimStore = new Map<string, EarlyAdopterClaimRecord>();
const ownerTrialClaimStore = new Map<string, OwnerLaunchTrialClaimRecord>();
let launchProgramMetaStore: LaunchProgramMetaRecord = {
  earlyAdopterClaimCount: 0,
  updatedAt: '',
};

function parseLaunchProgramWindow(nowIso: string): LaunchProgramWindow | null {
  const startAt = serverConfig.launchProgramStartAt?.trim();
  if (!startAt) {
    return null;
  }

  const start = new Date(startAt);
  const now = new Date(nowIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(now.getTime())) {
    return null;
  }

  const endsAt = new Date(start.getTime() + serverConfig.launchProgramDurationDays * DAY_MS);
  return {
    startsAt: start.toISOString(),
    endsAt: endsAt.toISOString(),
    active: now.getTime() >= start.getTime() && now.getTime() < endsAt.getTime(),
  };
}

function getNormalizedBadges(badges: string[] | undefined, includeEarlyAdopter: boolean) {
  const nextBadges: string[] = [];
  const seen = new Set<string>();

  for (const badge of badges ?? []) {
    if (typeof badge !== 'string') {
      continue;
    }

    const normalizedBadge = badge.trim();
    if (
      !normalizedBadge ||
      normalizedBadge === EARLY_ADOPTER_BADGE_ID ||
      seen.has(normalizedBadge)
    ) {
      continue;
    }

    seen.add(normalizedBadge);
    nextBadges.push(normalizedBadge);
  }

  if (includeEarlyAdopter) {
    nextBadges.push(EARLY_ADOPTER_BADGE_ID);
  }

  return nextBadges;
}

function normalizeSubscriptionStatus(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? '';
}

function shouldBlockOwnerTrialForExistingSubscription(
  subscription: TrialEligibilitySubscription | null | undefined,
) {
  if (subscription?.externalSubscriptionId) {
    return true;
  }

  const status = normalizeSubscriptionStatus(subscription?.status);
  return (
    status === 'trial' || status === 'active' || status === 'past_due' || status === 'suspended'
  );
}

async function getEarlyAdopterClaim(accountId: string) {
  const db = getBackendFirebaseDb();
  if (db) {
    const snapshot = await db.collection(EARLY_ADOPTER_CLAIMS_COLLECTION).doc(accountId).get();
    if (!snapshot.exists) {
      return null;
    }

    return snapshot.data() as EarlyAdopterClaimRecord;
  }

  return earlyAdopterClaimStore.get(accountId) ?? null;
}

async function claimEarlyAdopterBadge(input: {
  accountId: string;
  profileId: string;
  joinedDate: string;
  claimedAt: string;
}) {
  const existingClaim = await getEarlyAdopterClaim(input.accountId);
  if (existingClaim) {
    return existingClaim;
  }

  const window = parseLaunchProgramWindow(input.claimedAt);
  if (!window?.active || serverConfig.launchEarlyAdopterLimit <= 0) {
    return null;
  }

  const db = getBackendFirebaseDb();
  if (db) {
    const claimRef = db.collection(EARLY_ADOPTER_CLAIMS_COLLECTION).doc(input.accountId);
    const metaRef = db.collection(LAUNCH_PROGRAM_META_COLLECTION).doc(LAUNCH_PROGRAM_META_DOC_ID);
    let createdClaim: EarlyAdopterClaimRecord | null = null;

    await db.runTransaction(async (transaction) => {
      const [claimSnapshot, metaSnapshot] = await Promise.all([
        transaction.get(claimRef),
        transaction.get(metaRef),
      ]);

      if (claimSnapshot.exists) {
        createdClaim = claimSnapshot.data() as EarlyAdopterClaimRecord;
        return;
      }

      const claimedCount = Number(
        (metaSnapshot.data() as Partial<LaunchProgramMetaRecord> | undefined)
          ?.earlyAdopterClaimCount ?? 0,
      );
      if (claimedCount >= serverConfig.launchEarlyAdopterLimit) {
        return;
      }

      createdClaim = {
        accountId: input.accountId,
        profileId: input.profileId,
        badgeId: EARLY_ADOPTER_BADGE_ID,
        joinedDate: input.joinedDate,
        claimedAt: input.claimedAt,
      };

      transaction.set(claimRef, createdClaim);
      transaction.set(
        metaRef,
        {
          earlyAdopterClaimCount: claimedCount + 1,
          updatedAt: input.claimedAt,
        } satisfies LaunchProgramMetaRecord,
        { merge: true },
      );
    });

    return createdClaim;
  }

  if (launchProgramMetaStore.earlyAdopterClaimCount >= serverConfig.launchEarlyAdopterLimit) {
    return null;
  }

  const createdClaim: EarlyAdopterClaimRecord = {
    accountId: input.accountId,
    profileId: input.profileId,
    badgeId: EARLY_ADOPTER_BADGE_ID,
    joinedDate: input.joinedDate,
    claimedAt: input.claimedAt,
  };
  earlyAdopterClaimStore.set(input.accountId, createdClaim);
  launchProgramMetaStore = {
    earlyAdopterClaimCount: launchProgramMetaStore.earlyAdopterClaimCount + 1,
    updatedAt: input.claimedAt,
  };
  return createdClaim;
}

async function getOwnerLaunchTrialClaim(ownerUid: string) {
  const db = getBackendFirebaseDb();
  if (db) {
    const snapshot = await db.collection(OWNER_TRIAL_CLAIMS_COLLECTION).doc(ownerUid).get();
    if (!snapshot.exists) {
      return null;
    }

    return snapshot.data() as OwnerLaunchTrialClaimRecord;
  }

  return ownerTrialClaimStore.get(ownerUid) ?? null;
}

async function claimOwnerLaunchTrial(input: {
  ownerUid: string;
  storefrontId: string;
  claimedAt: string;
  trialDays: number;
  windowEndsAt: string;
}) {
  const existingClaim = await getOwnerLaunchTrialClaim(input.ownerUid);
  if (existingClaim) {
    return existingClaim;
  }

  const db = getBackendFirebaseDb();
  if (db) {
    const claimRef = db.collection(OWNER_TRIAL_CLAIMS_COLLECTION).doc(input.ownerUid);
    let createdClaim: OwnerLaunchTrialClaimRecord | null = null;

    await db.runTransaction(async (transaction) => {
      const claimSnapshot = await transaction.get(claimRef);
      if (claimSnapshot.exists) {
        createdClaim = claimSnapshot.data() as OwnerLaunchTrialClaimRecord;
        return;
      }

      createdClaim = {
        ownerUid: input.ownerUid,
        storefrontId: input.storefrontId,
        claimedAt: input.claimedAt,
        trialDays: input.trialDays,
        windowEndsAt: input.windowEndsAt,
      };
      transaction.set(claimRef, createdClaim);
    });

    return createdClaim;
  }

  const createdClaim: OwnerLaunchTrialClaimRecord = {
    ownerUid: input.ownerUid,
    storefrontId: input.storefrontId,
    claimedAt: input.claimedAt,
    trialDays: input.trialDays,
    windowEndsAt: input.windowEndsAt,
  };
  ownerTrialClaimStore.set(input.ownerUid, createdClaim);
  return createdClaim;
}

export async function applyEarlyAdopterLaunchProgramToGamificationState(input: {
  profileId: string;
  accountId: string | null;
  currentState?: Partial<StorefrontGamificationStateApiDocument> | null;
  nextState?: Partial<StorefrontGamificationStateApiDocument> | undefined;
  joinedDate: string;
  now?: string;
}) {
  const now = input.now ?? new Date().toISOString();
  const sourceState = input.nextState ?? input.currentState ?? undefined;
  let hasEarlyAdopterClaim = false;

  if (input.accountId) {
    hasEarlyAdopterClaim = Boolean(
      await claimEarlyAdopterBadge({
        accountId: input.accountId,
        profileId: input.profileId,
        joinedDate: input.joinedDate,
        claimedAt: now,
      }),
    );
  }

  if (!sourceState) {
    if (!hasEarlyAdopterClaim) {
      return undefined;
    }

    return {
      profileId: input.profileId,
      joinedDate: input.joinedDate,
      badges: [EARLY_ADOPTER_BADGE_ID],
    } satisfies Partial<StorefrontGamificationStateApiDocument>;
  }

  return {
    ...sourceState,
    profileId: input.profileId,
    joinedDate: sourceState.joinedDate ?? input.joinedDate,
    badges: getNormalizedBadges(sourceState.badges, hasEarlyAdopterClaim),
  } satisfies Partial<StorefrontGamificationStateApiDocument>;
}

export async function resolveOwnerLaunchTrialOffer(input: {
  ownerUid: string;
  storefrontId: string;
  currentSubscription?: TrialEligibilitySubscription | null;
  tier?: string;
  now?: string;
}) {
  const now = input.now ?? new Date().toISOString();
  const existingClaim = await getOwnerLaunchTrialClaim(input.ownerUid);
  const launchWindow = parseLaunchProgramWindow(now);

  if (existingClaim) {
    if (shouldBlockOwnerTrialForExistingSubscription(input.currentSubscription)) {
      return {
        trialDays: 0,
        claim: existingClaim,
      };
    }

    return {
      trialDays: existingClaim.trialDays,
      claim: existingClaim,
    };
  }

  // Launch trial is only available for the Growth tier
  const requestedTier = input.tier?.trim().toLowerCase() ?? '';
  if (requestedTier && requestedTier !== 'growth') {
    return {
      trialDays: 0,
      claim: null,
    };
  }

  if (
    !launchWindow?.active ||
    serverConfig.ownerLaunchTrialDays <= 0 ||
    shouldBlockOwnerTrialForExistingSubscription(input.currentSubscription)
  ) {
    return {
      trialDays: 0,
      claim: null,
    };
  }

  const claim = await claimOwnerLaunchTrial({
    ownerUid: input.ownerUid,
    storefrontId: input.storefrontId,
    claimedAt: now,
    trialDays: serverConfig.ownerLaunchTrialDays,
    windowEndsAt: launchWindow.endsAt,
  });

  return {
    trialDays: claim?.trialDays ?? 0,
    claim,
  };
}

export function clearLaunchProgramMemoryStateForTests() {
  earlyAdopterClaimStore.clear();
  ownerTrialClaimStore.clear();
  launchProgramMetaStore = {
    earlyAdopterClaimCount: 0,
    updatedAt: '',
  };
}

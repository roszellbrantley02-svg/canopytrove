import React from 'react';
import type { CanopyTroveAuthSession } from '../types/identity';
import { getOwnerPortalAccessState } from '../services/ownerPortalShared';
import type { OwnerPortalClaimRole } from '../services/ownerPortalSessionService';
import {
  ensureOwnerPortalSessionReady,
  getCurrentOwnerPortalClaimRole,
} from '../services/ownerPortalSessionService';
import { hasOwnerProfileDocument } from '../services/ownerPortalProfileService';

export function useOwnerPortalAccessState(authSession: CanopyTroveAuthSession) {
  const [claimRole, setClaimRole] = React.useState<OwnerPortalClaimRole | null>(null);
  const [isCheckingAccess, setIsCheckingAccess] = React.useState(false);

  React.useEffect(() => {
    let active = true;

    if (authSession.status !== 'authenticated') {
      setClaimRole(null);
      setIsCheckingAccess(false);
      return () => {
        active = false;
      };
    }

    setIsCheckingAccess(true);
    void (async () => {
      try {
        let nextClaimRole = await getCurrentOwnerPortalClaimRole();
        if (!nextClaimRole && authSession.uid) {
          const hasOwnerProfile = await hasOwnerProfileDocument(authSession.uid);
          if (hasOwnerProfile) {
            const ownerSession = await ensureOwnerPortalSessionReady();
            nextClaimRole = ownerSession.role;
          }
        }
        if (!active) {
          return;
        }

        setClaimRole(nextClaimRole);
      } catch (error) {
        if (__DEV__) {
          console.warn('[useOwnerPortalAccessState] failed to fetch claim role:', error);
        }
      } finally {
        if (active) {
          setIsCheckingAccess(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [authSession.status, authSession.uid]);

  const accessState = React.useMemo(
    () =>
      getOwnerPortalAccessState({
        claimRole,
      }),
    [claimRole],
  );

  return {
    accessState,
    claimRole,
    isCheckingAccess,
  };
}

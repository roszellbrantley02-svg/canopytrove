import React from 'react';
import { getOwnerProfile } from '../../services/ownerPortalService';
import type { OwnerProfileDocument } from '../../types/ownerPortal';

export function useOwnerPortalProfileLoader(ownerUid: string | null) {
  const [ownerProfile, setOwnerProfile] = React.useState<OwnerProfileDocument | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [statusText, setStatusText] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    if (!ownerUid) {
      setIsLoading(false);
      return;
    }

    void (async () => {
      try {
        const nextOwnerProfile = await getOwnerProfile(ownerUid);
        if (alive) {
          setOwnerProfile(nextOwnerProfile);
        }
      } catch (error) {
        if (alive) {
          setStatusText(error instanceof Error ? error.message : 'Unable to load owner profile.');
        }
      } finally {
        if (alive) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, [ownerUid]);

  return {
    isLoading,
    ownerProfile,
    setStatusText,
    statusText,
  };
}

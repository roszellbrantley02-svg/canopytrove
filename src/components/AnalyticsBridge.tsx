import React from 'react';
import { useStorefrontProfileController } from '../context/StorefrontController';
import { setAnalyticsIdentity } from '../services/analyticsService';

export function AnalyticsBridge() {
  const { appProfile, authSession, profileId } = useStorefrontProfileController();

  React.useEffect(() => {
    setAnalyticsIdentity({
      profileId,
      accountId: authSession.uid,
      profileKind:
        appProfile?.kind === 'authenticated' || appProfile?.kind === 'anonymous'
          ? appProfile.kind
          : null,
    });
  }, [appProfile?.kind, authSession.uid, profileId]);

  return null;
}

import React from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useStorefrontProfileController } from '../../context/StorefrontController';
import { useOwnerPortalAccessState } from '../../hooks/useOwnerPortalAccessState';
import { useSavedSummaries } from '../../hooks/useStorefrontSummaryData';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { getOwnerDispensaryClaim, getOwnerProfile } from '../../services/ownerPortalService';
import type { OwnerDispensaryClaimDocument, OwnerProfileDocument } from '../../types/ownerPortal';
import { getNextStepContent } from './ownerPortalHomeShared';
import { OWNER_PORTAL_PREVIEW_UID, ownerPortalPreviewAccessState } from './ownerPortalPreviewData';
import {
  getOwnerPortalPreviewClaim,
  getOwnerPortalPreviewClaimedStorefrontSummary,
  getOwnerPortalPreviewProfile,
} from '../../services/ownerPortalPreviewService';
import type { StorefrontSummary } from '../../types/storefront';

export function useOwnerPortalHomeScreenModel(preview = false) {
  const isPreview = preview;
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { authSession } = useStorefrontProfileController();
  const liveAccessState = useOwnerPortalAccessState(authSession);
  const ownerUid = authSession.uid;
  const [ownerProfile, setOwnerProfile] = React.useState<OwnerProfileDocument | null>(null);
  const [ownerClaim, setOwnerClaim] = React.useState<OwnerDispensaryClaimDocument | null>(null);
  const [previewStorefront, setPreviewStorefront] = React.useState<StorefrontSummary | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [errorText, setErrorText] = React.useState<string | null>(null);
  const previewOwnerUid = OWNER_PORTAL_PREVIEW_UID;
  const claimedStorefrontIds = ownerProfile?.dispensaryId ? [ownerProfile.dispensaryId] : [];
  const { data: claimedStorefronts } = useSavedSummaries(claimedStorefrontIds);

  React.useEffect(() => {
    if (isPreview) {
      let alive = true;

      setIsLoading(true);
      void (async () => {
        try {
          const [nextOwnerProfile, nextOwnerClaim, nextStorefront] = await Promise.all([
            getOwnerPortalPreviewProfile(),
            getOwnerPortalPreviewClaim(),
            getOwnerPortalPreviewClaimedStorefrontSummary(),
          ]);
          if (!alive) {
            return;
          }

          setOwnerProfile(nextOwnerProfile);
          setOwnerClaim(nextOwnerClaim);
          setPreviewStorefront(nextStorefront);
          setErrorText(null);
        } catch (error) {
          if (!alive) {
            return;
          }

          setErrorText(
            error instanceof Error ? error.message : 'Unable to load preview owner data.',
          );
        } finally {
          if (alive) {
            setIsLoading(false);
          }
        }
      })();

      return () => {
        alive = false;
      };
    }

    let alive = true;
    if (!ownerUid) {
      setOwnerProfile(null);
      setOwnerClaim(null);
      setPreviewStorefront(null);
      setErrorText(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorText(null);
    void (async () => {
      try {
        const nextOwnerProfile = await getOwnerProfile(ownerUid);
        if (!alive) {
          return;
        }

        setOwnerProfile(nextOwnerProfile);
        if (!nextOwnerProfile?.dispensaryId) {
          setOwnerClaim(null);
          return;
        }

        const nextOwnerClaim = await getOwnerDispensaryClaim(
          ownerUid,
          nextOwnerProfile.dispensaryId,
        );
        if (alive) {
          setOwnerClaim(nextOwnerClaim);
        }
      } catch (error) {
        if (alive) {
          setErrorText(error instanceof Error ? error.message : 'Unable to load owner profile.');
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
  }, [authSession.uid, isPreview, ownerUid]);

  const accessState = React.useMemo(
    () => (isPreview ? ownerPortalPreviewAccessState : liveAccessState.accessState),
    [isPreview, liveAccessState.accessState],
  );
  const claimedStorefront = isPreview ? previewStorefront : (claimedStorefronts[0] ?? null);
  const nextStep = ownerProfile ? getNextStepContent(ownerProfile.onboardingStep) : null;

  const handleContinue = React.useCallback(() => {
    const nextOwnerUid = isPreview ? previewOwnerUid : ownerUid;

    if (!nextOwnerUid || !ownerProfile || !nextStep?.routeName) {
      return;
    }

    switch (nextStep.routeName) {
      case 'OwnerPortalBusinessDetails':
        navigation.navigate('OwnerPortalBusinessDetails', {
          ownerUid: nextOwnerUid,
          initialLegalName: ownerProfile.legalName,
          initialCompanyName: ownerProfile.companyName,
          initialPhone: ownerProfile.phone ?? undefined,
          preview: isPreview,
        });
        return;
      case 'OwnerPortalClaimListing':
        navigation.navigate('OwnerPortalClaimListing', isPreview ? { preview: true } : undefined);
        return;
      case 'OwnerPortalBusinessVerification':
        navigation.navigate(
          'OwnerPortalBusinessVerification',
          isPreview ? { preview: true } : undefined,
        );
        return;
      case 'OwnerPortalIdentityVerification':
        navigation.navigate(
          'OwnerPortalIdentityVerification',
          isPreview ? { preview: true } : undefined,
        );
        return;
      case 'OwnerPortalSubscription':
        navigation.navigate('OwnerPortalSubscription', isPreview ? { preview: true } : undefined);
        return;
      default:
        return;
    }
  }, [isPreview, navigation, nextStep, ownerProfile, ownerUid, previewOwnerUid]);

  return {
    accessState,
    isCheckingAccess: liveAccessState.isCheckingAccess,
    authSession,
    claimedStorefront,
    errorText,
    handleContinue,
    isLoading,
    nextStep,
    ownerClaim,
    ownerProfile,
  };
}

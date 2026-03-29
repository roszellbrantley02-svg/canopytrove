import React from 'react';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  useStorefrontProfileController,
  useStorefrontQueryController,
  useStorefrontRewardsController,
  useStorefrontRouteController,
} from '../../context/StorefrontController';
import {
  ownerPortalPrelaunchEnabled,
  ownerPortalPreviewEnabled,
} from '../../config/ownerPortalConfig';
import { storefrontSourceMode } from '../../config/storefrontSourceConfig';
import { useStorefrontBackendHealth } from '../../hooks/useStorefrontBackendHealth';
import { useStorefrontBackendSeedStatus } from '../../hooks/useStorefrontBackendSeedStatus';
import { useGamificationLeaderboardRank } from '../../hooks/useGamificationData';
import { useRecentStorefrontIds, useSavedSummaries } from '../../hooks/useStorefrontData';
import { RootStackParamList } from '../../navigation/RootNavigator';
import { storefrontSourceStatus } from '../../sources';
import { legalConfig } from '../../config/legal';
import {
  getCommunitySafetyState,
  initializeCommunitySafetyState,
} from '../../services/communitySafetyService';
import { useProfileActions } from './useProfileActions';
import { useProfileDerivedState } from './useProfileDerivedState';

export function useProfileScreenModel(
  navigation: NativeStackNavigationProp<RootStackParamList>
) {
  const { savedStorefrontIds } = useStorefrontRouteController();
  const {
    appProfile,
    authSession,
    clearDisplayName,
    isStartingGuestSession,
    profileId,
    signOutSession,
    startGuestSession,
    updateDisplayName,
  } = useStorefrontProfileController();
  const { activeLocation, activeLocationLabel, activeLocationMode } = useStorefrontQueryController();
  const { badgeDefinitions, gamificationState, levelTitle } = useStorefrontRewardsController();
  const { data: rankData } = useGamificationLeaderboardRank();
  const { data: savedStorefronts, isLoading: isLoadingSaved } = useSavedSummaries(savedStorefrontIds);
  const { data: recentStorefrontIds, isLoading: isLoadingRecentIds } = useRecentStorefrontIds();
  const { data: recentStorefronts, isLoading: isLoadingRecentStorefronts } = useSavedSummaries(recentStorefrontIds);
  const backendHealth = useStorefrontBackendHealth();
  const { data: backendSeedStatus, isLoading: isLoadingBackendSeedStatus } = useStorefrontBackendSeedStatus();
  const [displayNameInput, setDisplayNameInput] = React.useState(appProfile?.displayName ?? '');
  const {
    displayName,
    earnedBadges,
    featuredBadges,
    joinedDays,
    levelProgress,
    nextBadges,
    profileInitials,
    rank,
    seedCounts,
  } = useProfileDerivedState({
    appProfile,
    badgeDefinitions,
    backendSeedStatus,
    gamificationState,
    levelTitle,
    profileId,
    rank: rankData.rank,
  });
  const {
    canSeed,
    dismissOwnerPreview,
    isSavingDisplayName,
    isSeeding,
    ownerPortalAccess,
    profileActionStatus,
    seedStatus,
    showOwnerPreview,
    clearDisplayName: clearProfileDisplayName,
    openLeaderboard,
    openLegalCenter,
    openMemberSignIn,
    openMemberSignUp,
    openDeleteAccount,
    openOwnerSignIn,
    openOwnerPortal,
    saveDisplayName,
    seed,
    signOut,
    startGuestSession: startGuestProfileSession,
  } = useProfileActions({
    authSession,
    backendHealth,
    clearDisplayName,
    displayNameInput,
    navigation,
    profileId,
    signOutSession,
    startGuestSession,
    updateDisplayName,
  });
  const [communitySafetyState, setCommunitySafetyState] = React.useState(() =>
    getCommunitySafetyState()
  );

  React.useEffect(() => {
    let alive = true;

    const refresh = () => {
      if (alive) {
        setCommunitySafetyState(getCommunitySafetyState());
      }
    };

    void initializeCommunitySafetyState().then(refresh);
    const unsubscribe = navigation.addListener('focus', refresh);

    return () => {
      alive = false;
      unsubscribe();
    };
  }, [navigation]);

  React.useEffect(() => {
    setDisplayNameInput(appProfile?.displayName ?? '');
  }, [appProfile?.displayName]);

  return {
    activeLocation,
    activeLocationLabel,
    activeLocationMode,
    appProfile,
    authSession,
    backendHealth,
    canSeed,
    dismissOwnerPreview,
    displayName,
    displayNameInput,
    earnedBadges,
    featuredBadges,
    gamificationState,
    isLoadingBackendSeedStatus,
    isLoadingRecentIds,
    isLoadingRecentStorefronts,
    isLoadingSaved,
    isSavingDisplayName,
    isSeeding,
    isStartingGuestSession,
    joinedDays,
    legalSupportEmail: legalConfig.supportEmail,
    levelProgress,
    levelTitle,
    navigation,
    nextBadges,
    openLeaderboard,
    openLegalCenter,
    openMemberSignIn,
    openMemberSignUp,
    openDeleteAccount,
    openOwnerPortal,
    openOwnerSignIn,
    ownerPortalAccess,
    ownerPortalPrelaunchEnabled,
    ownerPortalPreviewEnabled,
    profileActionStatus,
    profileId,
    profileInitials,
    rank,
    recentStorefrontIds,
    recentStorefronts,
    savedStorefrontIds,
    savedStorefronts,
    hasAcceptedGuidelines: Boolean(communitySafetyState.acceptedGuidelinesVersion),
    blockedAuthorCount: communitySafetyState.blockedAuthorProfileIds.length,
    seed,
    seedCounts,
    seedStatus,
    setDisplayNameInput,
    showOwnerPreview,
    signOut,
    startGuestSession: startGuestProfileSession,
    storefrontSourceMode,
    storefrontSourceStatus,
    saveDisplayName,
    clearDisplayName: clearProfileDisplayName,
  };
}

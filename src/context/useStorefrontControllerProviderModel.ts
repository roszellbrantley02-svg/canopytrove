import React from 'react';
import { getCachedStorefrontPreferences } from '../services/storefrontPreferencesService';
import { normalizeGamificationState } from '../services/canopyTroveGamificationService';
import { deleteCanopyTroveAccount } from '../services/accountDeletionService';
import { clearStorefrontRepositoryCache } from '../repositories/storefrontRepository';
import { storefrontSourceMode } from '../config/storefrontSourceConfig';
import { useStorefrontControllerValues } from './useStorefrontControllerValues';
import { useStorefrontRewardsModel } from './useStorefrontRewardsModel';
import { useStorefrontRemoteProfileSync } from './useStorefrontRemoteProfileSync';
import { useStorefrontProfileModel } from './useStorefrontProfileModel';
import { useStorefrontQueryModel } from './useStorefrontQueryModel';
import { useStorefrontRouteState } from './useStorefrontRouteState';

export function useStorefrontControllerProviderModel() {
  const cachedPreferences = getCachedStorefrontPreferences();
  const {
    appProfile,
    setAppProfile,
    authSession,
    isStartingGuestSession,
    profileId,
    setProfileId,
    startGuestSession,
    signOutSession,
    updateDisplayName,
    clearDisplayName,
  } = useStorefrontProfileModel({
    cachedProfileId: cachedPreferences?.profileId ?? cachedPreferences?.routeProfileId,
  });
  const routeState = useStorefrontRouteState(cachedPreferences?.savedStorefrontIds ?? []);
  const initialGamificationState = React.useMemo(
    () =>
      normalizeGamificationState(
        profileId,
        cachedPreferences?.gamificationState,
        appProfile?.createdAt
      ),
    [appProfile?.createdAt, cachedPreferences, profileId]
  );
  const rewardsModel = useStorefrontRewardsModel({
    profileId,
    profileCreatedAt: appProfile?.createdAt,
    initialState: initialGamificationState,
  });
  const {
    gamificationState,
    gamificationStateRef,
    setGamificationState,
  } = rewardsModel;
  const {
    availableAreas,
    selectedAreaId,
    selectedArea,
    searchQuery,
    locationQuery,
    deviceLocationLabel,
    locationError,
    isResolvingLocation,
    browseSortKey,
    browseHotDealsOnly,
    deviceLocation,
    searchLocation,
    activeLocation,
    activeLocationMode,
    activeLocationLabel,
    storefrontQuery,
    hasHydratedPreferences,
    setSelectedAreaId,
    setSearchQuery,
    setLocationQuery,
    setBrowseSortKey,
    setBrowseHotDealsOnly,
    setDeviceLocation,
    useDeviceLocation,
    applyLocationQuery,
  } = useStorefrontQueryModel({
    cachedPreferences,
    profileId,
    profileCreatedAt: appProfile?.createdAt,
    savedStorefrontIds: routeState.savedStorefrontIds,
    gamificationState,
    setSavedStorefrontIds: routeState.setSavedStorefrontIds,
    setGamificationState,
  });

  useStorefrontRemoteProfileSync({
    appProfile,
    authSession,
    hasHydratedPreferences,
    profileId,
    recentStorefrontIds: routeState.recentStorefrontIds,
    savedStorefrontIds: routeState.savedStorefrontIds,
    gamificationState,
    gamificationStateRef,
    setAppProfile,
    setProfileId,
    setRecentStorefrontIds: routeState.setRecentStorefrontIds,
    setSavedStorefrontIds: routeState.setSavedStorefrontIds,
    setGamificationState,
  });
  const deleteAccount = React.useCallback(async () => {
    if (!appProfile) {
      return {
        ok: false,
        partial: false,
        message: 'No Canopy Trove profile is loaded right now.',
      };
    }

    const result = await deleteCanopyTroveAccount({
      profileId,
      accountId: authSession.uid ?? null,
      isAuthenticatedAccount: authSession.status === 'authenticated',
      shouldDeleteBackendProfile: storefrontSourceMode === 'api',
    });

    setAppProfile(result.nextProfile);
    setProfileId(result.nextProfile.id);
    routeState.setSavedStorefrontIds([]);
    routeState.setRecentStorefrontIds([]);
    setGamificationState(
      normalizeGamificationState(result.nextProfile.id, undefined, result.nextProfile.createdAt)
    );
    clearStorefrontRepositoryCache();

    return {
      ok: result.ok,
      partial: result.partial,
      message: result.message,
    };
  }, [
    appProfile,
    authSession.status,
    authSession.uid,
    profileId,
    routeState,
    setAppProfile,
    setGamificationState,
    setProfileId,
  ]);
  const { profileValue, queryValue, rewardsValue, routeValue } = useStorefrontControllerValues({
    appProfile,
    authSession,
    isStartingGuestSession,
    profileId,
    signOutSession,
    startGuestSession,
    deleteAccount,
    updateDisplayName,
    clearDisplayName,
    rewardsModel,
    routeState,
    queryModel: {
      availableAreas,
      selectedAreaId,
      selectedArea,
      searchQuery,
      locationQuery,
      deviceLocationLabel,
      locationError,
      isResolvingLocation,
      browseSortKey,
      browseHotDealsOnly,
      deviceLocation,
      searchLocation,
      activeLocation,
      activeLocationMode,
      activeLocationLabel,
      storefrontQuery,
      setSelectedAreaId,
      setSearchQuery,
      setLocationQuery,
      setBrowseSortKey,
      setBrowseHotDealsOnly,
      setDeviceLocation,
      useDeviceLocation,
      applyLocationQuery,
    },
  });
  return { profileValue, queryValue, rewardsValue, routeValue };
}

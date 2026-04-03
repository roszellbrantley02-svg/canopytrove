import type React from 'react';
import { useContext, useMemo } from 'react';
import { StorefrontControllerContext } from './storefrontControllerShared';

function useRequiredContext<T>(context: React.Context<T | null>, hookName: string) {
  const value = useContext(context);
  if (!value) {
    throw new Error(`${hookName} must be used within StorefrontControllerProvider`);
  }
  return value;
}

export function useStorefrontQueryController() {
  return useRequiredContext(StorefrontControllerContext, 'useStorefrontQueryController').query;
}

export function useStorefrontRouteController() {
  return useRequiredContext(StorefrontControllerContext, 'useStorefrontRouteController').route;
}

export function useStorefrontProfileController() {
  return useRequiredContext(StorefrontControllerContext, 'useStorefrontProfileController').profile;
}

export function useStorefrontRewardsController() {
  return useRequiredContext(StorefrontControllerContext, 'useStorefrontRewardsController').rewards;
}

export function useStorefrontController() {
  const controllerValue = useRequiredContext(
    StorefrontControllerContext,
    'useStorefrontController',
  );

  return useMemo(
    () => ({
      ...controllerValue.query,
      ...controllerValue.route,
      ...controllerValue.profile,
      ...controllerValue.rewards,
    }),
    [controllerValue],
  );
}

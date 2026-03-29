import React, { useContext, useMemo } from 'react';
import {
  StorefrontProfileControllerContext,
  StorefrontQueryControllerContext,
  StorefrontRewardsControllerContext,
  StorefrontRouteControllerContext,
} from './storefrontControllerShared';

function useRequiredContext<T>(context: React.Context<T | null>, hookName: string) {
  const value = useContext(context);
  if (!value) {
    throw new Error(`${hookName} must be used within StorefrontControllerProvider`);
  }
  return value;
}

export function useStorefrontQueryController() {
  return useRequiredContext(
    StorefrontQueryControllerContext,
    'useStorefrontQueryController'
  );
}

export function useStorefrontRouteController() {
  return useRequiredContext(
    StorefrontRouteControllerContext,
    'useStorefrontRouteController'
  );
}

export function useStorefrontProfileController() {
  return useRequiredContext(
    StorefrontProfileControllerContext,
    'useStorefrontProfileController'
  );
}

export function useStorefrontRewardsController() {
  return useRequiredContext(
    StorefrontRewardsControllerContext,
    'useStorefrontRewardsController'
  );
}

export function useStorefrontController() {
  const queryValue = useStorefrontQueryController();
  const routeValue = useStorefrontRouteController();
  const profileValue = useStorefrontProfileController();
  const rewardsValue = useStorefrontRewardsController();

  return useMemo(
    () => ({
      ...queryValue,
      ...routeValue,
      ...profileValue,
      ...rewardsValue,
    }),
    [profileValue, queryValue, rewardsValue, routeValue]
  );
}

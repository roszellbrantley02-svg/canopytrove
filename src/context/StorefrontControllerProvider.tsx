import React, { PropsWithChildren } from 'react';
import {
  StorefrontProfileControllerContext,
  StorefrontQueryControllerContext,
  StorefrontRewardsControllerContext,
  StorefrontRouteControllerContext,
} from './storefrontControllerShared';
import { useStorefrontControllerProviderModel } from './useStorefrontControllerProviderModel';

export function StorefrontControllerProvider({ children }: PropsWithChildren) {
  const { profileValue, queryValue, rewardsValue, routeValue } =
    useStorefrontControllerProviderModel();

  return (
    <StorefrontProfileControllerContext.Provider value={profileValue}>
      <StorefrontRewardsControllerContext.Provider value={rewardsValue}>
        <StorefrontRouteControllerContext.Provider value={routeValue}>
          <StorefrontQueryControllerContext.Provider value={queryValue}>
            {children}
          </StorefrontQueryControllerContext.Provider>
        </StorefrontRouteControllerContext.Provider>
      </StorefrontRewardsControllerContext.Provider>
    </StorefrontProfileControllerContext.Provider>
  );
}

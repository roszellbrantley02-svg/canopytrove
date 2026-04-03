import type { PropsWithChildren } from 'react';
import React from 'react';
import { StorefrontControllerContext } from './storefrontControllerShared';
import { useStorefrontControllerProviderModel } from './useStorefrontControllerProviderModel';

export function StorefrontControllerProvider({ children }: PropsWithChildren) {
  const { controllerValue } = useStorefrontControllerProviderModel();

  return (
    <StorefrontControllerContext.Provider value={controllerValue}>
      {children}
    </StorefrontControllerContext.Provider>
  );
}

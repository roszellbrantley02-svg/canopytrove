import { useMemo } from 'react';
import type { OwnerPortalWorkspaceDocument } from '../../types/ownerPortal';
import type {
  OwnerLicenseComplianceViewModel,
  OwnerPortalWorkspaceWithCompliance,
} from './ownerPortalCompliance';
import { buildOwnerLicenseComplianceViewModel } from './ownerPortalCompliance';

export function useOwnerPortalLicenseCompliance(
  workspace: OwnerPortalWorkspaceDocument | OwnerPortalWorkspaceWithCompliance | null,
): OwnerLicenseComplianceViewModel {
  return useMemo(
    () =>
      buildOwnerLicenseComplianceViewModel(workspace as OwnerPortalWorkspaceWithCompliance | null),
    [workspace],
  );
}

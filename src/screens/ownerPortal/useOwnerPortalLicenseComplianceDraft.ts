import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  OwnerPortalLicenseComplianceInput,
  OwnerPortalWorkspaceDocument,
} from '../../types/ownerPortal';

export type OwnerPortalLicenseComplianceDraft = {
  licenseNumber: string;
  licenseType: string;
  issuedAt: string;
  expiresAt: string;
  renewalSubmittedAt: string;
  notes: string;
};

function createDraft(
  workspace: OwnerPortalWorkspaceDocument | null,
): OwnerPortalLicenseComplianceDraft {
  const compliance = workspace?.licenseCompliance;
  return {
    licenseNumber: compliance?.licenseNumber ?? '',
    licenseType: compliance?.licenseType ?? '',
    issuedAt: compliance?.issuedAt ?? '',
    expiresAt: compliance?.expiresAt ?? '',
    renewalSubmittedAt: compliance?.renewalSubmittedAt ?? '',
    notes: compliance?.notes ?? '',
  };
}

function normalizeNullableString(value: string) {
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function equalNullableString(left: string | null | undefined, right: string | null | undefined) {
  return (left ?? null) === (right ?? null);
}

export function useOwnerPortalLicenseComplianceDraft(
  workspace: OwnerPortalWorkspaceDocument | null,
) {
  const initialDraft = useMemo(() => createDraft(workspace), [workspace]);
  const [draft, setDraft] = useState<OwnerPortalLicenseComplianceDraft>(initialDraft);

  useEffect(() => {
    setDraft(initialDraft);
  }, [initialDraft]);

  const hasChanges = useMemo(() => {
    const compliance = workspace?.licenseCompliance;
    return !(
      equalNullableString(
        compliance?.licenseNumber,
        normalizeNullableString(draft.licenseNumber),
      ) &&
      equalNullableString(compliance?.licenseType, normalizeNullableString(draft.licenseType)) &&
      equalNullableString(compliance?.issuedAt, normalizeNullableString(draft.issuedAt)) &&
      equalNullableString(compliance?.expiresAt, normalizeNullableString(draft.expiresAt)) &&
      equalNullableString(
        compliance?.renewalSubmittedAt,
        normalizeNullableString(draft.renewalSubmittedAt),
      ) &&
      equalNullableString(compliance?.notes, normalizeNullableString(draft.notes))
    );
  }, [draft, workspace]);

  const updateDraftField = useCallback(
    <K extends keyof OwnerPortalLicenseComplianceDraft>(
      field: K,
      value: OwnerPortalLicenseComplianceDraft[K],
    ) => {
      setDraft((current) => ({
        ...current,
        [field]: value,
      }));
    },
    [],
  );

  const resetDraft = useCallback(() => {
    setDraft(createDraft(workspace));
  }, [workspace]);

  const buildSaveInput = useCallback((): OwnerPortalLicenseComplianceInput => {
    return {
      licenseNumber: normalizeNullableString(draft.licenseNumber) ?? '',
      licenseType: normalizeNullableString(draft.licenseType) ?? '',
      issuedAt: normalizeNullableString(draft.issuedAt),
      expiresAt: normalizeNullableString(draft.expiresAt),
      renewalSubmittedAt: normalizeNullableString(draft.renewalSubmittedAt),
      notes: normalizeNullableString(draft.notes),
    };
  }, [draft]);

  return {
    draft,
    hasChanges,
    resetDraft,
    setDraftField: updateDraftField,
    buildSaveInput,
  };
}

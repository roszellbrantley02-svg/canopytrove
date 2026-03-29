import React from 'react';
import {
  OwnerPortalProfileToolsInput,
  OwnerPortalPromotionInput,
  OwnerPortalWorkspaceDocument,
} from '../../types/ownerPortal';
import {
  createOwnerPortalPromotion,
  getOwnerPortalWorkspace,
  replyToOwnerPortalReview,
  saveOwnerPortalProfileTools,
  syncOwnerPortalAlerts,
  updateOwnerPortalPromotion,
} from '../../services/ownerPortalWorkspaceService';
import { getRegisteredFavoriteDealPushToken } from '../../services/favoriteDealNotificationService';
import { ownerPortalPreviewWorkspace } from './ownerPortalPreviewData';

const PREVIEW_READ_ONLY_MESSAGE =
  'Demo mode is read-only. Open the live owner portal to save changes.';

export function useOwnerPortalWorkspace(preview = false) {
  const [workspace, setWorkspace] = React.useState<OwnerPortalWorkspaceDocument | null>(
    preview ? ownerPortalPreviewWorkspace : null
  );
  const [isLoading, setIsLoading] = React.useState(!preview);
  const [isSaving, setIsSaving] = React.useState(false);
  const [errorText, setErrorText] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    if (preview) {
      setWorkspace(ownerPortalPreviewWorkspace);
      setIsLoading(false);
      setErrorText(null);
      return ownerPortalPreviewWorkspace;
    }

    setIsLoading(true);
    setErrorText(null);
    try {
      const nextWorkspace = await getOwnerPortalWorkspace();
      setWorkspace(nextWorkspace);
      return nextWorkspace;
    } catch (error) {
      const nextError =
        error instanceof Error ? error.message : 'Unable to load owner workspace.';
      setErrorText(nextError);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [preview]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const runMutation = React.useCallback(
    async <T,>(task: () => Promise<T>) => {
      if (preview) {
        setErrorText(PREVIEW_READ_ONLY_MESSAGE);
        throw new Error(PREVIEW_READ_ONLY_MESSAGE);
      }

      setIsSaving(true);
      setErrorText(null);
      try {
        const result = await task();
        await refresh();
        return result;
      } catch (error) {
        setErrorText(error instanceof Error ? error.message : 'Unable to save owner changes.');
        throw error;
      } finally {
        setIsSaving(false);
      }
    },
    [preview, refresh]
  );

  return {
    workspace,
    isLoading,
    isSaving,
    errorText,
    refresh,
    saveProfileTools: (input: OwnerPortalProfileToolsInput) =>
      runMutation(() => saveOwnerPortalProfileTools(input)),
    createPromotion: (input: OwnerPortalPromotionInput) =>
      runMutation(() => createOwnerPortalPromotion(input)),
    updatePromotion: (promotionId: string, input: OwnerPortalPromotionInput) =>
      runMutation(() => updateOwnerPortalPromotion(promotionId, input)),
    replyToReview: (reviewId: string, text: string) =>
      runMutation(() => replyToOwnerPortalReview(reviewId, text)),
    enableAlerts: () =>
      runMutation(async () => {
        const pushToken = await getRegisteredFavoriteDealPushToken({
          prompt: true,
        });
        return syncOwnerPortalAlerts(pushToken);
      }),
  };
}

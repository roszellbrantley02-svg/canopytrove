import React from 'react';
import type {
  OwnerAiActionPlan,
  OwnerAiDraftRequest,
  OwnerAiProfileSuggestion,
  OwnerAiPromotionDraft,
  OwnerAiReviewReplyDraft,
  OwnerPortalLicenseComplianceInput,
  OwnerPortalProfileToolsInput,
  OwnerPortalPromotionInput,
  OwnerPortalWorkspaceDocument,
} from '../../types/ownerPortal';
import {
  createOwnerPortalPromotion,
  getOwnerPortalAiActionPlan,
  getOwnerPortalAiProfileSuggestion,
  getOwnerPortalAiPromotionDraft,
  getOwnerPortalAiReviewReplyDraft,
  getOwnerPortalWorkspace,
  replyToOwnerPortalReview,
  saveOwnerPortalLicenseCompliance,
  saveOwnerPortalProfileTools,
  syncOwnerPortalAlerts,
  updateOwnerPortalPromotion,
} from '../../services/ownerPortalWorkspaceService';
import {
  createOwnerPortalPreviewPromotion,
  getOwnerPortalPreviewWorkspace,
  replyToOwnerPortalPreviewReview,
  saveOwnerPortalPreviewLicenseCompliance,
  saveOwnerPortalPreviewProfileTools,
  syncOwnerPortalPreviewAlerts,
  updateOwnerPortalPreviewPromotion,
} from '../../services/ownerPortalPreviewService';
import { getRegisteredOpsAlertPushToken } from '../../services/opsAlertNotificationService';
import {
  clearStorefrontRepositoryCache,
  storefrontRepository,
} from '../../repositories/storefrontRepository';

const PREVIEW_AI_MESSAGE = 'AI assistant tools only run in the live owner workspace.';
const ignoreAsyncError = () => undefined;

function getWorkspaceErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function useOwnerPortalWorkspace(preview = false) {
  const [workspace, setWorkspace] = React.useState<OwnerPortalWorkspaceDocument | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [errorText, setErrorText] = React.useState<string | null>(null);
  const [actionPlan, setActionPlan] = React.useState<OwnerAiActionPlan | null>(null);
  const [isAiLoading, setIsAiLoading] = React.useState(false);
  const [aiErrorText, setAiErrorText] = React.useState<string | null>(null);
  const hasRequestedActionPlanRef = React.useRef(false);

  const refresh = React.useCallback(async () => {
    if (preview) {
      const nextWorkspace = await getOwnerPortalPreviewWorkspace();
      setWorkspace(nextWorkspace);
      setIsLoading(false);
      setErrorText(null);
      setActionPlan(null);
      hasRequestedActionPlanRef.current = false;
      return nextWorkspace;
    }

    setIsLoading(true);
    setErrorText(null);
    try {
      const nextWorkspace = await getOwnerPortalWorkspace();
      setWorkspace(nextWorkspace);
      return nextWorkspace;
    } catch (error) {
      const nextError = getWorkspaceErrorMessage(error, 'Unable to load owner workspace.');
      setErrorText(nextError);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [preview]);

  React.useEffect(() => {
    void refresh().catch(ignoreAsyncError);
  }, [refresh]);

  const runAiTask = React.useCallback(
    async <T>(task: () => Promise<T>) => {
      if (preview) {
        setAiErrorText(PREVIEW_AI_MESSAGE);
        throw new Error(PREVIEW_AI_MESSAGE);
      }

      setIsAiLoading(true);
      setAiErrorText(null);
      try {
        return await task();
      } catch (error) {
        const nextError = getWorkspaceErrorMessage(error, 'Unable to run the owner AI assistant.');
        setAiErrorText(nextError);
        throw error;
      } finally {
        setIsAiLoading(false);
      }
    },
    [preview],
  );

  const refreshActionPlan = React.useCallback(async () => {
    const nextActionPlan = await runAiTask(() => getOwnerPortalAiActionPlan());
    setActionPlan(nextActionPlan);
    hasRequestedActionPlanRef.current = true;
    return nextActionPlan;
  }, [runAiTask]);

  React.useEffect(() => {
    if (preview || !workspace?.storefrontSummary || hasRequestedActionPlanRef.current) {
      return;
    }

    void refreshActionPlan().catch(ignoreAsyncError);
  }, [preview, refreshActionPlan, workspace?.storefrontSummary]);

  const runMutation = React.useCallback(
    async <T>(task: () => Promise<T>) => {
      setIsSaving(true);
      setErrorText(null);
      try {
        const result = await task();
        if (preview) {
          clearStorefrontRepositoryCache();
          const storefrontId = workspace?.storefrontSummary?.id;
          if (storefrontId) {
            storefrontRepository.invalidateStorefrontDetails(storefrontId);
          }
        }
        try {
          await refresh();
          setErrorText(null);
        } catch (refreshError) {
          const refreshMessage = getWorkspaceErrorMessage(
            refreshError,
            'Unable to refresh the owner workspace.',
          );
          setErrorText(`Changes saved, but the workspace could not refresh yet. ${refreshMessage}`);
        }
        return result;
      } catch (error) {
        setErrorText(getWorkspaceErrorMessage(error, 'Unable to save owner changes.'));
        throw error;
      } finally {
        setIsSaving(false);
      }
    },
    [preview, refresh, workspace?.storefrontSummary?.id],
  );

  return {
    workspace,
    runtimeStatus: workspace?.runtimeStatus ?? null,
    isLoading,
    isSaving,
    errorText,
    actionPlan,
    isAiLoading,
    aiErrorText,
    refresh,
    refreshActionPlan,
    saveLicenseCompliance: (input: OwnerPortalLicenseComplianceInput) =>
      runMutation(() =>
        preview
          ? saveOwnerPortalPreviewLicenseCompliance(input)
          : saveOwnerPortalLicenseCompliance(input),
      ),
    saveProfileTools: (input: OwnerPortalProfileToolsInput) =>
      runMutation(() =>
        preview ? saveOwnerPortalPreviewProfileTools(input) : saveOwnerPortalProfileTools(input),
      ),
    createPromotion: (input: OwnerPortalPromotionInput) =>
      runMutation(() =>
        preview ? createOwnerPortalPreviewPromotion(input) : createOwnerPortalPromotion(input),
      ),
    updatePromotion: (promotionId: string, input: OwnerPortalPromotionInput) =>
      runMutation(() =>
        preview
          ? updateOwnerPortalPreviewPromotion(promotionId, input)
          : updateOwnerPortalPromotion(promotionId, input),
      ),
    replyToReview: (reviewId: string, text: string) =>
      runMutation(() =>
        preview
          ? replyToOwnerPortalPreviewReview(reviewId, text)
          : replyToOwnerPortalReview(reviewId, text),
      ),
    suggestProfileToolsWithAi: (input: OwnerAiDraftRequest = {}) =>
      runAiTask(() =>
        getOwnerPortalAiProfileSuggestion(input),
      ) as Promise<OwnerAiProfileSuggestion>,
    draftPromotionWithAi: (input: OwnerAiDraftRequest = {}) =>
      runAiTask(() => getOwnerPortalAiPromotionDraft(input)) as Promise<OwnerAiPromotionDraft>,
    draftReviewReplyWithAi: (reviewId: string, input: OwnerAiDraftRequest = {}) =>
      runAiTask(() =>
        getOwnerPortalAiReviewReplyDraft(reviewId, input),
      ) as Promise<OwnerAiReviewReplyDraft>,
    enableAlerts: () =>
      runMutation(async () => {
        if (preview) {
          return syncOwnerPortalPreviewAlerts();
        }
        const pushToken = await getRegisteredOpsAlertPushToken({
          prompt: true,
        });
        return syncOwnerPortalAlerts(pushToken);
      }),
  };
}

import { createHash } from 'node:crypto';
import { serverConfig } from '../config';
import { recordRuntimeIncident } from './runtimeOpsService';

const OWNER_AI_BLOCKED_INTENT_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  {
    pattern:
      /\b(?:ignore|disregard|override|bypass|reveal|show|dump)\b[\s\S]{0,48}\b(?:prompt|instruction|instructions|system|developer)\b/i,
    reason: 'prompt-injection-style instruction override',
  },
  {
    pattern:
      /\b(?:write|generate|create|build)\b[\s\S]{0,32}\b(?:code|script|sql|javascript|python|shell|payload|malware|exploit)\b/i,
    reason: 'off-domain code or exploit generation',
  },
  {
    pattern: /\b(?:password|secret|api key|token|credit card|ssn|social security)\b/i,
    reason: 'secret or sensitive-data extraction attempt',
  },
];

type OpenAiModerationResponse = {
  results?: Array<{
    flagged?: boolean;
  }>;
};

export type OwnerAiDraftInput = {
  goal?: string | null;
  tone?: string | null;
  focus?: string | null;
};

export class OwnerAiInputRejectedError extends Error {
  readonly statusCode = 400;
  readonly code = 'OWNER_AI_INPUT_REJECTED';

  constructor(message: string) {
    super(message);
  }
}

function getCombinedInputText(input: OwnerAiDraftInput) {
  return [input.goal, input.tone, input.focus]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map((value) => value.trim())
    .join('\n');
}

export function buildOwnerAiUserIdentifier(ownerUid: string) {
  const ownerHash = createHash('sha256').update(ownerUid, 'utf8').digest('hex').slice(0, 24);
  return `owner-ai:${ownerHash}`;
}

export function detectBlockedOwnerAiIntent(input: OwnerAiDraftInput) {
  const combinedText = getCombinedInputText(input);
  if (!combinedText) {
    return null;
  }

  for (const entry of OWNER_AI_BLOCKED_INTENT_PATTERNS) {
    if (entry.pattern.test(combinedText)) {
      return entry.reason;
    }
  }

  return null;
}

async function moderateOwnerAiInput(ownerUid: string, inputText: string) {
  if (!serverConfig.openAiApiKey || !serverConfig.ownerAiInputModerationEnabled || !inputText) {
    return;
  }

  try {
    const response = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serverConfig.openAiApiKey}`,
      },
      body: JSON.stringify({
        model: 'omni-moderation-latest',
        input: inputText,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI moderation request failed with ${response.status}`);
    }

    const payload = (await response.json()) as OpenAiModerationResponse;
    const flagged = payload.results?.some((result) => result.flagged);
    if (flagged) {
      throw new OwnerAiInputRejectedError(
        'AI input was rejected because it is outside the supported storefront drafting use cases.',
      );
    }
  } catch (error) {
    if (error instanceof OwnerAiInputRejectedError) {
      throw error;
    }

    await recordRuntimeIncident({
      kind: 'ops',
      severity: 'warning',
      source: 'owner-portal-ai-moderation',
      message: error instanceof Error ? error.message : 'Owner portal AI input moderation failed.',
      metadata: {
        provider: 'openai',
        owner: buildOwnerAiUserIdentifier(ownerUid),
      },
    }).catch(() => {
      // Preserve AI drafts even if monitoring is degraded.
    });
  }
}

export async function assertOwnerAiInputAllowed(ownerUid: string, input: OwnerAiDraftInput) {
  const blockedReason = detectBlockedOwnerAiIntent(input);
  if (blockedReason) {
    throw new OwnerAiInputRejectedError(
      'AI input must stay focused on storefront copy, promotions, profiles, or review replies.',
    );
  }

  const combinedText = getCombinedInputText(input);
  if (!combinedText) {
    return;
  }

  await moderateOwnerAiInput(ownerUid, combinedText);
}

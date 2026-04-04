import {
  OwnerAiActionPlan,
  OwnerAiProfileSuggestion,
  OwnerAiPromotionDraft,
  OwnerAiReviewReplyDraft,
  OwnerPromotionAudience,
  OwnerPromotionCardTone,
  OwnerPromotionPlacementScope,
  OwnerPromotionPlacementSurface,
} from '../../../src/types/ownerPortal';
import { serverConfig } from '../config';
import { getOwnerPortalWorkspace } from './ownerPortalWorkspaceService';
import { recordRuntimeIncident } from './runtimeOpsService';

type OpenAiChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
};

const OPENAI_TIMEOUT_MS = 15_000;

function getNowIso() {
  return new Date().toISOString();
}

function formatCount(value: number) {
  return Math.round(value).toLocaleString();
}

function sanitizeText(value: string, fallback: string) {
  const normalized = value.trim();
  return normalized || fallback;
}

type GeneratedOwnerAiPayload = {
  generatedAt: string;
  usedFallback: boolean;
};

type GeneratedOwnerAiPayloadBase<T extends GeneratedOwnerAiPayload> = Omit<
  T,
  keyof GeneratedOwnerAiPayload
>;

type OwnerAiPayloadValidator<T extends GeneratedOwnerAiPayload> = (
  value: unknown,
) => GeneratedOwnerAiPayloadBase<T> | null;

const OWNER_AI_PRIORITY_TONES = new Set<OwnerAiActionPlan['priorities'][number]['tone']>([
  'info',
  'warning',
  'success',
]);
const OWNER_AI_PROMOTION_AUDIENCES = new Set<OwnerPromotionAudience>([
  'all_followers',
  'frequent_visitors',
  'new_customers',
]);
const OWNER_AI_PROMOTION_CARD_TONES = new Set<OwnerPromotionCardTone>([
  'standard',
  'owner_featured',
  'hot_deal',
]);
const OWNER_AI_PROMOTION_PLACEMENT_SURFACES = new Set<OwnerPromotionPlacementSurface>([
  'nearby',
  'browse',
  'hot_deals',
]);
const OWNER_AI_PROMOTION_PLACEMENT_SCOPES = new Set<OwnerPromotionPlacementScope>([
  'storefront_area',
  'statewide',
]);

function asObjectRecord(value: unknown) {
  if (typeof value !== 'object' || !value || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function parseRequiredString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function parseOptionalString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function parseStringArray(value: unknown, options?: { maxItems?: number }) {
  if (!Array.isArray(value)) {
    return null;
  }

  const normalized = value
    .map((entry) => parseRequiredString(entry))
    .filter((entry): entry is string => Boolean(entry));

  return options?.maxItems ? normalized.slice(0, options.maxItems) : normalized;
}

function parseEnumValue<T extends string>(value: unknown, allowed: Set<T>) {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim() as T;
  return allowed.has(normalized) ? normalized : null;
}

function validateOwnerAiActionPlanPayload(
  value: unknown,
): GeneratedOwnerAiPayloadBase<OwnerAiActionPlan> | null {
  const payload = asObjectRecord(value);
  if (!payload) {
    return null;
  }

  const headline = parseRequiredString(payload.headline);
  const summary = parseRequiredString(payload.summary);
  const priorityItems = Array.isArray(payload.priorities) ? payload.priorities : null;
  if (!headline || !summary || !priorityItems) {
    return null;
  }

  const priorities = priorityItems
    .map((item) => {
      const record = asObjectRecord(item);
      if (!record) {
        return null;
      }

      const title = parseRequiredString(record.title);
      const body = parseRequiredString(record.body);
      const tone = parseEnumValue(record.tone, OWNER_AI_PRIORITY_TONES);
      if (!title || !body || !tone) {
        return null;
      }

      return { title, body, tone };
    })
    .filter((item): item is OwnerAiActionPlan['priorities'][number] => Boolean(item))
    .slice(0, 3);

  if (!priorities.length) {
    return null;
  }

  return {
    headline,
    summary,
    priorities,
  };
}

function validateOwnerAiPromotionDraftPayload(
  value: unknown,
): GeneratedOwnerAiPayloadBase<OwnerAiPromotionDraft> | null {
  const payload = asObjectRecord(value);
  if (!payload) {
    return null;
  }

  const title = parseRequiredString(payload.title);
  const description = parseRequiredString(payload.description);
  const badges = parseStringArray(payload.badges, { maxItems: 5 });
  const audience = parseEnumValue(payload.audience, OWNER_AI_PROMOTION_AUDIENCES);
  const cardTone = parseEnumValue(payload.cardTone, OWNER_AI_PROMOTION_CARD_TONES);
  const placementSurfacesRaw = parseStringArray(payload.placementSurfaces, { maxItems: 3 });
  const placementScope = parseEnumValue(
    payload.placementScope,
    OWNER_AI_PROMOTION_PLACEMENT_SCOPES,
  );
  const reasoning = parseRequiredString(payload.reasoning);

  if (
    !title ||
    !description ||
    !badges ||
    !audience ||
    !cardTone ||
    !placementSurfacesRaw ||
    !placementScope ||
    !reasoning
  ) {
    return null;
  }

  const placementSurfaces = placementSurfacesRaw.filter(
    (surface): surface is OwnerAiPromotionDraft['placementSurfaces'][number] =>
      OWNER_AI_PROMOTION_PLACEMENT_SURFACES.has(
        surface as OwnerAiPromotionDraft['placementSurfaces'][number],
      ),
  );

  if (!placementSurfaces.length) {
    return null;
  }

  return {
    title,
    description,
    badges,
    audience,
    cardTone,
    placementSurfaces,
    placementScope,
    reasoning,
  };
}

function validateOwnerAiReviewReplyDraftPayload(
  value: unknown,
): GeneratedOwnerAiPayloadBase<OwnerAiReviewReplyDraft> | null {
  const payload = asObjectRecord(value);
  if (!payload) {
    return null;
  }

  const text = parseRequiredString(payload.text);
  const tone = parseRequiredString(payload.tone);
  const reasoning = parseRequiredString(payload.reasoning);
  if (!text || !tone || !reasoning) {
    return null;
  }

  return {
    text,
    tone,
    reasoning,
  };
}

function validateOwnerAiProfileSuggestionPayload(
  value: unknown,
): GeneratedOwnerAiPayloadBase<OwnerAiProfileSuggestion> | null {
  const payload = asObjectRecord(value);
  if (!payload) {
    return null;
  }

  const cardSummary = parseRequiredString(payload.cardSummary);
  const featuredBadges = parseStringArray(payload.featuredBadges, { maxItems: 5 });
  const reasoning = parseRequiredString(payload.reasoning);
  const verifiedBadgeLabel =
    payload.verifiedBadgeLabel === null ? null : parseOptionalString(payload.verifiedBadgeLabel);

  if (!cardSummary || !featuredBadges || !reasoning) {
    return null;
  }

  return {
    cardSummary,
    verifiedBadgeLabel,
    featuredBadges,
    reasoning,
  };
}

async function generateJsonWithFallback<T extends GeneratedOwnerAiPayload>(options: {
  systemPrompt: string;
  userPrompt: string;
  fallback: () => GeneratedOwnerAiPayloadBase<T>;
  validate: OwnerAiPayloadValidator<T>;
}): Promise<T> {
  const generatedAt = getNowIso();

  if (!serverConfig.openAiApiKey) {
    return {
      ...options.fallback(),
      usedFallback: true,
      generatedAt,
    } as T;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, OPENAI_TIMEOUT_MS);

    const response = await (async () => {
      try {
        return await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${serverConfig.openAiApiKey}`,
          },
          body: JSON.stringify({
            model: serverConfig.openAiModel,
            temperature: 0.7,
            response_format: {
              type: 'json_object',
            },
            messages: [
              {
                role: 'system',
                content: `${options.systemPrompt}\nReturn valid JSON only.`,
              },
              {
                role: 'user',
                content: options.userPrompt,
              },
            ],
          }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }
    })();

    if (!response.ok) {
      throw new Error(`OpenAI request failed with ${response.status}`);
    }

    const payload = (await response.json()) as OpenAiChatCompletionResponse;
    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('OpenAI response did not include content.');
    }

    const validatedPayload = options.validate(JSON.parse(content));
    if (!validatedPayload) {
      throw new Error('OpenAI response did not match the expected JSON shape.');
    }

    return {
      ...validatedPayload,
      usedFallback: false,
      generatedAt,
    } as T;
  } catch (error) {
    try {
      await recordRuntimeIncident({
        kind: 'ops',
        severity: 'warning',
        source: 'owner-portal-ai',
        message:
          error instanceof Error ? error.message : 'Owner portal AI fell back to local generation.',
        metadata: {
          provider: 'openai',
          model: serverConfig.openAiModel,
        },
      });
    } catch {
      // Keep local AI fallbacks available even if incident reporting is unavailable.
    }

    return {
      ...options.fallback(),
      usedFallback: true,
      generatedAt,
    } as T;
  }
}

export async function getOwnerAiActionPlan(ownerUid: string): Promise<OwnerAiActionPlan> {
  const workspace = await getOwnerPortalWorkspace(ownerUid);
  const lowRatingCount = workspace.recentReviews.filter((review) => review.isLowRating).length;
  const missingProfileTools =
    !workspace.profileTools?.cardSummary || !workspace.profileTools?.menuUrl;
  const hasNoLivePromotion = workspace.promotions.every(
    (promotion) => promotion.status !== 'active',
  );

  const fallback = (): Omit<OwnerAiActionPlan, 'usedFallback' | 'generatedAt'> => {
    const priorities = [];

    if (lowRatingCount > 0) {
      priorities.push({
        title: 'Respond to low-rating reviews first',
        body: `${lowRatingCount} recent review${lowRatingCount === 1 ? '' : 's'} are reading as high-friction. Reply calmly and offer a concrete next step.`,
        tone: 'warning' as const,
      });
    }

    if (hasNoLivePromotion && workspace.metrics.followerCount >= 5) {
      priorities.push({
        title: 'Launch a fresh promotion for saved followers',
        body: `${formatCount(workspace.metrics.followerCount)} people already follow this storefront. A focused offer can convert that saved audience faster than a broad refresh.`,
        tone: 'info' as const,
      });
    }

    if (missingProfileTools) {
      priorities.push({
        title: 'Tighten the premium storefront surface',
        body: 'Your menu link, card summary, or premium media still needs cleanup. Improving those surfaces strengthens opens before you spend energy on more promotion.',
        tone: 'success' as const,
      });
    }

    if (!priorities.length) {
      priorities.push({
        title: 'Keep the current pace',
        body: 'Reviews, storefront presentation, and offers are relatively stable. The next best move is a small promotion refresh and continued response discipline.',
        tone: 'success' as const,
      });
    }

    return {
      headline: 'This week, protect trust and turn saved interest into visits.',
      summary:
        'The owner workspace is healthiest when review follow-up, storefront presentation, and one live offer stay in balance.',
      priorities: priorities.slice(0, 3),
    };
  };

  return generateJsonWithFallback<OwnerAiActionPlan>({
    systemPrompt:
      'You are the Canopy Trove owner operator assistant. Produce concise, tactical weekly guidance for a dispensary owner. Keep it premium, calm, and practical.',
    userPrompt: JSON.stringify({
      storefront: workspace.storefrontSummary,
      metrics: workspace.metrics,
      patternFlags: workspace.patternFlags,
      recentReviews: workspace.recentReviews.slice(0, 4),
      promotions: workspace.promotions.slice(0, 4),
      profileTools: workspace.profileTools,
    }),
    fallback,
    validate: validateOwnerAiActionPlanPayload,
  });
}

export async function generateOwnerAiPromotionDraft(
  ownerUid: string,
  input: {
    goal?: string | null;
    tone?: string | null;
  },
): Promise<OwnerAiPromotionDraft> {
  const workspace = await getOwnerPortalWorkspace(ownerUid);
  const storefrontName =
    workspace.storefrontSummary?.displayName ??
    workspace.ownerProfile?.companyName ??
    'this storefront';

  const fallback = (): Omit<OwnerAiPromotionDraft, 'usedFallback' | 'generatedAt'> => ({
    title: sanitizeText(
      input.goal ?? '',
      workspace.metrics.followerCount >= 10
        ? 'Saved-follower weekend offer'
        : 'Premium storefront feature this week',
    ),
    description:
      workspace.metrics.followerCount >= 10
        ? `${storefrontName} is giving saved followers a cleaner reason to come back this week. Keep the offer direct, welcoming, and easy to act on.`
        : `${storefrontName} is featured this week with a premium, easy-to-read deal designed to convert storefront views into visits.`,
    badges:
      workspace.metrics.followerCount >= 10
        ? ['Featured', 'Follower favorite', 'Limited time']
        : ['Featured', 'Fresh drop', 'Staff pick'],
    audience: 'all_followers',
    cardTone: workspace.metrics.followerCount >= 10 ? 'hot_deal' : 'owner_featured',
    placementSurfaces: ['nearby', 'browse', 'hot_deals'],
    placementScope: 'storefront_area',
    reasoning:
      'This draft leans into current saved-follower demand and keeps the storefront card readable on the highest-intent surfaces first.',
  });

  return generateJsonWithFallback<OwnerAiPromotionDraft>({
    systemPrompt:
      'You are the Canopy Trove campaign assistant. Return a promotion draft that is concise, premium, local, and plausible for a legal cannabis storefront. Never promise things not in context.',
    userPrompt: JSON.stringify({
      storefront: workspace.storefrontSummary,
      metrics: workspace.metrics,
      patternFlags: workspace.patternFlags,
      currentGoal: input.goal ?? null,
      preferredTone: input.tone ?? null,
      existingPromotions: workspace.promotions.slice(0, 4),
    }),
    fallback,
    validate: validateOwnerAiPromotionDraftPayload,
  });
}

export async function generateOwnerAiReviewReplyDraft(
  ownerUid: string,
  reviewId: string,
  input: {
    tone?: string | null;
  },
): Promise<OwnerAiReviewReplyDraft> {
  const workspace = await getOwnerPortalWorkspace(ownerUid);
  const review = workspace.recentReviews.find((candidate) => candidate.id === reviewId);
  if (!review) {
    throw new Error('Review not found in the current owner workspace.');
  }

  const fallback = (): Omit<OwnerAiReviewReplyDraft, 'usedFallback' | 'generatedAt'> => {
    if (review.rating <= 2) {
      return {
        text: `Thanks for the honest feedback, ${review.authorName}. We're sorry the visit missed the mark. Our team is reviewing what happened, and we'd like the chance to make it right with a smoother experience next time.`,
        tone: input.tone?.trim() || 'make-it-right',
        reasoning:
          'Low-rating reviews need ownership, calm language, and a clear signal that the team is correcting the problem.',
      };
    }

    return {
      text: `Thanks for stopping by, ${review.authorName}. We appreciate you taking the time to share this, and we're glad the visit left a strong impression. We hope to see you again soon.`,
      tone: input.tone?.trim() || 'warm',
      reasoning:
        'Positive reviews work best with a brief, appreciative reply that feels active without sounding inflated.',
    };
  };

  return generateJsonWithFallback<OwnerAiReviewReplyDraft>({
    systemPrompt:
      'You draft owner replies for Canopy Trove. Sound calm, accountable, premium, and human. Keep replies under 90 words.',
    userPrompt: JSON.stringify({
      storefront: workspace.storefrontSummary,
      review,
      preferredTone: input.tone ?? null,
    }),
    fallback,
    validate: validateOwnerAiReviewReplyDraftPayload,
  });
}

export async function generateOwnerAiProfileSuggestion(
  ownerUid: string,
  input: {
    focus?: string | null;
  },
): Promise<OwnerAiProfileSuggestion> {
  const workspace = await getOwnerPortalWorkspace(ownerUid);
  const storefrontName =
    workspace.storefrontSummary?.displayName ??
    workspace.ownerProfile?.companyName ??
    'This storefront';

  const fallback = (): Omit<OwnerAiProfileSuggestion, 'usedFallback' | 'generatedAt'> => ({
    cardSummary:
      workspace.profileTools?.cardSummary ??
      `${storefrontName} pairs a cleaner storefront experience with verified owner presence, menu access, and a stronger reason to open the listing.`,
    verifiedBadgeLabel:
      workspace.profileTools?.verifiedBadgeLabel ??
      (workspace.ownerProfile?.businessVerificationStatus === 'verified'
        ? 'Verified owner'
        : 'Owner managed'),
    featuredBadges: workspace.profileTools?.featuredBadges?.length
      ? workspace.profileTools.featuredBadges
      : ['Verified owner', 'Menu linked', 'Featured storefront'],
    reasoning:
      'This suggestion tightens the storefront summary, trust signal, and badge mix so the card reads faster and feels more premium.',
  });

  return generateJsonWithFallback<OwnerAiProfileSuggestion>({
    systemPrompt:
      'You improve premium storefront copy inside the Canopy Trove owner portal. Keep outputs short, credible, and polished.',
    userPrompt: JSON.stringify({
      storefront: workspace.storefrontSummary,
      metrics: workspace.metrics,
      profileTools: workspace.profileTools,
      preferredFocus: input.focus ?? null,
    }),
    fallback,
    validate: validateOwnerAiProfileSuggestionPayload,
  });
}

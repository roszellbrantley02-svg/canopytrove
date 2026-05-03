/**
 * Claude Sonnet 4.5 vision parser for the AI Shop Bootstrap flow.
 *
 * Given a ScrapedWebsiteContent (screenshot in Cloud Storage + page
 * text + meta), call Anthropic's Messages API with a tool definition
 * that mirrors AiShopBootstrapDraftPayload's shape, return the
 * structured tool_use args.
 *
 * We use raw fetch rather than @anthropic-ai/sdk to match the
 * established codebase pattern (ownerPortalAiService + reviewPhotoModerationService
 * also use fetch directly to OpenAI). This keeps the dependency tree
 * small and the deploy artifact lean.
 *
 * Required env vars:
 *   ANTHROPIC_API_KEY  — from Secret Manager
 */

import { getBackendFirebaseStorage } from '../firebase';
import type { AiShopBootstrapDraftPayload, ScrapedWebsiteContent } from '../types/aiShopBootstrap';

const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_API_VERSION = '2023-06-01';
const MODEL = 'claude-sonnet-4-5';
const MAX_OUTPUT_TOKENS = 4096;

const SYSTEM_PROMPT = `You are reading a New York-licensed cannabis dispensary's website. Your job is to extract structured data that will populate the dispensary's listing on Canopy Trove (a NY dispensary discovery app).

Critical rules:
- Extract ONLY what is clearly visible in the screenshot or text. If you are not sure, set the field to null. Never guess.
- For brand names: list specific cannabis brand names visible (Cresco, Curaleaf, Stiiizy, RYTHM, MFNY, Verano, Hudson Cannabis, Wagmi, etc). Generic words like "pre-roll" or "indica" are NOT brands.
- For deals: only count CURRENTLY ACTIVE promotions on the page. Skip expired ones. Quote the exact deal text the page shows.
- For payment methods: only mark a method true if the page explicitly says it's accepted. If unclear, leave null.
- For hours: parse into a structured array, one entry per day. Use "Closed" for closed days.
- Confidence rubric:
  - "high" = page is well-structured (visible Dutchie/Jane menu, clear hours block, address present)
  - "medium" = page is readable but sparse, some fields missing
  - "low" = thin page, mostly placeholder, or anti-bot blocked

Use the extractStorefrontDraft tool. Set extractionNotes to a 1-2 sentence honest summary of what was easy vs hard to extract.`;

const TOOL_DEFINITION = {
  name: 'extractStorefrontDraft',
  description:
    'Extract structured fields for a Canopy Trove storefront listing from a NY dispensary website screenshot + text.',
  input_schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      detectedName: { type: ['string', 'null'] },
      detectedAddress: { type: ['string', 'null'] },
      detectedCity: { type: ['string', 'null'] },
      detectedState: { type: ['string', 'null'] },
      detectedZip: { type: ['string', 'null'] },
      detectedPhone: { type: ['string', 'null'] },
      detectedWebsite: { type: ['string', 'null'] },
      detectedMenuUrl: { type: ['string', 'null'] },
      detectedHours: {
        type: ['array', 'null'],
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            day: { type: 'string' },
            hours: { type: 'string' },
          },
          required: ['day', 'hours'],
        },
      },
      detectedBrands: {
        type: ['array', 'null'],
        items: { type: 'string' },
      },
      detectedDeals: {
        type: ['array', 'null'],
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
            discountText: { type: 'string' },
          },
          required: ['title', 'description'],
        },
      },
      detectedAboutText: { type: ['string', 'null'] },
      detectedPhotoUrls: {
        type: ['array', 'null'],
        items: { type: 'string' },
      },
      detectedPaymentMethods: {
        type: ['object', 'null'],
        additionalProperties: false,
        properties: {
          acceptsCash: { type: ['boolean', 'null'] },
          acceptsDebit: { type: ['boolean', 'null'] },
          acceptsCredit: { type: ['boolean', 'null'] },
          sourceText: { type: ['string', 'null'] },
        },
        required: ['acceptsCash', 'acceptsDebit', 'acceptsCredit', 'sourceText'],
      },
      extractionConfidence: { type: 'string', enum: ['high', 'medium', 'low'] },
      extractionNotes: { type: 'string' },
    },
    required: ['extractionConfidence', 'extractionNotes'],
  },
};

/**
 * Run the parse. Throws on hard failure (missing API key, transport
 * error, malformed response). The caller (aiShopBootstrapService)
 * catches these and marks the draft as failed with a typed reason.
 */
export async function parseScrapedContentWithClaudeVision(
  content: ScrapedWebsiteContent,
): Promise<AiShopBootstrapDraftPayload> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured.');
  }

  // 1. Download the screenshot from Cloud Storage to base64.
  const screenshotBase64 = await downloadScreenshotAsBase64(content.screenshotGcsUrl);

  // 2. Build the user message — image + structured text context.
  const userContext = buildUserContext(content);

  const requestBody = {
    model: MODEL,
    max_tokens: MAX_OUTPUT_TOKENS,
    system: SYSTEM_PROMPT,
    tools: [TOOL_DEFINITION],
    tool_choice: { type: 'tool', name: 'extractStorefrontDraft' },
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/png',
              data: screenshotBase64,
            },
          },
          {
            type: 'text',
            text: userContext,
          },
        ],
      },
    ],
  };

  const response = await fetch(ANTHROPIC_MESSAGES_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_API_VERSION,
      'content-type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Anthropic API ${response.status}: ${detail.slice(0, 500)}`);
  }

  const payload = (await response.json()) as {
    content?: Array<{ type: string; name?: string; input?: unknown }>;
    stop_reason?: string;
  };

  // Find the tool_use block.
  const toolUse = (payload.content ?? []).find(
    (block) => block.type === 'tool_use' && block.name === 'extractStorefrontDraft',
  );
  if (!toolUse || !toolUse.input || typeof toolUse.input !== 'object') {
    throw new Error('Anthropic response did not include a valid extractStorefrontDraft tool_use.');
  }

  // The tool input is already structured per our schema; coerce to the
  // typed payload + fill the OCM cross-reference field (computed downstream).
  const draft = normalizeDraftPayload(toolUse.input as Partial<AiShopBootstrapDraftPayload>);
  return draft;
}

/**
 * Build the text context we hand the model alongside the screenshot.
 * Includes meta description, og:image, embed providers detected, plus
 * the most relevant page text. We cap the text aggressively because
 * Claude vision is the expensive part and we don't want to pay for
 * boilerplate (footer text, cookie banners, etc).
 */
function buildUserContext(content: ScrapedWebsiteContent): string {
  const lines: string[] = [];
  lines.push(`URL: ${content.finalUrl}`);
  if (content.pageTitle) lines.push(`Page title: ${content.pageTitle}`);
  if (content.metaDescription) lines.push(`Meta description: ${content.metaDescription}`);
  if (content.ogImage) lines.push(`OG image: ${content.ogImage}`);
  if (content.detectedEmbedProviders.length > 0) {
    lines.push(`Embedded providers detected: ${content.detectedEmbedProviders.join(', ')}`);
  }
  if (content.outboundLinks.length > 0) {
    lines.push('');
    lines.push('Notable links:');
    for (const link of content.outboundLinks.slice(0, 20)) {
      lines.push(`  - ${link.text || '(no text)'} → ${link.href}`);
    }
  }
  if (content.pageText) {
    lines.push('');
    lines.push('Page text (truncated to 8000 chars):');
    lines.push(content.pageText.slice(0, 8000));
  }
  return lines.join('\n');
}

/**
 * Coerce the tool input to a fully-typed AiShopBootstrapDraftPayload,
 * filling in `ocmMatch: null` (set later by the OCM cross-reference
 * step) and defaulting any missing optional arrays to null.
 */
function normalizeDraftPayload(
  input: Partial<AiShopBootstrapDraftPayload>,
): AiShopBootstrapDraftPayload {
  return {
    detectedName: input.detectedName ?? null,
    detectedAddress: input.detectedAddress ?? null,
    detectedCity: input.detectedCity ?? null,
    detectedState: input.detectedState ?? null,
    detectedZip: input.detectedZip ?? null,
    detectedPhone: input.detectedPhone ?? null,
    detectedWebsite: input.detectedWebsite ?? null,
    detectedMenuUrl: input.detectedMenuUrl ?? null,
    ocmMatch: null, // populated by aiShopBootstrapService after parse
    detectedHours: input.detectedHours ?? null,
    detectedBrands: input.detectedBrands ?? null,
    detectedDeals: input.detectedDeals ?? null,
    detectedAboutText: input.detectedAboutText ?? null,
    detectedPhotoUrls: input.detectedPhotoUrls ?? null,
    detectedPaymentMethods: input.detectedPaymentMethods ?? null,
    extractionConfidence: input.extractionConfidence ?? 'low',
    extractionNotes: input.extractionNotes ?? '',
  };
}

/**
 * Download a screenshot from Cloud Storage (gs:// URL) and return its
 * base64 encoding — what Anthropic's vision API expects.
 */
async function downloadScreenshotAsBase64(gcsUrl: string): Promise<string> {
  if (!gcsUrl.startsWith('gs://')) {
    throw new Error(`screenshotGcsUrl must start with gs://, got: ${gcsUrl}`);
  }
  const withoutScheme = gcsUrl.slice('gs://'.length);
  const slashIdx = withoutScheme.indexOf('/');
  if (slashIdx === -1) {
    throw new Error(`screenshotGcsUrl missing object name: ${gcsUrl}`);
  }
  const bucketName = withoutScheme.slice(0, slashIdx);
  const objectName = withoutScheme.slice(slashIdx + 1);

  const storage = getBackendFirebaseStorage();
  if (!storage) {
    throw new Error('Backend Firebase storage is not configured.');
  }
  const bucket = storage.bucket(bucketName);
  const file = bucket.file(objectName);
  const [buffer] = await file.download();
  return buffer.toString('base64');
}

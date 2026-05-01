import { Router } from 'express';
import { serverConfig } from '../config';
import { createRateLimitMiddleware } from '../http/rateLimit';
import { withMutationCooldown } from '../http/mutationCooldownMiddleware';
import { registerCooldownReplay } from '../services/ownerMutationCooldownService';
import {
  parseOwnerPortalAlertSyncBody,
  parseOwnerPortalBrandsBody,
  parseOwnerPortalLicenseComplianceBody,
  parseOwnerPortalProfileToolsBody,
  parseOwnerPortalPromotionBody,
  parseOwnerPortalPromotionIdParam,
  parseOwnerPortalReviewReplyBody,
  parseReviewIdParam,
} from '../http/validation';
import {
  createOwnerPortalJsonRoute,
  createOwnerPortalClaimSyncRoute,
} from './ownerPortalRouteUtils';
import { syncOwnerPortalAlerts } from '../services/ownerPortalAlertService';
import { syncOwnerPortalAuthClaims } from '../services/ownerPortalAuthClaimsService';
import {
  createOwnerPortalPromotion,
  deleteOwnerPortalPromotion,
  getOwnerPortalBrandActivity,
  getOwnerPortalBrands,
  getOwnerPortalPaymentMethods,
  getOwnerPortalWorkspace,
  replyToOwnerPortalReview,
  saveOwnerPortalBrands,
  saveOwnerPortalLicenseCompliance,
  saveOwnerPortalPaymentMethods,
  saveOwnerPortalProfileTools,
  updateOwnerPortalPromotion,
} from '../services/ownerPortalWorkspaceService';
import { autoVerifyBusinessWithOcm } from '../services/ocmAutoVerificationService';
import { assertOwnerPhoneVerified } from '../services/phoneVerificationService';
import { createStripeIdentitySession } from '../services/stripeIdentityService';
import { assertRuntimePolicyAllowsOwnerAction } from '../services/runtimeOpsService';
import { requireTierAccess } from '../services/ownerTierGatingService';

export const ownerPortalWorkspaceRoutes = Router();
const ownerClaimSyncRateLimiter = createRateLimitMiddleware({
  name: 'owner-claim-sync',
  windowMs: 60_000,
  max: 10,
  methods: ['POST'],
});
const ownerComplianceRateLimiter = createRateLimitMiddleware({
  name: 'owner-license-compliance',
  windowMs: 60_000,
  max: 10,
  methods: ['PUT'],
});
const ownerProfileToolsRateLimiter = createRateLimitMiddleware({
  name: 'owner-profile-tools',
  windowMs: 60_000,
  max: 10,
  methods: ['PUT'],
});
const ownerBrandsRateLimiter = createRateLimitMiddleware({
  name: 'owner-brands',
  windowMs: 60_000,
  max: 10,
  methods: ['PUT'],
});
const ownerPaymentMethodsRateLimiter = createRateLimitMiddleware({
  name: 'owner-payment-methods',
  windowMs: 60_000,
  max: 10,
  methods: ['PUT'],
});
const ownerPromotionRateLimiter = createRateLimitMiddleware({
  name: 'owner-promotions',
  windowMs: 60_000,
  max: 10,
  methods: ['POST', 'PUT'],
});
const ownerReviewReplyRateLimiter = createRateLimitMiddleware({
  name: 'owner-review-replies',
  windowMs: 60_000,
  max: 10,
  methods: ['POST'],
});
ownerPortalWorkspaceRoutes.use(
  createRateLimitMiddleware({
    name: 'owner-workspace-write',
    windowMs: 60_000,
    max: serverConfig.writeRateLimitPerMinute,
    methods: ['POST', 'PUT'],
  }),
);

ownerPortalWorkspaceRoutes.get(
  '/owner-portal/workspace',
  createOwnerPortalJsonRoute('Unknown owner workspace failure', async ({ ownerUid, request }) => {
    const locationId =
      typeof request.query.locationId === 'string' ? request.query.locationId.trim() || null : null;
    return getOwnerPortalWorkspace(ownerUid, locationId);
  }),
);

ownerPortalWorkspaceRoutes.post(
  '/owner-portal/auth/sync-claims',
  ownerClaimSyncRateLimiter,
  createOwnerPortalClaimSyncRoute(
    'Unknown owner auth claim sync failure',
    async ({ ownerUid, ownerEmail }) =>
      syncOwnerPortalAuthClaims({
        ownerUid,
        ownerEmail,
      }),
  ),
);

ownerPortalWorkspaceRoutes.post(
  '/owner-portal/business-verification/auto-verify',
  createOwnerPortalJsonRoute('Unknown OCM auto-verification failure', async ({ ownerUid }) => {
    // Anti-fraud gate: phone verification is the cheapest fraud signal
    // we have, and we surface a typed error so the frontend can route
    // the user to the verification screen instead of showing a generic
    // failure. assertOwnerPhoneVerified throws
    // PhoneVerificationError('phone_verification_required', 403).
    await assertOwnerPhoneVerified(ownerUid);
    return autoVerifyBusinessWithOcm(ownerUid);
  }),
);

ownerPortalWorkspaceRoutes.post(
  '/owner-portal/identity-verification/session',
  createOwnerPortalJsonRoute('Unknown Stripe Identity session failure', async ({ ownerUid }) => {
    // Same anti-fraud gate as business-verification — both are required
    // for any owner claim to advance, so gating both effectively gates
    // the entire claim path on phone verification.
    await assertOwnerPhoneVerified(ownerUid);
    return createStripeIdentitySession(ownerUid);
  }),
);

ownerPortalWorkspaceRoutes.get(
  '/owner-portal/license-compliance',
  createOwnerPortalJsonRoute('Unknown owner license compliance failure', async ({ ownerUid }) => {
    const workspace = await getOwnerPortalWorkspace(ownerUid);
    return workspace.licenseCompliance;
  }),
);

ownerPortalWorkspaceRoutes.put(
  '/owner-portal/license-compliance',
  ownerComplianceRateLimiter,
  withMutationCooldown('free', { summary: 'Update license compliance information' }),
  createOwnerPortalJsonRoute(
    'Unknown owner license compliance failure',
    async ({ ownerUid, request }) => {
      const locationId =
        typeof request.body?.locationId === 'string'
          ? request.body.locationId.trim() || null
          : null;
      return saveOwnerPortalLicenseCompliance(
        ownerUid,
        parseOwnerPortalLicenseComplianceBody(request.body),
        locationId,
      );
    },
  ),
);

registerCooldownReplay('PUT:/owner-portal/license-compliance', async (ownerUid, body) => {
  const locationId =
    typeof (body as { locationId?: unknown }).locationId === 'string'
      ? (body as { locationId: string }).locationId.trim() || null
      : null;
  await saveOwnerPortalLicenseCompliance(
    ownerUid,
    parseOwnerPortalLicenseComplianceBody(body),
    locationId,
  );
});

ownerPortalWorkspaceRoutes.put(
  '/owner-portal/profile-tools',
  ownerProfileToolsRateLimiter,
  withMutationCooldown('free', { summary: 'Update profile tools (hours, photos, contact info)' }),
  createOwnerPortalJsonRoute(
    'Unknown owner profile tools failure',
    async ({ ownerUid, request }) => {
      await assertRuntimePolicyAllowsOwnerAction('profile_tools');
      const locationId =
        typeof request.body?.locationId === 'string'
          ? request.body.locationId.trim() || null
          : null;
      return saveOwnerPortalProfileTools(
        ownerUid,
        parseOwnerPortalProfileToolsBody(request.body),
        locationId,
      );
    },
  ),
);

// Replay handler used when admin releases a queued profile-tools mutation.
// Re-runs the same persistence logic the live route executes, minus the
// runtime policy check (admin release implies override).
registerCooldownReplay('PUT:/owner-portal/profile-tools', async (ownerUid, body) => {
  const locationId =
    typeof (body as { locationId?: unknown }).locationId === 'string'
      ? (body as { locationId: string }).locationId.trim() || null
      : null;
  await saveOwnerPortalProfileTools(ownerUid, parseOwnerPortalProfileToolsBody(body), locationId);
});

ownerPortalWorkspaceRoutes.post(
  '/owner-portal/promotions',
  ownerPromotionRateLimiter,
  createOwnerPortalJsonRoute('Unknown owner promotion failure', async ({ ownerUid, request }) => {
    await requireTierAccess(ownerUid, 'growth', 'Promotions');
    await assertRuntimePolicyAllowsOwnerAction('promotion');
    const locationId =
      typeof request.body?.locationId === 'string' ? request.body.locationId.trim() || null : null;
    return createOwnerPortalPromotion(
      ownerUid,
      parseOwnerPortalPromotionBody(request.body),
      locationId,
    );
  }),
);

ownerPortalWorkspaceRoutes.put(
  '/owner-portal/promotions/:promotionId',
  ownerPromotionRateLimiter,
  createOwnerPortalJsonRoute(
    'Unknown owner promotion update failure',
    async ({ ownerUid, request }) => {
      await requireTierAccess(ownerUid, 'growth', 'Promotions');
      await assertRuntimePolicyAllowsOwnerAction('promotion');
      const locationId =
        typeof request.body?.locationId === 'string'
          ? request.body.locationId.trim() || null
          : null;
      return updateOwnerPortalPromotion(
        ownerUid,
        parseOwnerPortalPromotionIdParam(request.params.promotionId),
        parseOwnerPortalPromotionBody(request.body),
        locationId,
      );
    },
  ),
);

ownerPortalWorkspaceRoutes.delete(
  '/owner-portal/promotions/:promotionId',
  createOwnerPortalJsonRoute(
    'Unknown owner promotion delete failure',
    async ({ ownerUid, request }) => {
      await requireTierAccess(ownerUid, 'growth', 'Promotions');
      const locationId =
        typeof request.body?.locationId === 'string'
          ? request.body.locationId.trim() || null
          : null;
      return deleteOwnerPortalPromotion(
        ownerUid,
        parseOwnerPortalPromotionIdParam(request.params.promotionId),
        locationId,
      );
    },
  ),
);

ownerPortalWorkspaceRoutes.post(
  '/owner-portal/reviews/:reviewId/reply',
  ownerReviewReplyRateLimiter,
  createOwnerPortalJsonRoute(
    'Unknown owner review reply failure',
    async ({ ownerUid, request }) => {
      await assertRuntimePolicyAllowsOwnerAction('review_reply');
      const locationId =
        typeof request.body?.locationId === 'string'
          ? request.body.locationId.trim() || null
          : null;
      return replyToOwnerPortalReview(
        ownerUid,
        parseReviewIdParam(request.params.reviewId),
        parseOwnerPortalReviewReplyBody(request.body).text,
        locationId,
      );
    },
  ),
);

ownerPortalWorkspaceRoutes.post(
  '/owner-portal/alerts/sync',
  createOwnerPortalJsonRoute('Unknown owner alert sync failure', async ({ ownerUid, request }) =>
    syncOwnerPortalAlerts({
      ownerUid,
      ...parseOwnerPortalAlertSyncBody(request.body),
    }),
  ),
);

ownerPortalWorkspaceRoutes.get(
  '/owner-portal/brands',
  createOwnerPortalJsonRoute(
    'Unknown owner brand roster failure',
    async ({ ownerUid, request }) => {
      const locationId =
        typeof request.query.locationId === 'string'
          ? request.query.locationId.trim() || null
          : null;
      return getOwnerPortalBrands(ownerUid, locationId);
    },
  ),
);

ownerPortalWorkspaceRoutes.put(
  '/owner-portal/brands',
  ownerBrandsRateLimiter,
  withMutationCooldown('free', { summary: 'Update brand roster' }),
  createOwnerPortalJsonRoute(
    'Unknown owner brand roster save failure',
    async ({ ownerUid, request }) => {
      await assertRuntimePolicyAllowsOwnerAction('profile_tools');
      const locationId =
        typeof request.body?.locationId === 'string'
          ? request.body.locationId.trim() || null
          : null;
      return saveOwnerPortalBrands(ownerUid, parseOwnerPortalBrandsBody(request.body), locationId);
    },
  ),
);

registerCooldownReplay('PUT:/owner-portal/brands', async (ownerUid, body) => {
  const locationId =
    typeof (body as { locationId?: unknown }).locationId === 'string'
      ? (body as { locationId: string }).locationId.trim() || null
      : null;
  await saveOwnerPortalBrands(ownerUid, parseOwnerPortalBrandsBody(body), locationId);
});

ownerPortalWorkspaceRoutes.get(
  '/owner-portal/brand-activity',
  createOwnerPortalJsonRoute(
    'Unknown owner brand activity failure',
    async ({ ownerUid, request }) => {
      const locationId =
        typeof request.query.locationId === 'string'
          ? request.query.locationId.trim() || null
          : null;
      const sinceDaysRaw =
        typeof request.query.sinceDays === 'string' ? Number(request.query.sinceDays) : NaN;
      const limitRaw = typeof request.query.limit === 'string' ? Number(request.query.limit) : NaN;
      return getOwnerPortalBrandActivity(ownerUid, locationId, {
        sinceDays: Number.isFinite(sinceDaysRaw) ? sinceDaysRaw : undefined,
        limit: Number.isFinite(limitRaw) ? limitRaw : undefined,
      });
    },
  ),
);

ownerPortalWorkspaceRoutes.get(
  '/owner-portal/payment-methods',
  createOwnerPortalJsonRoute(
    'Unknown owner payment methods failure',
    async ({ ownerUid, request }) => {
      const locationId =
        typeof request.query.locationId === 'string'
          ? request.query.locationId.trim() || null
          : null;
      return getOwnerPortalPaymentMethods(ownerUid, locationId);
    },
  ),
);

ownerPortalWorkspaceRoutes.put(
  '/owner-portal/payment-methods',
  ownerPaymentMethodsRateLimiter,
  createOwnerPortalJsonRoute(
    'Unknown owner payment methods save failure',
    async ({ ownerUid, request }) => {
      const locationId =
        typeof request.body?.locationId === 'string'
          ? request.body.locationId.trim() || null
          : null;
      const rawMethods =
        request.body?.methods && typeof request.body.methods === 'object'
          ? (request.body.methods as Record<string, unknown>)
          : {};
      const methods: Record<string, boolean> = {};
      for (const [key, value] of Object.entries(rawMethods)) {
        if (typeof value === 'boolean') methods[key] = value;
      }
      return saveOwnerPortalPaymentMethods(ownerUid, { methods }, locationId);
    },
  ),
);

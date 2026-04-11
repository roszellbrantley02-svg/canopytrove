import { Router } from 'express';
import { serverConfig } from '../config';
import { createRateLimitMiddleware } from '../http/rateLimit';
import {
  parseOwnerPortalAlertSyncBody,
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
  getOwnerPortalWorkspace,
  replyToOwnerPortalReview,
  saveOwnerPortalLicenseCompliance,
  saveOwnerPortalProfileTools,
  updateOwnerPortalPromotion,
} from '../services/ownerPortalWorkspaceService';
import { autoVerifyBusinessWithOcm } from '../services/ocmAutoVerificationService';
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
  createOwnerPortalJsonRoute('Unknown OCM auto-verification failure', async ({ ownerUid }) =>
    autoVerifyBusinessWithOcm(ownerUid),
  ),
);

ownerPortalWorkspaceRoutes.post(
  '/owner-portal/identity-verification/session',
  createOwnerPortalJsonRoute('Unknown Stripe Identity session failure', async ({ ownerUid }) =>
    createStripeIdentitySession(ownerUid),
  ),
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

ownerPortalWorkspaceRoutes.put(
  '/owner-portal/profile-tools',
  ownerProfileToolsRateLimiter,
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

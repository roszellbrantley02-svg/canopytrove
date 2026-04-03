type NotificationData = Record<string, unknown> | null | undefined;

export type FavoriteStoreDealNotificationPayload = {
  kind: 'favorite_store_deal';
  storefrontId: string | null;
};

export type OwnerReviewNotificationPayload = {
  kind: 'owner_review';
  storefrontId: string | null;
  reviewId: string | null;
};

export type OwnerReportNotificationPayload = {
  kind: 'owner_report';
  storefrontId: string | null;
  reportId: string | null;
};

export type OwnerLicenseComplianceNotificationPayload = {
  kind: 'owner_license_compliance';
  storefrontId: string | null;
  reminderStage: string | null;
};

export type OwnerPortalAlertNotificationPayload = {
  kind: 'owner_portal_alert';
  storefrontId: string | null;
};

export type RuntimeIncidentAlertNotificationPayload = {
  kind: 'runtime_incident_alert';
  source: string | null;
  targetId: string | null;
};

export type AppNotificationPayload =
  | FavoriteStoreDealNotificationPayload
  | OwnerReviewNotificationPayload
  | OwnerReportNotificationPayload
  | OwnerLicenseComplianceNotificationPayload
  | OwnerPortalAlertNotificationPayload
  | RuntimeIncidentAlertNotificationPayload;

function asTrimmedString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function createFavoriteStoreDealNotificationPayload(storefrontId: string) {
  return {
    kind: 'favorite_store_deal',
    storefrontId: storefrontId.trim() || null,
  } satisfies FavoriteStoreDealNotificationPayload;
}

export function parseNotificationPayload(data: NotificationData): AppNotificationPayload | null {
  const kind = asTrimmedString(data?.kind);
  if (!kind) {
    return null;
  }

  switch (kind) {
    case 'favorite_store_deal':
      return {
        kind,
        storefrontId: asTrimmedString(data?.storefrontId),
      };
    case 'owner_review':
      return {
        kind,
        storefrontId: asTrimmedString(data?.storefrontId),
        reviewId: asTrimmedString(data?.reviewId),
      };
    case 'owner_report':
      return {
        kind,
        storefrontId: asTrimmedString(data?.storefrontId),
        reportId: asTrimmedString(data?.reportId),
      };
    case 'owner_license_compliance':
      return {
        kind,
        storefrontId: asTrimmedString(data?.storefrontId),
        reminderStage: asTrimmedString(data?.reminderStage),
      };
    case 'owner_portal_alert':
      return {
        kind,
        storefrontId: asTrimmedString(data?.storefrontId),
      };
    case 'runtime_incident_alert':
      return {
        kind,
        source: asTrimmedString(data?.source),
        targetId: asTrimmedString(data?.targetId),
      };
    default:
      return null;
  }
}

const rawEnabled = (process.env.EXPO_PUBLIC_OWNER_PORTAL_PRELAUNCH_ENABLED ?? '').trim();
const rawAllowlist = (process.env.EXPO_PUBLIC_OWNER_PORTAL_ALLOWLIST ?? '').trim();
const rawBulkClaimQueueEnabled = (process.env.EXPO_PUBLIC_BULK_CLAIM_QUEUE_ENABLED ?? '').trim();
const isDeveloperBuild = typeof __DEV__ !== 'undefined' && __DEV__;

export const ownerPortalPrelaunchEnabled =
  rawEnabled.toLowerCase() === 'true' || rawEnabled === '1';

/**
 * Phase 1 of multi-location claim — gates the multi-select + parallel OTP
 * queue UX in OwnerPortalClaimListingScreen. When false (production default),
 * the screen behaves exactly as before: single-select, single-claim,
 * navigate to per-shop verification screen. When true, owners can pick up
 * to 3 shops and verify them in parallel via inline chips.
 *
 * Backend is unchanged either way — bulk submit just calls the existing
 * single-claim endpoint N times.
 */
export const ownerPortalBulkClaimQueueEnabled =
  rawBulkClaimQueueEnabled.toLowerCase() === 'true' || rawBulkClaimQueueEnabled === '1';

// Owner access remains available after prelaunch ends; the flag only controls
// whether access is restricted to an allowlist during the rollout window.
export const ownerPortalAccessAvailable = true;

export const ownerPortalAllowlist = rawAllowlist
  .split(',')
  .map((value: string) => value.trim().toLowerCase())
  .filter(Boolean);

export const hasOwnerPortalAllowlist = ownerPortalAllowlist.length > 0;

export function isOwnerPortalEmailAllowlisted(email: string | null | undefined) {
  if (!email) {
    return false;
  }

  const normalizedEmail = email.trim().toLowerCase();

  if (!ownerPortalPrelaunchEnabled) {
    return true;
  }

  if (!hasOwnerPortalAllowlist) {
    return normalizedEmail.endsWith('.test') || isDeveloperBuild;
  }

  return ownerPortalAllowlist.includes(normalizedEmail);
}

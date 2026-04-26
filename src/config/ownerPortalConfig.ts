const rawEnabled = (process.env.EXPO_PUBLIC_OWNER_PORTAL_PRELAUNCH_ENABLED ?? '').trim();
const rawAllowlist = (process.env.EXPO_PUBLIC_OWNER_PORTAL_ALLOWLIST ?? '').trim();
const isDeveloperBuild = typeof __DEV__ !== 'undefined' && __DEV__;

export const ownerPortalPrelaunchEnabled =
  rawEnabled.toLowerCase() === 'true' || rawEnabled === '1';

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

const rawEnabled = (process.env.EXPO_PUBLIC_OWNER_PORTAL_PRELAUNCH_ENABLED ?? '').trim();
const rawPreviewEnabled = (process.env.EXPO_PUBLIC_OWNER_PORTAL_PREVIEW_ENABLED ?? '').trim();
const rawAllowlist = (process.env.EXPO_PUBLIC_OWNER_PORTAL_ALLOWLIST ?? '').trim();
const isDeveloperBuild = typeof __DEV__ !== 'undefined' && __DEV__;

export const ownerPortalPrelaunchEnabled =
  rawEnabled.toLowerCase() === 'true' || rawEnabled === '1';

export const ownerPortalPreviewEnabled =
  rawPreviewEnabled.toLowerCase() === 'true' || rawPreviewEnabled === '1';

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

const EMAIL_LIKE_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

export function isEmailLike(value: string | null | undefined) {
  return Boolean(value?.trim() && EMAIL_LIKE_PATTERN.test(value.trim()));
}

export function getSafePublicDisplayName(value: string | null | undefined, fallback: string) {
  const trimmed = value?.trim() ?? '';
  return trimmed && !isEmailLike(trimmed) ? trimmed : fallback;
}

export function getProfileFallbackName(profileId: string) {
  const suffix = profileId.trim().slice(-6);
  return suffix ? `Canopy Trove ${suffix}` : 'Canopy Trove member';
}

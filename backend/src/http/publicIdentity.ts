const EMAIL_LIKE_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

export function isEmailLike(value: string | null | undefined) {
  return Boolean(value?.trim() && EMAIL_LIKE_PATTERN.test(value.trim()));
}

export function sanitizePublicDisplayName(value: string | null | undefined) {
  const trimmed = value?.trim() ?? '';
  return trimmed && !isEmailLike(trimmed) ? trimmed : null;
}

export function getSafePublicDisplayName(value: string | null | undefined, fallback: string) {
  return sanitizePublicDisplayName(value) ?? fallback;
}

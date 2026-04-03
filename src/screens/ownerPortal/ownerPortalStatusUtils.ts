export function formatStatusLabel(value: string | null | undefined, fallback = 'Not set') {
  if (!value) {
    return fallback;
  }

  return value.replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());
}

export function isVerifiedStatus(value: string | null | undefined) {
  const normalizedValue = (value ?? '').trim().toLowerCase();
  return normalizedValue === 'verified' || normalizedValue === 'approved';
}

export function isPendingReviewStatus(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase() === 'pending';
}

export function formatDateLabel(value: string | null | undefined) {
  if (!value) {
    return 'Unavailable';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Unavailable';
  }

  return date.toLocaleDateString();
}

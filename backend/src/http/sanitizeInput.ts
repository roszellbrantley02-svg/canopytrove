/**
 * Sanitize a string by trimming, removing null bytes, normalizing unicode, and stripping control characters
 * @param value - The string to sanitize
 * @returns The sanitized string
 */
export function sanitizeString(value: string): string {
  if (typeof value !== 'string') {
    return '';
  }

  // Trim whitespace
  let sanitized = value.trim();

  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, '');

  // Normalize unicode to NFC form
  sanitized = sanitized.normalize('NFC');

  // Strip control characters (except common whitespace)
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  return sanitized;
}

/**
 * Escape HTML entities to prevent XSS attacks
 * @param value - The string to escape
 * @returns The escaped string
 */
export function sanitizeHtml(value: string): string {
  if (typeof value !== 'string') {
    return '';
  }

  const htmlEscapeMap: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
  };

  return value.replace(/[&<>"']/g, (char) => htmlEscapeMap[char] || char);
}

/**
 * Sanitize an ID by stripping non-alphanumeric characters except hyphens and underscores
 * @param value - The ID string to sanitize
 * @returns The sanitized ID
 */
export function sanitizeId(value: string): string {
  if (typeof value !== 'string') {
    return '';
  }

  // Remove all characters except alphanumeric, hyphens, and underscores
  return value.replace(/[^a-zA-Z0-9\-_]/g, '');
}

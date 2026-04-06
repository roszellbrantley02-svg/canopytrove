import { logSecurityEvent } from './securityEventLogger';

/**
 * Lightweight content quality checks for user-generated text.
 *
 * This is NOT a content moderation system — it catches obvious spam patterns
 * and extremely low-quality content. Actual moderation (hate speech, threats,
 * misinformation) should be done by a dedicated service.
 *
 * Patterns detected:
 * - Excessive URLs (SEO spam)
 * - Phone numbers in reviews (solicitation)
 * - Repeated characters (keyboard spam)
 * - All-caps text (shouting)
 * - Extremely short text for reviews
 * - Known spam phrases
 */

export type ContentQualityResult = {
  pass: boolean;
  flags: string[];
  score: number; // 0-100, higher = more suspicious
};

const URL_REGEX = /https?:\/\/[^\s]+/gi;
const PHONE_REGEX = /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
const REPEATED_CHAR_REGEX = /(.)\1{9,}/; // 10+ of same char
const EMAIL_REGEX = /[\w.+-]+@[\w-]+\.[\w.-]+/gi;

const SPAM_PHRASES = [
  'buy now',
  'click here',
  'free money',
  'act now',
  'limited time',
  'earn cash',
  'make money fast',
  'work from home',
  'dm me',
  'check my bio',
  'follow me',
  'telegram',
  'whatsapp group',
];

export function checkContentQuality(
  text: string,
  options?: {
    minLength?: number;
    maxUrls?: number;
    context?: string;
    ip?: string;
    path?: string;
  },
): ContentQualityResult {
  const flags: string[] = [];
  let score = 0;
  const trimmed = text.trim();

  // Minimum length
  const minLen = options?.minLength ?? 0;
  if (minLen > 0 && trimmed.length < minLen) {
    flags.push('too_short');
    score += 30;
  }

  // URL count
  const urls = trimmed.match(URL_REGEX) || [];
  const maxUrls = options?.maxUrls ?? 2;
  if (urls.length > maxUrls) {
    flags.push('excessive_urls');
    score += 20 * (urls.length - maxUrls);
  }

  // Phone numbers
  const phones = trimmed.match(PHONE_REGEX) || [];
  if (phones.length > 0) {
    flags.push('contains_phone');
    score += 15;
  }

  // Email addresses
  const emails = trimmed.match(EMAIL_REGEX) || [];
  if (emails.length > 0) {
    flags.push('contains_email');
    score += 10;
  }

  // Repeated characters
  if (REPEATED_CHAR_REGEX.test(trimmed)) {
    flags.push('repeated_chars');
    score += 25;
  }

  // All caps (only for text longer than 20 chars)
  if (trimmed.length > 20 && trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed)) {
    flags.push('all_caps');
    score += 10;
  }

  // Spam phrases
  const lowerText = trimmed.toLowerCase();
  const matchedSpam = SPAM_PHRASES.filter((phrase) => lowerText.includes(phrase));
  if (matchedSpam.length > 0) {
    flags.push('spam_phrases');
    score += 20 * matchedSpam.length;
  }

  // High ratio of non-alphanumeric (emoji spam, symbols)
  const alphaNum = trimmed.replace(/[^a-zA-Z0-9]/g, '');
  if (trimmed.length > 10 && alphaNum.length / trimmed.length < 0.3) {
    flags.push('low_alpha_ratio');
    score += 15;
  }

  const pass = score < 50;

  if (!pass && options?.ip) {
    logSecurityEvent({
      event: 'suspicious_payload',
      ip: options.ip,
      path: options?.path ?? 'unknown',
      method: 'POST',
      detail: `Content quality check failed: ${flags.join(', ')} (score: ${score})`,
      meta: { flags, score, textLength: trimmed.length, context: options?.context },
    });
  }

  return { pass, flags, score };
}

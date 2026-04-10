import type { StorefrontRecord } from '../../../src/types/storefrontRecord';
import type { GooglePlacesEnrichment } from './googlePlacesShared';
import { computeOpenNowFromHours } from '../utils/storefrontOperationalStatus';
import { getOfficialWebsiteHoursOverride } from './storefrontWebsiteHoursOverrides';

const WEBSITE_HOURS_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const WEBSITE_HOURS_TIMEOUT_MS = 8_000;
const USER_AGENT = 'CanopyTroveStorefrontHours/1.0';

type WebsiteHoursResult = {
  hours: string[];
  sourceUrl: string;
};

type CacheEntry = {
  expiresAt: number;
  value: WebsiteHoursResult | null;
};

const websiteHoursCache = new Map<string, CacheEntry>();

const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

const DISPLAY_DAY_ORDER = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;
const DISPLAY_DAY_ORDER_INDEX = new Map<string, number>(
  DISPLAY_DAY_ORDER.map((day, index) => [day, index]),
);

const DAY_INDEX = new Map<string, number>([
  ['sun', 0],
  ['sunday', 0],
  ['mon', 1],
  ['monday', 1],
  ['tue', 2],
  ['tues', 2],
  ['tuesday', 2],
  ['wed', 3],
  ['wednesday', 3],
  ['thu', 4],
  ['thur', 4],
  ['thurs', 4],
  ['thursday', 4],
  ['fri', 5],
  ['friday', 5],
  ['sat', 6],
  ['saturday', 6],
]);

function normalizeWebsiteUrl(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      return null;
    }

    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

function getCachedValue(cacheKey: string) {
  const cached = websiteHoursCache.get(cacheKey);
  if (!cached) {
    return null;
  }

  if (cached.expiresAt <= Date.now()) {
    websiteHoursCache.delete(cacheKey);
    return null;
  }

  return cached.value;
}

function setCachedValue(cacheKey: string, value: WebsiteHoursResult | null) {
  websiteHoursCache.set(cacheKey, {
    expiresAt: Date.now() + WEBSITE_HOURS_CACHE_TTL_MS,
    value,
  });
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#8211;|&#x2013;/gi, '–')
    .replace(/&#8212;|&#x2014;/gi, '—')
    .replace(/&#(\d+);/g, (_match, codePoint) => {
      const parsed = Number(codePoint);
      return Number.isFinite(parsed) ? String.fromCodePoint(parsed) : '';
    });
}

function stripHtmlToText(html: string) {
  return decodeHtmlEntities(
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<\/h[1-6]>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\r/g, '')
    .replace(/\t/g, ' ')
    .replace(/[ ]{2,}/g, ' ');
}

function normalizeTimeToken(value: string) {
  const match = value
    .trim()
    .replace(/\./g, '')
    .match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
  if (!match) {
    return null;
  }

  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2] ?? '0', 10);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || hours < 1 || hours > 12) {
    return null;
  }

  return `${hours}:${String(minutes).padStart(2, '0')} ${match[3].toUpperCase()}`;
}

function normalizeStructuredTimeToken(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  const twelveHour = normalizeTimeToken(trimmed.replace(/\s+/g, ''));
  if (twelveHour) {
    return twelveHour;
  }

  const match = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) {
    return null;
  }

  let hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || hours < 0 || hours > 23) {
    return null;
  }

  const period = hours >= 12 ? 'PM' : 'AM';
  if (hours === 0) {
    hours = 12;
  } else if (hours > 12) {
    hours -= 12;
  }

  return `${hours}:${String(minutes).padStart(2, '0')} ${period}`;
}

function splitDaySelector(value: string) {
  return value
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function resolveDayToken(token: string) {
  return DAY_INDEX.get(token.trim().toLowerCase()) ?? null;
}

function expandDaySelector(value: string) {
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (!trimmed) {
    return [];
  }

  const rangeMatch = trimmed.match(
    /^(sun(?:day)?|mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:rs|rsday|rday)?|fri(?:day)?|sat(?:urday)?)\s*[-–—]\s*(sun(?:day)?|mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:rs|rsday|rday)?|fri(?:day)?|sat(?:urday)?)$/i,
  );
  if (rangeMatch) {
    const startIndex = resolveDayToken(rangeMatch[1]);
    const endIndex = resolveDayToken(rangeMatch[2]);
    if (startIndex === null || endIndex === null) {
      return [];
    }

    const days: string[] = [];
    let current = startIndex;
    while (true) {
      days.push(DAY_NAMES[current]);
      if (current === endIndex) {
        break;
      }
      current = (current + 1) % 7;
    }
    return days;
  }

  return splitDaySelector(trimmed)
    .map(resolveDayToken)
    .filter((index): index is number => index !== null)
    .map((index) => DAY_NAMES[index]);
}

function parseHoursLine(line: string) {
  const normalized = line
    .replace(/[|]+/g, ' ')
    .replace(/\u2013|\u2014/g, '-')
    .replace(/\s+/g, ' ')
    .trim();

  const match = normalized.match(
    /^(?<days>(?:sun(?:day)?|mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:rs|rsday|rday)?|fri(?:day)?|sat(?:urday)?)(?:\s*(?:\/|-)\s*(?:sun(?:day)?|mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:rs|rsday|rday)?|fri(?:day)?|sat(?:urday)?))*)\s*:?\s*(?<hours>.+)$/i,
  );
  if (!match?.groups) {
    return [];
  }

  const days = expandDaySelector(match.groups.days);
  if (!days.length) {
    return [];
  }

  const rest = match.groups.hours.trim();
  if (/^closed$/i.test(rest)) {
    return days.map((day) => `${day}: Closed`);
  }

  const timeMatch = rest.match(
    /(?<open>\d{1,2}(?::\d{2})?\s*[ap]\.?m\.?)\s*[-–—]\s*(?<close>\d{1,2}(?::\d{2})?\s*[ap]\.?m\.?)/i,
  );
  if (!timeMatch?.groups) {
    return [];
  }

  const open = normalizeTimeToken(timeMatch.groups.open.replace(/\s+/g, ''));
  const close = normalizeTimeToken(timeMatch.groups.close.replace(/\s+/g, ''));
  if (!open || !close) {
    return [];
  }

  return days.map((day) => `${day}: ${open} - ${close}`);
}

function scoreSection(sectionLabel: string, lines: string[]) {
  const normalized = sectionLabel.toLowerCase();
  let score = lines.length;
  if (normalized.includes('store')) score += 4;
  if (normalized.includes('in-store')) score += 4;
  if (normalized.includes('hours')) score += 2;
  if (normalized.includes('visit')) score += 1;
  if (normalized.includes('drive')) score -= 6;
  if (normalized.includes('pickup')) score -= 4;
  if (normalized.includes('delivery')) score -= 4;
  if (lines.length >= 7) score += 3;
  return score;
}

function parseHoursFromPlainText(html: string) {
  const text = stripHtmlToText(html);
  const rawLines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const sections = new Map<string, string[]>();
  let currentSection = 'default';

  for (const line of rawLines) {
    const hasDayName =
      /(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sun|Mon|Tue|Wed|Thu|Fri|Sat)/i.test(
        line,
      );
    const hasTimeRange =
      /\d{1,2}(?::\d{2})?\s*[ap]\.?m\.?\s*[-–—]\s*\d{1,2}(?::\d{2})?\s*[ap]\.?m\.?/i.test(line);

    if (/hours|visit us/i.test(line) && !hasTimeRange) {
      currentSection = line;
      if (!sections.has(currentSection)) {
        sections.set(currentSection, []);
      }
      continue;
    }

    if (!hasDayName) {
      continue;
    }

    const parsed = parseHoursLine(line);
    if (!parsed.length) {
      continue;
    }

    const bucket = sections.get(currentSection) ?? [];
    bucket.push(...parsed);
    sections.set(currentSection, bucket);
  }

  const ranked = Array.from(sections.entries())
    .map(([section, lines]) => ({
      section,
      lines: Array.from(new Set(lines)),
      score: scoreSection(section, lines),
    }))
    .filter((entry) => entry.lines.length > 0)
    .sort((left, right) => right.score - left.score);

  return sortHoursLines(ranked[0]?.lines ?? []);
}

function normalizeJsonLdDay(value: string) {
  const match = value.match(/(?:schema\.org\/)?([A-Za-z]+)$/);
  if (!match) {
    return null;
  }

  const token = match[1].toLowerCase();
  const index = resolveDayToken(token);
  return index === null ? null : DAY_NAMES[index];
}

function parseJsonLdHours(html: string) {
  const scriptMatches = html.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );

  const results: string[] = [];
  for (const match of scriptMatches) {
    const rawJson = decodeHtmlEntities(match[1] ?? '').trim();
    if (!rawJson) {
      continue;
    }

    let payload: unknown;
    try {
      payload = JSON.parse(rawJson);
    } catch {
      continue;
    }

    const payloadGraph =
      typeof payload === 'object' && payload !== null
        ? (payload as { '@graph'?: unknown[] })['@graph']
        : null;
    const items = Array.isArray(payload)
      ? payload
      : Array.isArray(payloadGraph)
        ? payloadGraph
        : [payload];

    for (const item of items) {
      if (!item || typeof item !== 'object') {
        continue;
      }

      const record = item as {
        openingHours?: unknown;
        openingHoursSpecification?: unknown;
      };

      if (Array.isArray(record.openingHours)) {
        for (const entry of record.openingHours) {
          if (typeof entry !== 'string') {
            continue;
          }

          const parsed = parseHoursLine(entry);
          if (parsed.length) {
            results.push(...parsed);
          }
        }
      }

      const specs = Array.isArray(record.openingHoursSpecification)
        ? record.openingHoursSpecification
        : record.openingHoursSpecification
          ? [record.openingHoursSpecification]
          : [];
      for (const spec of specs) {
        if (!spec || typeof spec !== 'object') {
          continue;
        }

        const hoursSpec = spec as {
          dayOfWeek?: string | string[];
          opens?: string;
          closes?: string;
        };
        const rawDays = Array.isArray(hoursSpec.dayOfWeek)
          ? hoursSpec.dayOfWeek
          : hoursSpec.dayOfWeek
            ? [hoursSpec.dayOfWeek]
            : [];
        const days = rawDays
          .map(normalizeJsonLdDay)
          .filter((day): day is (typeof DAY_NAMES)[number] => day !== null);
        const open = normalizeStructuredTimeToken(hoursSpec.opens);
        const close = normalizeStructuredTimeToken(hoursSpec.closes);

        if (!days.length || !open || !close) {
          continue;
        }

        results.push(...days.map((day) => `${day}: ${open} - ${close}`));
      }
    }
  }

  return sortHoursLines(Array.from(new Set(results)));
}

function sortHoursLines(lines: string[]) {
  return lines.slice().sort((left, right) => {
    const leftDay = left.split(':', 1)[0]?.trim() ?? '';
    const rightDay = right.split(':', 1)[0]?.trim() ?? '';
    return (
      (DISPLAY_DAY_ORDER_INDEX.get(leftDay) ?? Number.MAX_SAFE_INTEGER) -
      (DISPLAY_DAY_ORDER_INDEX.get(rightDay) ?? Number.MAX_SAFE_INTEGER)
    );
  });
}

async function fetchWebsiteHours(url: string): Promise<WebsiteHoursResult | null> {
  const cacheKey = normalizeWebsiteUrl(url);
  if (!cacheKey) {
    return null;
  }

  const cached = getCachedValue(cacheKey);
  if (cached !== null) {
    return cached;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), WEBSITE_HOURS_TIMEOUT_MS);

  try {
    const response = await fetch(cacheKey, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
      signal: controller.signal,
    });

    if (!response.ok) {
      setCachedValue(cacheKey, null);
      return null;
    }

    const html = await response.text();
    const structuredHours = parseJsonLdHours(html);
    const textHours = parseHoursFromPlainText(html);
    const hours = structuredHours.length >= textHours.length ? structuredHours : textHours;

    const result = hours.length
      ? {
          hours,
          sourceUrl: cacheKey,
        }
      : null;
    setCachedValue(cacheKey, result);
    return result;
  } catch {
    setCachedValue(cacheKey, null);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function resolveWebsiteHoursFallback(
  source: StorefrontRecord,
  googleEnrichment: GooglePlacesEnrichment | null,
) {
  if (googleEnrichment?.hours?.length) {
    return googleEnrichment;
  }

  const officialOverride = getOfficialWebsiteHoursOverride(source.id);
  if (officialOverride?.hours.length) {
    return {
      phone: googleEnrichment?.phone ?? source.phone,
      website: officialOverride.sourceUrl,
      hours: officialOverride.hours,
      openNow: googleEnrichment?.openNow ?? computeOpenNowFromHours(officialOverride.hours),
      businessStatus: googleEnrichment?.businessStatus ?? null,
      location: googleEnrichment?.location ?? null,
      hoursSource: 'website' as const,
    } satisfies GooglePlacesEnrichment;
  }

  const websiteUrl = normalizeWebsiteUrl(googleEnrichment?.website ?? source.website);
  if (!websiteUrl) {
    return googleEnrichment;
  }

  const websiteHours = await fetchWebsiteHours(websiteUrl);
  if (!websiteHours?.hours.length) {
    return googleEnrichment;
  }

  return {
    phone: googleEnrichment?.phone ?? source.phone,
    website: googleEnrichment?.website ?? source.website,
    hours: websiteHours.hours,
    openNow: googleEnrichment?.openNow ?? computeOpenNowFromHours(websiteHours.hours),
    businessStatus: googleEnrichment?.businessStatus ?? null,
    location: googleEnrichment?.location ?? null,
    hoursSource: 'website' as const,
  } satisfies GooglePlacesEnrichment;
}

export function clearWebsiteHoursCacheForTests() {
  websiteHoursCache.clear();
}

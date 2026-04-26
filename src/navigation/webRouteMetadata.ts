import { Platform } from 'react-native';
import type { StorefrontSummary } from '../types/storefront';

const APP_ORIGIN = 'https://app.canopytrove.com';

type WebRouteMetadata = {
  title: string;
  description: string;
  robots: string;
  canonicalUrl: string;
};

type WebRouteContext = {
  name?: string;
  params?: Record<string, unknown> | undefined;
};

const INDEXABLE_ROUTE_METADATA: Record<
  string,
  Omit<WebRouteMetadata, 'canonicalUrl'> & { canonicalPath: string }
> = {
  '/': {
    title: 'Canopy Trove — Find Live Dispensaries Near You',
    description:
      'Find licensed dispensaries open now near you. Live hours, directions, hot deals, real reviews, and verified storefronts. Browse New York dispensaries instantly — no app download required.',
    robots: 'index, follow',
    canonicalPath: '/',
  },
  '/nearby': {
    title: 'Nearby Dispensaries Open Now | Canopy Trove',
    description:
      'Find licensed dispensaries open near you with live hours, directions, hot deals, and verified reviews across New York.',
    robots: 'index, follow',
    canonicalPath: '/nearby',
  },
  '/browse': {
    title: 'Browse Licensed Dispensaries in New York | Canopy Trove',
    description:
      'Browse verified New York dispensaries, compare storefront details, check hours, and find your next stop faster.',
    robots: 'index, follow',
    canonicalPath: '/browse',
  },
  '/hot-deals': {
    title: 'Hot Dispensary Deals in New York | Canopy Trove',
    description:
      'See live deals from licensed New York dispensaries, compare offers, and find nearby savings without leaving the web app.',
    robots: 'index, follow',
    canonicalPath: '/hot-deals',
  },
  '/verify': {
    title: 'Is This Dispensary Licensed? Verify with Canopy Trove',
    description:
      'Check whether a New York dispensary is licensed. Cross-check address, name, or license number against the OCM public registry — updated hourly.',
    robots: 'index, follow',
    canonicalPath: '/verify',
  },
};

function normalizePath(path?: string | null): string {
  if (!path) {
    return '/';
  }

  const withoutOrigin = path.replace(/^https?:\/\/[^/]+/i, '');
  const withoutQuery = withoutOrigin.split(/[?#]/, 1)[0] || '/';
  const withLeadingSlash = withoutQuery.startsWith('/') ? withoutQuery : `/${withoutQuery}`;
  const collapsed = withLeadingSlash.replace(/\/{2,}/g, '/');

  if (collapsed.length > 1 && collapsed.endsWith('/')) {
    return collapsed.slice(0, -1);
  }

  return collapsed;
}

function buildCanonicalUrl(path: string): string {
  if (path === '/') {
    return `${APP_ORIGIN}/`;
  }

  return `${APP_ORIGIN}${path.endsWith('/') ? path : `${path}/`}`;
}

function buildNoindexMetadata(path: string): WebRouteMetadata {
  let title = 'Canopy Trove';
  let description =
    'Find licensed dispensaries, live hours, hot deals, and real reviews across New York.';

  if (path.startsWith('/storefronts/')) {
    title = 'Storefront Details | Canopy Trove';
    description =
      'View dispensary details, directions, live hours, reviews, and nearby deals on Canopy Trove.';
  } else if (path.startsWith('/owner-portal')) {
    title = 'Owner Portal | Canopy Trove';
    description =
      'Manage your Canopy Trove storefront, reviews, offers, and profile details from the owner portal.';
  } else if (path === '/profile') {
    title = 'Profile | Canopy Trove';
    description =
      'Sign in to your Canopy Trove account to save storefronts, write reviews, and manage your profile.';
  } else if (path === '/legal' || path === '/account-deletion') {
    title = 'Canopy Trove Support';
    description =
      'Access account help, legal information, and support resources from Canopy Trove.';
  }

  return {
    title,
    description,
    robots: 'noindex, follow',
    canonicalUrl: buildCanonicalUrl(path),
  };
}

function isStorefrontSummary(value: unknown): value is StorefrontSummary {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as StorefrontSummary).id === 'string' &&
    typeof (value as StorefrontSummary).displayName === 'string' &&
    typeof (value as StorefrontSummary).city === 'string' &&
    typeof (value as StorefrontSummary).state === 'string'
  );
}

function buildStorefrontMetadata(path: string, routeContext?: WebRouteContext): WebRouteMetadata {
  const storefront = routeContext?.params?.storefront;
  const storefrontSummary = isStorefrontSummary(storefront) ? storefront : null;

  if (storefrontSummary) {
    const locationLabel = `${storefrontSummary.city}, ${storefrontSummary.state}`;
    return {
      title: `${storefrontSummary.displayName} in ${locationLabel} | Canopy Trove`,
      description:
        storefrontSummary.ownerCardSummary ??
        `View hours, directions, reviews, and verified storefront details for ${storefrontSummary.displayName} in ${locationLabel}.`,
      robots: 'index, follow',
      canonicalUrl: buildCanonicalUrl(path),
    };
  }

  return {
    title: 'Dispensary Storefront Details | Canopy Trove',
    description:
      'View verified dispensary hours, directions, reviews, and storefront details on Canopy Trove.',
    robots: 'index, follow',
    canonicalUrl: buildCanonicalUrl(path),
  };
}

export function getWebRouteMetadata(
  path?: string | null,
  routeContext?: WebRouteContext,
): WebRouteMetadata {
  const normalizedPath = normalizePath(path);
  const indexableMetadata = INDEXABLE_ROUTE_METADATA[normalizedPath];

  if (indexableMetadata) {
    return {
      title: indexableMetadata.title,
      description: indexableMetadata.description,
      robots: indexableMetadata.robots,
      canonicalUrl: buildCanonicalUrl(indexableMetadata.canonicalPath),
    };
  }

  if (normalizedPath.startsWith('/storefronts/')) {
    return buildStorefrontMetadata(normalizedPath, routeContext);
  }

  return buildNoindexMetadata(normalizedPath);
}

function setMetaAttribute(attribute: 'name' | 'property', key: string, value: string) {
  if (typeof document === 'undefined') {
    return;
  }

  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.setAttribute('content', value);
}

function setCanonicalLink(href: string) {
  if (typeof document === 'undefined') {
    return;
  }

  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', href);
}

export function syncWebRouteMetadata(path?: string | null, routeContext?: WebRouteContext) {
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    return;
  }

  const metadata = getWebRouteMetadata(path, routeContext);

  document.title = metadata.title;
  setMetaAttribute('name', 'title', metadata.title);
  setMetaAttribute('name', 'description', metadata.description);
  setMetaAttribute('name', 'robots', metadata.robots);
  setMetaAttribute('property', 'og:url', metadata.canonicalUrl);
  setMetaAttribute('property', 'og:title', metadata.title);
  setMetaAttribute('property', 'og:description', metadata.description);
  setMetaAttribute('property', 'twitter:url', metadata.canonicalUrl);
  setMetaAttribute('property', 'twitter:title', metadata.title);
  setMetaAttribute('property', 'twitter:description', metadata.description);
  setCanonicalLink(metadata.canonicalUrl);
}

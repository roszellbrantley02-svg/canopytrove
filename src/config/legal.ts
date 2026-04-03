function normalizeConfiguredValue(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

const supportEmail =
  normalizeConfiguredValue(process.env.EXPO_PUBLIC_SUPPORT_EMAIL) || 'support@canopytrove.com';

export const legalConfig = {
  supportEmail,
  supportEmailUrl: `mailto:${supportEmail}`,
  privacyPolicyUrl: normalizeConfiguredValue(process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL),
  termsUrl: normalizeConfiguredValue(process.env.EXPO_PUBLIC_TERMS_URL),
  communityGuidelinesUrl: normalizeConfiguredValue(
    process.env.EXPO_PUBLIC_COMMUNITY_GUIDELINES_URL,
  ),
  appWebsiteUrl: normalizeConfiguredValue(process.env.EXPO_PUBLIC_APP_WEBSITE_URL),
  accountDeletionHelpUrl: normalizeConfiguredValue(
    process.env.EXPO_PUBLIC_ACCOUNT_DELETION_HELP_URL,
  ),
} as const;

export const legalDocumentLinks = [
  {
    key: 'privacy',
    label: 'Privacy Policy',
    url: legalConfig.privacyPolicyUrl,
    envVar: 'EXPO_PUBLIC_PRIVACY_POLICY_URL',
    required: true,
  },
  {
    key: 'terms',
    label: 'Terms of Use',
    url: legalConfig.termsUrl,
    envVar: 'EXPO_PUBLIC_TERMS_URL',
    required: true,
  },
  {
    key: 'guidelines',
    label: 'Community Guidelines',
    url: legalConfig.communityGuidelinesUrl,
    envVar: 'EXPO_PUBLIC_COMMUNITY_GUIDELINES_URL',
    required: true,
  },
] as const;

export const legalSupportLinks = [
  {
    key: 'website',
    label: 'Canopy Trove™ website',
    url: legalConfig.appWebsiteUrl,
    envVar: 'EXPO_PUBLIC_APP_WEBSITE_URL',
  },
  {
    key: 'deletion-help',
    label: 'Account deletion help',
    url: legalConfig.accountDeletionHelpUrl ?? legalConfig.privacyPolicyUrl,
    envVar: 'EXPO_PUBLIC_ACCOUNT_DELETION_HELP_URL',
  },
] as const;

export const missingPublishedLegalLinks = legalDocumentLinks.filter((link) => !link.url);
export const hasPublishedLegalLinks = missingPublishedLegalLinks.length === 0;

export const legalReadinessText = hasPublishedLegalLinks
  ? 'All required public legal links are configured for store review.'
  : `Still missing public URLs for ${missingPublishedLegalLinks.map((link) => link.label).join(', ')}.`;

export const privacyPolicySections = [
  {
    title: 'What Canopy Trove collects',
    body: 'Canopy Trove stores the account and profile details needed to keep your saved storefronts, reviews, badges, and owner tools connected to your account.',
  },
  {
    title: 'Location use',
    body: 'Canopy Trove uses your foreground location to find nearby dispensaries, start navigation, and trigger the in-app arrival prompt when you reach a destination.',
  },
  {
    title: 'Reviews and reports',
    body: 'Reviews, helpful votes, storefront reports, and related reaction media are stored so Canopy Trove can power community features, quality signals, and moderation workflows. If member photo uploads are enabled later, those uploads will follow the same moderation path.',
  },
  {
    title: 'Notifications',
    body: 'If you allow notifications, Canopy Trove can send favorite-deal alerts and follow-up prompts tied to the storefronts you save or visit.',
  },
] as const;

export const communityGuidelines = [
  'Keep reviews truthful, firsthand, and specific to the storefront visit.',
  'Only upload photos or media you created or otherwise have the right to share when those uploads are available.',
  'Do not post threats, harassment, hate speech, sexual content, or illegal instructions.',
  'Do not impersonate staff, owners, or other Canopy Trove members.',
  'Do not spam ratings, duplicate reviews, or flood the report system.',
  'Respect privacy. Do not share personal phone numbers, license images, or medical information.',
  'Do not post copied ads, minors, faces without consent, or imagery showing cannabis consumption.',
] as const;

export const moderationPolicyNotes = [
  'Canopy Trove members can report storefront listing issues and flag abusive reviews directly from the storefront detail screen.',
  'Blocked review authors are hidden only on the current device and can be managed in Privacy and safety.',
  'Owner verification, storefront reports, and reported reviews move through a manual review workflow.',
  'Photo, copyright, trademark, and privacy complaints can be sent to support for manual review.',
  `Support and moderation questions can be sent to ${supportEmail}.`,
] as const;

export const locationDisclosureText =
  'Canopy Trove only uses in-use location permission to find nearby storefronts, guide navigation, and show the arrival follow-up prompt when you reach a store.';

export const accountDeletionDisclosureText =
  'Deleting your account removes your Canopy Trove profile data from this device and clears the linked profile data path used by the app backend. If account-login removal requires a recent sign-in, Canopy Trove will tell you so.';

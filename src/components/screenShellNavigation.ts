const OWNER_PORTAL_WORKSPACE_ROUTES = new Set([
  'OwnerPortalReviewInbox',
  'OwnerPortalPromotions',
  'OwnerPortalProfileTools',
  'OwnerPortalBusinessDetails',
  'OwnerPortalClaimListing',
  'OwnerPortalBusinessVerification',
  'OwnerPortalIdentityVerification',
  'OwnerPortalSubscription',
  'OwnerPortalBadges',
  'OwnerPortalHours',
]);

export function buildWebBackResetState(routeName: string) {
  const profileTabsRoute = { name: 'Tabs', params: { screen: 'Profile' } };
  const browseTabsRoute = { name: 'Tabs', params: { screen: 'Browse' } };

  if (routeName === 'OwnerPortalAccess') {
    return {
      index: 0,
      routes: [profileTabsRoute],
    };
  }

  if (
    routeName === 'OwnerPortalSignIn' ||
    routeName === 'OwnerPortalSignUp' ||
    routeName === 'OwnerPortalForgotPassword' ||
    routeName === 'OwnerPortalHome'
  ) {
    return {
      index: 1,
      routes: [profileTabsRoute, { name: 'OwnerPortalAccess' }],
    };
  }

  if (OWNER_PORTAL_WORKSPACE_ROUTES.has(routeName) || routeName.startsWith('OwnerPortal')) {
    return {
      index: 1,
      routes: [profileTabsRoute, { name: 'OwnerPortalHome' }],
    };
  }

  if (
    routeName === 'CanopyTroveSignIn' ||
    routeName === 'CanopyTroveSignUp' ||
    routeName === 'CanopyTroveForgotPassword' ||
    routeName === 'Settings' ||
    routeName === 'DeleteAccount' ||
    routeName === 'LegalCenter' ||
    routeName === 'SavedStorefronts' ||
    routeName === 'BadgeGallery' ||
    routeName === 'AdminRuntimePanel'
  ) {
    return {
      index: 0,
      routes: [profileTabsRoute],
    };
  }

  if (routeName === 'WriteReview' || routeName === 'ReportStorefront') {
    return {
      index: 0,
      routes: [browseTabsRoute],
    };
  }

  return {
    index: 0,
    routes: [{ name: 'Tabs' }],
  };
}

export function getWebBackLabel(routeName: string) {
  if (
    routeName === 'OwnerPortalAccess' ||
    routeName === 'OwnerPortalSignIn' ||
    routeName === 'OwnerPortalSignUp' ||
    routeName === 'OwnerPortalForgotPassword' ||
    routeName === 'OwnerPortalHome' ||
    OWNER_PORTAL_WORKSPACE_ROUTES.has(routeName) ||
    routeName.startsWith('OwnerPortal')
  ) {
    return 'Back to Profile';
  }

  if (routeName === 'WriteReview' || routeName === 'ReportStorefront') {
    return 'Back to Browse';
  }

  if (
    routeName === 'CanopyTroveSignIn' ||
    routeName === 'CanopyTroveSignUp' ||
    routeName === 'CanopyTroveForgotPassword' ||
    routeName === 'Settings' ||
    routeName === 'DeleteAccount' ||
    routeName === 'LegalCenter' ||
    routeName === 'SavedStorefronts' ||
    routeName === 'BadgeGallery' ||
    routeName === 'AdminRuntimePanel'
  ) {
    return 'Back to Profile';
  }

  return 'Back';
}

type ResolveStorefrontOpenNowArgs = {
  liveOpenNow?: boolean | null;
  summaryOpenNow?: boolean | null;
  detailOpenNow?: boolean | null;
};

export function resolveStorefrontOpenNow({
  liveOpenNow,
  summaryOpenNow,
  detailOpenNow,
}: ResolveStorefrontOpenNowArgs) {
  if (typeof liveOpenNow === 'boolean') {
    return liveOpenNow;
  }

  if (typeof summaryOpenNow === 'boolean') {
    return summaryOpenNow;
  }

  if (typeof detailOpenNow === 'boolean') {
    return detailOpenNow;
  }

  return null;
}

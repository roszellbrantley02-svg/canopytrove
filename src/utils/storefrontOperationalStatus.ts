import { computeOpenNow } from './storefrontOpenStatus';

type ResolveStorefrontOpenNowArgs = {
  hours?: string[] | null;
  liveOpenNow?: boolean | null;
  summaryOpenNow?: boolean | null;
  detailOpenNow?: boolean | null;
};

export function resolveStorefrontOpenNow({
  hours,
  liveOpenNow,
  summaryOpenNow,
  detailOpenNow,
}: ResolveStorefrontOpenNowArgs) {
  const computedFromHours = computeOpenNow(hours, null);
  if (typeof computedFromHours === 'boolean') {
    return computedFromHours;
  }

  if (typeof liveOpenNow === 'boolean') {
    return liveOpenNow;
  }

  if (typeof detailOpenNow === 'boolean') {
    return detailOpenNow;
  }

  if (typeof summaryOpenNow === 'boolean') {
    return summaryOpenNow;
  }

  return null;
}

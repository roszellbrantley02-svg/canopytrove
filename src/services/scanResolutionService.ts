import { storefrontApiBaseUrl } from '../config/storefrontSourceConfig';

/* ── Scan Resolution Types ── */

export type ScanIngestRequest = {
  rawCode: string;
  installId: string;
  profileId?: string;
  location?: { lat: number; lng: number; accuracyMeters?: number };
  nearStorefrontId?: string;
};

export type ScanResolutionResult = ScanLicenseResult | ScanProductResult | ScanUnknownResult;

/**
 * How confidently a license scan was matched to the OCM registry.
 */
export type LicenseVerificationState = 'verified' | 'unverified';

/**
 * Where a scanned product sits in our catalog.
 */
export type ProductCatalogState = 'verified' | 'unrecognized_lab' | 'uncatalogued';

export type ScanLicenseResult = {
  kind: 'license';
  license?: {
    licenseNumber: string;
    licenseType: string;
    licenseeName: string;
    status: string;
  };
  storefrontId?: string;
  verificationState?: LicenseVerificationState;
};

export type ScanProductResult = {
  kind: 'product';
  coa?: {
    brandName?: string;
    productName?: string;
    batchId?: string;
    upc?: string;
    labName?: string;
    thcPercent?: number;
    cbdPercent?: number;
    contaminants?: {
      pesticides?: 'pass' | 'fail';
      heavyMetals?: 'pass' | 'fail';
      microbial?: 'pass' | 'fail';
      solvents?: 'pass' | 'fail';
    };
    terpenes?: string[];
    coaUrl?: string;
    brandWebsiteUrl?: string;
  };
  suggestedShops?: Array<{
    storefrontId: string;
    name: string;
    distance?: number;
  }>;
  catalogState?: ProductCatalogState;
};

export type ScanUnknownResult = {
  kind: 'unknown';
  error?: string;
  reason?: string;
};

const REQUEST_TIMEOUT_MS = 15_000;
type NormalizedProductContaminants = NonNullable<
  NonNullable<ScanProductResult['coa']>['contaminants']
>;

function normalizeContaminantStatus(value: unknown): 'pass' | 'fail' | undefined {
  if (value === 'pass' || value === true) {
    return 'pass';
  }

  if (value === 'fail' || value === false) {
    return 'fail';
  }

  return undefined;
}

function normalizeProductContaminants(
  contaminants: unknown,
): NormalizedProductContaminants | undefined {
  if (!contaminants || typeof contaminants !== 'object') {
    return undefined;
  }

  const source = contaminants as Record<string, unknown>;
  const normalized = {
    pesticides: normalizeContaminantStatus(source.pesticides),
    heavyMetals: normalizeContaminantStatus(source.heavyMetals),
    microbial: normalizeContaminantStatus(source.microbial),
    solvents: normalizeContaminantStatus(source.solvents),
  };

  return Object.values(normalized).some((value) => value !== undefined) ? normalized : undefined;
}

function normalizeScanResolutionPayload(payload: unknown): ScanResolutionResult {
  if (!payload || typeof payload !== 'object') {
    return { kind: 'unknown', error: 'Invalid scan response' };
  }

  const candidate = payload as Partial<ScanResolutionResult> & {
    kind?: unknown;
    coa?: ScanProductResult['coa'];
  };

  if (candidate.kind === 'product') {
    const productResult = candidate as ScanProductResult;
    return {
      ...productResult,
      coa: productResult.coa
        ? {
            ...productResult.coa,
            contaminants: normalizeProductContaminants(productResult.coa.contaminants),
          }
        : productResult.coa,
    };
  }

  if (candidate.kind === 'license' || candidate.kind === 'unknown') {
    return candidate as ScanResolutionResult;
  }

  return { kind: 'unknown', error: 'Invalid scan response' };
}

function buildIngestUrl(): string | null {
  if (!storefrontApiBaseUrl) return null;
  const base = storefrontApiBaseUrl.endsWith('/')
    ? storefrontApiBaseUrl
    : `${storefrontApiBaseUrl}/`;
  return new URL('scans/ingest', base).toString();
}

function buildResolveProductUrl(code: string): string | null {
  if (!storefrontApiBaseUrl) return null;
  const base = storefrontApiBaseUrl.endsWith('/')
    ? storefrontApiBaseUrl
    : `${storefrontApiBaseUrl}/`;
  const url = new URL('products/resolve', base);
  url.searchParams.set('code', code);
  return url.toString();
}

export async function ingestScan(input: ScanIngestRequest): Promise<ScanResolutionResult> {
  const url = buildIngestUrl();
  if (!url) {
    return { kind: 'unknown', error: 'Scan service unavailable' };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(input),
      signal: controller.signal,
    });

    if (!response.ok) {
      return { kind: 'unknown', error: `Scan failed (${response.status})` };
    }

    const payload = await response.json();
    return normalizeScanResolutionPayload(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Scan request failed';
    return { kind: 'unknown', error: message };
  } finally {
    clearTimeout(timeoutId);
  }
}

export type CoaOpenedRequest = {
  installId: string;
  profileId?: string;
  brandId: string;
  labName: string;
  batchId?: string;
};

export async function reportCoaOpened(payload: CoaOpenedRequest): Promise<void> {
  const url = buildCoaOpenedUrl();
  if (!url) {
    return; // Fail-soft: silently continue if service unavailable
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    // Fire and forget: we don't care about response
  } catch (error) {
    // Fail-soft: log locally but don't throw
    console.warn(
      '[scanResolution] Failed to report COA opened:',
      error instanceof Error ? error.message : String(error),
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

function buildCoaOpenedUrl(): string | null {
  if (!storefrontApiBaseUrl) return null;
  const base = storefrontApiBaseUrl.endsWith('/')
    ? storefrontApiBaseUrl
    : `${storefrontApiBaseUrl}/`;
  return new URL('scans/coa-opened', base).toString();
}

export type ProductContributionInput = {
  rawCode: string;
  installId: string;
  brandName?: string;
  productName?: string;
  upc?: string;
  coaUrl?: string;
  notes?: string;
};

export type ProductContributionResult = {
  accepted: boolean;
  contributionId?: string;
  error?: string;
};

function buildContributeUrl(): string | null {
  if (!storefrontApiBaseUrl) return null;
  const base = storefrontApiBaseUrl.endsWith('/')
    ? storefrontApiBaseUrl
    : `${storefrontApiBaseUrl}/`;
  return new URL('products/contribute', base).toString();
}

/**
 * Submit a crowdsourced product contribution when a scan came back as
 * uncatalogued or unrecognized_lab. Fail-soft: never throws.
 */
export async function submitProductContribution(
  input: ProductContributionInput,
): Promise<ProductContributionResult> {
  const url = buildContributeUrl();
  if (!url) {
    return { accepted: false, error: 'Contribution service unavailable' };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(input),
      signal: controller.signal,
    });

    if (!response.ok) {
      return { accepted: false, error: `Contribution failed (${response.status})` };
    }

    const payload = (await response.json()) as ProductContributionResult;
    return payload;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Contribution request failed';
    return { accepted: false, error: message };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function resolveProduct(code: string): Promise<ScanResolutionResult> {
  const url = buildResolveProductUrl(code);
  if (!url) {
    return { kind: 'unknown', error: 'Scan service unavailable' };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });

    if (!response.ok) {
      return { kind: 'unknown', error: `Resolution failed (${response.status})` };
    }

    const payload = await response.json();
    return normalizeScanResolutionPayload(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Resolution request failed';
    return { kind: 'unknown', error: message };
  } finally {
    clearTimeout(timeoutId);
  }
}
